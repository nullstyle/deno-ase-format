# @nullstyle/ase-format

**WARNING:  This was vibed;  don't use it.  it's just for me for now, and it will get de-vibed (harmonized?) over time.**

A Deno-first library for reading and writing Aseprite (`.ase`/`.aseprite`)
files.  

## Features

- **Read and write** Aseprite files with full support for:
  - Header, frames, and layers (including hierarchy)
  - Cels (raw, linked, compressed image, compressed tilemap)
  - Palette (old and new formats)
  - Tags, slices, tilesets, user data, external files, color profile
  - Unknown chunk preservation for forward compatibility

- **Tooling-friendly API** for game development:
  - Fast metadata access without decoding pixel payloads
  - Lazy/optional pixel decode and compositing
  - Helpers for common workflows (export frames, resolve linked cels, tilemap
    decode)

- **Round-trip support**:
  - Lossless read → write for known and unknown chunks
  - Canonical output mode for modified files

## Installation

```bash
deno add jsr:@nullstyle/ase-format
```

Or import directly:

```ts
import { encodeAseprite, parseAseprite } from "jsr:@nullstyle/ase-format";
```

## Quick Start

### Read Metadata

```ts
import {
  getSpriteDimensions,
  listLayers,
  listTags,
  parseAseprite,
} from "@nullstyle/ase-format";

const bytes = await Deno.readFile("sprite.aseprite");
const file = parseAseprite(bytes);

const dims = getSpriteDimensions(file);
console.log(`Size: ${dims.width}x${dims.height}`);
console.log(`Frames: ${file.frames.length}`);
console.log(`Color depth: ${file.header.colorDepth}bpp`);

console.log("Layers:", listLayers(file));
console.log("Tags:", listTags(file));
```

### Decode Cel Pixels to RGBA

```ts
import {
  convertToRgba,
  decodeCelPixels,
  parseAseprite,
} from "@nullstyle/ase-format";

const bytes = await Deno.readFile("sprite.aseprite");
const file = parseAseprite(bytes);

// Get the first cel from the first frame
const cel = file.frames[0].cels[0];

// Decode compressed pixel data
const decoded = await decodeCelPixels(file, cel);

// Convert to RGBA (handles indexed and grayscale modes)
const rgba = convertToRgba(file, decoded);

console.log(`Cel size: ${decoded.width}x${decoded.height}`);
console.log(`Pixel data length: ${rgba.length} bytes`);
```

### Export Frames by Tag

```ts
import {
  convertToRgba,
  decodeCelPixels,
  getTagFrameRange,
  parseAseprite,
} from "@nullstyle/ase-format";

const bytes = await Deno.readFile("sprite.aseprite");
const file = parseAseprite(bytes);

// Get frames for a specific animation tag
const walkTag = getTagFrameRange(file, "Walk");
if (walkTag) {
  console.log(`Walk animation: frames ${walkTag.from} to ${walkTag.to}`);
  console.log(`Playback order: ${walkTag.playbackOrder}`);

  for (const frameIndex of walkTag.playbackOrder) {
    const frame = file.frames[frameIndex];
    console.log(`Frame ${frameIndex}: ${frame.durationMs}ms`);
  }
}
```

### Round-Trip (Read, Modify, Write)

```ts
import { encodeAseprite, parseAseprite } from "@nullstyle/ase-format";

const bytes = await Deno.readFile("sprite.aseprite");
const file = parseAseprite(bytes, { preserveChunks: true });

// Modify the file
file.frames[0].durationMs = 200;
file.layers[0].name = "Renamed Layer";

// Write back
const output = await encodeAseprite(file);
await Deno.writeFile("modified.aseprite", output);
```

### Work with Layer Hierarchy

