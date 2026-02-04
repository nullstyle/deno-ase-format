/**
 * External files chunk parser (0x2008)
 * @module
 */

import type { BinaryReader } from "../binary/reader.ts";
import type {
  ExternalFile,
  ExternalFilesChunk,
  ExternalFileType,
} from "../types.ts";
import { ChunkType } from "../types.ts";

/**
 * Parse an external files chunk.
 * @param reader - Binary reader positioned at start of chunk data
 * @returns Parsed external files chunk
 */
export function parseExternalFilesChunk(
  reader: BinaryReader,
): ExternalFilesChunk {
  const entryCount = reader.u32();

  // Reserved bytes
  reader.skip(8);

  const files: ExternalFile[] = [];

  for (let i = 0; i < entryCount; i++) {
    const id = reader.u32();
    const type = reader.u8() as ExternalFileType;

    // Reserved bytes
    reader.skip(7);

    const fileName = reader.string();

    files.push({
      id,
      type,
      fileName,
    });
  }

  return {
    type: ChunkType.ExternalFiles,
    files,
  };
}
