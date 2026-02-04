/**
 * Tileset chunk parser (0x2023)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { Tileset, TilesetChunk } from "../types.ts";
import { ChunkType, TilesetFlags } from "../types.ts";

/**
 * Parse a tileset chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed tileset chunk
 */
export function parseTilesetChunk(reader: BinaryReader): TilesetChunk {
  const id = reader.u32();
  const flags = reader.u32();
  const tileCount = reader.u32();
  const tileWidth = reader.u16();
  const tileHeight = reader.u16();
  const baseIndex = reader.i16();

  // Reserved bytes
  reader.skip(14);

  const name = reader.string();

  const tileset: Tileset = {
    id,
    flags,
    tileCount,
    tileWidth,
    tileHeight,
    baseIndex,
    name,
  };

  // External file link
  if (flags & TilesetFlags.IncludeLinkToExternal) {
    tileset.externalFileId = reader.u32();
    tileset.externalTilesetId = reader.u32();
  }

  // Tiles included in file
  if (flags & TilesetFlags.IncludeTilesInFile) {
    const compressedLength = reader.u32();
    tileset.compressedData = reader.bytes(compressedLength);
  }

  return {
    type: ChunkType.Tileset,
    tileset,
  };
}
