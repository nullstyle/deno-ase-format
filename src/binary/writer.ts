/**
 * BinaryWriter for writing little-endian binary data.
 * Designed for encoding Aseprite file format.
 * Uses a growable buffer internally.
 */
export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private _offset: number;
  private _capacity: number;

  /** Initial capacity for the buffer */
  private static readonly INITIAL_CAPACITY = 4096;

  /**
   * Create a new BinaryWriter.
   * @param initialCapacity - Initial buffer capacity (default: 4096)
   */
  constructor(initialCapacity = BinaryWriter.INITIAL_CAPACITY) {
    this._capacity = initialCapacity;
    this.buffer = new Uint8Array(this._capacity);
    this.view = new DataView(this.buffer.buffer);
    this._offset = 0;
  }

  /** Current write offset (also the current length of written data) */
  get offset(): number {
    return this._offset;
  }

  /** Current length of written data */
  get length(): number {
    return this._offset;
  }

  /**
   * Ensure there's enough capacity for additional bytes.
   */
  private ensureCapacity(additionalBytes: number): void {
    const required = this._offset + additionalBytes;
    if (required <= this._capacity) {
      return;
    }

    // Grow by doubling until we have enough
    let newCapacity = this._capacity;
    while (newCapacity < required) {
      newCapacity *= 2;
    }

    const newBuffer = new Uint8Array(newCapacity);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
    this.view = new DataView(this.buffer.buffer);
    this._capacity = newCapacity;
  }

  /**
   * Write an unsigned 8-bit integer (BYTE).
   */
  u8(value: number): this {
    this.ensureCapacity(1);
    this.view.setUint8(this._offset, value);
    this._offset += 1;
    return this;
  }

  /**
   * Write an unsigned 16-bit integer (WORD), little-endian.
   */
  u16(value: number): this {
    this.ensureCapacity(2);
    this.view.setUint16(this._offset, value, true);
    this._offset += 2;
    return this;
  }

  /**
   * Write a signed 16-bit integer (SHORT), little-endian.
   */
  i16(value: number): this {
    this.ensureCapacity(2);
    this.view.setInt16(this._offset, value, true);
    this._offset += 2;
    return this;
  }

  /**
   * Write an unsigned 32-bit integer (DWORD), little-endian.
   */
  u32(value: number): this {
    this.ensureCapacity(4);
    this.view.setUint32(this._offset, value, true);
    this._offset += 4;
    return this;
  }

  /**
   * Write a signed 32-bit integer (LONG), little-endian.
   */
  i32(value: number): this {
    this.ensureCapacity(4);
    this.view.setInt32(this._offset, value, true);
    this._offset += 4;
    return this;
  }

  /**
   * Write an unsigned 64-bit integer (QWORD), little-endian.
   */
  u64(value: bigint): this {
    this.ensureCapacity(8);
    this.view.setBigUint64(this._offset, value, true);
    this._offset += 8;
    return this;
  }

  /**
   * Write a signed 64-bit integer (LONG64), little-endian.
   */
  i64(value: bigint): this {
    this.ensureCapacity(8);
    this.view.setBigInt64(this._offset, value, true);
    this._offset += 8;
    return this;
  }

  /**
   * Write a 32-bit fixed-point number (16.16 format).
   */
  fixed16_16(value: number): this {
    this.ensureCapacity(4);
    const raw = Math.round(value * 65536);
    this.view.setInt32(this._offset, raw, true);
    this._offset += 4;
    return this;
  }

  /**
   * Write a 32-bit IEEE 754 float, little-endian.
   */
  f32(value: number): this {
    this.ensureCapacity(4);
    this.view.setFloat32(this._offset, value, true);
    this._offset += 4;
    return this;
  }

  /**
   * Write a 64-bit IEEE 754 double, little-endian.
   */
  f64(value: number): this {
    this.ensureCapacity(8);
    this.view.setFloat64(this._offset, value, true);
    this._offset += 8;
    return this;
  }

  /**
   * Write raw bytes.
   */
  bytes(data: Uint8Array): this {
    this.ensureCapacity(data.length);
    this.buffer.set(data, this._offset);
    this._offset += data.length;
    return this;
  }

  /**
   * Write an Aseprite-format string.
   * Format: WORD length, then BYTE[length] UTF-8 encoded string.
   */
  string(value: string): this {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length > 0xFFFF) {
      throw new Error(
        `BinaryWriter: String too long (${encoded.length} bytes, max 65535)`,
      );
    }
    this.u16(encoded.length);
    this.bytes(encoded);
    return this;
  }

  /**
   * Write a UUID from a hex string (with or without dashes).
   */
  uuid(value: string): this {
    const hex = value.replace(/-/g, "");
    if (hex.length !== 32) {
      throw new Error(`BinaryWriter: Invalid UUID length: ${value}`);
    }
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    this.bytes(bytes);
    return this;
  }

  /**
   * Write zero bytes for padding/reserved fields.
   */
  zeros(count: number): this {
    this.ensureCapacity(count);
    // Uint8Array is already zero-initialized, but we need to ensure
    // we're not reusing old data if the buffer was grown
    for (let i = 0; i < count; i++) {
      this.buffer[this._offset + i] = 0;
    }
    this._offset += count;
    return this;
  }

  /**
   * Get the current offset for later patching.
   */
  mark(): number {
    return this._offset;
  }

  /**
   * Patch a u16 value at a previously marked offset.
   */
  patchU16(offset: number, value: number): this {
    this.view.setUint16(offset, value, true);
    return this;
  }

  /**
   * Patch a u32 value at a previously marked offset.
   */
  patchU32(offset: number, value: number): this {
    this.view.setUint32(offset, value, true);
    return this;
  }

  /**
   * Get the written data as a Uint8Array (trimmed to actual length).
   */
  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this._offset);
  }

  /**
   * Get a view of the written data (no copy, but shares underlying buffer).
   */
  toUint8ArrayView(): Uint8Array {
    return this.buffer.subarray(0, this._offset);
  }

  /**
   * Reset the writer to the beginning (reuses buffer).
   */
  reset(): this {
    this._offset = 0;
    return this;
  }

  /**
   * Seek to a specific offset for patching.
   * Note: This doesn't extend the buffer; use for patching only.
   */
  seek(offset: number): this {
    if (offset < 0 || offset > this._offset) {
      throw new Error(
        `BinaryWriter: Invalid seek offset ${offset}, current length is ${this._offset}`,
      );
    }
    this._offset = offset;
    return this;
  }

  /**
   * Create a sub-writer that can be merged later.
   */
  static create(initialCapacity?: number): BinaryWriter {
    return new BinaryWriter(initialCapacity);
  }

  /**
   * Append another writer's content to this writer.
   */
  append(other: BinaryWriter): this {
    return this.bytes(other.toUint8ArrayView());
  }
}
