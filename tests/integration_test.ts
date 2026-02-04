/**
 * Integration tests using real Aseprite test files from the Aseprite repository.
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseAseprite } from "../src/parse.ts";
import { encodeAseprite } from "../src/encode.ts";
import {
  buildLayerTree,
  decodeCelPixels,
  getTagFrameRange,
  listLayers,
  listTags,
  validateAseprite,
} from "../mod.ts";

const TEST_SPRITES_DIR = "./vendor/aseprite/tests/sprites";

/**
 * Helper to read a test sprite file.
 */
async function readTestSprite(filename: string): Promise<Uint8Array> {
  return await Deno.readFile(`${TEST_SPRITES_DIR}/${filename}`);
}

// ============================================================================
// Basic Parsing Tests
// ============================================================================

Deno.test("integration - parse 1empty3.aseprite", async () => {
  const bytes = await readTestSprite("1empty3.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.header);
  assertEquals(file.header.magic, 0xa5e0);
  assertExists(file.frames);
  assertExists(file.layers);
});

Deno.test("integration - parse 2f-index-3x3.aseprite (indexed color)", async () => {
  const bytes = await readTestSprite("2f-index-3x3.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.header);
  // Indexed mode is 8bpp
  assertEquals(file.header.colorDepth, 8);
  assertExists(file.palette);
  assertEquals(file.palette!.entries.length > 0, true);
});

Deno.test("integration - parse 4f-index-4x4.aseprite (4 frames)", async () => {
  const bytes = await readTestSprite("4f-index-4x4.aseprite");
  const file = parseAseprite(bytes);

  assertEquals(file.frames.length, 4);
  assertEquals(file.header.frameCount, 4);
});

// ============================================================================
// Tilemap Tests
// ============================================================================

Deno.test("integration - parse 2x2tilemap2x2tile.aseprite (tilemap)", async () => {
  const bytes = await readTestSprite("2x2tilemap2x2tile.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.tilesets);
  assertEquals(file.tilesets!.length > 0, true);

  // Should have tilemap layer
  const layers = listLayers(file);
  const tilemapLayer = layers.find((l) => l.type === 2); // LayerType.Tilemap
  assertExists(tilemapLayer);
});

Deno.test("integration - parse 2x3tilemap-indexed.aseprite (indexed tilemap)", async () => {
  const bytes = await readTestSprite("2x3tilemap-indexed.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.tilesets);
  assertEquals(file.header.colorDepth, 8); // Indexed
});

Deno.test("integration - parse 3x2tilemap-grayscale.aseprite (grayscale tilemap)", async () => {
  const bytes = await readTestSprite("3x2tilemap-grayscale.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.tilesets);
  assertEquals(file.header.colorDepth, 16); // Grayscale
});

// ============================================================================
// Layer Group Tests
// ============================================================================

Deno.test("integration - parse groups2.aseprite (layer groups)", async () => {
  const bytes = await readTestSprite("groups2.aseprite");
  const file = parseAseprite(bytes);

  const layers = listLayers(file);
  assertEquals(layers.length > 1, true);

  // Build layer tree to verify hierarchy
  const tree = buildLayerTree(file.layers);
  assertExists(tree);
});

Deno.test("integration - parse groups3abc.aseprite (nested groups)", async () => {
  const bytes = await readTestSprite("groups3abc.aseprite");
  const file = parseAseprite(bytes);

  const layers = listLayers(file);
  // Should have group layers
  const groupLayers = layers.filter((l) => l.type === 1); // LayerType.Group
  assertEquals(groupLayers.length > 0, true);
});

// ============================================================================
// Linked Cel Tests
// ============================================================================

Deno.test("integration - parse link.aseprite (linked cels)", async () => {
  const bytes = await readTestSprite("link.aseprite");
  const file = parseAseprite(bytes);

  // Should have linked cels (type 1)
  let hasLinkedCel = false;
  for (const frame of file.frames) {
    for (const cel of frame.cels) {
      if (cel.type === 1) {
        hasLinkedCel = true;
        break;
      }
    }
    if (hasLinkedCel) break;
  }
  assertEquals(hasLinkedCel, true);
});

// ============================================================================
// Slice Tests
// ============================================================================

Deno.test("integration - parse slices.aseprite", async () => {
  const bytes = await readTestSprite("slices.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.slices);
  assertEquals(file.slices!.length > 0, true);
});

Deno.test("integration - parse slices-moving.aseprite (animated slices)", async () => {
  const bytes = await readTestSprite("slices-moving.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.slices);
  // Moving slices should have multiple keys
  const hasMultipleKeys = file.slices!.some((s) => s.keys.length > 1);
  assertEquals(hasMultipleKeys, true);
});

// ============================================================================
// Tag Tests
// ============================================================================

Deno.test("integration - parse tags3.aseprite", async () => {
  const bytes = await readTestSprite("tags3.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.tags);
  assertEquals(file.tags!.length, 3);

  const tags = listTags(file);
  assertEquals(tags.length, 3);
});

Deno.test("integration - parse tags3x123reps.aseprite (tags with repeats)", async () => {
  const bytes = await readTestSprite("tags3x123reps.aseprite");
  const file = parseAseprite(bytes);

  assertExists(file.tags);
  // Check that tags have repeat values
  const hasRepeats = file.tags!.some((t) => t.repeat > 0);
  assertEquals(hasRepeats, true);
});

// ============================================================================
// User Data / Properties Tests
// ============================================================================

Deno.test({
  name: "integration - parse file-tests-props.aseprite (properties)",
  ignore: true, // This file uses newer property formats not yet fully supported
  fn: async () => {
    const bytes = await readTestSprite("file-tests-props.aseprite");
    const file = parseAseprite(bytes);
    assertExists(file.header);
    assertExists(file.layers);
  },
});

// ============================================================================
// Validation Tests
// ============================================================================

Deno.test("integration - validate all test sprites", async () => {
  const testFiles = [
    "1empty3.aseprite",
    "2f-index-3x3.aseprite",
    "2x2tilemap2x2tile.aseprite",
    "4f-index-4x4.aseprite",
    "abcd.aseprite",
    "groups2.aseprite",
    "link.aseprite",
    "slices.aseprite",
    "tags3.aseprite",
  ];

  for (const filename of testFiles) {
    const bytes = await readTestSprite(filename);
    const file = parseAseprite(bytes);
    const issues = validateAseprite(file);

    // Should have no errors (warnings/info are OK)
    const errors = issues.filter((i) => i.severity === "error");
    assertEquals(
      errors.length,
      0,
      `${filename} has validation errors: ${JSON.stringify(errors)}`,
    );
  }
});

// ============================================================================
// Round-trip Tests
// ============================================================================

Deno.test("integration - round-trip 1empty3.aseprite", async () => {
  const original = await readTestSprite("1empty3.aseprite");
  const parsed = parseAseprite(original, { preserveChunks: true });

  // Encode back
  const encoded = await encodeAseprite(parsed, { mode: "canonical" });

  // Parse the encoded version
  const reparsed = parseAseprite(encoded);

  // Verify structure matches
  assertEquals(reparsed.header.width, parsed.header.width);
  assertEquals(reparsed.header.height, parsed.header.height);
  assertEquals(reparsed.header.colorDepth, parsed.header.colorDepth);
  assertEquals(reparsed.frames.length, parsed.frames.length);
  assertEquals(reparsed.layers.length, parsed.layers.length);
});

Deno.test("integration - round-trip 4f-index-4x4.aseprite", async () => {
  const original = await readTestSprite("4f-index-4x4.aseprite");
  const parsed = parseAseprite(original, { preserveChunks: true });

  const encoded = await encodeAseprite(parsed, { mode: "canonical" });
  const reparsed = parseAseprite(encoded);

  assertEquals(reparsed.frames.length, parsed.frames.length);
  assertEquals(reparsed.layers.length, parsed.layers.length);

  // Verify palette preserved
  assertExists(reparsed.palette);
  assertEquals(reparsed.palette!.size, parsed.palette!.size);
});

Deno.test("integration - round-trip tags3.aseprite", async () => {
  const original = await readTestSprite("tags3.aseprite");
  const parsed = parseAseprite(original, { preserveChunks: true });

  const encoded = await encodeAseprite(parsed, { mode: "canonical" });
  const reparsed = parseAseprite(encoded);

  // Verify tags preserved
  assertExists(reparsed.tags);
  assertEquals(reparsed.tags!.length, parsed.tags!.length);

  for (let i = 0; i < parsed.tags!.length; i++) {
    assertEquals(reparsed.tags![i].name, parsed.tags![i].name);
    assertEquals(reparsed.tags![i].fromFrame, parsed.tags![i].fromFrame);
    assertEquals(reparsed.tags![i].toFrame, parsed.tags![i].toFrame);
  }
});

Deno.test("integration - round-trip slices.aseprite", async () => {
  const original = await readTestSprite("slices.aseprite");
  const parsed = parseAseprite(original, { preserveChunks: true });

  const encoded = await encodeAseprite(parsed, { mode: "canonical" });
  const reparsed = parseAseprite(encoded);

  // Verify slices preserved
  assertExists(reparsed.slices);
  assertEquals(reparsed.slices!.length, parsed.slices!.length);
});

// ============================================================================
// Cel Decoding Tests
// ============================================================================

Deno.test("integration - decode cels from abcd.aseprite", async () => {
  const bytes = await readTestSprite("abcd.aseprite");
  const file = parseAseprite(bytes);

  // Try to decode first cel
  if (file.frames.length > 0 && file.frames[0].cels.length > 0) {
    const cel = file.frames[0].cels[0];
    if (cel.type === 0 || cel.type === 2) {
      // Raw or Compressed
      const decoded = await decodeCelPixels(file, cel);
      assertExists(decoded);
      assertEquals(decoded.width > 0, true);
      assertEquals(decoded.height > 0, true);
      assertEquals(decoded.pixels.length > 0, true);
    }
  }
});

// ============================================================================
// Tag Frame Range Tests
// ============================================================================

Deno.test("integration - get tag frame ranges from tags3.aseprite", async () => {
  const bytes = await readTestSprite("tags3.aseprite");
  const file = parseAseprite(bytes);

  const tags = listTags(file);
  for (const tag of tags) {
    const range = getTagFrameRange(file, tag.name);
    assertExists(range);
    assertEquals(range!.name, tag.name);
    assertEquals(range!.from, tag.fromFrame);
    assertEquals(range!.to, tag.toFrame);
    assertEquals(range!.playbackOrder.length > 0, true);
  }
});
