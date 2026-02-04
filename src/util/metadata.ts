/**
 * Metadata listing utilities for quick access without pixel decoding.
 * @module
 */

import type { AsepriteFile } from "../types.ts";

/**
 * Layer metadata summary.
 */
export interface LayerInfo {
  /** Layer index */
  index: number;
  /** Layer name */
  name: string;
  /** Layer type (0=normal, 1=group, 2=tilemap) */
  type: number;
  /** Child level (for hierarchy) */
  childLevel: number;
  /** Is layer visible */
  visible: boolean;
  /** Is layer editable */
  editable: boolean;
  /** Is background layer */
  background: boolean;
  /** Blend mode */
  blendMode: number;
  /** Opacity (0-255) */
  opacity: number;
}

/**
 * Tag metadata summary.
 */
export interface TagInfo {
  /** Tag name */
  name: string;
  /** First frame index */
  fromFrame: number;
  /** Last frame index */
  toFrame: number;
  /** Animation direction */
  direction: number;
  /** Repeat count (0 = infinite) */
  repeat: number;
  /** Tag color */
  color: { r: number; g: number; b: number };
}

/**
 * Slice metadata summary.
 */
export interface SliceInfo {
  /** Slice name */
  name: string;
  /** Number of keys */
  keyCount: number;
  /** Has 9-patch data */
  has9Patch: boolean;
  /** Has pivot data */
  hasPivot: boolean;
}

/**
 * Frame metadata summary.
 */
export interface FrameInfo {
  /** Frame index */
  index: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Number of cels in this frame */
  celCount: number;
}

/**
 * Tileset metadata summary.
 */
export interface TilesetInfo {
  /** Tileset ID */
  id: number;
  /** Tileset name */
  name: string;
  /** Number of tiles */
  tileCount: number;
  /** Tile width */
  tileWidth: number;
  /** Tile height */
  tileHeight: number;
  /** Base index */
  baseIndex: number;
  /** Has external link */
  hasExternalLink: boolean;
  /** Has embedded tiles */
  hasEmbeddedTiles: boolean;
}

/** Layer flags */
const LayerFlags = {
  Visible: 1,
  Editable: 2,
  Background: 8,
};

/** Slice flags */
const SliceFlags = {
  Has9Patch: 1,
  HasPivot: 2,
};

/** Tileset flags */
const TilesetFlags = {
  IncludeLinkToExternal: 1,
  IncludeTilesInFile: 2,
};

/**
 * List all layers with metadata (no pixel decoding).
 *
 * @param file - The Aseprite file
 * @returns Array of layer info
 */
export function listLayers(file: AsepriteFile): LayerInfo[] {
  return file.layers.map((layer, index) => ({
    index,
    name: layer.name,
    type: layer.type,
    childLevel: layer.childLevel,
    visible: (layer.flags & LayerFlags.Visible) !== 0,
    editable: (layer.flags & LayerFlags.Editable) !== 0,
    background: (layer.flags & LayerFlags.Background) !== 0,
    blendMode: layer.blendMode,
    opacity: layer.opacity,
  }));
}

/**
 * List all tags with metadata.
 *
 * @param file - The Aseprite file
 * @returns Array of tag info
 */
export function listTags(file: AsepriteFile): TagInfo[] {
  if (!file.tags) return [];

  return file.tags.map((tag) => ({
    name: tag.name,
    fromFrame: tag.fromFrame,
    toFrame: tag.toFrame,
    direction: tag.direction,
    repeat: tag.repeat,
    color: { ...tag.color },
  }));
}

/**
 * List all slices with metadata.
 *
 * @param file - The Aseprite file
 * @returns Array of slice info
 */
export function listSlices(file: AsepriteFile): SliceInfo[] {
  if (!file.slices) return [];

  return file.slices.map((slice) => ({
    name: slice.name,
    keyCount: slice.keys.length,
    has9Patch: (slice.flags & SliceFlags.Has9Patch) !== 0,
    hasPivot: (slice.flags & SliceFlags.HasPivot) !== 0,
  }));
}

/**
 * List all frames with metadata.
 *
 * @param file - The Aseprite file
 * @returns Array of frame info
 */
export function listFrames(file: AsepriteFile): FrameInfo[] {
  return file.frames.map((frame, index) => ({
    index,
    durationMs: frame.durationMs,
    celCount: frame.cels.length,
  }));
}

/**
 * List all tilesets with metadata.
 *
 * @param file - The Aseprite file
 * @returns Array of tileset info
 */
export function listTilesets(file: AsepriteFile): TilesetInfo[] {
  if (!file.tilesets) return [];

  return file.tilesets.map((tileset) => ({
    id: tileset.id,
    name: tileset.name,
    tileCount: tileset.tileCount,
    tileWidth: tileset.tileWidth,
    tileHeight: tileset.tileHeight,
    baseIndex: tileset.baseIndex,
    hasExternalLink: (tileset.flags & TilesetFlags.IncludeLinkToExternal) !== 0,
    hasEmbeddedTiles: (tileset.flags & TilesetFlags.IncludeTilesInFile) !== 0,
  }));
}

/**
 * Get total animation duration in milliseconds.
 *
 * @param file - The Aseprite file
 * @returns Total duration
 */
export function getTotalDuration(file: AsepriteFile): number {
  return file.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
}

/**
 * Get sprite dimensions.
 *
 * @param file - The Aseprite file
 * @returns Width and height
 */
export function getSpriteDimensions(
  file: AsepriteFile,
): { width: number; height: number } {
  return {
    width: file.header.width,
    height: file.header.height,
  };
}

/**
 * Get color depth.
 *
 * @param file - The Aseprite file
 * @returns Color depth (8, 16, or 32)
 */
export function getColorDepth(file: AsepriteFile): 8 | 16 | 32 {
  return file.header.colorDepth as 8 | 16 | 32;
}

/**
 * Get palette size.
 *
 * @param file - The Aseprite file
 * @returns Palette size or 0 if no palette
 */
export function getPaletteSize(file: AsepriteFile): number {
  return file.palette?.size ?? 0;
}