```ts
import {
  buildLayerTree,
  getLayerPath,
  isLayerVisible,
  parseAseprite,
} from "@nullstyle/ase-format";

const bytes = await Deno.readFile("sprite.aseprite");
const file = parseAseprite(bytes);

// Build hierarchical tree from flat layer list
const tree = buildLayerTree(file.layers);

function printTree(nodes: LayerNode[], indent = 0) {
  for (const node of nodes) {
    const prefix = "  ".repeat(indent);
    const visibility = isLayerVisible(node) ? "👁" : "🚫";
    console.log(`${prefix}${visibility} ${node.layer.name}`);
    printTree(node.children, indent + 1);
  }
}

printTree(tree);
```

### Decode Tilemap

```ts
import {
  decodeTilemap,
  decodeTileValue,
  getTilesetById,
  parseAseprite,
} from "@nullstyle/ase-format";
import { CelType } from "@nullstyle/ase-format";

const bytes = await Deno.readFile("tilemap.aseprite");
const file = parseAseprite(bytes);

// Find tilemap cels
for (const frame of file.frames) {
  for (const cel of frame.cels) {
    if (cel.type === CelType.CompressedTilemap) {
      const tilemap = await decodeTilemap(cel);

      console.log(`Tilemap: ${tilemap.width}x${tilemap.height} tiles`);

      // Decode individual tiles
      for (let i = 0; i < tilemap.tiles.length; i++) {
        const tile = decodeTileValue(tilemap.tiles[i], tilemap.masks);
        if (tile.tileId !== 0) {
          console.log(
            `Tile ${i}: ID=${tile.tileId}, xFlip=${tile.xFlip}, yFlip=${tile.yFlip}`,
          );
        }
      }
    }
  }
}
```

## API Reference

### Core Functions

| Function                            | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| `parseAseprite(bytes, opts?)`       | Parse Aseprite file bytes into structured data     |
| `encodeAseprite(file, opts?)`       | Encode structured data back to Aseprite file bytes |
| `decodeCelPixels(file, cel, opts?)` | Decode compressed cel pixel data                   |
| `convertToRgba(file, decoded)`      | Convert indexed/grayscale pixels to RGBA           |

### Metadata Functions

| Function                    | Description                    |
| --------------------------- | ------------------------------ |
| `listLayers(file)`          | List all layers with metadata  |
| `listTags(file)`            | List all animation tags        |
| `listSlices(file)`          | List all slices                |
| `listFrames(file)`          | List all frames with durations |
| `listTilesets(file)`        | List all tilesets              |
| `getSpriteDimensions(file)` | Get sprite width and height    |
| `getColorDepth(file)`       | Get color depth (8, 16, or 32) |
| `getTotalDuration(file)`    | Get total animation duration   |
| `getPaletteSize(file)`      | Get palette size               |

### Layer Utilities

| Function                       | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `buildLayerTree(layers)`       | Build hierarchical tree from flat layer list |
| `flattenLayerTree(roots)`      | Flatten tree back to array                   |
| `findLayerByName(roots, name)` | Find layer by name in tree                   |
| `getLayerPath(node)`           | Get full path of layer (e.g., "Group/Child") |
| `isLayerVisible(node)`         | Check if layer and all parents are visible   |

### Tag and Slice Utilities

| Function                                  | Description                       |
| ----------------------------------------- | --------------------------------- |
| `getTagFrameRange(file, name)`            | Get tag with resolved frame range |
| `getAllTagFrameRanges(file)`              | Get all tags with frame ranges    |
| `getTagsAtFrame(file, frameIndex)`        | Find tags containing a frame      |
| `getSliceAtFrame(file, name, frameIndex)` | Get slice bounds at frame         |
| `getAllSlicesAtFrame(file, frameIndex)`   | Get all slices at frame           |

### Tile Utilities

