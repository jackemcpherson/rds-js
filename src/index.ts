export { RdsError, UnsupportedTypeError } from "./errors.js";

import { decompress } from "./decompress.js";
import { parseStream } from "./parser.js";

/**
 * Parse an RDS file from a byte buffer.
 *
 * Handles gzip decompression automatically. Returns the parsed R object
 * as a JavaScript value:
 *
 * - Data frames → `Record<string, unknown>[]` (array of row objects)
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
