/**
 * Cel chunk parser (0x2005) and Cel Extra chunk parser (0x2006)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type {
  Cel,
  CelChunk,
  CelExtra,
  CelExtraChunk,
  CompressedImageCel,
  CompressedTilemapCel,
  LinkedCel,
  RawImageCel,
} from "../types.ts";
import { CelType, ChunkType } from "../types.ts";

/**
 * Parse a cel chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @param chunkEndOffset - Offset where chunk data ends
 * @returns Parsed cel chunk
 */
export function parseCelChunk(
  reader: BinaryReader,
  chunkEndOffset: number,
): CelChunk {
  const layerIndex = reader.u16();
  const x = reader.i16();
  const y = reader.i16();
  const opacity = reader.u8();
  const celType = reader.u16();
  const zIndex = reader.i16();

  // Reserved bytes
  reader.skip(5);

  let cel: Cel;

  switch (celType) {
    case CelType.RawImage: {
      const width = reader.u16();
      const height = reader.u16();
      const remainingBytes = chunkEndOffset - reader.offset;
      const bytes = reader.bytes(remainingBytes);

      cel = {
        type: CelType.RawImage,
        layerIndex,
        x,
        y,
        opacity,
        zIndex,
        width,
        height,
        data: {
          kind: "raw",
          bytes,
        },
      } as RawImageCel;
      break;
    }

    case CelType.Linked: {
      const linkedFrameIndex = reader.u16();

      cel = {
        type: CelType.Linked,
        layerIndex,
        x,
        y,
        opacity,
        zIndex,
        linkedFrameIndex,
      } as LinkedCel;
      break;
    }

    case CelType.CompressedImage: {
      const width = reader.u16();
      const height = reader.u16();
      const remainingBytes = chunkEndOffset - reader.offset;
      const bytes = reader.bytes(remainingBytes);

      cel = {
        type: CelType.CompressedImage,
        layerIndex,
        x,
        y,
        opacity,
        zIndex,
        width,
        height,
        data: {
          kind: "zlib",
          bytes,
        },
      } as CompressedImageCel;
      break;
    }

    case CelType.CompressedTilemap: {
      const width = reader.u16();
      const height = reader.u16();
      const bitsPerTile = reader.u16();
      const tileIdMask = reader.u32();
      const xFlipMask = reader.u32();
      const yFlipMask = reader.u32();
      const rotationMask = reader.u32();

      // Reserved bytes
      reader.skip(10);

      const remainingBytes = chunkEndOffset - reader.offset;
      const bytes = reader.bytes(remainingBytes);

      cel = {
        type: CelType.CompressedTilemap,
        layerIndex,
        x,
        y,
        opacity,
        zIndex,
        width,
        height,
        bitsPerTile,
        masks: {
          tileIdMask,
          xFlipMask,
          yFlipMask,
          rotationMask,
        },
        data: {
          kind: "zlib",
          bytes,
        },
      } as CompressedTilemapCel;
      break;
    }

    default:
      throw new Error(`Unknown cel type: ${celType}`);
  }

  return {
    type: ChunkType.Cel,
    cel,
  };
}

/**
 * Parse a cel extra chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed cel extra chunk
 */
export function parseCelExtraChunk(reader: BinaryReader): CelExtraChunk {
  const flags = reader.u32();
  const preciseX = reader.fixed16_16();
  const preciseY = reader.fixed16_16();
  const celWidth = reader.fixed16_16();
  const celHeight = reader.fixed16_16();

  const extra: CelExtra = {
    flags,
    preciseX,
    preciseY,
    celWidth,
    celHeight,
  };

  return {
    type: ChunkType.CelExtra,
    extra,
  };
}
