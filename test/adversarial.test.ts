import { describe, expect, it } from "vitest";
import { parseRds, RdsError } from "../src/index.js";
import { parseStream } from "../src/parser.js";

/**
 * Hand-built malformed inputs (TST-05). A binary parser's classic
 * robustness hotspot is hostile input: every case here must surface as
 * a typed RdsError — never a hang, infinite loop, stack overflow, or
 * uncontrolled RangeError.
 */

/** Build an uncompressed XDR v2 stream: "X\n" + 3 header ints + body ints. */
function xdrStream(bodyInts: number[]): Uint8Array {
  const header = [2, 0x030203, 0x020300]; // version 2, writer, min reader
  const ints = [...header, ...bodyInts];
  const out = new Uint8Array(2 + ints.length * 4);
  out[0] = 0x58; // 'X'
  out[1] = 0x0a; // '\n'
  const view = new DataView(out.buffer);
  ints.forEach((value, i) => view.setInt32(2 + i * 4, value, false));
  return out;
}

const INTSXP = 13;
const STRSXP = 16;
const CHARSXP = 9;
const VECSXP = 19;
const NILVALUE = 254;

describe("adversarial inputs", () => {
  it("rejects a negative vector length instead of looping or throwing RangeError", () => {
    expect(() => parseStream(xdrStream([INTSXP, -5]))).toThrow(RdsError);
    expect(() => parseStream(xdrStream([INTSXP, -5]))).toThrow(/negative vector length/i);
  });

  it("rejects a negative string length (other than the -1 NA sentinel)", () => {
    // STRSXP of 1 element whose CHARSXP claims length -2.
    expect(() => parseStream(xdrStream([STRSXP, 1, CHARSXP, -2]))).toThrow(
      /negative string length/i,
    );
  });

  it("rejects an oversized length claim before allocating", () => {
    expect(() => parseStream(xdrStream([INTSXP, 50_000_000, 1, 2, 3]))).toThrow(
      /exceeds remaining data/i,
    );
  });

  it("rejects an absurd long-vector (64-bit) length claim", () => {
    // -1 marks a long vector; hi/lo words claim ~2^33 elements.
    expect(() => parseStream(xdrStream([INTSXP, -1, 2, 0]))).toThrow(/exceeds remaining data/i);
  });

  it("reports truncated vectors as end-of-data, not a hang", () => {
    expect(() => parseStream(xdrStream([INTSXP, 3, 42]))).toThrow(/Unexpected end of data/i);
  });

  it("caps recursion depth on deeply nested generic vectors", () => {
    // 2,000 nested one-element lists, terminated by NILVALUE.
    const body: number[] = [];
    for (let i = 0; i < 2_000; i++) body.push(VECSXP, 1);
    body.push(NILVALUE);
    expect(() => parseStream(xdrStream(body))).toThrow(/Maximum nesting depth/i);
  });

  it("rejects empty input", async () => {
    await expect(parseRds(new Uint8Array(0))).rejects.toThrow(RdsError);
  });

  it("enforces the decompression ceiling on gzip bombs", async () => {
    // 8 MB of zeros compresses to a few KB.
    const bomb = new Uint8Array(8 * 1024 * 1024);
    const cs = new CompressionStream("gzip");
    const compressed = new Uint8Array(
      await new Response(new Blob([bomb]).stream().pipeThrough(cs)).arrayBuffer(),
    );
    expect(compressed.byteLength).toBeLessThan(64 * 1024);

    await expect(parseRds(compressed, { maxDecompressedBytes: 1024 * 1024 })).rejects.toThrow(
      /exceeds the .*limit/i,
    );
  });

  it("still parses a valid stream after a depth-cap failure (state unwinds)", () => {
    const deep: number[] = [];
    for (let i = 0; i < 2_000; i++) deep.push(VECSXP, 1);
    deep.push(NILVALUE);
    expect(() => parseStream(xdrStream(deep))).toThrow(/Maximum nesting depth/i);

    // A simple 2-element integer vector parses fine immediately afterwards.
    expect(parseStream(xdrStream([INTSXP, 2, 7, 9]))).toEqual([7, 9]);
  });
});
