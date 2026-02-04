/**
 * Slice chunk parser (0x2022)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { Slice, SliceChunk, SliceKey } from "../types.ts";
import { ChunkType, SliceFlags } from "../types.ts";

/**
 * Parse a slice chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed slice chunk
 */
export function parseSliceChunk(reader: BinaryReader): SliceChunk {
  const keyCount = reader.u32();
  const flags = reader.u32();

  // Reserved
  reader.skip(4);

  const name = reader.string();

  const keys: SliceKey[] = [];

  for (let i = 0; i < keyCount; i++) {
    const frameIndex = reader.u32();
    const x = reader.i32();
    const y = reader.i32();
    const width = reader.u32();
    const height = reader.u32();

    const key: SliceKey = {
      frameIndex,
      x,
      y,
      width,
      height,
    };

    if (flags & SliceFlags.Has9Patch) {
      const centerX = reader.i32();
      const centerY = reader.i32();
      const centerWidth = reader.u32();
      const centerHeight = reader.u32();
      key.center = {
        x: centerX,
        y: centerY,
        width: centerWidth,
        height: centerHeight,
      };
    }

    if (flags & SliceFlags.HasPivot) {
      const pivotX = reader.i32();
      const pivotY = reader.i32();
      key.pivot = { x: pivotX, y: pivotY };
    }

    keys.push(key);
  }

  const slice: Slice = {
    name,
    flags,
    keys,
  };

  return {
    type: ChunkType.Slice,
    slice,
  };
}
