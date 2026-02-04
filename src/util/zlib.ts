/**
 * Zlib compression utilities using Web Compression Streams.
 * Aseprite uses zlib (RFC1950) for compressed payloads.
 * The Web Compression Streams "deflate" format is zlib-wrapped deflate.
 * @module
 */

import type { CompressionProvider } from "../types.ts";

/**
 * Check if Web Compression Streams are available.
 */
export function hasCompressionStreams(): boolean {
  return (
    typeof CompressionStream !== "undefined" &&
    typeof DecompressionStream !== "undefined"
  );
}

/**
 * Inflate (decompress) zlib-compressed data using Web Compression Streams.
 * @param data - Compressed data
 * @returns Decompressed data
 */
export async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (!hasCompressionStreams()) {
    throw new Error(
      "DecompressionStream not available. " +
        "Please provide a CompressionProvider in options.",
    );
  }

  // Create a readable stream from the compressed data
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  // Pipe through decompression - use type assertion for compatibility
  const decompressor = new DecompressionStream("deflate");
  const decompressedStream = stream.pipeThrough(
    decompressor as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );

  // Collect the result
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Concatenate chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Deflate (compress) data using zlib format via Web Compression Streams.
 * @param data - Uncompressed data
 * @returns Compressed data
 */
export async function deflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (!hasCompressionStreams()) {
    throw new Error(
      "CompressionStream not available. " +
        "Please provide a CompressionProvider in options.",
    );
  }

  // Create a readable stream from the uncompressed data
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  // Pipe through compression - use type assertion for compatibility
  const compressor = new CompressionStream("deflate");
  const compressedStream = stream.pipeThrough(
    compressor as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );

  // Collect the result
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Concatenate chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Default compression provider using Web Compression Streams.
 */
export const defaultCompressionProvider: CompressionProvider = {
  inflateZlib,
  deflateZlib,
};

/**
 * Get a compression provider, using the provided one or falling back to default.
 * @param provider - Optional custom provider
 * @returns Compression provider to use
 */
export function getCompressionProvider(
  provider?: CompressionProvider,
): CompressionProvider {
  if (provider) {
    return provider;
  }
  return defaultCompressionProvider;
}
