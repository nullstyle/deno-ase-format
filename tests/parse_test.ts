/**
 * Parser tests using synthetic Aseprite file data.
 */

import { assertEquals, assertThrows } from "@std/assert";
import { BinaryWriter } from "../src/binary/writer.ts";
import { parseAseprite } from "../src/parse.ts";
import {
  ASE_FILE_MAGIC,
  ASE_FRAME_MAGIC,
  AseFormatError,
  ChunkType,
} from "../src/types.ts";

/**
 * Create a minimal valid Aseprite file header (exactly 128 bytes).
 */
function createHeader(options: {
  width?: number;
  height?: number;
  colorDepth?: number;
  frameCount?: number;
} = {}): Uint8Array {
  const width = options.width ?? 32;
  const height = options.height ?? 32;
  const colorDepth = options.colorDepth ?? 32;
  const frameCount = options.frameCount ?? 1;

  // Create exactly 128 bytes for the header
  const header = new Uint8Array(128);
  const view = new DataView(header.buffer);

  let offset = 0;

  // File size (will be patched later)
  view.setUint32(offset, 0, true);
  offset += 4;

  // Magic number
  view.setUint16(offset, ASE_FILE_MAGIC, true);
  offset += 2;

  // Frame count
  view.setUint16(offset, frameCount, true);
  offset += 2;

  // Width
  view.setUint16(offset, width, true);
  offset += 2;

  // Height
  view.setUint16(offset, height, true);
  offset += 2;

  // Color depth
  view.setUint16(offset, colorDepth, true);
  offset += 2;

  // Flags
  view.setUint32(offset, 1, true);
  offset += 4;

  // Speed (deprecated)
  view.setUint16(offset, 100, true);
  offset += 2;

  // Reserved (4 bytes)
  offset += 4;

  // Transparent index
  header[offset] = 0;
  offset += 1;

  // Ignored (3 bytes)
  offset += 3;

  // Color count
  view.setUint16(offset, 256, true);
  offset += 2;

  // Pixel width
  header[offset] = 1;
  offset += 1;

  // Pixel height
  header[offset] = 1;
  offset += 1;

  // Grid X
  view.setInt16(offset, 0, true);
  offset += 2;

  // Grid Y
  view.setInt16(offset, 0, true);
  offset += 2;

  // Grid width
  view.setUint16(offset, 16, true);
  offset += 2;

  // Grid height
  view.setUint16(offset, 16, true);
  offset += 2;

  // Reserved (84 bytes) - already zeros

  return header;
}

/**
 * Create a minimal frame with no chunks.
 */
function createEmptyFrame(durationMs = 100): Uint8Array {
  const frame = new Uint8Array(16);
  const view = new DataView(frame.buffer);

  view.setUint32(0, 16, true); // Frame size
  view.setUint16(4, ASE_FRAME_MAGIC, true); // Magic
  view.setUint16(6, 0, true); // Old chunk count
  view.setUint16(8, durationMs, true); // Duration
  // Reserved (2 bytes) - already zeros
  view.setUint32(12, 0, true); // New chunk count

  return frame;
}

/**
 * Create a layer chunk.
 */
function createLayerChunk(name: string, type = 0): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const dataWriter = new BinaryWriter();

  dataWriter.u16(1); // Flags (visible)
  dataWriter.u16(type); // Type
  dataWriter.u16(0); // Child level
  dataWriter.u16(0); // Default width
  dataWriter.u16(0); // Default height
  dataWriter.u16(0); // Blend mode
  dataWriter.u8(255); // Opacity
  dataWriter.zeros(3); // Reserved
  dataWriter.u16(nameBytes.length);
  dataWriter.bytes(nameBytes);

  const data = dataWriter.toUint8Array();
  const chunkWriter = new BinaryWriter();
  chunkWriter.u32(data.length + 6); // Chunk size
  chunkWriter.u16(ChunkType.Layer);
  chunkWriter.bytes(data);

  return chunkWriter.toUint8Array();
}

/**
 * Create a complete minimal Aseprite file.
 */
function createMinimalFile(): Uint8Array {
  const header = createHeader({ frameCount: 1 });
  const layerChunk = createLayerChunk("Layer 1");

  // Frame with one layer chunk
  const frameSize = 16 + layerChunk.length;
  const frame = new Uint8Array(frameSize);
  const frameView = new DataView(frame.buffer);

  frameView.setUint32(0, frameSize, true); // Frame size
  frameView.setUint16(4, ASE_FRAME_MAGIC, true); // Magic
  frameView.setUint16(6, 1, true); // Old chunk count
  frameView.setUint16(8, 100, true); // Duration
  // Reserved (2 bytes)
  frameView.setUint32(12, 1, true); // New chunk count
  frame.set(layerChunk, 16);

  // Combine header and frame
  const fileSize = 128 + frame.length;
  const file = new Uint8Array(fileSize);
  file.set(header, 0);
  file.set(frame, 128);

  // Patch file size
  const view = new DataView(file.buffer);
  view.setUint32(0, fileSize, true);

  return file;
}

Deno.test("parseAseprite - minimal file", () => {
  const bytes = createMinimalFile();
  const file = parseAseprite(bytes);

  assertEquals(file.header.width, 32);
  assertEquals(file.header.height, 32);
  assertEquals(file.header.colorDepth, 32);
  assertEquals(file.frames.length, 1);
  assertEquals(file.layers.length, 1);
  assertEquals(file.layers[0].name, "Layer 1");
});

Deno.test("parseAseprite - frame duration", () => {
  const bytes = createMinimalFile();
  const file = parseAseprite(bytes);

  assertEquals(file.frames[0].durationMs, 100);
});

