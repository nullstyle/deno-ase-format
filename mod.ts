/**
 * @module @nullstyle/ase-format
 *
 * A Deno-first library for reading and writing Aseprite (.ase/.aseprite) files.
 *
 * @example Read metadata from an Aseprite file
 * ```ts
 * import { parseAseprite, listLayers, listTags } from "@nullstyle/ase-format";
 *
 * const bytes = await Deno.readFile("sprite.aseprite");
 * const file = parseAseprite(bytes);
 *
 * console.log(`Size: ${file.header.width}x${file.header.height}`);
 * console.log(`Frames: ${file.frames.length}`);
 * console.log("Layers:", listLayers(file));
 * console.log("Tags:", listTags(file));
 * ```
 *
 * @example Decode cel pixels to RGBA
 * ```ts
 * import { parseAseprite, decodeCelPixels, convertToRgba } from "@nullstyle/ase-format";
 *
 * const bytes = await Deno.readFile("sprite.aseprite");
 * const file = parseAseprite(bytes);
 *
 * const cel = file.frames[0].cels[0];
 * const decoded = await decodeCelPixels(file, cel);
 * const rgba = convertToRgba(file, decoded);
 * ```
 *
 * @example Round-trip (read and write)
 * ```ts
 * import { parseAseprite, encodeAseprite } from "@nullstyle/ase-format";
 *
 * const bytes = await Deno.readFile("sprite.aseprite");
 * const file = parseAseprite(bytes);
 *
 * // Modify the file...
 * file.frames[0].durationMs = 200;
 *
 * // Write back
 * const output = await encodeAseprite(file);
 * await Deno.writeFile("modified.aseprite", output);
 * ```
 */

// =============================================================================
// Core Parse/Encode Functions
// =============================================================================

export { parseAseprite } from "./src/parse.ts";
export { encodeAseprite } from "./src/encode.ts";

// =============================================================================
// Types
// =============================================================================

export type {
  AseHeader,
  // Main file structure
  AsepriteFile,
  // Cels
  Cel,
  CelBase,
  // Chunks
  CelChunk,
  CelExtra,
  CelExtraChunk,
  CelImageData,
  Chunk,
  // Color profile
  ColorProfile,
  ColorProfileChunk,
  CompressedImageCel,
  CompressedTilemapCel,
  // Options
  CompressionProvider,
  DecodedCelPixels,
  DecodeOptions,
  EncodeOptions,
  // External files
  ExternalFile,
  ExternalFilesChunk,
  Frame,
  // Layers
  Layer,
  LayerChunk,
  LinkedCel,
  OldPaletteChunk,
  // Palette
  Palette,
  PaletteChunk,
  PaletteEntry,
  ParseOptions,
  // User data
  PropertiesMap,
  PropertyValue,
  RawImageCel,
  // Slices
  Slice,
  SliceChunk,
  SliceKey,
  // Tags
  Tag,
  TagsChunk,
  TilemapMasks,
  // Tilesets
  Tileset,
  TilesetChunk,
  UnknownChunk,
  UserData,
  UserDataChunk,
  // Validation
  ValidationIssue,
} from "./src/types.ts";

// =============================================================================
// Constants and Enums
// =============================================================================

export {
  // Magic numbers
  ASE_FILE_MAGIC,
  ASE_FRAME_MAGIC,
  // Error handling
  AseErrorCode,
  AseFormatError,
  // Enums
  BlendMode,
  CelType,
  ChunkType,
  ColorDepth,
  ColorProfileType,
  ExternalFileType,
  HeaderFlags,
  LayerFlags,
  LayerType,
  PropertyType,
  SliceFlags,
  TagDirection,
  TilesetFlags,
  UserDataFlags,
  ValidationSeverity,
} from "./src/types.ts";

// =============================================================================
// Utility Functions
// =============================================================================

// Decoding
export {
  convertToRgba,
  decodeCelPixels,
  decodeTile,
  decodeTilemap,
  resolveLinkedCel,
} from "./src/util/decode.ts";

// Layer tree
export {
  buildLayerTree,
  findLayerByName,
  flattenLayerTree,
  getLayerPath,
  isLayerVisible,
} from "./src/util/layer_tree.ts";
export type { LayerNode } from "./src/util/layer_tree.ts";

// Render order
export {
  getCelsInRenderOrder,
  getFrameRenderOrder,
  getVisibleLayersInOrder,
} from "./src/util/render_order.ts";
export type { RenderCel } from "./src/util/render_order.ts";

// Tags and slices
export {
  getAllSlicesAtFrame,
  getAllTagFrameRanges,
  getSliceAtFrame,
  getTagFrameRange,
  getTagsAtFrame,
  listSliceNames,
  listTagNames,
  resolveTagFrameRange,
} from "./src/util/tags_slices.ts";
export type {
  ResolvedSliceKey,
  TagFrameRange,
} from "./src/util/tags_slices.ts";

// Tile utilities
export {
  applyTileTransform,
  decodeTilesetPixels,
  decodeTileValue,
  encodeTileValue,
  getTilePixels,
  getTilesetById,
  getTilesetByName,
} from "./src/util/tile.ts";
export type { DecodedTile } from "./src/util/tile.ts";

// Metadata
export {
  getColorDepth,
  getPaletteSize,
  getSpriteDimensions,
  getTotalDuration,
  listFrames,
  listLayers,
  listSlices,
  listTags,
  listTilesets,
} from "./src/util/metadata.ts";
export type {
  FrameInfo,
  LayerInfo,
  SliceInfo,
  TagInfo,
  TilesetInfo,
} from "./src/util/metadata.ts";

// Validation
export { validateAseprite } from "./src/util/validate.ts";

// Compression
export {
  defaultCompressionProvider,
  deflateZlib,
  hasCompressionStreams,
  inflateZlib,
} from "./src/util/zlib.ts";
