/**
 * Unit tests for BinaryReader and BinaryWriter.
 */

import { assertEquals, assertThrows } from "@std/assert";
import { BinaryReader } from "../src/binary/reader.ts";
import { BinaryWriter } from "../src/binary/writer.ts";

Deno.test("BinaryReader - u8", () => {
  const data = new Uint8Array([0x00, 0x7f, 0xff]);
  const reader = new BinaryReader(data);

  assertEquals(reader.u8(), 0x00);
  assertEquals(reader.u8(), 0x7f);
  assertEquals(reader.u8(), 0xff);
});

Deno.test("BinaryReader - u16 little-endian", () => {
  const data = new Uint8Array([0x34, 0x12, 0xff, 0xff]);
  const reader = new BinaryReader(data);

  assertEquals(reader.u16(), 0x1234);
  assertEquals(reader.u16(), 0xffff);
});

Deno.test("BinaryReader - i16 little-endian", () => {
  const data = new Uint8Array([0xff, 0xff, 0x00, 0x80]);
  const reader = new BinaryReader(data);

  assertEquals(reader.i16(), -1);
  assertEquals(reader.i16(), -32768);
});

Deno.test("BinaryReader - u32 little-endian", () => {
  const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
  const reader = new BinaryReader(data);

  assertEquals(reader.u32(), 0x12345678);
});

Deno.test("BinaryReader - i32 little-endian", () => {
  const data = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
  const reader = new BinaryReader(data);

  assertEquals(reader.i32(), -1);
});

Deno.test("BinaryReader - u64 little-endian", () => {
  const data = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const reader = new BinaryReader(data);

  assertEquals(reader.u64(), 1n);
});

Deno.test("BinaryReader - fixed16_16", () => {
  // 1.5 in 16.16 fixed point = 0x00018000
  const data = new Uint8Array([0x00, 0x80, 0x01, 0x00]);
  const reader = new BinaryReader(data);

  assertEquals(reader.fixed16_16(), 1.5);
});

