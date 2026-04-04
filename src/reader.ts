import { RdsError } from "./errors.js";

/** Cursor-based binary reader over a Uint8Array using big-endian (XDR) byte order. */
export class RdsReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private pos: number;

  constructor(data: Uint8Array) {
    this.bytes = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.pos = 0;
  }

  get position(): number {
    return this.pos;
  }

  get remaining(): number {
    return this.bytes.byteLength - this.pos;
  }

  readByte(): number {
    this.ensureAvailable(1);
    // biome-ignore lint/style/noNonNullAssertion: bounds checked by ensureAvailable
    const value = this.bytes[this.pos]!;
    this.pos += 1;
    return value;
  }

  readInt(): number {
    this.ensureAvailable(4);
    const value = this.view.getInt32(this.pos, false); // big-endian
    this.pos += 4;
    return value;
  }

  readDouble(): number {
    this.ensureAvailable(8);
    const value = this.view.getFloat64(this.pos, false); // big-endian
    this.pos += 8;
    return value;
  }

  readBytes(length: number): Uint8Array {
    this.ensureAvailable(length);
    const slice = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  /** Read a format character (single ASCII byte) for the serialization header. */
  readFormatByte(): string {
    const byte = this.readByte();
    // Skip newline after format byte
    if (this.pos < this.bytes.byteLength && this.bytes[this.pos] === 0x0a) {
      this.pos += 1;
    }
    return String.fromCharCode(byte);
  }

  private ensureAvailable(n: number): void {
    if (this.pos + n > this.bytes.byteLength) {
      throw new RdsError(
        `Unexpected end of data: needed ${n} bytes at offset ${this.pos}, but only ${this.remaining} remain`,
      );
    }
  }
}
