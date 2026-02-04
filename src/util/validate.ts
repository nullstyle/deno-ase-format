/**
 * Validation utilities for Aseprite files.
 * @module
 */

import type { AsepriteFile, ValidationIssue } from "../types.ts";
import {
  CelType,
  ColorDepth,
  LayerType,
  ValidationSeverity,
} from "../types.ts";

/**
 * Validate an Aseprite file structure.
 *
 * @param file - The Aseprite file to validate
 * @returns Array of validation issues
 */
export function validateAseprite(file: AsepriteFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate header
  validateHeader(file, issues);

  // Validate layers
  validateLayers(file, issues);

  // Validate frames and cels
  validateFrames(file, issues);

  // Validate palette
  validatePalette(file, issues);

  // Validate tags
  validateTags(file, issues);

  // Validate slices
  validateSlices(file, issues);

  // Validate tilesets
  validateTilesets(file, issues);

  return issues;
}

function validateHeader(file: AsepriteFile, issues: ValidationIssue[]): void {
  const header = file.header;

  // Check dimensions
  if (header.width <= 0 || header.height <= 0) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "INVALID_DIMENSIONS",
      message: `Invalid sprite dimensions: ${header.width}x${header.height}`,
    });
  }

  // Check color depth
  if (![8, 16, 32].includes(header.colorDepth)) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "INVALID_COLOR_DEPTH",
      message: `Invalid color depth: ${header.colorDepth}`,
    });
  }

  // Check frame count
  if (header.frameCount <= 0) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "NO_FRAMES",
      message: "File has no frames",
    });
  }

  // Check frame count matches
  if (header.frameCount !== file.frames.length) {
    issues.push({
      severity: ValidationSeverity.Warning,
      code: "FRAME_COUNT_MISMATCH",
      message:
        `Header frame count (${header.frameCount}) doesn't match actual frames (${file.frames.length})`,
    });
  }

  // Check pixel ratio
  if (header.pixelWidth === 0 || header.pixelHeight === 0) {
    issues.push({
      severity: ValidationSeverity.Info,
      code: "ZERO_PIXEL_RATIO",
      message: "Pixel ratio contains zero values",
    });
  }
}

function validateLayers(file: AsepriteFile, issues: ValidationIssue[]): void {
  if (file.layers.length === 0) {
    issues.push({
      severity: ValidationSeverity.Warning,
      code: "NO_LAYERS",
      message: "File has no layers",
    });
    return;
  }

  // Check layer hierarchy
  let maxChildLevel = 0;
  for (let i = 0; i < file.layers.length; i++) {
    const layer = file.layers[i];

    // Check for valid layer type
    if (
      ![LayerType.Normal, LayerType.Group, LayerType.Tilemap].includes(
        layer.type,
      )
    ) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "UNKNOWN_LAYER_TYPE",
        message: `Layer ${i} ("${layer.name}") has unknown type: ${layer.type}`,
        location: { layerIndex: i },
      });
    }

    // Check child level consistency
    if (layer.childLevel > maxChildLevel + 1) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "INVALID_CHILD_LEVEL",
        message:
          `Layer ${i} ("${layer.name}") has invalid child level jump: ${layer.childLevel}`,
        location: { layerIndex: i },
      });
    }

    if (layer.type === LayerType.Group) {
      maxChildLevel = layer.childLevel + 1;
    } else {
      maxChildLevel = layer.childLevel;
    }

    // Check opacity
    if (layer.opacity > 255) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "INVALID_OPACITY",
        message:
          `Layer ${i} ("${layer.name}") has invalid opacity: ${layer.opacity}`,
        location: { layerIndex: i },
      });
    }

    // Check tilemap layer has tileset reference
    if (layer.type === LayerType.Tilemap && layer.tilesetIndex === undefined) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "MISSING_TILESET_REFERENCE",
        message:
          `Tilemap layer ${i} ("${layer.name}") has no tileset reference`,
        location: { layerIndex: i },
      });
    }
  }
}

function validateFrames(file: AsepriteFile, issues: ValidationIssue[]): void {
  for (let frameIdx = 0; frameIdx < file.frames.length; frameIdx++) {
    const frame = file.frames[frameIdx];

    // Check duration
    if (frame.durationMs <= 0) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "ZERO_DURATION",
        message:
          `Frame ${frameIdx} has zero or negative duration: ${frame.durationMs}ms`,
        location: { frameIndex: frameIdx },
      });
    }

    // Validate cels
    for (const cel of frame.cels) {
      // Check layer index
      if (cel.layerIndex < 0 || cel.layerIndex >= file.layers.length) {
        issues.push({
          severity: ValidationSeverity.Error,
          code: "INVALID_LAYER_INDEX",
          message:
            `Cel in frame ${frameIdx} references invalid layer index: ${cel.layerIndex}`,
          location: { frameIndex: frameIdx },
        });
      }

      // Check linked cel reference
      if (cel.type === CelType.Linked) {
        if (
          cel.linkedFrameIndex < 0 || cel.linkedFrameIndex >= file.frames.length
        ) {
          issues.push({
            severity: ValidationSeverity.Error,
            code: "INVALID_LINKED_FRAME",
            message:
              `Linked cel in frame ${frameIdx} references invalid frame: ${cel.linkedFrameIndex}`,
            location: { frameIndex: frameIdx },
          });
        } else if (cel.linkedFrameIndex >= frameIdx) {
          issues.push({
            severity: ValidationSeverity.Warning,
            code: "FORWARD_LINKED_CEL",
            message:
              `Linked cel in frame ${frameIdx} references forward frame: ${cel.linkedFrameIndex}`,
            location: { frameIndex: frameIdx },
          });
        }
      }

      // Check cel opacity
      if (cel.opacity > 255) {
        issues.push({
          severity: ValidationSeverity.Warning,
          code: "INVALID_CEL_OPACITY",
          message:
            `Cel in frame ${frameIdx} has invalid opacity: ${cel.opacity}`,
          location: { frameIndex: frameIdx },
        });
      }
    }
  }
}

