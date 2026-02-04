#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Example: Extract frames from an animation tag as raw RGBA buffers.
 *
 * Usage:
 *   deno run --allow-read --allow-write examples/ase_extract_tag.ts sprite.aseprite Walk ./output
 *
 * This will create:
 *   - ./output/manifest.json - Frame metadata
 *   - ./output/frame_0.rgba - Raw RGBA pixel data for each frame
 */

import {
  convertToRgba,
  decodeCelPixels,
  getSpriteDimensions,
  getTagFrameRange,
  listTagNames,
  parseAseprite,
  resolveLinkedCel,
} from "../mod.ts";
import { CelType } from "../mod.ts";

async function main() {
  const args = Deno.args;

  if (args.length < 3) {
    console.error(
      "Usage: ase_extract_tag.ts <file.aseprite> <tag_name> <output_dir>",
    );
    Deno.exit(1);
  }

  const [filePath, tagName, outputDir] = args;

  // Read and parse file
  const bytes = await Deno.readFile(filePath);
  const file = parseAseprite(bytes);

  // Find the tag
  const tagRange = getTagFrameRange(file, tagName);
  if (!tagRange) {
    console.error(`Tag "${tagName}" not found.`);
    console.error("Available tags:", listTagNames(file).join(", ") || "(none)");
    Deno.exit(1);
  }

  // Create output directory
  await Deno.mkdir(outputDir, { recursive: true });

  const dims = getSpriteDimensions(file);
  const manifest = {
    source: filePath,
    tag: tagName,
    width: dims.width,
    height: dims.height,
    colorDepth: file.header.colorDepth,
    frameRange: {
      from: tagRange.from,
      to: tagRange.to,
    },
    direction: tagRange.direction,
    repeat: tagRange.repeat,
    frames: [] as Array<{
      index: number;
      durationMs: number;
      file: string;
      cels: Array<{
        layerIndex: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }>,
  };

  console.log(
    `Extracting tag "${tagName}" (frames ${tagRange.from}-${tagRange.to})`,
  );

  for (let i = 0; i < tagRange.playbackOrder.length; i++) {
    const frameIndex = tagRange.playbackOrder[i];
    const frame = file.frames[frameIndex];

    const frameData = {
      index: frameIndex,
      durationMs: frame.durationMs,
      file: `frame_${i}.rgba`,
      cels: [] as typeof manifest.frames[0]["cels"],
    };

    // Create a blank canvas for compositing
    const canvas = new Uint8Array(dims.width * dims.height * 4);

    // Process cels (simplified - just extracts, doesn't composite)
    for (const cel of frame.cels) {
      // Resolve linked cels
      const resolvedCel = resolveLinkedCel(file, cel);

      // Skip non-image cels
      if (
        resolvedCel.type !== CelType.RawImage &&
        resolvedCel.type !== CelType.CompressedImage
      ) {
        continue;
      }

      try {
        const decoded = await decodeCelPixels(file, resolvedCel);
        const rgba = convertToRgba(file, decoded);

        // Simple blit to canvas (no blending)
        const celWidth = decoded.width;
        const celHeight = decoded.height;
        const celX = resolvedCel.x;
        const celY = resolvedCel.y;

        for (let y = 0; y < celHeight; y++) {
          for (let x = 0; x < celWidth; x++) {
            const canvasX = celX + x;
            const canvasY = celY + y;

            if (canvasX < 0 || canvasX >= dims.width) continue;
            if (canvasY < 0 || canvasY >= dims.height) continue;

            const srcIdx = (y * celWidth + x) * 4;
            const dstIdx = (canvasY * dims.width + canvasX) * 4;

            // Simple alpha blend
            const srcA = rgba[srcIdx + 3] / 255;
            if (srcA > 0) {
              canvas[dstIdx] = rgba[srcIdx];
              canvas[dstIdx + 1] = rgba[srcIdx + 1];
              canvas[dstIdx + 2] = rgba[srcIdx + 2];
              canvas[dstIdx + 3] = rgba[srcIdx + 3];
            }
          }
        }

        frameData.cels.push({
          layerIndex: cel.layerIndex,
          x: celX,
          y: celY,
          width: celWidth,
          height: celHeight,
        });
      } catch (e) {
        console.warn(`  Warning: Could not decode cel: ${e}`);
      }
    }

    // Write frame data
    const framePath = `${outputDir}/${frameData.file}`;
    await Deno.writeFile(framePath, canvas);
    console.log(`  Frame ${i} (source: ${frameIndex}): ${framePath}`);

    manifest.frames.push(frameData);
  }

  // Write manifest
  const manifestPath = `${outputDir}/manifest.json`;
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${manifestPath}`);
  console.log(`Extracted ${manifest.frames.length} frames.`);
}

main();
