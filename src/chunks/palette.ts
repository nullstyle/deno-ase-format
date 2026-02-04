/**
 * Palette chunk parsers (0x2019 new palette, 0x0004/0x0011 old palette)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { OldPaletteChunk, Palette, PaletteChunk } from "../types.ts";
import { ChunkType } from "../types.ts";

/** Palette entry flags */
const PALETTE_ENTRY_HAS_NAME = 1;

/**
 * Parse a new palette chunk (0x2019).
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed palette chunk
 */
export function parsePaletteChunk(reader: BinaryReader): PaletteChunk {
  const size = reader.u32();
  const firstIndex = reader.u32();
  const lastIndex = reader.u32();

  // Reserved bytes
  reader.skip(8);

  const entries: Palette["entries"] = [];

  for (let i = firstIndex; i <= lastIndex; i++) {
    const entryFlags = reader.u16();
    const r = reader.u8();
    const g = reader.u8();
    const b = reader.u8();
    const a = reader.u8();

    let name: string | undefined;
    if (entryFlags & PALETTE_ENTRY_HAS_NAME) {
      name = reader.string();
    }

    entries.push({ r, g, b, a, name });
  }

  const palette: Palette = {
    size,
    firstIndex,
    lastIndex,
    entries,
  };

  return {
    type: ChunkType.Palette,
    palette,
  };
}

/**
 * Parse an old palette chunk (0x0004 or 0x0011).
 * @param reader - Binary reader positioned at start of chunk data
 * @param chunkType - The chunk type (0x0004 or 0x0011)
 * @returns Parsed old palette chunk
 */
export function parseOldPaletteChunk(
  reader: BinaryReader,
  chunkType: typeof ChunkType.OldPalette1 | typeof ChunkType.OldPalette2,
): OldPaletteChunk {
  const packetCount = reader.u16();
  const packets: OldPaletteChunk["packets"] = [];

  for (let i = 0; i < packetCount; i++) {
    const skipCount = reader.u8();
    let colorCount = reader.u8();

    // 0 means 256 colors
    if (colorCount === 0) {
      colorCount = 256;
    }

    const colors: Array<{ r: number; g: number; b: number }> = [];
    for (let j = 0; j < colorCount; j++) {
      const r = reader.u8();
      const g = reader.u8();
      const b = reader.u8();
      colors.push({ r, g, b });
    }

    packets.push({ skipCount, colors });
  }

  return {
    type: chunkType,
    packets,
  };
}
