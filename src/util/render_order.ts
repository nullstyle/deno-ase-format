/**
 * Render order utilities for determining cel drawing order.
 * @module
 */

import type { AsepriteFile, Cel, Layer } from "../types.ts";
import { LayerFlags, LayerType } from "../types.ts";

/**
 * Information about a cel for rendering.
 */
export interface RenderCel {
  /** The cel data */
  cel: Cel;
  /** The layer this cel belongs to */
  layer: Layer;
  /** Layer index */
  layerIndex: number;
  /** Computed render order (lower = draw first) */
  order: number;
}

/**
 * Get the render order for cels in a frame.
 * Implements the z-index algorithm from the Aseprite spec:
 * - Cels are sorted by (layerIndex + zIndex)
 * - Ties are broken by zIndex (higher zIndex = later in draw order)
 *
 * @param file - The Aseprite file
 * @param frameIndex - Frame index to get render order for
 * @returns Array of layer indices in render order (first = bottom, last = top)
 */
export function getFrameRenderOrder(
  file: AsepriteFile,
  frameIndex: number,
): number[] {
  if (frameIndex < 0 || frameIndex >= file.frames.length) {
    return [];
  }

  const frame = file.frames[frameIndex];
  const cels = frame.cels;

  // Build render info for each cel
  const renderCels: Array<
    { layerIndex: number; zIndex: number; order: number }
  > = [];

  for (const cel of cels) {
    const layer = file.layers[cel.layerIndex];
    if (!layer) continue;

    // Skip invisible layers
    if ((layer.flags & LayerFlags.Visible) === 0) continue;

    // Skip reference layers (they're not rendered)
    if (layer.flags & LayerFlags.Reference) continue;

    // Skip group layers (they don't have pixels)
    if (layer.type === LayerType.Group) continue;

    const order = cel.layerIndex + cel.zIndex;
    renderCels.push({
      layerIndex: cel.layerIndex,
      zIndex: cel.zIndex,
      order,
    });
  }

  // Sort by order, then by zIndex for ties
  renderCels.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.zIndex - b.zIndex;
  });

  return renderCels.map((rc) => rc.layerIndex);
}

/**
 * Get cels in render order for a frame.
 *
 * @param file - The Aseprite file
 * @param frameIndex - Frame index
 * @returns Array of RenderCel objects in render order
 */
export function getCelsInRenderOrder(
  file: AsepriteFile,
  frameIndex: number,
): RenderCel[] {
  if (frameIndex < 0 || frameIndex >= file.frames.length) {
    return [];
  }

  const frame = file.frames[frameIndex];
  const result: RenderCel[] = [];

  for (const cel of frame.cels) {
    const layer = file.layers[cel.layerIndex];
    if (!layer) continue;

    // Skip invisible layers
    if ((layer.flags & LayerFlags.Visible) === 0) continue;

    // Skip reference layers
    if (layer.flags & LayerFlags.Reference) continue;

    // Skip group layers
    if (layer.type === LayerType.Group) continue;

    const order = cel.layerIndex + cel.zIndex;
    result.push({
      cel,
      layer,
      layerIndex: cel.layerIndex,
      order,
    });
  }

  // Sort by order, then by zIndex for ties
  result.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.cel.zIndex - b.cel.zIndex;
  });

  return result;
}

/**
 * Get all visible layers in render order (bottom to top).
 *
 * @param file - The Aseprite file
 * @returns Array of layer indices in render order
 */
export function getVisibleLayersInOrder(file: AsepriteFile): number[] {
  const result: number[] = [];

  for (let i = 0; i < file.layers.length; i++) {
    const layer = file.layers[i];

    // Skip invisible layers
    if ((layer.flags & LayerFlags.Visible) === 0) continue;

    // Skip reference layers
    if (layer.flags & LayerFlags.Reference) continue;

    // Skip group layers
    if (layer.type === LayerType.Group) continue;

    result.push(i);
  }

  return result;
}
