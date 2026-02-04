/**
 * Aseprite file parser.
 * @module
 */

import { BinaryReader } from "./binary/reader.ts";
import {
  parseCelChunk,
  parseCelExtraChunk,
  parseColorProfileChunk,
  parseExternalFilesChunk,
  parseLayerChunk,
  parseOldPaletteChunk,
  parsePaletteChunk,
  parseSliceChunk,
  parseTagsChunk,
  parseTilesetChunk,
  parseUserDataChunk,
} from "./chunks/mod.ts";
import type {
  AseHeader,
  AsepriteFile,
  Cel,
  CelChunk,
  Chunk,
  ColorProfile,
  ExternalFile,
  Frame,
  Layer,
  OldPaletteChunk,
  Palette,
  PaletteEntry,
  ParseOptions,
  Slice,
  Tag,
  Tileset,
  UnknownChunk,
  UserData,
} from "./types.ts";
import {
  ASE_FILE_MAGIC,
  ASE_FRAME_MAGIC,
  AseErrorCode,
  AseFormatError,
  ChunkType,
} from "./types.ts";

/** Default parse options */
const DEFAULT_OPTIONS: Required<ParseOptions> = {
  preserveChunks: true,
  preserveCompressed: true,
  decodeImages: false,
  strict: true,
};

/**
 * Parse context for tracking state during parsing.
 */
interface ParseContext {
  /** Last object that can receive user data */
  lastAttachTarget:
    | { kind: "layer"; layer: Layer }
    | { kind: "cel"; cel: Cel }
    | { kind: "slice"; slice: Slice }
    | { kind: "tileset"; tileset: Tileset }
    | { kind: "sprite" }
    | null;

  /** Pending tag user data (after Tags chunk) */
  pendingTagUserData: Tag[] | null;
  pendingTagUserDataIndex: number;

  /** Pending tileset user data */
  pendingTilesetUserData: {
    tileset: Tileset;
    phase: "tileset" | "tiles";
    tileIndex: number;
  } | null;

  /** Current frame index */
  frameIndex: number;

  /** Last cel for CelExtra attachment */
  lastCel: Cel | null;
}

/**
 * Parse the 128-byte Aseprite file header.
 */
function parseHeader(reader: BinaryReader, strict: boolean): AseHeader {
  const fileSize = reader.u32();
  const magic = reader.u16();

  if (strict && magic !== ASE_FILE_MAGIC) {
    throw new AseFormatError(
      `Invalid file magic: expected 0x${ASE_FILE_MAGIC.toString(16)}, got 0x${
        magic.toString(16)
      }`,
      AseErrorCode.BAD_MAGIC,
      { offset: 4 },
    );
  }

  const frameCount = reader.u16();
  const width = reader.u16();
  const height = reader.u16();
  const colorDepth = reader.u16() as 8 | 16 | 32;

  if (strict && ![8, 16, 32].includes(colorDepth)) {
    throw new AseFormatError(
      `Unsupported color depth: ${colorDepth}`,
      AseErrorCode.UNSUPPORTED_COLOR_DEPTH,
      { offset: 12 },
    );
  }

  const flags = reader.u32();
  const speed = reader.u16();

  // Reserved (should be 0) - two DWORDs
  reader.skip(4);
  reader.skip(4);

  const transparentIndex = reader.u8();

  // Ignored bytes
  reader.skip(3);

  const colorCount = reader.u16();
  const pixelWidth = reader.u8();
  const pixelHeight = reader.u8();
  const gridX = reader.i16();
  const gridY = reader.i16();
  const gridWidth = reader.u16();
  const gridHeight = reader.u16();

  // Reserved bytes to complete 128-byte header
  reader.skip(84);

  return {
    fileSize,
    magic,
    frameCount,
    width,
    height,
    colorDepth,
    flags,
    speed,
    transparentIndex,
    colorCount,
    pixelWidth,
    pixelHeight,
    gridX,
    gridY,
    gridWidth,
    gridHeight,
  };
}

/**
 * Dispatch chunk parsing based on chunk type.
 */
