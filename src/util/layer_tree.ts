/**
 * Layer tree utilities for building hierarchical layer structure.
 * @module
 */

import type { Layer } from "../types.ts";
import { LayerType } from "../types.ts";

/**
 * A node in the layer tree hierarchy.
 */
export interface LayerNode {
  /** The layer data */
  layer: Layer;
  /** Index in the flat layers array */
  index: number;
  /** Child layers (for group layers) */
  children: LayerNode[];
  /** Parent node (null for root layers) */
  parent: LayerNode | null;
}

/**
 * Build a hierarchical tree structure from flat layer list.
 * Uses childLevel to determine parent-child relationships.
 *
 * @param layers - Flat array of layers
 * @returns Array of root layer nodes
 */
export function buildLayerTree(layers: Layer[]): LayerNode[] {
  const roots: LayerNode[] = [];
  const stack: LayerNode[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const node: LayerNode = {
      layer,
      index: i,
      children: [],
      parent: null,
    };

    // Pop stack until we find the parent level
    while (
      stack.length > 0 &&
      stack[stack.length - 1].layer.childLevel >= layer.childLevel
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Root level layer
      roots.push(node);
    } else {
      // Child of the layer at top of stack
      const parent = stack[stack.length - 1];
      node.parent = parent;
      parent.children.push(node);
    }

    // If this is a group, push it onto the stack
    if (layer.type === LayerType.Group) {
      stack.push(node);
    }
  }

  return roots;
}

/**
 * Flatten a layer tree back to an array (depth-first order).
 *
 * @param roots - Root layer nodes
 * @returns Flat array of layer nodes
 */
export function flattenLayerTree(roots: LayerNode[]): LayerNode[] {
  const result: LayerNode[] = [];

  function visit(node: LayerNode): void {
    result.push(node);
    for (const child of node.children) {
      visit(child);
    }
  }

  for (const root of roots) {
    visit(root);
  }

  return result;
}

/**
 * Find a layer by name in the tree.
 *
 * @param roots - Root layer nodes
 * @param name - Layer name to find
 * @returns Found layer node or undefined
 */
export function findLayerByName(
  roots: LayerNode[],
  name: string,
): LayerNode | undefined {
  function search(nodes: LayerNode[]): LayerNode | undefined {
    for (const node of nodes) {
      if (node.layer.name === name) {
        return node;
      }
      const found = search(node.children);
      if (found) return found;
    }
    return undefined;
  }

  return search(roots);
}

/**
 * Get the full path of a layer (including parent names).
 *
 * @param node - Layer node
 * @param separator - Path separator (default: "/")
 * @returns Full path string
 */
export function getLayerPath(node: LayerNode, separator = "/"): string {
  const parts: string[] = [];
  let current: LayerNode | null = node;

  while (current) {
    parts.unshift(current.layer.name);
    current = current.parent;
  }

  return parts.join(separator);
}

/**
 * Check if a layer is visible (considering parent visibility).
 *
 * @param node - Layer node
 * @returns True if layer and all parents are visible
 */
export function isLayerVisible(node: LayerNode): boolean {
  const VISIBLE_FLAG = 1;
  let current: LayerNode | null = node;

  while (current) {
    if ((current.layer.flags & VISIBLE_FLAG) === 0) {
      return false;
    }
    current = current.parent;
  }

  return true;
}
