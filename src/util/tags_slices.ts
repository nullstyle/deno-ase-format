/**
 * Tag and slice utilities for animation and region handling.
 * @module
 */

import type { AsepriteFile, SliceKey, Tag } from "../types.ts";
import { TagDirection } from "../types.ts";

/**
 * Resolved tag frame range with animation info.
 */
export interface TagFrameRange {
  /** Tag name */
  name: string;
  /** First frame index */
  from: number;
  /** Last frame index */
  to: number;
  /** Animation direction */
  direction: number;
  /** Repeat count (0 = infinite) */
  repeat: number;
  /** Total frame count in the tag */
  frameCount: number;
  /** Frame indices in playback order */
  playbackOrder: number[];
}

/**
 * Get tag information with resolved frame range.
 *
 * @param file - The Aseprite file
 * @param tagName - Name of the tag to find
 * @returns Tag frame range or undefined if not found
 */
export function getTagFrameRange(
  file: AsepriteFile,
  tagName: string,
): TagFrameRange | undefined {
  if (!file.tags) return undefined;

  const tag = file.tags.find((t) => t.name === tagName);
  if (!tag) return undefined;

  return resolveTagFrameRange(tag);
}

/**
 * Resolve a tag to its frame range with playback order.
 *
 * @param tag - The tag to resolve
 * @returns Resolved tag frame range
 */
export function resolveTagFrameRange(tag: Tag): TagFrameRange {
  const from = tag.fromFrame;
  const to = tag.toFrame;
  const frameCount = to - from + 1;

  // Build playback order based on direction
  const playbackOrder: number[] = [];

  switch (tag.direction) {
    case TagDirection.Forward:
      for (let i = from; i <= to; i++) {
        playbackOrder.push(i);
      }
      break;

    case TagDirection.Reverse:
      for (let i = to; i >= from; i--) {
        playbackOrder.push(i);
      }
      break;

    case TagDirection.PingPong:
      // Forward, then reverse (excluding endpoints on reverse)
      for (let i = from; i <= to; i++) {
        playbackOrder.push(i);
      }
      for (let i = to - 1; i > from; i--) {
        playbackOrder.push(i);
      }
      break;

    case TagDirection.PingPongReverse:
      // Reverse, then forward (excluding endpoints on forward)
      for (let i = to; i >= from; i--) {
        playbackOrder.push(i);
      }
      for (let i = from + 1; i < to; i++) {
        playbackOrder.push(i);
      }
      break;
  }

  return {
    name: tag.name,
    from,
    to,
    direction: tag.direction,
    repeat: tag.repeat,
    frameCount,
    playbackOrder,
  };
}

/**
 * Get all tags as resolved frame ranges.
 *
 * @param file - The Aseprite file
 * @returns Array of resolved tag frame ranges
 */
export function getAllTagFrameRanges(file: AsepriteFile): TagFrameRange[] {
  if (!file.tags) return [];
  return file.tags.map(resolveTagFrameRange);
}

/**
 * Find tags that contain a specific frame.
 *
 * @param file - The Aseprite file
 * @param frameIndex - Frame index to search for
 * @returns Array of tags containing the frame
 */
export function getTagsAtFrame(file: AsepriteFile, frameIndex: number): Tag[] {
  if (!file.tags) return [];
  return file.tags.filter((t) =>
    frameIndex >= t.fromFrame && frameIndex <= t.toFrame
  );
}

/**
 * Resolved slice key with computed bounds.
 */
export interface ResolvedSliceKey {
  /** Slice name */
  name: string;
  /** Frame index this key applies to */
  frameIndex: number;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** 9-patch center bounds (if applicable) */
  center?: { x: number; y: number; width: number; height: number };
  /** Pivot point (if applicable) */
  pivot?: { x: number; y: number };
}

/**
 * Get slice bounds at a specific frame.
 * Finds the most recent slice key that applies to the given frame.
 *
 * @param file - The Aseprite file
 * @param sliceName - Name of the slice
 * @param frameIndex - Frame index
 * @returns Resolved slice key or undefined
 */
export function getSliceAtFrame(
  file: AsepriteFile,
  sliceName: string,
  frameIndex: number,
): ResolvedSliceKey | undefined {
  if (!file.slices) return undefined;

  const slice = file.slices.find((s) => s.name === sliceName);
  if (!slice || slice.keys.length === 0) return undefined;

  // Find the key that applies to this frame
  // Keys are sorted by frameIndex, find the last one <= frameIndex
  let applicableKey: SliceKey | undefined;

  for (const key of slice.keys) {
    if (key.frameIndex <= frameIndex) {
      applicableKey = key;
    } else {
      break;
    }
  }

  if (!applicableKey) return undefined;

  return {
    name: sliceName,
    frameIndex: applicableKey.frameIndex,
    x: applicableKey.x,
    y: applicableKey.y,
    width: applicableKey.width,
    height: applicableKey.height,
    center: applicableKey.center,
    pivot: applicableKey.pivot,
  };
}

/**
 * Get all slices at a specific frame.
 *
 * @param file - The Aseprite file
 * @param frameIndex - Frame index
 * @returns Array of resolved slice keys
 */
export function getAllSlicesAtFrame(
  file: AsepriteFile,
  frameIndex: number,
): ResolvedSliceKey[] {
  if (!file.slices) return [];

  const result: ResolvedSliceKey[] = [];

  for (const slice of file.slices) {
    const resolved = getSliceAtFrame(file, slice.name, frameIndex);
    if (resolved) {
      result.push(resolved);
    }
  }

  return result;
}

/**
 * List all slice names in the file.
 *
 * @param file - The Aseprite file
 * @returns Array of slice names
 */
export function listSliceNames(file: AsepriteFile): string[] {
  if (!file.slices) return [];
  return file.slices.map((s) => s.name);
}

/**
 * List all tag names in the file.
 *
 * @param file - The Aseprite file
 * @returns Array of tag names
 */
export function listTagNames(file: AsepriteFile): string[] {
  if (!file.tags) return [];
  return file.tags.map((t) => t.name);
}
