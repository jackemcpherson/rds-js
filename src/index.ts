export { RdsError, UnsupportedTypeError } from "./errors.js";
export type { DataFrame } from "./types.js";

import { decompress } from "./decompress.js";
import { RdsError } from "./errors.js";
import { parseStream } from "./parser.js";
import type { DataFrame } from "./types.js";

/** Options for {@link parseRds}. */
export interface ParseRdsOptions {
  /**
   * Ceiling on the decompressed payload size in bytes. Gzip expands fully
   * in memory, so without a cap a small crafted file (a decompression
   * bomb) can exhaust memory. Unset = unlimited, matching the primary
   * trusted-file use case.
   */
  readonly maxDecompressedBytes?: number | undefined;
}

/**
 * Parse an RDS file from a byte buffer.
 *
 * Handles gzip decompression automatically. Returns the parsed R object
 * as a JavaScript value:
 *
 * - Data frames → {@link DataFrame} (column-major: `{ names, columns }`)
 * - Vectors → arrays of primitives (with `null` for NA values)
 * - Factors → resolved to string arrays
 * - Dates → ISO 8601 strings
 * - Named lists → plain objects
 *
 * @param data - The raw (possibly gzipped) RDS bytes.
 * @param options - Optional safety limits for untrusted input.
 * @throws {RdsError} if the file is malformed, exceeds limits, or uses unsupported compression
 * @throws {UnsupportedTypeError} if the file contains unsupported R types (closures, environments, etc.)
 */
export async function parseRds(data: Uint8Array, options?: ParseRdsOptions): Promise<unknown> {
  const decompressed = await decompress(data, options?.maxDecompressedBytes);
  try {
    return parseStream(decompressed);
  } catch (err) {
    // Belt-and-braces: any allocation failure that slips past the length
    // validation surfaces as a typed parse error, never a bare RangeError.
    if (err instanceof RangeError) {
      throw new RdsError(`Malformed RDS data: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Check whether a value is a {@link DataFrame} (column-major data frame).
 */
export function isDataFrame(value: unknown): value is DataFrame {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.names) && Array.isArray(obj.columns);
}

/**
 * Pivot a column-major {@link DataFrame} into an array of row objects.
 *
 * Convenience helper for small datasets. For large data frames (100K+ rows),
 * prefer working with the column-major format directly to avoid doubling
 * memory usage.
 *
 * @param frame - Column-major data frame from {@link parseRds}.
 * @returns Array of row objects with column names as keys.
 */
export function toRows(frame: DataFrame): Record<string, unknown>[] {
  const { names, columns } = frame;
  if (names.length === 0 || columns.length === 0) return [];

  const firstCol = columns[0];
  const nRows = Array.isArray(firstCol) ? firstCol.length : 0;
  if (nRows === 0) return [];

  const rows: Record<string, unknown>[] = new Array(nRows);
  for (let r = 0; r < nRows; r++) {
    const row: Record<string, unknown> = {};
    for (let c = 0; c < names.length; c++) {
      const name = names[c];
      const col = columns[c];
      if (name !== undefined && Array.isArray(col)) {
        row[name] = col[r] ?? null;
      }
    }
    rows[r] = row;
  }

  return rows;
}
