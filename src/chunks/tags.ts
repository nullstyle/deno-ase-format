/**
 * Tags chunk parser (0x2018)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { Tag, TagDirection, TagsChunk } from "../types.ts";
import { ChunkType } from "../types.ts";

/**
 * Parse a tags chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed tags chunk
 */
export function parseTagsChunk(reader: BinaryReader): TagsChunk {
  const tagCount = reader.u16();

  // Reserved bytes
  reader.skip(8);

  const tags: Tag[] = [];

  for (let i = 0; i < tagCount; i++) {
    const fromFrame = reader.u16();
    const toFrame = reader.u16();
    const direction = reader.u8() as TagDirection;
    const repeat = reader.u16();

    // Reserved bytes
    reader.skip(6);

    // Tag color (deprecated, but still present)
    const r = reader.u8();
    const g = reader.u8();
    const b = reader.u8();

    // Extra byte (always 0)
    reader.skip(1);

    const name = reader.string();

    tags.push({
      fromFrame,
      toFrame,
      direction,
      repeat,
      color: { r, g, b },
      name,
    });
  }

  return {
    type: ChunkType.Tags,
    tags,
  };
}