| Function                                        | Description                            |
| ----------------------------------------------- | -------------------------------------- |
| `decodeTilemap(cel, compression?)`              | Decode tilemap cel data                |
| `decodeTileValue(value, masks)`                 | Decode tile ID and flip/rotation flags |
| `encodeTileValue(tile, masks)`                  | Encode tile back to raw value          |
| `getTilesetById(file, id)`                      | Find tileset by ID                     |
| `getTilesetByName(file, name)`                  | Find tileset by name                   |
| `decodeTilesetPixels(tileset, compression?)`    | Decode tileset pixel data              |
| `getTilePixels(tileset, tileIndex, colorDepth)` | Get pixels for a single tile           |

### Render Order

| Function                                 | Description                        |
| ---------------------------------------- | ---------------------------------- |
| `getFrameRenderOrder(file, frameIndex)`  | Get layer indices in render order  |
| `getCelsInRenderOrder(file, frameIndex)` | Get cels sorted by render order    |
| `getVisibleLayersInOrder(file)`          | Get visible layers in render order |

### Validation

| Function                 | Description                             |
| ------------------------ | --------------------------------------- |
| `validateAseprite(file)` | Validate file structure, returns issues |

### Compression

| Function                  | Description                                |
| ------------------------- | ------------------------------------------ |
| `inflateZlib(data)`       | Decompress zlib data                       |
| `deflateZlib(data)`       | Compress data with zlib                    |
| `hasCompressionStreams()` | Check if Web Compression Streams available |

## Parse Options

```ts
interface ParseOptions {
  /** Keep each frame's raw chunk list. Default: true */
  preserveChunks?: boolean;

  /** Keep compressed payload bytes. Default: true */
  preserveCompressed?: boolean;

  /** Eagerly decode compressed payloads. Default: false */
  decodeImages?: false | "metadata" | "pixels";

  /** Strict validation. Default: true */
  strict?: boolean;
}
```

## Encode Options

```ts
interface EncodeOptions {
  /** Encoding mode. Default: "chunks-if-present" */
  mode?: "chunks" | "canonical" | "chunks-if-present";

  /** Emit legacy palette chunks. Default: false */
  writeLegacyPaletteChunks?: boolean;

  /** Custom compression provider */
  compression?: CompressionProvider;
}
```

## Types

The library exports comprehensive TypeScript types for all Aseprite structures:

- `AsepriteFile` - Complete file structure
- `AseHeader` - File header
- `Frame` - Animation frame
- `Layer` - Layer definition
- `Cel` - Cel (image data in a frame/layer)
- `Palette`, `PaletteEntry` - Color palette
- `Tag` - Animation tag
- `Slice`, `SliceKey` - Slice regions
- `Tileset` - Tileset definition
- `ColorProfile` - Color profile
- `UserData` - User-defined data

## Constants and Enums

```ts
import {
  BlendMode, // Normal, Multiply, Screen, etc.
  CelType, // RawImage, Linked, CompressedImage, CompressedTilemap
  ChunkType, // Layer, Cel, Palette, Tags, etc.
  ColorDepth, // 8, 16, 32
  LayerType, // Normal, Group, Tilemap
  TagDirection, // Forward, Reverse, PingPong, PingPongReverse
} from "@nullstyle/ase-format";
```

## Error Handling

The library throws `AseFormatError` for parsing/encoding errors:

```ts
import { AseErrorCode, AseFormatError } from "@nullstyle/ase-format";

try {
  const file = parseAseprite(bytes);
} catch (e) {
  if (e instanceof AseFormatError) {
    console.error(`Error: ${e.code} at offset ${e.offset}`);
    console.error(e.message);
  }
}
```

Error codes include:

- `BAD_MAGIC` - Invalid file or frame magic number
- `OUT_OF_BOUNDS` - Read past end of data
- `BAD_CHUNK_SIZE` - Invalid chunk size
- `UNSUPPORTED_COLOR_DEPTH` - Unknown color depth
- `INVALID_CEL_TYPE` - Unknown cel type
- `DECOMPRESSION_FAILED` - Zlib decompression error
- `INVALID_LINKED_CEL` - Invalid linked cel reference
- `MISSING_TILESET` - Referenced tileset not found

## License

MIT