Deno.test("BinaryReader - string", () => {
  // Length = 5, then "hello"
  const data = new Uint8Array([0x05, 0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
  const reader = new BinaryReader(data);

  assertEquals(reader.string(), "hello");
});

Deno.test("BinaryReader - empty string", () => {
  const data = new Uint8Array([0x00, 0x00]);
  const reader = new BinaryReader(data);

  assertEquals(reader.string(), "");
});

Deno.test("BinaryReader - bytes", () => {
  const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
  const reader = new BinaryReader(data);

  const bytes = reader.bytes(3);
  assertEquals(bytes, new Uint8Array([0x01, 0x02, 0x03]));
  assertEquals(reader.offset, 3);
});

Deno.test("BinaryReader - out of bounds throws", () => {
  const data = new Uint8Array([0x01, 0x02]);
  const reader = new BinaryReader(data);

  reader.u16();
  assertThrows(() => reader.u8(), Error, "Out of bounds");
});

Deno.test("BinaryReader - seek", () => {
  const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const reader = new BinaryReader(data);

  reader.seek(2);
  assertEquals(reader.u8(), 0x03);
});

Deno.test("BinaryReader - subReader", () => {
  const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
  const reader = new BinaryReader(data);

  reader.u8(); // Skip first byte
  const sub = reader.subReader(3);

  assertEquals(sub.length, 3);
  assertEquals(sub.u8(), 0x02);
  assertEquals(reader.offset, 4);
});

Deno.test("BinaryWriter - u8", () => {
  const writer = new BinaryWriter();
  writer.u8(0x00).u8(0x7f).u8(0xff);

  assertEquals(writer.toUint8Array(), new Uint8Array([0x00, 0x7f, 0xff]));
});

Deno.test("BinaryWriter - u16 little-endian", () => {
  const writer = new BinaryWriter();
  writer.u16(0x1234);

  assertEquals(writer.toUint8Array(), new Uint8Array([0x34, 0x12]));
});

Deno.test("BinaryWriter - i16 little-endian", () => {
  const writer = new BinaryWriter();
  writer.i16(-1);

  assertEquals(writer.toUint8Array(), new Uint8Array([0xff, 0xff]));
});

Deno.test("BinaryWriter - u32 little-endian", () => {
  const writer = new BinaryWriter();
  writer.u32(0x12345678);

  assertEquals(writer.toUint8Array(), new Uint8Array([0x78, 0x56, 0x34, 0x12]));
});

Deno.test("BinaryWriter - fixed16_16", () => {
  const writer = new BinaryWriter();
  writer.fixed16_16(1.5);

  assertEquals(writer.toUint8Array(), new Uint8Array([0x00, 0x80, 0x01, 0x00]));
});

Deno.test("BinaryWriter - string", () => {
  const writer = new BinaryWriter();
  writer.string("hello");

  assertEquals(
    writer.toUint8Array(),
    new Uint8Array([0x05, 0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f]),
  );
});

Deno.test("BinaryWriter - empty string", () => {
  const writer = new BinaryWriter();
  writer.string("");

  assertEquals(writer.toUint8Array(), new Uint8Array([0x00, 0x00]));
});

Deno.test("BinaryWriter - bytes", () => {
  const writer = new BinaryWriter();
  writer.bytes(new Uint8Array([0x01, 0x02, 0x03]));

  assertEquals(writer.toUint8Array(), new Uint8Array([0x01, 0x02, 0x03]));
});

Deno.test("BinaryWriter - zeros", () => {
  const writer = new BinaryWriter();
  writer.zeros(4);

  assertEquals(writer.toUint8Array(), new Uint8Array([0x00, 0x00, 0x00, 0x00]));
});

Deno.test("BinaryWriter - grows buffer", () => {
  const writer = new BinaryWriter(4);

  // Write more than initial capacity
  for (let i = 0; i < 100; i++) {
    writer.u8(i);
  }

  assertEquals(writer.length, 100);
  const result = writer.toUint8Array();
  assertEquals(result.length, 100);
  assertEquals(result[0], 0);
  assertEquals(result[99], 99);
});

Deno.test("BinaryWriter - patch", () => {
  const writer = new BinaryWriter();
  const mark = writer.mark();
  writer.u32(0); // Placeholder
  writer.u8(0xff);

  writer.patchU32(mark, 0x12345678);

  assertEquals(
    writer.toUint8Array(),
    new Uint8Array([0x78, 0x56, 0x34, 0x12, 0xff]),
  );
});

Deno.test("BinaryReader/Writer - round-trip primitives", () => {
  const writer = new BinaryWriter();

  writer.u8(42);
  writer.u16(0x1234);
  writer.i16(-100);
  writer.u32(0xdeadbeef);
  writer.i32(-12345);
  writer.fixed16_16(3.14159);
  writer.string("test string");
  writer.bytes(new Uint8Array([1, 2, 3, 4, 5]));

  const data = writer.toUint8Array();
  const reader = new BinaryReader(data);

  assertEquals(reader.u8(), 42);
  assertEquals(reader.u16(), 0x1234);
  assertEquals(reader.i16(), -100);
  assertEquals(reader.u32(), 0xdeadbeef);
  assertEquals(reader.i32(), -12345);
  // Fixed point has some precision loss
  const fixed = reader.fixed16_16();
  assertEquals(Math.abs(fixed - 3.14159) < 0.0001, true);
  assertEquals(reader.string(), "test string");
  assertEquals(reader.bytes(5), new Uint8Array([1, 2, 3, 4, 5]));
});

Deno.test("BinaryReader - uuid", () => {
  // UUID: 12345678-1234-1234-1234-123456789abc
  const data = new Uint8Array([
    0x12,
    0x34,
    0x56,
    0x78,
    0x12,
    0x34,
    0x12,
    0x34,
    0x12,
    0x34,
    0x12,
    0x34,
    0x56,
    0x78,
    0x9a,
    0xbc,
  ]);
  const reader = new BinaryReader(data);

  assertEquals(reader.uuid(), "12345678-1234-1234-1234-123456789abc");
});

Deno.test("BinaryWriter - uuid", () => {
  const writer = new BinaryWriter();
  writer.uuid("12345678-1234-1234-1234-123456789abc");

  assertEquals(
    writer.toUint8Array(),
    new Uint8Array([
      0x12,
      0x34,
      0x56,
      0x78,
      0x12,
      0x34,
      0x12,
      0x34,
      0x12,
      0x34,
      0x12,
      0x34,
      0x56,
      0x78,
      0x9a,
      0xbc,
    ]),
  );
});
