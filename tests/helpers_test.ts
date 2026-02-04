/**
 * Tests for helper utilities.
 */

import { assertEquals } from "@std/assert";
import type { AsepriteFile, Tag } from "../src/types.ts";
import { LayerType, TagDirection } from "../src/types.ts";
import {
  buildLayerTree,
  findLayerByName,
  flattenLayerTree,
  getLayerPath,
  isLayerVisible,
} from "../src/util/layer_tree.ts";
import {
  getAllTagFrameRanges,
  getSliceAtFrame,
  getTagFrameRange,
  resolveTagFrameRange,
} from "../src/util/tags_slices.ts";
import { decodeTileValue, encodeTileValue } from "../src/util/tile.ts";
import {
  getColorDepth,
  getPaletteSize,
  getSpriteDimensions,
  getTotalDuration,
  listFrames,
  listLayers,
} from "../src/util/metadata.ts";

// Mock file for testing
function createMockFile(): AsepriteFile {
  return {
    header: {
      fileSize: 1000,
      magic: 0xa5e0,
      frameCount: 3,
      width: 64,
      height: 64,
      colorDepth: 32,
      flags: 1,
      speed: 100,
      transparentIndex: 0,
      colorCount: 256,
      pixelWidth: 1,
      pixelHeight: 1,
      gridX: 0,
      gridY: 0,
      gridWidth: 16,
      gridHeight: 16,
    },
    frames: [
      { durationMs: 100, cels: [] },
      { durationMs: 200, cels: [] },
      { durationMs: 150, cels: [] },
    ],
    layers: [
      {
        flags: 1, // Visible
        type: LayerType.Normal,
        childLevel: 0,
        defaultWidth: 0,
        defaultHeight: 0,
        blendMode: 0,
        opacity: 255,
        name: "Background",
      },
      {
        flags: 1,
        type: LayerType.Group,
        childLevel: 0,
        defaultWidth: 0,
        defaultHeight: 0,
        blendMode: 0,
        opacity: 255,
        name: "Group",
      },
      {
        flags: 1,
        type: LayerType.Normal,
        childLevel: 1,
        defaultWidth: 0,
        defaultHeight: 0,
        blendMode: 0,
        opacity: 255,
        name: "Child 1",
      },
      {
        flags: 0, // Not visible
        type: LayerType.Normal,
        childLevel: 1,
        defaultWidth: 0,
        defaultHeight: 0,
        blendMode: 0,
        opacity: 255,
        name: "Child 2 (hidden)",
      },
    ],
    tags: [
      {
        fromFrame: 0,
        toFrame: 2,
        direction: TagDirection.Forward,
        repeat: 0,
        color: { r: 255, g: 0, b: 0 },
        name: "Walk",
      },
      {
        fromFrame: 1,
        toFrame: 2,
        direction: TagDirection.PingPong,
        repeat: 3,
        color: { r: 0, g: 255, b: 0 },
        name: "Jump",
      },
    ],
    slices: [
      {
        name: "hitbox",
        flags: 0,
        keys: [
          { frameIndex: 0, x: 10, y: 10, width: 20, height: 30 },
          { frameIndex: 2, x: 15, y: 15, width: 25, height: 35 },
        ],
      },
    ],
    palette: {
      size: 16,
      firstIndex: 0,
      lastIndex: 15,
      entries: Array.from({ length: 16 }, (_, i) => ({
        r: i * 16,
        g: i * 16,
        b: i * 16,
        a: 255,
      })),
    },
  };
}

// Layer tree tests
Deno.test("buildLayerTree - creates hierarchy", () => {
  const file = createMockFile();
  const tree = buildLayerTree(file.layers);

  assertEquals(tree.length, 2); // Background and Group at root
  assertEquals(tree[0].layer.name, "Background");
  assertEquals(tree[1].layer.name, "Group");
  assertEquals(tree[1].children.length, 2);
  assertEquals(tree[1].children[0].layer.name, "Child 1");
  assertEquals(tree[1].children[1].layer.name, "Child 2 (hidden)");
});

Deno.test("findLayerByName - finds layer", () => {
  const file = createMockFile();
  const tree = buildLayerTree(file.layers);

  const found = findLayerByName(tree, "Child 1");
  assertEquals(found !== undefined, true);
  assertEquals(found!.layer.name, "Child 1");

  const notFound = findLayerByName(tree, "Nonexistent");
  assertEquals(notFound, undefined);
});

Deno.test("getLayerPath - returns full path", () => {
  const file = createMockFile();
  const tree = buildLayerTree(file.layers);

  const child = findLayerByName(tree, "Child 1");
  assertEquals(getLayerPath(child!), "Group/Child 1");

  const root = findLayerByName(tree, "Background");
  assertEquals(getLayerPath(root!), "Background");
});

Deno.test("isLayerVisible - checks parent visibility", () => {
  const file = createMockFile();
  const tree = buildLayerTree(file.layers);

  const visible = findLayerByName(tree, "Child 1");
  assertEquals(isLayerVisible(visible!), true);

  const hidden = findLayerByName(tree, "Child 2 (hidden)");
  assertEquals(isLayerVisible(hidden!), false);
});

Deno.test("flattenLayerTree - returns flat array", () => {
  const file = createMockFile();
  const tree = buildLayerTree(file.layers);
  const flat = flattenLayerTree(tree);

  assertEquals(flat.length, 4);
  assertEquals(flat.map((n) => n.layer.name), [
    "Background",
    "Group",
    "Child 1",
    "Child 2 (hidden)",
  ]);
});

