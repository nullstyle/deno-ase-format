/**
 * Utility modules for Aseprite file handling.
 * @module
 */

// Compression
export {
  defaultCompressionProvider,
  deflateZlib,
  getCompressionProvider,
  hasCompressionStreams,
  inflateZlib,
} from "./zlib.ts";

// Decoding
export {
  convertToRgba,
  decodeCelPixels,
  decodeTile,
  decodeTilemap,
  resolveLinkedCel,
} from "./decode.ts";

// Layer tree
export {
  buildLayerTree,
  findLayerByName,
  flattenLayerTree,
  getLayerPath,
  isLayerVisible,
} from "./layer_tree.ts";
export type { LayerNode } from "./layer_tree.ts";

// Render order
export {
  getCelsInRenderOrder,
  getFrameRenderOrder,
  getVisibleLayersInOrder,
} from "./render_order.ts";
export type { RenderCel } from "./render_order.ts";

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
} from "./tags_slices.ts";
export type { ResolvedSliceKey, TagFrameRange } from "./tags_slices.ts";

// Tile utilities
export {
  applyTileTransform,
  decodeTilesetPixels,
  decodeTileValue,
  encodeTileValue,
  getTilePixels,
  getTilesetById,
  getTilesetByName,
} from "./tile.ts";
export type { DecodedTile } from "./tile.ts";

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
} from "./metadata.ts";
export type {
  FrameInfo,
  LayerInfo,
  SliceInfo,
  TagInfo,
  TilesetInfo,
} from "./metadata.ts";

// Validation
export { validateAseprite } from "./validate.ts";
