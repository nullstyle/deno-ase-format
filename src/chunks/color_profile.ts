/**
 * Color profile chunk parser (0x2007)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type { ColorProfile, ColorProfileChunk } from "../types.ts";
import { ChunkType, ColorProfileType } from "../types.ts";

/** Color profile flags */
const COLOR_PROFILE_HAS_GAMMA = 1;

/**
 * Parse a color profile chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed color profile chunk
 */
export function parseColorProfileChunk(
  reader: BinaryReader,
): ColorProfileChunk {
  const type = reader.u16() as ColorProfileType;
  const flags = reader.u16();

  // Fixed gamma (always present, but only valid if flag is set)
  const gammaRaw = reader.fixed16_16();

  // Reserved bytes
  reader.skip(8);

  const profile: ColorProfile = {
    type,
    flags,
  };

  if (flags & COLOR_PROFILE_HAS_GAMMA) {
    profile.gamma = gammaRaw;
  }

  if (type === ColorProfileType.EmbeddedICC) {
    const iccLength = reader.u32();
    profile.iccData = reader.bytes(iccLength);
  }

  return {
    type: ChunkType.ColorProfile,
    profile,
  };
}