Deno.test("parseAseprite - invalid magic throws in strict mode", () => {
  const bytes = createMinimalFile();
  // Corrupt the magic number
  bytes[4] = 0x00;
  bytes[5] = 0x00;

  assertThrows(
    () => parseAseprite(bytes, { strict: true }),
    AseFormatError,
    "Invalid file magic",
  );
});

Deno.test("parseAseprite - invalid magic allowed in non-strict mode", () => {
  const bytes = createMinimalFile();
  // Corrupt the magic number
  bytes[4] = 0x00;
  bytes[5] = 0x00;

  const file = parseAseprite(bytes, { strict: false });
  assertEquals(file.header.magic, 0);
});

Deno.test("parseAseprite - preserveChunks option", () => {
  const bytes = createMinimalFile();

  const fileWithChunks = parseAseprite(bytes, { preserveChunks: true });
  assertEquals(fileWithChunks.frames[0].chunks !== undefined, true);
  assertEquals(fileWithChunks.frames[0].chunks!.length, 1);

  const fileWithoutChunks = parseAseprite(bytes, { preserveChunks: false });
  assertEquals(fileWithoutChunks.frames[0].chunks, undefined);
});

Deno.test("parseAseprite - multiple layers", () => {
  const header = createHeader({ frameCount: 1 });
  const layer1 = createLayerChunk("Background");
  const layer2 = createLayerChunk("Foreground");

  const frameSize = 16 + layer1.length + layer2.length;
  const frame = new Uint8Array(frameSize);
  const frameView = new DataView(frame.buffer);

  frameView.setUint32(0, frameSize, true);
  frameView.setUint16(4, ASE_FRAME_MAGIC, true);
  frameView.setUint16(6, 2, true);
  frameView.setUint16(8, 100, true);
  frameView.setUint32(12, 2, true);
  frame.set(layer1, 16);
  frame.set(layer2, 16 + layer1.length);

  const fileSize = 128 + frame.length;
  const file = new Uint8Array(fileSize);
  file.set(header, 0);
  file.set(frame, 128);

  const view = new DataView(file.buffer);
  view.setUint32(0, fileSize, true);

  const parsed = parseAseprite(file);
  assertEquals(parsed.layers.length, 2);
  assertEquals(parsed.layers[0].name, "Background");
  assertEquals(parsed.layers[1].name, "Foreground");
});

Deno.test("parseAseprite - multiple frames", () => {
  const header = createHeader({ frameCount: 3 });
  const layer = createLayerChunk("Layer 1");

  // First frame with layer
  const frame1Size = 16 + layer.length;
  const frame1 = new Uint8Array(frame1Size);
  const frame1View = new DataView(frame1.buffer);
  frame1View.setUint32(0, frame1Size, true);
  frame1View.setUint16(4, ASE_FRAME_MAGIC, true);
  frame1View.setUint16(6, 1, true);
  frame1View.setUint16(8, 100, true);
  frame1View.setUint32(12, 1, true);
  frame1.set(layer, 16);

  // Empty frames
  const frame2 = createEmptyFrame(200);
  const frame3 = createEmptyFrame(150);

  const fileSize = 128 + frame1.length + frame2.length + frame3.length;
  const file = new Uint8Array(fileSize);
  file.set(header, 0);
  file.set(frame1, 128);
  file.set(frame2, 128 + frame1.length);
  file.set(frame3, 128 + frame1.length + frame2.length);

  const view = new DataView(file.buffer);
  view.setUint32(0, fileSize, true);

  const parsed = parseAseprite(file);
  assertEquals(parsed.frames.length, 3);
  assertEquals(parsed.frames[0].durationMs, 100);
  assertEquals(parsed.frames[1].durationMs, 200);
  assertEquals(parsed.frames[2].durationMs, 150);
});

Deno.test("parseAseprite - unknown chunk preserved", () => {
  const header = createHeader({ frameCount: 1 });

  // Create an unknown chunk type
  const unknownData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const unknownChunkWriter = new BinaryWriter();
  unknownChunkWriter.u32(unknownData.length + 6);
  unknownChunkWriter.u16(0x9999); // Unknown type
  unknownChunkWriter.bytes(unknownData);
  const unknownChunk = unknownChunkWriter.toUint8Array();

  const frameSize = 16 + unknownChunk.length;
  const frame = new Uint8Array(frameSize);
  const frameView = new DataView(frame.buffer);
  frameView.setUint32(0, frameSize, true);
  frameView.setUint16(4, ASE_FRAME_MAGIC, true);
  frameView.setUint16(6, 1, true);
  frameView.setUint16(8, 100, true);
  frameView.setUint32(12, 1, true);
  frame.set(unknownChunk, 16);

  const fileSize = 128 + frame.length;
  const file = new Uint8Array(fileSize);
  file.set(header, 0);
  file.set(frame, 128);

  const view = new DataView(file.buffer);
  view.setUint32(0, fileSize, true);

  const parsed = parseAseprite(file);
  assertEquals(parsed.unknownChunks !== undefined, true);
  assertEquals(parsed.unknownChunks!.length, 1);
  assertEquals(parsed.unknownChunks![0].type, 0x9999);
  assertEquals(parsed.unknownChunks![0].rawData, unknownData);
});

Deno.test("parseAseprite - color depths", () => {
  for (const colorDepth of [8, 16, 32]) {
    const header = createHeader({ colorDepth, frameCount: 1 });
    const frame = createEmptyFrame();

    const fileSize = 128 + frame.length;
    const file = new Uint8Array(fileSize);
    file.set(header, 0);
    file.set(frame, 128);

    const view = new DataView(file.buffer);
    view.setUint32(0, fileSize, true);

    const parsed = parseAseprite(file);
    assertEquals(parsed.header.colorDepth, colorDepth);
  }
});
