import { RdsError } from "./errors.js";

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;
const BZIP2_MAGIC_0 = 0x42; // 'B'
const BZIP2_MAGIC_1 = 0x5a; // 'Z'
const XZ_MAGIC_0 = 0xfd;
const XZ_MAGIC_1 = 0x37; // '7'

export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  if (data.length < 2) {
    throw new RdsError("Input too short to be a valid RDS file");
  }

  // biome-ignore lint/style/noNonNullAssertion: bounds checked above
  const b0 = data[0]!;
  // biome-ignore lint/style/noNonNullAssertion: bounds checked above
  const b1 = data[1]!;

  if (b0 === BZIP2_MAGIC_0 && b1 === BZIP2_MAGIC_1) {
    throw new RdsError("Unsupported compression: bzip2. Only gzip is supported.");
  }

  if (b0 === XZ_MAGIC_0 && b1 === XZ_MAGIC_1) {
    throw new RdsError("Unsupported compression: xz. Only gzip is supported.");
  }

  if (b0 === GZIP_MAGIC_0 && b1 === GZIP_MAGIC_1) {
    return decompressGzip(data);
  }

  // Not compressed — return as-is
  return data;
}

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const writePromise = writer.write(data as unknown as BufferSource).then(() => writer.close());

  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.byteLength;
  }

  await writePromise;

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
