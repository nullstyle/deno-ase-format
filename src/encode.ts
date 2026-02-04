/**
 * Aseprite file encoder.
 * @module
 */

import { BinaryWriter } from "./binary/writer.ts";
import {
  encodeCelChunk,
  encodeCelExtraChunk,
  encodeColorProfileChunk,
  encodeExternalFilesChunk,
  encodeLayerChunk,
  encodePaletteChunk,
  encodeSliceChunk,
  encodeTagsChunk,
  encodeTilesetChunk,
  encodeUserDataChunk,
  wrapChunk,
} from "./chunks/encode.ts";
import type {
  AsepriteFile,
  Chunk,
  CompressionProvider,
  EncodeOptions,
  UnknownChunk,
} from "./types.ts";
import {
  ASE_FILE_MAGIC,
  ASE_FRAME_MAGIC,
  AseErrorCode,
  AseFormatError,
  ChunkType,
} from "./types.ts";
import { getCompressionProvider } from "./util/zlib.ts";

/** Default encode options */
const DEFAULT_OPTIONS: Required<EncodeOptions> = {
  mode: "chunks-if-present",
  writeLegacyPaletteChunks: false,
  compression: undefined as unknown as CompressionProvider,
};

/**
 * Encode the 128-byte file header.
 */
function encodeHeader(file: AsepriteFile, fileSize: number): Uint8Array {
  const writer = new BinaryWriter(128);
  const header = file.header;

  writer.u32(fileSize);
  writer.u16(ASE_FILE_MAGIC);
  writer.u16(header.frameCount);
  writer.u16(header.width);
  writer.u16(header.height);
  writer.u16(header.colorDepth);
  writer.u32(header.flags);
  writer.u16(header.speed);
  writer.zeros(4); // Reserved
  writer.u8(header.transparentIndex);
  writer.zeros(3); // Ignored
  writer.u16(header.colorCount);
  writer.u8(header.pixelWidth || 1);
  writer.u8(header.pixelHeight || 1);
  writer.i16(header.gridX);
  writer.i16(header.gridY);
  writer.u16(header.gridWidth || 16);
  writer.u16(header.gridHeight || 16);
  writer.zeros(84); // Reserved

  return writer.toUint8Array();
}

/**
 * Encode a frame header.
 */
function encodeFrameHeader(
  frameSize: number,
  chunkCount: number,
  durationMs: number,
): Uint8Array {
  const writer = new BinaryWriter(16);

  writer.u32(frameSize);
  writer.u16(ASE_FRAME_MAGIC);

  // Old chunk count (use 0xFFFF if > 0xFFFF)
  writer.u16(chunkCount > 0xfffe ? 0xffff : chunkCount);

  writer.u16(durationMs);
  writer.zeros(2); // Reserved

  // New chunk count
  writer.u32(chunkCount);

  return writer.toUint8Array();
}

/**
 * Encode a chunk from the preserved chunk list.
 */
async function encodeChunkFromPreserved(
  chunk: Chunk,
  compression: CompressionProvider,
): Promise<Uint8Array> {
  // If raw data is preserved, use it directly
  if ("rawData" in chunk && chunk.rawData) {
    return wrapChunk(chunk.type, chunk.rawData);
  }

  // Otherwise, re-encode based on chunk type
  switch (chunk.type) {
    case ChunkType.Layer: {
      const layerChunk = chunk as unknown as {
        layer: Parameters<typeof encodeLayerChunk>[0];
      };
      return wrapChunk(ChunkType.Layer, encodeLayerChunk(layerChunk.layer));
    }

    case ChunkType.Cel:
      return wrapChunk(
        ChunkType.Cel,
        await encodeCelChunk(
          (chunk as { cel: Parameters<typeof encodeCelChunk>[0] }).cel,
          compression,
        ),
      );

    case ChunkType.CelExtra:
      return wrapChunk(
        ChunkType.CelExtra,
        encodeCelExtraChunk(
          (chunk as { extra: Parameters<typeof encodeCelExtraChunk>[0] }).extra,
        ),
      );

    case ChunkType.Palette:
      return wrapChunk(
        ChunkType.Palette,
        encodePaletteChunk(
          (chunk as { palette: Parameters<typeof encodePaletteChunk>[0] })
            .palette,
        ),
      );

    case ChunkType.Tags:
      return wrapChunk(
        ChunkType.Tags,
        encodeTagsChunk(
          (chunk as { tags: Parameters<typeof encodeTagsChunk>[0] }).tags,
        ),
      );

    case ChunkType.UserData:
      return wrapChunk(
        ChunkType.UserData,
        encodeUserDataChunk(
          (chunk as { userData: Parameters<typeof encodeUserDataChunk>[0] })
            .userData,
        ),
      );

    case ChunkType.Slice:
      return wrapChunk(
        ChunkType.Slice,
        encodeSliceChunk(
          (chunk as { slice: Parameters<typeof encodeSliceChunk>[0] }).slice,
        ),
      );

    case ChunkType.Tileset:
      return wrapChunk(
        ChunkType.Tileset,
        encodeTilesetChunk(
          (chunk as { tileset: Parameters<typeof encodeTilesetChunk>[0] })
            .tileset,
        ),
      );

    case ChunkType.ColorProfile:
      return wrapChunk(
        ChunkType.ColorProfile,
        encodeColorProfileChunk(
          (chunk as { profile: Parameters<typeof encodeColorProfileChunk>[0] })
            .profile,
        ),
      );

    case ChunkType.ExternalFiles:
      return wrapChunk(
        ChunkType.ExternalFiles,
        encodeExternalFilesChunk(
          (chunk as { files: Parameters<typeof encodeExternalFilesChunk>[0] })
            .files,
        ),
      );

    default:
      // Unknown chunk - write raw data
      if ("rawData" in chunk) {
        return wrapChunk(chunk.type, (chunk as UnknownChunk).rawData);
      }
      throw new AseFormatError(
        `Cannot encode unknown chunk type without raw data: 0x${
          chunk.type.toString(16)
        }`,
        AseErrorCode.BAD_CHUNK_SIZE,
      );
  }
}

