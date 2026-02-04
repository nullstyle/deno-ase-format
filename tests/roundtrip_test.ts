/**
 * Round-trip tests for parse/encode cycle.
 */

import { assertEquals } from "@std/assert";
import { BinaryWriter } from "../src/binary/writer.ts";
import { encodeAseprite } from "../src/encode.ts";
import { parseAseprite } from "../src/parse.ts";
import { ASE_FILE_MAGIC, ASE_FRAME_MAGIC, ChunkType } from "../src/types.ts";

/**
 * Create a minimal valid Aseprite file with a layer and cel.
 */
function createTestFile(): Uint8Array {
  const width = 16;
  const height = 16;
  const colorDepth = 32;

  // Create exactly 128 bytes for the header
  const header = new Uint8Array(128);
  const headerView = new DataView(header.buffer);

  let offset = 0;
  headerView.setUint32(offset, 0, true); // File size (placeholder)
  offset += 4;
  headerView.setUint16(offset, ASE_FILE_MAGIC, true);
  offset += 2;
  headerView.setUint16(offset, 2, true); // 2 frames
  offset += 2;
  headerView.setUint16(offset, width, true);
  offset += 2;
  headerView.setUint16(offset, height, true);
  offset += 2;
  headerView.setUint16(offset, colorDepth, true);
  offset += 2;
  headerView.setUint32(offset, 1, true); // Flags
  offset += 4;
  headerView.setUint16(offset, 100, true); // Speed
  offset += 2;
  // Reserved (4 bytes)
  offset += 4;
  header[offset] = 0; // Transparent index
  offset += 1;
  // Ignored (3 bytes)
  offset += 3;
  headerView.setUint16(offset, 256, true); // Color count
  offset += 2;
  header[offset] = 1; // Pixel width
  offset += 1;
  header[offset] = 1; // Pixel height
  offset += 1;
  headerView.setInt16(offset, 0, true); // Grid X
  offset += 2;
  headerView.setInt16(offset, 0, true); // Grid Y
  offset += 2;
  headerView.setUint16(offset, 16, true); // Grid width
  offset += 2;
  headerView.setUint16(offset, 16, true); // Grid height
  // Rest is reserved (84 bytes) - already zeros

  // Create layer chunk
  const layerDataWriter = new BinaryWriter();
  layerDataWriter.u16(1); // Flags
  layerDataWriter.u16(0); // Type
  layerDataWriter.u16(0); // Child level
  layerDataWriter.u16(0);
  layerDataWriter.u16(0);
  layerDataWriter.u16(0); // Blend mode
  layerDataWriter.u8(255); // Opacity
  layerDataWriter.zeros(3);
  layerDataWriter.string("Test Layer");
  const layerData = layerDataWriter.toUint8Array();

  const layerChunkWriter = new BinaryWriter();
  layerChunkWriter.u32(layerData.length + 6);
  layerChunkWriter.u16(ChunkType.Layer);
  layerChunkWriter.bytes(layerData);
  const layerChunk = layerChunkWriter.toUint8Array();

  // Create raw cel chunk (4x4 red square)
  const celPixels = new Uint8Array(4 * 4 * 4); // 4x4 RGBA
  for (let i = 0; i < 16; i++) {
    celPixels[i * 4] = 255; // R
    celPixels[i * 4 + 1] = 0; // G
    celPixels[i * 4 + 2] = 0; // B
    celPixels[i * 4 + 3] = 255; // A
  }

  const celDataWriter = new BinaryWriter();
  celDataWriter.u16(0); // Layer index
  celDataWriter.i16(0); // X
  celDataWriter.i16(0); // Y
  celDataWriter.u8(255); // Opacity
  celDataWriter.u16(0); // Type (raw)
  celDataWriter.i16(0); // Z-index
  celDataWriter.zeros(5);
  celDataWriter.u16(4); // Width
  celDataWriter.u16(4); // Height
  celDataWriter.bytes(celPixels);
  const celData = celDataWriter.toUint8Array();

  const celChunkWriter = new BinaryWriter();
  celChunkWriter.u32(celData.length + 6);
  celChunkWriter.u16(ChunkType.Cel);
  celChunkWriter.bytes(celData);
  const celChunk = celChunkWriter.toUint8Array();

  // Frame 1: layer + cel
  const frame1Size = 16 + layerChunk.length + celChunk.length;
  const frame1 = new Uint8Array(frame1Size);
  const frame1View = new DataView(frame1.buffer);
  frame1View.setUint32(0, frame1Size, true);
  frame1View.setUint16(4, ASE_FRAME_MAGIC, true);
  frame1View.setUint16(6, 2, true);
  frame1View.setUint16(8, 100, true);
  frame1View.setUint32(12, 2, true);
  frame1.set(layerChunk, 16);
  frame1.set(celChunk, 16 + layerChunk.length);

  // Frame 2: linked cel
  const linkedCelDataWriter = new BinaryWriter();
  linkedCelDataWriter.u16(0); // Layer index
  linkedCelDataWriter.i16(0); // X
  linkedCelDataWriter.i16(0); // Y
  linkedCelDataWriter.u8(255); // Opacity
  linkedCelDataWriter.u16(1); // Type (linked)
  linkedCelDataWriter.i16(0); // Z-index
  linkedCelDataWriter.zeros(5);
  linkedCelDataWriter.u16(0); // Linked frame index
  const linkedCelData = linkedCelDataWriter.toUint8Array();

  const linkedCelChunkWriter = new BinaryWriter();
  linkedCelChunkWriter.u32(linkedCelData.length + 6);
  linkedCelChunkWriter.u16(ChunkType.Cel);
  linkedCelChunkWriter.bytes(linkedCelData);
  const linkedCelChunk = linkedCelChunkWriter.toUint8Array();

  const frame2Size = 16 + linkedCelChunk.length;
  const frame2 = new Uint8Array(frame2Size);
  const frame2View = new DataView(frame2.buffer);
  frame2View.setUint32(0, frame2Size, true);
  frame2View.setUint16(4, ASE_FRAME_MAGIC, true);
  frame2View.setUint16(6, 1, true);
  frame2View.setUint16(8, 200, true);
  frame2View.setUint32(12, 1, true);
  frame2.set(linkedCelChunk, 16);

  // Combine
  const fileSize = 128 + frame1.length + frame2.length;
  const file = new Uint8Array(fileSize);
  file.set(header, 0);
  file.set(frame1, 128);
  file.set(frame2, 128 + frame1.length);

  // Patch file size
  const view = new DataView(file.buffer);
  view.setUint32(0, fileSize, true);

  return file;
}

