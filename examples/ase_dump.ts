#!/usr/bin/env -S deno run --allow-read

/**
 * Example: Dump Aseprite file metadata to JSON.
 *
 * Usage:
 *   deno run --allow-read examples/ase_dump.ts sprite.aseprite
 */

import {
  getColorDepth,
  getPaletteSize,
  getSpriteDimensions,
  getTotalDuration,
  listFrames,
  listLayers,
  listSlices,
  listTags,
  listTilesets,
  parseAseprite,
} from "../mod.ts";

async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.error("Usage: ase_dump.ts <file.aseprite>");
    Deno.exit(1);
  }

  const filePath = args[0];
  const bytes = await Deno.readFile(filePath);
  const file = parseAseprite(bytes);

  const dims = getSpriteDimensions(file);

  const summary = {
    file: filePath,
    dimensions: dims,
    colorDepth: getColorDepth(file),
    paletteSize: getPaletteSize(file),
    totalDuration: getTotalDuration(file),
    frameCount: file.frames.length,
    layerCount: file.layers.length,
    tagCount: file.tags?.length ?? 0,
    sliceCount: file.slices?.length ?? 0,
    tilesetCount: file.tilesets?.length ?? 0,
    header: {
      flags: file.header.flags,
      transparentIndex: file.header.transparentIndex,
      pixelRatio: `${file.header.pixelWidth}:${file.header.pixelHeight}`,
      grid: {
        x: file.header.gridX,
        y: file.header.gridY,
        width: file.header.gridWidth,
        height: file.header.gridHeight,
      },
    },
    layers: listLayers(file),
    frames: listFrames(file),
    tags: listTags(file),
    slices: listSlices(file),
    tilesets: listTilesets(file),
    colorProfile: file.colorProfile
      ? {
        type: file.colorProfile.type,
        flags: file.colorProfile.flags,
        gamma: file.colorProfile.gamma,
        hasICC: file.colorProfile.iccData !== undefined,
      }
      : null,
    externalFiles: file.externalFiles ?? [],
    unknownChunkCount: file.unknownChunks?.length ?? 0,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
