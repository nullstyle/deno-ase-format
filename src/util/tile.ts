/**
 * Tile and tileset utilities.
 * @module
 */

import type {
  AsepriteFile,
  CompressedTilemapCel,
  CompressionProvider,
  Tileset,
} from "../types.ts";
import { AseErrorCode, AseFormatError } from "../types.ts";
import { getCompressionProvider } from "./zlib.ts";

/**
 * Decoded tile information.
 */
export interface DecodedTile {
  /** Tile ID (index into tileset) */
  tileId: number;
  /** Horizontal flip */
  xFlip: boolean;
  /** Vertical flip */
  yFlip: boolean;
  /** 90-degree clockwise rotation */
  rotation: boolean;
}

/**
 * Decode a single tile value using the tilemap masks.
 *
 * @param value - Raw tile value from tilemap
 * @param masks - Tilemap masks
 * @returns Decoded tile information
 */
export function decodeTileValue(
  value: number,
  masks: CompressedTilemapCel["masks"],
): DecodedTile {
  return {
    tileId: value & masks.tileIdMask,
    xFlip: (value & masks.xFlipMask) !== 0,
    yFlip: (value & masks.yFlipMask) !== 0,
    rotation: (value & masks.rotationMask) !== 0,
  };
}

/**
 * Encode tile information back to a raw value.
 *
 * @param tile - Decoded tile information
 * @param masks - Tilemap masks
 * @returns Raw tile value
 */
export function encodeTileValue(
  tile: DecodedTile,
  masks: CompressedTilemapCel["masks"],
): number {
  let value = tile.tileId & masks.tileIdMask;
  if (tile.xFlip) value |= masks.xFlipMask;
  if (tile.yFlip) value |= masks.yFlipMask;
  if (tile.rotation) value |= masks.rotationMask;
  return value;
}

/**
 * Get a tileset by ID.
 *
 * @param file - The Aseprite file
 * @param tilesetId - Tileset ID
 * @returns Tileset or undefined
 */
export function getTilesetById(
  file: AsepriteFile,
  tilesetId: number,
): Tileset | undefined {
  if (!file.tilesets) return undefined;
  return file.tilesets.find((t) => t.id === tilesetId);
}

/**
 * Get a tileset by name.
 *
 * @param file - The Aseprite file
 * @param name - Tileset name
 * @returns Tileset or undefined
 */
export function getTilesetByName(
  file: AsepriteFile,
  name: string,
): Tileset | undefined {
  if (!file.tilesets) return undefined;
  return file.tilesets.find((t) => t.name === name);
}

/**
 * Decode tileset pixel data.
 *
 * @param tileset - The tileset to decode
 * @param compression - Compression provider
 * @returns Decoded pixel data
 */
export async function decodeTilesetPixels(
  tileset: Tileset,
  compression?: CompressionProvider,
): Promise<Uint8Array> {
  // Check if already decoded
  if (tileset.decodedPixels) {
    return tileset.decodedPixels;
  }

  if (!tileset.compressedData) {
    throw new AseFormatError(
      `Tileset "${tileset.name}" has no tile data`,
      AseErrorCode.MISSING_TILESET,
    );
  }

  const provider = getCompressionProvider(compression);
  const decoded = await provider.inflateZlib(tileset.compressedData);
  tileset.decodedPixels = decoded;

  return decoded;
}

/**
 * Get pixel data for a single tile from a tileset.
 *
 * @param tileset - The tileset
 * @param tileIndex - Tile index (0-based, accounting for baseIndex)
 * @param colorDepth - Color depth (8, 16, or 32)
 * @returns Pixel data for the tile
 */
export function getTilePixels(
  tileset: Tileset,
  tileIndex: number,
  colorDepth: 8 | 16 | 32,
): Uint8Array {
  if (!tileset.decodedPixels) {
    throw new AseFormatError(
      `Tileset "${tileset.name}" pixels not decoded. Call decodeTilesetPixels first.`,
      AseErrorCode.MISSING_TILESET,
    );
  }

  const bytesPerPixel = colorDepth / 8;
  const tilePixelCount = tileset.tileWidth * tileset.tileHeight;
  const tileBytesSize = tilePixelCount * bytesPerPixel;

  // Account for base index
  const adjustedIndex = tileIndex - tileset.baseIndex;
  if (adjustedIndex < 0 || adjustedIndex >= tileset.tileCount) {
    throw new AseFormatError(
      `Tile index ${tileIndex} out of range for tileset "${tileset.name}"`,
      AseErrorCode.OUT_OF_BOUNDS,
    );
  }

  const offset = adjustedIndex * tileBytesSize;
  return tileset.decodedPixels.subarray(offset, offset + tileBytesSize);
}

/**
 * Apply tile transformations (flip/rotate) to pixel data.
 *
 * @param pixels - Source pixel data
 * @param width - Tile width
 * @param height - Tile height
 * @param bytesPerPixel - Bytes per pixel (1, 2, or 4)
 * @param tile - Tile transformation info
 * @returns Transformed pixel data
 */
export function applyTileTransform(
  pixels: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
  tile: DecodedTile,
): Uint8Array {
  if (!tile.xFlip && !tile.yFlip && !tile.rotation) {
    return pixels;
  }

  const result = new Uint8Array(pixels.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let srcX = x;
      let srcY = y;

      // Apply rotation first (90 degrees clockwise)
      if (tile.rotation) {
        const newX = height - 1 - srcY;
        const newY = srcX;
        srcX = newX;
        srcY = newY;
      }

      // Apply flips
      if (tile.xFlip) {
        srcX = width - 1 - srcX;
      }
      if (tile.yFlip) {
        srcY = height - 1 - srcY;
      }

      const srcOffset = (srcY * width + srcX) * bytesPerPixel;
      const dstOffset = (y * width + x) * bytesPerPixel;

      for (let b = 0; b < bytesPerPixel; b++) {
        result[dstOffset + b] = pixels[srcOffset + b];
      }
    }
  }

  return result;
}