function validatePalette(file: AsepriteFile, issues: ValidationIssue[]): void {
  // Indexed mode requires palette
  if (file.header.colorDepth === ColorDepth.Indexed && !file.palette) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "MISSING_PALETTE",
      message: "Indexed color mode requires a palette",
    });
  }

  if (file.palette) {
    // Check palette entries
    if (file.palette.entries.length === 0) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "EMPTY_PALETTE",
        message: "Palette has no entries",
      });
    }

    // Check transparent index
    if (file.header.colorDepth === ColorDepth.Indexed) {
      if (file.header.transparentIndex >= file.palette.size) {
        issues.push({
          severity: ValidationSeverity.Warning,
          code: "INVALID_TRANSPARENT_INDEX",
          message:
            `Transparent index (${file.header.transparentIndex}) exceeds palette size (${file.palette.size})`,
        });
      }
    }
  }
}

function validateTags(file: AsepriteFile, issues: ValidationIssue[]): void {
  if (!file.tags) return;

  const frameCount = file.frames.length;

  for (let i = 0; i < file.tags.length; i++) {
    const tag = file.tags[i];

    // Check frame range
    if (tag.fromFrame < 0 || tag.fromFrame >= frameCount) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "INVALID_TAG_RANGE",
        message: `Tag "${tag.name}" has invalid start frame: ${tag.fromFrame}`,
      });
    }

    if (tag.toFrame < 0 || tag.toFrame >= frameCount) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "INVALID_TAG_RANGE",
        message: `Tag "${tag.name}" has invalid end frame: ${tag.toFrame}`,
      });
    }

    if (tag.fromFrame > tag.toFrame) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "INVALID_TAG_RANGE",
        message:
          `Tag "${tag.name}" has inverted range: ${tag.fromFrame} > ${tag.toFrame}`,
      });
    }

    // Check for empty name
    if (!tag.name || tag.name.trim() === "") {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "EMPTY_TAG_NAME",
        message: `Tag at index ${i} has empty name`,
      });
    }
  }
}

function validateSlices(file: AsepriteFile, issues: ValidationIssue[]): void {
  if (!file.slices) return;

  const frameCount = file.frames.length;

  for (const slice of file.slices) {
    // Check for empty name
    if (!slice.name || slice.name.trim() === "") {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "EMPTY_SLICE_NAME",
        message: "Slice has empty name",
      });
    }

    // Check keys
    if (slice.keys.length === 0) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "EMPTY_SLICE_KEYS",
        message: `Slice "${slice.name}" has no keys`,
      });
    }

    for (const key of slice.keys) {
      if (key.frameIndex < 0 || key.frameIndex >= frameCount) {
        issues.push({
          severity: ValidationSeverity.Error,
          code: "INVALID_SLICE_KEY_FRAME",
          message:
            `Slice "${slice.name}" has key with invalid frame: ${key.frameIndex}`,
        });
      }

      if (key.width <= 0 || key.height <= 0) {
        issues.push({
          severity: ValidationSeverity.Warning,
          code: "INVALID_SLICE_DIMENSIONS",
          message:
            `Slice "${slice.name}" has key with invalid dimensions: ${key.width}x${key.height}`,
        });
      }
    }
  }
}

function validateTilesets(file: AsepriteFile, issues: ValidationIssue[]): void {
  if (!file.tilesets) return;

  const tilesetIds = new Set<number>();

  for (const tileset of file.tilesets) {
    // Check for duplicate IDs
    if (tilesetIds.has(tileset.id)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "DUPLICATE_TILESET_ID",
        message: `Duplicate tileset ID: ${tileset.id}`,
      });
    }
    tilesetIds.add(tileset.id);

    // Check dimensions
    if (tileset.tileWidth <= 0 || tileset.tileHeight <= 0) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "INVALID_TILE_DIMENSIONS",
        message:
          `Tileset "${tileset.name}" has invalid tile dimensions: ${tileset.tileWidth}x${tileset.tileHeight}`,
      });
    }

    // Check tile count
    if (tileset.tileCount <= 0) {
      issues.push({
        severity: ValidationSeverity.Warning,
        code: "EMPTY_TILESET",
        message: `Tileset "${tileset.name}" has no tiles`,
      });
    }
  }
}
