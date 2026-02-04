/**
 * Layer chunk parser (0x2004)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { BlendMode, Layer, LayerChunk } from "../types.ts";
import { ChunkType, LayerType } from "../types.ts";

/**
 * Parse a layer chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed layer chunk
 */
export function parseLayerChunk(reader: BinaryReader): LayerChunk {
  const flags = reader.u16();
  const type = reader.u16() as typeof LayerType[keyof typeof LayerType];
  const childLevel = reader.u16();
  const defaultWidth = reader.u16(); // Ignored
  const defaultHeight = reader.u16(); // Ignored
  const blendMode = reader.u16() as BlendMode;
  const opacity = reader.u8();

  // Reserved bytes
  reader.skip(3);

  const name = reader.string();

  let tilesetIndex: number | undefined;
  if (type === LayerType.Tilemap) {
    tilesetIndex = reader.u32();
  }

  const layer: Layer = {
    flags,
    type,
    childLevel,
    defaultWidth,
    defaultHeight,
    blendMode,
    opacity,
    name,
    tilesetIndex,
  };

  return {
    type: ChunkType.Layer,
    layer,
  };
}
