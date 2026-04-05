export { RdsError, UnsupportedTypeError } from "./errors.js";
export type { DataFrame } from "./types.js";

import { decompress } from "./decompress.js";
import { parseStream } from "./parser.js";
import type { DataFrame } from "./types.js";

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
 * @throws {RdsError} if the file is malformed or uses unsupported compression
 * @throws {UnsupportedTypeError} if the file contains unsupported R types (closures, environments, etc.)
 */
export async function parseRds(data: Uint8Array): Promise<unknown> {
  const decompressed = await decompress(data);
  return parseStream(decompressed);
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
