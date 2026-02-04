/**
 * Cel pixel decoding utilities.
 * @module
 */

import type {
  AsepriteFile,
  Cel,
  CompressedImageCel,
  CompressedTilemapCel,
  CompressionProvider,
  DecodedCelPixels,
  DecodeOptions,
  RawImageCel,
} from "../types.ts";
import { AseErrorCode, AseFormatError, CelType } from "../types.ts";
import { getCompressionProvider } from "./zlib.ts";

/**
 * Decode pixel data from a cel.
 * @param file - The Aseprite file (needed for color depth)
 * @param cel - The cel to decode
 * @param opts - Decode options
 * @returns Decoded pixel data
 */
export async function decodeCelPixels(
  file: AsepriteFile,
  cel: Cel,
  opts?: DecodeOptions,
): Promise<DecodedCelPixels> {
  const compression = getCompressionProvider(opts?.compression);

  switch (cel.type) {
    case CelType.RawImage: {
      const rawCel = cel as RawImageCel;
      return {
        width: rawCel.width,
        height: rawCel.height,
        colorDepth: file.header.colorDepth,
        pixels: rawCel.data.bytes,
      };
    }

    case CelType.CompressedImage: {
      const compressedCel = cel as CompressedImageCel;

      // Check if already decoded
      if (compressedCel.data.decoded) {
        return {
          width: compressedCel.width,
          height: compressedCel.height,
          colorDepth: file.header.colorDepth,
          pixels: compressedCel.data.decoded,
        };
      }

      // Decompress
      try {
        const decoded = await compression.inflateZlib(compressedCel.data.bytes);
        compressedCel.data.decoded = decoded;

        return {
          width: compressedCel.width,
          height: compressedCel.height,
          colorDepth: file.header.colorDepth,
          pixels: decoded,
        };
      } catch (error) {
        throw new AseFormatError(
          `Failed to decompress cel: ${
            error instanceof Error ? error.message : String(error)
          }`,
          AseErrorCode.DECOMPRESSION_FAILED,
        );
      }
    }

    case CelType.Linked: {
      // Find the linked cel
      const linkedFrameIndex = cel.linkedFrameIndex;
      if (linkedFrameIndex < 0 || linkedFrameIndex >= file.frames.length) {
        throw new AseFormatError(
          `Invalid linked frame index: ${linkedFrameIndex}`,
          AseErrorCode.INVALID_LINKED_CEL,
        );
      }

      const linkedFrame = file.frames[linkedFrameIndex];
      const linkedCel = linkedFrame.cels.find(
        (c) => c.layerIndex === cel.layerIndex,
      );

      if (!linkedCel) {
        throw new AseFormatError(
          `Linked cel not found in frame ${linkedFrameIndex} for layer ${cel.layerIndex}`,
          AseErrorCode.INVALID_LINKED_CEL,
        );
      }

      // Recursively decode the linked cel
      return decodeCelPixels(file, linkedCel, opts);
    }

    case CelType.CompressedTilemap: {
      // For tilemap cels, we decode the tile indices, not pixels
      throw new AseFormatError(
        "Use decodeTilemap() for tilemap cels",
        AseErrorCode.INVALID_CEL_TYPE,
      );
    }

    default:
      throw new AseFormatError(
        `Unknown cel type: ${(cel as Cel).type}`,
        AseErrorCode.INVALID_CEL_TYPE,
      );
  }
}

/**
 * Decode tilemap data from a tilemap cel.
 * @param cel - The tilemap cel to decode
 * @param compression - Compression provider
 * @returns Decoded tilemap data
 */
export async function decodeTilemap(
  cel: CompressedTilemapCel,
  compression?: CompressionProvider,
): Promise<{
  width: number;
  height: number;
  tiles: Uint32Array;
  masks: CompressedTilemapCel["masks"];
}> {
  const provider = getCompressionProvider(compression);

  // Check if already decoded
  if (cel.decodedTiles) {
    return {
      width: cel.width,
      height: cel.height,
      tiles: cel.decodedTiles,
      masks: cel.masks,
    };
  }

  // Decompress tile data
  const decompressed = await provider.inflateZlib(cel.data.bytes);

  // Convert to Uint32Array based on bits per tile
  const tileCount = cel.width * cel.height;
  const tiles = new Uint32Array(tileCount);

  const bytesPerTile = cel.bitsPerTile / 8;
  const view = new DataView(
    decompressed.buffer,
    decompressed.byteOffset,
    decompressed.byteLength,
  );

  for (let i = 0; i < tileCount; i++) {
    const offset = i * bytesPerTile;
    switch (bytesPerTile) {
      case 1:
        tiles[i] = view.getUint8(offset);
        break;
      case 2:
        tiles[i] = view.getUint16(offset, true);
        break;
      case 4:
        tiles[i] = view.getUint32(offset, true);
        break;
      default:
        throw new Error(`Unsupported bits per tile: ${cel.bitsPerTile}`);
    }
  }

  cel.decodedTiles = tiles;

  return {
    width: cel.width,
    height: cel.height,
    tiles,
    masks: cel.masks,
  };
}

