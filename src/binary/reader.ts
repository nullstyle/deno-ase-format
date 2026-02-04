/**
 * BinaryReader for reading little-endian binary data from a Uint8Array.
 * Designed for parsing Aseprite file format.
 */
export class BinaryReader {
  private readonly view: DataView;
  private readonly data: Uint8Array;
  private _offset: number;

  /**
   * Create a new BinaryReader.
   * @param data - The byte array to read from
   * @param offset - Initial offset (default: 0)
   */
  constructor(data: Uint8Array, offset = 0) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this._offset = offset;
  }

  /** Current byte offset in the buffer */
  get offset(): number {
    return this._offset;
  }

  /** Set the current byte offset */
  set offset(value: number) {
    this._offset = value;
  }

  /** Total length of the buffer */
  get length(): number {
    return this.data.length;
  }

  /** Remaining bytes from current offset */
  get remaining(): number {
    return this.data.length - this._offset;
  }

  /** Check if we've reached the end of the buffer */
  get eof(): boolean {
    return this._offset >= this.data.length;
  }

  /**
   * Ensure there are enough bytes to read.
   * @throws Error if not enough bytes remain
   */
  private ensureBytes(count: number): void {
    if (this._offset + count > this.data.length) {
      throw new Error(
        `BinaryReader: Out of bounds at offset ${this._offset}, ` +
          `tried to read ${count} bytes, but only ${this.remaining} remain`,
      );
    }
  }

  /**
   * Read an unsigned 8-bit integer (BYTE).
   */
  u8(): number {
    this.ensureBytes(1);
    const value = this.view.getUint8(this._offset);
    this._offset += 1;
    return value;
  }

  /**
   * Read an unsigned 16-bit integer (WORD), little-endian.
   */
  u16(): number {
    this.ensureBytes(2);
    const value = this.view.getUint16(this._offset, true);
    this._offset += 2;
    return value;
  }

  /**
   * Read a signed 16-bit integer (SHORT), little-endian.
   */
  i16(): number {
    this.ensureBytes(2);
    const value = this.view.getInt16(this._offset, true);
    this._offset += 2;
    return value;
  }

  /**
   * Read an unsigned 32-bit integer (DWORD), little-endian.
   */
  u32(): number {
    this.ensureBytes(4);
    const value = this.view.getUint32(this._offset, true);
    this._offset += 4;
    return value;
  }

  /**
   * Read a signed 32-bit integer (LONG), little-endian.
   */
  i32(): number {
    this.ensureBytes(4);
    const value = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return value;
  }

  /**
   * Read an unsigned 64-bit integer (QWORD), little-endian.
   * Returns a BigInt since JavaScript numbers can't safely represent all 64-bit values.
   */
  u64(): bigint {
    this.ensureBytes(8);
    const value = this.view.getBigUint64(this._offset, true);
    this._offset += 8;
    return value;
  }

  /**
   * Read a signed 64-bit integer (LONG64), little-endian.
   * Returns a BigInt since JavaScript numbers can't safely represent all 64-bit values.
   */
  i64(): bigint {
    this.ensureBytes(8);
    const value = this.view.getBigInt64(this._offset, true);
    this._offset += 8;
    return value;
  }

  /**
   * Read a 32-bit fixed-point number (16.16 format).
   * The upper 16 bits are the integer part, lower 16 bits are the fractional part.
   */
  fixed16_16(): number {
    this.ensureBytes(4);
    const raw = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return raw / 65536;
  }

  /**
   * Read a 32-bit IEEE 754 float, little-endian.
   */
  f32(): number {
    this.ensureBytes(4);
    const value = this.view.getFloat32(this._offset, true);
    this._offset += 4;
    return value;
  }

  /**
   * Read a 64-bit IEEE 754 double, little-endian.
   */
  f64(): number {
    this.ensureBytes(8);
    const value = this.view.getFloat64(this._offset, true);
    this._offset += 8;
    return value;
  }

  /**
   * Read a specified number of bytes as a new Uint8Array.
   * Returns a view into the original buffer (no copy).
   */
  bytes(count: number): Uint8Array {
    this.ensureBytes(count);
    const slice = this.data.subarray(this._offset, this._offset + count);
    this._offset += count;
    return slice;
  }

  /**
   * Read a specified number of bytes as a copy (new allocation).
   */
  bytesCopy(count: number): Uint8Array {
    this.ensureBytes(count);
    const slice = this.data.slice(this._offset, this._offset + count);
    this._offset += count;
    return slice;
  }

  /**
   * Read an Aseprite-format string.
   * Format: WORD length, then BYTE[length] UTF-8 encoded string.
   */
  string(): string {
    const length = this.u16();
    if (length === 0) {
      return "";
    }
    const bytes = this.bytes(length);
    return new TextDecoder("utf-8").decode(bytes);
  }

  /**
   * Read a UUID (16 bytes) as a hex string.
   */
  uuid(): string {
    const bytes = this.bytes(16);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Format as standard UUID: 8-4-4-4-12
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
      hex.slice(16, 20)
    }-${hex.slice(20, 32)}`;
  }

  /**
   * Skip a specified number of bytes.
   */
  skip(count: number): void {
    this.ensureBytes(count);
    this._offset += count;
  }

  /**
   * Peek at the next byte without advancing the offset.
   */
  peekU8(): number {
    this.ensureBytes(1);
    return this.view.getUint8(this._offset);
  }

  /**
   * Peek at the next 16-bit value without advancing the offset.
   */
  peekU16(): number {
    this.ensureBytes(2);
    return this.view.getUint16(this._offset, true);
  }

  /**
   * Peek at the next 32-bit value without advancing the offset.
   */
  peekU32(): number {
    this.ensureBytes(4);
    return this.view.getUint32(this._offset, true);
  }

  /**
   * Create a sub-reader for a specific range.
   * Useful for reading chunks with known boundaries.
   */
  subReader(length: number): BinaryReader {
    this.ensureBytes(length);
    const subData = this.data.subarray(this._offset, this._offset + length);
    this._offset += length;
    return new BinaryReader(subData);
  }

  /**
   * Seek to an absolute offset.
   */
  seek(offset: number): void {
    if (offset < 0 || offset > this.data.length) {
      throw new Error(
        `BinaryReader: Invalid seek offset ${offset}, buffer length is ${this.data.length}`,
      );
    }
    this._offset = offset;
  }
}
