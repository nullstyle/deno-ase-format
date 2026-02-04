/**
 * Unit tests for zlib compression utilities.
 */

import { assertEquals } from "@std/assert";
import {
  deflateZlib,
  hasCompressionStreams,
  inflateZlib,
} from "../src/util/zlib.ts";

Deno.test("hasCompressionStreams - returns true in Deno", () => {
  assertEquals(hasCompressionStreams(), true);
});

Deno.test("deflateZlib/inflateZlib - round-trip", async () => {
  const original = new TextEncoder().encode(
    "Hello, World! This is a test of zlib compression.",
  );

  const compressed = await deflateZlib(original);
  const decompressed = await inflateZlib(compressed);

  assertEquals(decompressed, original);
});

Deno.test("deflateZlib/inflateZlib - empty data", async () => {
  const original = new Uint8Array(0);

  const compressed = await deflateZlib(original);
  const decompressed = await inflateZlib(compressed);

  assertEquals(decompressed, original);
});

Deno.test("deflateZlib/inflateZlib - binary data", async () => {
  const original = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    original[i] = i;
  }

  const compressed = await deflateZlib(original);
  const decompressed = await inflateZlib(compressed);

  assertEquals(decompressed, original);
});

Deno.test("deflateZlib/inflateZlib - large data", async () => {
  // Create 1MB of data
  const original = new Uint8Array(1024 * 1024);
  for (let i = 0; i < original.length; i++) {
    original[i] = i % 256;
  }

  const compressed = await deflateZlib(original);
  const decompressed = await inflateZlib(compressed);

  assertEquals(decompressed.length, original.length);
  assertEquals(decompressed, original);

  // Compression should reduce size for repetitive data
  assertEquals(compressed.length < original.length, true);
});

Deno.test("deflateZlib/inflateZlib - random data", async () => {
  const original = new Uint8Array(1000);
  crypto.getRandomValues(original);

  const compressed = await deflateZlib(original);
  const decompressed = await inflateZlib(compressed);

  assertEquals(decompressed, original);
});