// Tag tests
Deno.test("getTagFrameRange - finds tag", () => {
  const file = createMockFile();
  const range = getTagFrameRange(file, "Walk");

  assertEquals(range !== undefined, true);
  assertEquals(range!.from, 0);
  assertEquals(range!.to, 2);
  assertEquals(range!.frameCount, 3);
});

Deno.test("resolveTagFrameRange - forward direction", () => {
  const tag: Tag = {
    fromFrame: 0,
    toFrame: 2,
    direction: TagDirection.Forward,
    repeat: 0,
    color: { r: 0, g: 0, b: 0 },
    name: "test",
  };

  const range = resolveTagFrameRange(tag);
  assertEquals(range.playbackOrder, [0, 1, 2]);
});

Deno.test("resolveTagFrameRange - reverse direction", () => {
  const tag: Tag = {
    fromFrame: 0,
    toFrame: 2,
    direction: TagDirection.Reverse,
    repeat: 0,
    color: { r: 0, g: 0, b: 0 },
    name: "test",
  };

  const range = resolveTagFrameRange(tag);
  assertEquals(range.playbackOrder, [2, 1, 0]);
});

Deno.test("resolveTagFrameRange - ping-pong direction", () => {
  const tag: Tag = {
    fromFrame: 0,
    toFrame: 2,
    direction: TagDirection.PingPong,
    repeat: 0,
    color: { r: 0, g: 0, b: 0 },
    name: "test",
  };

  const range = resolveTagFrameRange(tag);
  assertEquals(range.playbackOrder, [0, 1, 2, 1]);
});

Deno.test("getAllTagFrameRanges - returns all tags", () => {
  const file = createMockFile();
  const ranges = getAllTagFrameRanges(file);

  assertEquals(ranges.length, 2);
  assertEquals(ranges[0].name, "Walk");
  assertEquals(ranges[1].name, "Jump");
});

// Slice tests
Deno.test("getSliceAtFrame - finds correct key", () => {
  const file = createMockFile();

  // Frame 0 uses first key
  const slice0 = getSliceAtFrame(file, "hitbox", 0);
  assertEquals(slice0 !== undefined, true);
  assertEquals(slice0!.x, 10);
  assertEquals(slice0!.width, 20);

  // Frame 1 still uses first key (no key at frame 1)
  const slice1 = getSliceAtFrame(file, "hitbox", 1);
  assertEquals(slice1!.x, 10);

  // Frame 2 uses second key
  const slice2 = getSliceAtFrame(file, "hitbox", 2);
  assertEquals(slice2!.x, 15);
  assertEquals(slice2!.width, 25);
});

// Tile tests
Deno.test("decodeTileValue - extracts fields", () => {
  const masks = {
    tileIdMask: 0x1fffffff,
    xFlipMask: 0x20000000,
    yFlipMask: 0x40000000,
    rotationMask: 0x80000000,
  };

  // Tile ID 42, no transforms
  const tile1 = decodeTileValue(42, masks);
  assertEquals(tile1.tileId, 42);
  assertEquals(tile1.xFlip, false);
  assertEquals(tile1.yFlip, false);
  assertEquals(tile1.rotation, false);

  // Tile ID 100 with X flip
  const tile2 = decodeTileValue(100 | 0x20000000, masks);
  assertEquals(tile2.tileId, 100);
  assertEquals(tile2.xFlip, true);
  assertEquals(tile2.yFlip, false);

  // All transforms
  const tile3 = decodeTileValue(
    1 | 0x20000000 | 0x40000000 | 0x80000000,
    masks,
  );
  assertEquals(tile3.tileId, 1);
  assertEquals(tile3.xFlip, true);
  assertEquals(tile3.yFlip, true);
  assertEquals(tile3.rotation, true);
});

Deno.test("encodeTileValue - round-trip", () => {
  const masks = {
    tileIdMask: 0x1fffffff,
    xFlipMask: 0x20000000,
    yFlipMask: 0x40000000,
    rotationMask: 0x80000000,
  };

  const original = {
    tileId: 123,
    xFlip: true,
    yFlip: false,
    rotation: true,
  };

  const encoded = encodeTileValue(original, masks);
  const decoded = decodeTileValue(encoded, masks);

  assertEquals(decoded, original);
});

// Metadata tests
Deno.test("listLayers - returns layer info", () => {
  const file = createMockFile();
  const layers = listLayers(file);

  assertEquals(layers.length, 4);
  assertEquals(layers[0].name, "Background");
  assertEquals(layers[0].visible, true);
  assertEquals(layers[3].name, "Child 2 (hidden)");
  assertEquals(layers[3].visible, false);
});

Deno.test("listFrames - returns frame info", () => {
  const file = createMockFile();
  const frames = listFrames(file);

  assertEquals(frames.length, 3);
  assertEquals(frames[0].durationMs, 100);
  assertEquals(frames[1].durationMs, 200);
  assertEquals(frames[2].durationMs, 150);
});

Deno.test("getTotalDuration - sums frame durations", () => {
  const file = createMockFile();
  const total = getTotalDuration(file);

  assertEquals(total, 450); // 100 + 200 + 150
});

Deno.test("getSpriteDimensions - returns size", () => {
  const file = createMockFile();
  const dims = getSpriteDimensions(file);

  assertEquals(dims.width, 64);
  assertEquals(dims.height, 64);
});

Deno.test("getColorDepth - returns depth", () => {
  const file = createMockFile();
  assertEquals(getColorDepth(file), 32);
});

Deno.test("getPaletteSize - returns size", () => {
  const file = createMockFile();
  assertEquals(getPaletteSize(file), 16);
});