/**
 * Decode a single tile value using the tilemap masks.
 * @param value - Raw tile value
 * @param masks - Tilemap masks
 * @returns Decoded tile information
 */
export function decodeTile(
  value: number,
  masks: CompressedTilemapCel["masks"],
): {
  tileId: number;
  xFlip: boolean;
  yFlip: boolean;
  rotation: boolean;
} {
  return {
    tileId: value & masks.tileIdMask,
    xFlip: (value & masks.xFlipMask) !== 0,
    yFlip: (value & masks.yFlipMask) !== 0,
    rotation: (value & masks.rotationMask) !== 0,
  };
}

/**
 * Convert indexed or grayscale pixels to RGBA.
 * @param file - The Aseprite file
 * @param decoded - Decoded cel pixels
 * @returns RGBA pixel data
 */
export function convertToRgba(
  file: AsepriteFile,
  decoded: DecodedCelPixels,
): Uint8Array {
  const { width, height, colorDepth, pixels } = decoded;
  const pixelCount = width * height;
  const rgba = new Uint8Array(pixelCount * 4);

  switch (colorDepth) {
    case 32:
      // Already RGBA
      rgba.set(pixels);
      break;

    case 16:
      // Grayscale + Alpha (2 bytes per pixel)
      for (let i = 0; i < pixelCount; i++) {
        const gray = pixels[i * 2];
        const alpha = pixels[i * 2 + 1];
        rgba[i * 4] = gray;
        rgba[i * 4 + 1] = gray;
        rgba[i * 4 + 2] = gray;
        rgba[i * 4 + 3] = alpha;
      }
      break;

    case 8: {
      // Indexed (1 byte per pixel)
      const palette = file.palette;
      const transparentIndex = file.header.transparentIndex;

      for (let i = 0; i < pixelCount; i++) {
        const index = pixels[i];

        if (index === transparentIndex) {
          rgba[i * 4] = 0;
          rgba[i * 4 + 1] = 0;
          rgba[i * 4 + 2] = 0;
          rgba[i * 4 + 3] = 0;
        } else if (palette && palette.entries[index]) {
          const entry = palette.entries[index];
          rgba[i * 4] = entry.r;
          rgba[i * 4 + 1] = entry.g;
          rgba[i * 4 + 2] = entry.b;
          rgba[i * 4 + 3] = entry.a;
        } else {
          // Fallback for missing palette entry
          rgba[i * 4] = 0;
          rgba[i * 4 + 1] = 0;
          rgba[i * 4 + 2] = 0;
          rgba[i * 4 + 3] = 255;
        }
      }
      break;
    }
  }

  return rgba;
}

/**
 * Resolve a linked cel to its actual image cel.
 * @param file - The Aseprite file
 * @param cel - The cel to resolve
 * @returns The resolved cel (may be the same cel if not linked)
 */
export function resolveLinkedCel(file: AsepriteFile, cel: Cel): Cel {
  if (cel.type !== CelType.Linked) {
    return cel;
  }

  const linkedFrameIndex = cel.linkedFrameIndex;
  if (linkedFrameIndex < 0 || linkedFrameIndex >= file.frames.length) {
    throw new AseFormatError(
      `Invalid linked frame index: ${linkedFrameIndex}`,
      AseErrorCode.INVALID_LINKED_CEL,
    );
  }

  const linkedFrame = file.frames[linkedFrameIndex];
  const linkedCel = linkedFrame.cels.find(
    (c) => c.layerIndex === cel.layerIndex,
  );

  if (!linkedCel) {
    throw new AseFormatError(
      `Linked cel not found in frame ${linkedFrameIndex} for layer ${cel.layerIndex}`,
      AseErrorCode.INVALID_LINKED_CEL,
    );
  }

  // Recursively resolve in case of chained links
  return resolveLinkedCel(file, linkedCel);
}