/**
 * Encode file in "chunks" mode (round-trip oriented).
 * Preserves exact chunk ordering from parsed file.
 */
async function encodeChunksMode(
  file: AsepriteFile,
  compression: CompressionProvider,
): Promise<Uint8Array> {
  const frameBuffers: Uint8Array[] = [];

  for (const frame of file.frames) {
    if (!frame.chunks) {
      throw new AseFormatError(
        "Chunks mode requires preserved chunks. Use canonical mode or parse with preserveChunks: true",
        AseErrorCode.BAD_CHUNK_SIZE,
      );
    }

    const chunkBuffers: Uint8Array[] = [];

    for (const chunk of frame.chunks) {
      const encoded = await encodeChunkFromPreserved(chunk, compression);
      chunkBuffers.push(encoded);
    }

    // Calculate frame size
    let chunksSize = 0;
    for (const buf of chunkBuffers) {
      chunksSize += buf.length;
    }
    const frameSize = 16 + chunksSize;

    // Build frame
    const frameHeader = encodeFrameHeader(
      frameSize,
      frame.chunks.length,
      frame.durationMs,
    );
    const frameBuffer = new Uint8Array(frameSize);
    frameBuffer.set(frameHeader, 0);

    let offset = 16;
    for (const buf of chunkBuffers) {
      frameBuffer.set(buf, offset);
      offset += buf.length;
    }

    frameBuffers.push(frameBuffer);
  }

  // Calculate total file size
  let framesSize = 0;
  for (const buf of frameBuffers) {
    framesSize += buf.length;
  }
  const fileSize = 128 + framesSize;

  // Build final file
  const header = encodeHeader(file, fileSize);
  const result = new Uint8Array(fileSize);
  result.set(header, 0);

  let offset = 128;
  for (const buf of frameBuffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

/**
 * Encode file in "canonical" mode (model oriented).
 * Emits normalized chunk ordering.
 */
async function encodeCanonicalMode(
  file: AsepriteFile,
  compression: CompressionProvider,
  _options: Required<EncodeOptions>,
): Promise<Uint8Array> {
  const frameBuffers: Uint8Array[] = [];

  for (let frameIdx = 0; frameIdx < file.frames.length; frameIdx++) {
    const frame = file.frames[frameIdx];
    const chunkBuffers: Uint8Array[] = [];

    // First frame: emit global chunks
    if (frameIdx === 0) {
      // Layers
      for (const layer of file.layers) {
        chunkBuffers.push(wrapChunk(ChunkType.Layer, encodeLayerChunk(layer)));

        // Layer user data
        if (layer.userData) {
          chunkBuffers.push(
            wrapChunk(ChunkType.UserData, encodeUserDataChunk(layer.userData)),
          );
        }
      }

      // Color profile
      if (file.colorProfile) {
        chunkBuffers.push(
          wrapChunk(
            ChunkType.ColorProfile,
            encodeColorProfileChunk(file.colorProfile),
          ),
        );
      }

      // External files
      if (file.externalFiles && file.externalFiles.length > 0) {
        chunkBuffers.push(
          wrapChunk(
            ChunkType.ExternalFiles,
            encodeExternalFilesChunk(file.externalFiles),
          ),
        );
      }

      // Palette
      if (file.palette) {
        chunkBuffers.push(
          wrapChunk(ChunkType.Palette, encodePaletteChunk(file.palette)),
        );
      }

      // Tags
      if (file.tags && file.tags.length > 0) {
        chunkBuffers.push(
          wrapChunk(ChunkType.Tags, encodeTagsChunk(file.tags)),
        );

        // Tag user data
        for (const tag of file.tags) {
          if (tag.userData) {
            chunkBuffers.push(
              wrapChunk(ChunkType.UserData, encodeUserDataChunk(tag.userData)),
            );
          }
        }
      }

      // Slices
      if (file.slices) {
        for (const slice of file.slices) {
          chunkBuffers.push(
            wrapChunk(ChunkType.Slice, encodeSliceChunk(slice)),
          );

          if (slice.userData) {
            chunkBuffers.push(
              wrapChunk(
                ChunkType.UserData,
                encodeUserDataChunk(slice.userData),
              ),
            );
          }
        }
      }

      // Tilesets
      if (file.tilesets) {
        for (const tileset of file.tilesets) {
          chunkBuffers.push(
            wrapChunk(ChunkType.Tileset, encodeTilesetChunk(tileset)),
          );

          if (tileset.userData) {
            chunkBuffers.push(
              wrapChunk(
                ChunkType.UserData,
                encodeUserDataChunk(tileset.userData),
              ),
            );
          }

          // Tile user data
          if (tileset.tileUserData) {
            for (const tileUd of tileset.tileUserData) {
              if (tileUd) {
                chunkBuffers.push(
                  wrapChunk(ChunkType.UserData, encodeUserDataChunk(tileUd)),
                );
              }
            }
          }
        }
      }

      // Sprite-level user data
      if (file.userData) {
        chunkBuffers.push(
          wrapChunk(ChunkType.UserData, encodeUserDataChunk(file.userData)),
        );
      }

      // Unknown chunks (preserved)
      if (file.unknownChunks) {
        for (const unknown of file.unknownChunks) {
          chunkBuffers.push(wrapChunk(unknown.type, unknown.rawData));
        }
      }
    }

    // Cels for this frame
    for (const cel of frame.cels) {
      const celData = await encodeCelChunk(cel, compression);
      chunkBuffers.push(wrapChunk(ChunkType.Cel, celData));

      // Cel extra
      if (cel.extra) {
        chunkBuffers.push(
          wrapChunk(ChunkType.CelExtra, encodeCelExtraChunk(cel.extra)),
        );
      }

      // Cel user data
      if (cel.userData) {
        chunkBuffers.push(
          wrapChunk(ChunkType.UserData, encodeUserDataChunk(cel.userData)),
        );
      }
    }

    // Calculate frame size
    let chunksSize = 0;
    for (const buf of chunkBuffers) {
      chunksSize += buf.length;
    }
    const frameSize = 16 + chunksSize;

    // Build frame
    const frameHeader = encodeFrameHeader(
      frameSize,
      chunkBuffers.length,
      frame.durationMs,
    );
    const frameBuffer = new Uint8Array(frameSize);
    frameBuffer.set(frameHeader, 0);

    let offset = 16;
    for (const buf of chunkBuffers) {
      frameBuffer.set(buf, offset);
      offset += buf.length;
    }

    frameBuffers.push(frameBuffer);
  }

  // Calculate total file size
  let framesSize = 0;
  for (const buf of frameBuffers) {
    framesSize += buf.length;
  }
  const fileSize = 128 + framesSize;

  // Build final file
  const header = encodeHeader(file, fileSize);
  const result = new Uint8Array(fileSize);
  result.set(header, 0);

  let offset = 128;
  for (const buf of frameBuffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}

/**
 * Encode an Aseprite file to bytes.
 * @param file - The Aseprite file structure
 * @param opts - Encode options
 * @returns Encoded file bytes
 */
export async function encodeAseprite(
  file: AsepriteFile,
  opts?: EncodeOptions,
): Promise<Uint8Array> {
  const options: Required<EncodeOptions> = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  const compression = getCompressionProvider(options.compression);

  // Determine mode
  let mode = options.mode;
  if (mode === "chunks-if-present") {
    // Check if first frame has chunks
    const hasChunks = file.frames.length > 0 &&
      file.frames[0].chunks !== undefined;
    mode = hasChunks ? "chunks" : "canonical";
  }

  if (mode === "chunks") {
    return await encodeChunksMode(file, compression);
  } else {
    return await encodeCanonicalMode(file, compression, options);
  }
}