function parseChunk(
  reader: BinaryReader,
  chunkType: number,
  chunkEndOffset: number,
  ctx: ParseContext,
  _options: Required<ParseOptions>,
): Chunk {
  switch (chunkType) {
    case ChunkType.Layer: {
      const chunk = parseLayerChunk(reader);
      ctx.lastAttachTarget = { kind: "layer", layer: chunk.layer };
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.Cel: {
      const chunk = parseCelChunk(reader, chunkEndOffset);
      ctx.lastAttachTarget = { kind: "cel", cel: chunk.cel };
      ctx.lastCel = chunk.cel;
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.CelExtra: {
      const chunk = parseCelExtraChunk(reader);
      // Attach to last cel
      if (ctx.lastCel) {
        ctx.lastCel.extra = chunk.extra;
      }
      return chunk;
    }

    case ChunkType.Palette: {
      const chunk = parsePaletteChunk(reader);
      ctx.lastAttachTarget = null;
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.OldPalette1:
    case ChunkType.OldPalette2: {
      const chunk = parseOldPaletteChunk(reader, chunkType);
      ctx.lastAttachTarget = null;
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.Tags: {
      const chunk = parseTagsChunk(reader);
      // Set up pending tag user data
      ctx.pendingTagUserData = chunk.tags;
      ctx.pendingTagUserDataIndex = 0;
      ctx.lastAttachTarget = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.UserData: {
      const chunk = parseUserDataChunk(reader);

      // Attach user data based on context
      if (
        ctx.pendingTagUserData &&
        ctx.pendingTagUserDataIndex < ctx.pendingTagUserData.length
      ) {
        ctx.pendingTagUserData[ctx.pendingTagUserDataIndex].userData =
          chunk.userData;
        ctx.pendingTagUserDataIndex++;
      } else if (ctx.pendingTilesetUserData) {
        if (ctx.pendingTilesetUserData.phase === "tileset") {
          ctx.pendingTilesetUserData.tileset.userData = chunk.userData;
          ctx.pendingTilesetUserData.phase = "tiles";
          ctx.pendingTilesetUserData.tileIndex = 0;
        } else {
          if (!ctx.pendingTilesetUserData.tileset.tileUserData) {
            ctx.pendingTilesetUserData.tileset.tileUserData = [];
          }
          ctx.pendingTilesetUserData.tileset
            .tileUserData[ctx.pendingTilesetUserData.tileIndex] =
              chunk.userData;
          ctx.pendingTilesetUserData.tileIndex++;
        }
      } else if (ctx.lastAttachTarget) {
        switch (ctx.lastAttachTarget.kind) {
          case "layer":
            ctx.lastAttachTarget.layer.userData = chunk.userData;
            break;
          case "cel":
            ctx.lastAttachTarget.cel.userData = chunk.userData;
            break;
          case "slice":
            ctx.lastAttachTarget.slice.userData = chunk.userData;
            break;
          case "tileset":
            ctx.lastAttachTarget.tileset.userData = chunk.userData;
            break;
          case "sprite":
            // Will be handled at file level
            break;
        }
      }

      return chunk;
    }

    case ChunkType.Slice: {
      const chunk = parseSliceChunk(reader);
      ctx.lastAttachTarget = { kind: "slice", slice: chunk.slice };
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.Tileset: {
      const chunk = parseTilesetChunk(reader);
      ctx.lastAttachTarget = { kind: "tileset", tileset: chunk.tileset };
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = {
        tileset: chunk.tileset,
        phase: "tileset",
        tileIndex: 0,
      };
      return chunk;
    }

    case ChunkType.ColorProfile: {
      const chunk = parseColorProfileChunk(reader);
      ctx.lastAttachTarget = null;
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    case ChunkType.ExternalFiles: {
      const chunk = parseExternalFilesChunk(reader);
      ctx.lastAttachTarget = null;
      ctx.pendingTagUserData = null;
      ctx.pendingTilesetUserData = null;
      return chunk;
    }

    default: {
      // Unknown chunk - preserve raw data
      const dataLength = chunkEndOffset - reader.offset;
      const rawData = reader.bytes(dataLength);
      const unknown: UnknownChunk = {
        type: chunkType,
        rawData,
      };
      return unknown;
    }
  }
}

/**
 * Convert old palette format to new palette format.
 */
function convertOldPalette(oldChunks: OldPaletteChunk[]): Palette | undefined {
  if (oldChunks.length === 0) return undefined;

  const entries: PaletteEntry[] = [];
  let index = 0;

  for (const chunk of oldChunks) {
    for (const packet of chunk.packets) {
      index += packet.skipCount;
      for (const color of packet.colors) {
        entries[index] = {
          r: color.r,
          g: color.g,
          b: color.b,
          a: 255,
        };
        index++;
      }
    }
  }

  return {
    size: entries.length,
    firstIndex: 0,
    lastIndex: entries.length - 1,
    entries,
  };
}

/**
 * Parse an Aseprite file from bytes.
 * @param bytes - The file bytes
 * @param opts - Parse options
 * @returns Parsed Aseprite file structure
 */
export function parseAseprite(
  bytes: Uint8Array,
  opts?: ParseOptions,
): AsepriteFile {
  const options: Required<ParseOptions> = { ...DEFAULT_OPTIONS, ...opts };
  const reader = new BinaryReader(bytes);

  // Parse header
  const header = parseHeader(reader, options.strict);

  // Initialize result structures
  const frames: Frame[] = [];
  const layers: Layer[] = [];
  const tags: Tag[] = [];
  const slices: Slice[] = [];
  const tilesets: Tileset[] = [];
  const unknownChunks: UnknownChunk[] = [];
  const oldPaletteChunks: OldPaletteChunk[] = [];
  let palette: Palette | undefined;
  let colorProfile: ColorProfile | undefined;
  let externalFiles: ExternalFile[] | undefined;
  let spriteUserData: UserData | undefined;

  // Parse context
  const ctx: ParseContext = {
    lastAttachTarget: null,
    pendingTagUserData: null,
    pendingTagUserDataIndex: 0,
    pendingTilesetUserData: null,
    frameIndex: 0,
    lastCel: null,
  };

  // Parse frames
  for (let frameIdx = 0; frameIdx < header.frameCount; frameIdx++) {
    ctx.frameIndex = frameIdx;
    ctx.lastCel = null;

    const frameStartOffset = reader.offset;
    const frameSize = reader.u32();
    const frameMagic = reader.u16();

    if (options.strict && frameMagic !== ASE_FRAME_MAGIC) {
      throw new AseFormatError(
        `Invalid frame magic at frame ${frameIdx}: expected 0x${
          ASE_FRAME_MAGIC.toString(16)
        }, got 0x${frameMagic.toString(16)}`,
        AseErrorCode.BAD_MAGIC,
        { offset: frameStartOffset + 4, frameIndex: frameIdx },
      );
    }

    const oldChunkCount = reader.u16();
    let durationMs = reader.u16();

    // Reserved bytes
    reader.skip(2);

    const newChunkCount = reader.u32();

    // Determine actual chunk count
    let chunkCount: number;
    if (newChunkCount === 0) {
      chunkCount = oldChunkCount;
    } else if (oldChunkCount === 0xffff) {
      chunkCount = newChunkCount;
    } else {
      chunkCount = oldChunkCount;
    }

    // Apply deprecated speed if duration is 0
    if (durationMs === 0) {
      durationMs = header.speed;
    }

    const cels: Cel[] = [];
    const chunks: Chunk[] = [];

    // Parse chunks
    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const chunkStartOffset = reader.offset;
      const chunkSize = reader.u32();
      const chunkType = reader.u16();
      const chunkEndOffset = chunkStartOffset + chunkSize;

      if (options.strict && chunkEndOffset > bytes.length) {
        throw new AseFormatError(
          `Chunk size exceeds file bounds at frame ${frameIdx}, chunk ${chunkIdx}`,
          AseErrorCode.BAD_CHUNK_SIZE,
          { offset: chunkStartOffset, frameIndex: frameIdx, chunkType },
        );
      }

      const chunk = parseChunk(reader, chunkType, chunkEndOffset, ctx, options);

      // Collect parsed data
      if (chunk.type === ChunkType.Layer) {
        layers.push((chunk as { layer: Layer }).layer);
      } else if (chunk.type === ChunkType.Cel) {
        cels.push((chunk as CelChunk).cel);
      } else if (chunk.type === ChunkType.Palette) {
        palette = (chunk as { palette: Palette }).palette;
      } else if (
        chunk.type === ChunkType.OldPalette1 ||
        chunk.type === ChunkType.OldPalette2
      ) {
        oldPaletteChunks.push(chunk as OldPaletteChunk);
      } else if (chunk.type === ChunkType.Tags) {
        tags.push(...(chunk as { tags: Tag[] }).tags);
      } else if (chunk.type === ChunkType.Slice) {
        slices.push((chunk as { slice: Slice }).slice);
      } else if (chunk.type === ChunkType.Tileset) {
        tilesets.push((chunk as { tileset: Tileset }).tileset);
      } else if (chunk.type === ChunkType.ColorProfile) {
        colorProfile = (chunk as { profile: ColorProfile }).profile;
      } else if (chunk.type === ChunkType.ExternalFiles) {
        externalFiles = (chunk as { files: ExternalFile[] }).files;
      } else if (chunk.type === ChunkType.UserData) {
        // Check if this is sprite-level user data (first frame, before any other attachable object)
        if (frameIdx === 0 && ctx.lastAttachTarget?.kind === "sprite") {
          spriteUserData = (chunk as { userData: UserData }).userData;
        }
      } else if (!Object.values(ChunkType).includes(chunk.type as ChunkType)) {
        unknownChunks.push(chunk as UnknownChunk);
      }

      if (options.preserveChunks) {
        chunks.push(chunk);
      }

      // Ensure we're at the correct position for the next chunk
      reader.seek(chunkEndOffset);
    }

    const frame: Frame = {
      durationMs,
      cels,
    };

    if (options.preserveChunks) {
      frame.chunks = chunks;
    }

    frames.push(frame);

    // Ensure we're at the correct position for the next frame
    reader.seek(frameStartOffset + frameSize);
  }

  // Convert old palette if no new palette was found
  if (!palette && oldPaletteChunks.length > 0) {
    palette = convertOldPalette(oldPaletteChunks);
  }

  const result: AsepriteFile = {
    header,
    frames,
    layers,
  };

  if (tags.length > 0) result.tags = tags;
  if (slices.length > 0) result.slices = slices;
  if (palette) result.palette = palette;
  if (tilesets.length > 0) result.tilesets = tilesets;
  if (colorProfile) result.colorProfile = colorProfile;
  if (externalFiles) result.externalFiles = externalFiles;
  if (spriteUserData) result.userData = spriteUserData;
  if (unknownChunks.length > 0) result.unknownChunks = unknownChunks;

  return result;
}