Deno.test("roundtrip - parse and encode preserves structure", async () => {
  const original = createTestFile();
  const parsed = parseAseprite(original, { preserveChunks: true });

  // Verify parsed structure
  assertEquals(parsed.header.width, 16);
  assertEquals(parsed.header.height, 16);
  assertEquals(parsed.frames.length, 2);
  assertEquals(parsed.layers.length, 1);
  assertEquals(parsed.layers[0].name, "Test Layer");
  assertEquals(parsed.frames[0].durationMs, 100);
  assertEquals(parsed.frames[1].durationMs, 200);

  // Encode back
  const encoded = await encodeAseprite(parsed, { mode: "canonical" });

  // Parse the encoded file
  const reparsed = parseAseprite(encoded);

  // Verify structure is preserved
  assertEquals(reparsed.header.width, parsed.header.width);
  assertEquals(reparsed.header.height, parsed.header.height);
  assertEquals(reparsed.header.colorDepth, parsed.header.colorDepth);
  assertEquals(reparsed.frames.length, parsed.frames.length);
  assertEquals(reparsed.layers.length, parsed.layers.length);
  assertEquals(reparsed.layers[0].name, parsed.layers[0].name);
  assertEquals(reparsed.frames[0].durationMs, parsed.frames[0].durationMs);
  assertEquals(reparsed.frames[1].durationMs, parsed.frames[1].durationMs);
});

Deno.test("roundtrip - modify and encode", async () => {
  const original = createTestFile();
  const parsed = parseAseprite(original, { preserveChunks: true });

  // Modify the file
  parsed.frames[0].durationMs = 500;
  parsed.layers[0].name = "Modified Layer";

  // Encode with canonical mode
  const encoded = await encodeAseprite(parsed, { mode: "canonical" });

  // Parse and verify modifications
  const reparsed = parseAseprite(encoded);
  assertEquals(reparsed.frames[0].durationMs, 500);
  assertEquals(reparsed.layers[0].name, "Modified Layer");
});

Deno.test("roundtrip - cel data preserved", async () => {
  const original = createTestFile();
  const parsed = parseAseprite(original, { preserveChunks: true });

  // Check cel data
  assertEquals(parsed.frames[0].cels.length, 1);
  const cel = parsed.frames[0].cels[0];
  assertEquals(cel.type, 0); // Raw
  assertEquals(cel.layerIndex, 0);

  // Encode and reparse
  const encoded = await encodeAseprite(parsed, { mode: "canonical" });
  const reparsed = parseAseprite(encoded);

  assertEquals(reparsed.frames[0].cels.length, 1);
  const reparsedCel = reparsed.frames[0].cels[0];
  assertEquals(reparsedCel.type, cel.type);
  assertEquals(reparsedCel.layerIndex, cel.layerIndex);
});

Deno.test("roundtrip - linked cel preserved", async () => {
  const original = createTestFile();
  const parsed = parseAseprite(original, { preserveChunks: true });

  // Check linked cel
  assertEquals(parsed.frames[1].cels.length, 1);
  const linkedCel = parsed.frames[1].cels[0];
  assertEquals(linkedCel.type, 1); // Linked

  // Encode and reparse
  const encoded = await encodeAseprite(parsed, { mode: "canonical" });
  const reparsed = parseAseprite(encoded);

  assertEquals(reparsed.frames[1].cels.length, 1);
  const reparsedLinkedCel = reparsed.frames[1].cels[0];
  assertEquals(reparsedLinkedCel.type, 1);
});

Deno.test("roundtrip - multiple encode cycles", async () => {
  let data = createTestFile();

  // Multiple parse/encode cycles
  for (let i = 0; i < 3; i++) {
    const parsed = parseAseprite(data, { preserveChunks: true });
    data = await encodeAseprite(parsed, { mode: "canonical" });
  }

  // Final parse should still be valid
  const final = parseAseprite(data);
  assertEquals(final.header.width, 16);
  assertEquals(final.header.height, 16);
  assertEquals(final.frames.length, 2);
  assertEquals(final.layers.length, 1);
});
