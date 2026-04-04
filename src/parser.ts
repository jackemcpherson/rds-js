import { RdsError, UnsupportedTypeError } from "./errors.js";
import { RdsReader } from "./reader.js";
import { CHAR_ENCODING, FLAGS, NA, PSEUDO, SEXP, SUPPORTED_VERSIONS } from "./types.js";

const textDecoder = new TextDecoder("utf-8");
const latin1Decoder = new TextDecoder("latin1");

/** Attributes parsed from an R object. */
interface RAttributes {
  names?: string[];
  class?: string[];
  levels?: string[];
  "row.names"?: unknown;
  tzone?: string[];
  [key: string]: unknown;
}

/** Reference table for back-references during deserialization. */
class RefTable {
  private readonly refs: unknown[] = [];

  add(obj: unknown): number {
    this.refs.push(obj);
    return this.refs.length;
  }

  get(index: number): unknown {
    if (index < 1 || index > this.refs.length) {
      throw new RdsError(`Invalid reference index: ${index}`);
    }
    return this.refs[index - 1];
  }
}

export function parseStream(data: Uint8Array): unknown {
  const reader = new RdsReader(data);
  const format = reader.readFormatByte();

  if (format !== "X") {
    throw new RdsError(
      `Unsupported serialization format: "${format}". Only XDR binary format ("X") is supported.`,
    );
  }

  const version = reader.readInt();
  if (!SUPPORTED_VERSIONS.includes(version as 2 | 3)) {
    throw new RdsError(`Unsupported serialization version: ${version}. Expected 2 or 3.`);
  }

  // Writer R version (informational, skip)
  reader.readInt();
  // Minimum reader R version (informational, skip)
  reader.readInt();

  // Version 3 has native encoding
  if (version === 3) {
    const encodingLen = reader.readInt();
    // Skip the encoding string — we always decode as UTF-8
    reader.readBytes(encodingLen);
  }

  const refTable = new RefTable();
  return readItem(reader, refTable);
}

function readItem(reader: RdsReader, refs: RefTable): unknown {
  const flags = reader.readInt();
  const sexpType = flags & FLAGS.TYPE_MASK;
  const hasAttributes = (flags & FLAGS.ATTR_BIT) !== 0;
  const hasTag = (flags & FLAGS.TAG_BIT) !== 0;
  const isObject = (flags & FLAGS.OBJECT_BIT) !== 0;
  const gpFlags = (flags & FLAGS.GP_MASK) >>> FLAGS.GP_SHIFT;

  switch (sexpType) {
    case SEXP.NIL:
    case PSEUDO.NILVALUE:
      return null;

    case PSEUDO.GLOBALENV:
    case PSEUDO.EMPTYENV:
    case PSEUDO.BASEENV:
    case PSEUDO.BASENAMESPACE:
      return null;

    case PSEUDO.REF: {
      const refIndex = unpackRefIndex(flags);
      return refs.get(refIndex);
    }

    case PSEUDO.NAMESPACESXP:
    case PSEUDO.PACKAGESXP: {
      const info = readPersistentNames(reader, refs);
      refs.add(info);
      return info;
    }

    case SEXP.SYM:
      return readSymbol(reader, refs);

    case SEXP.LIST:
      return readPairlist(reader, refs, hasAttributes, hasTag);

    case SEXP.CHAR:
      return readCharsxp(reader, gpFlags);

    case SEXP.LGL:
      return readLogicalVector(reader, refs, hasAttributes);

    case SEXP.INT:
      return readIntegerVector(reader, refs, hasAttributes, isObject);

    case SEXP.REAL:
      return readRealVector(reader, refs, hasAttributes, isObject);

    case SEXP.STR:
      return readStringVector(reader, refs, hasAttributes);

    case SEXP.VEC:
      return readGenericVector(reader, refs, hasAttributes, isObject);

    case SEXP.RAW:
      return readRawVector(reader, refs, hasAttributes);

    case SEXP.CPLX:
      return readComplexVector(reader, refs, hasAttributes);

    case PSEUDO.ALTREP:
      return readAltrep(reader, refs);

    default:
      throw new UnsupportedTypeError(
        `Unsupported R type: SEXPTYPE ${sexpType}. Only tabular data types are supported.`,
        sexpType,
      );
  }
}

function unpackRefIndex(flags: number): number {
  const index = flags >>> 8;
  return index === 0 ? -1 : index; // 0 means "read next int" — shouldn't happen in practice for v2/v3
}

function readPersistentNames(reader: RdsReader, refs: RefTable): string[] {
  const names: string[] = [];
  for (;;) {
    const item = readItem(reader, refs);
    if (item === null) break;
    if (typeof item === "string") names.push(item);
  }
  return names;
}

function readSymbol(reader: RdsReader, refs: RefTable): string {
  const charValue = readItem(reader, refs);
  if (typeof charValue !== "string") {
    throw new RdsError("Expected CHARSXP for symbol name");
  }
  refs.add(charValue);
  return charValue;
}

function readCharsxp(reader: RdsReader, gpFlags: number): string | null {
  const length = reader.readInt();

  // NA string sentinel
  if (length === -1) {
    return null;
  }

  const bytes = reader.readBytes(length);

  if (gpFlags & CHAR_ENCODING.LATIN1) {
    return latin1Decoder.decode(bytes);
  }

  // Default to UTF-8 (covers both UTF8 flag set and unset)
  return textDecoder.decode(bytes);
}

function readPairlist(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
  hasTag: boolean,
): RAttributes {
  // Pairlists are used for attributes — we parse them into a plain object
  const attrs: RAttributes = {};

  if (hasAttributes) {
    // Attributes on the pairlist itself (rare, skip)
    readItem(reader, refs);
  }

  let tag: string | null = null;
  if (hasTag) {
    const tagValue = readItem(reader, refs);
    tag = typeof tagValue === "string" ? tagValue : null;
  }

  const value = readItem(reader, refs);

  if (tag !== null) {
    attrs[tag] = value;
  }

  // Read the CDR (rest of pairlist)
  const rest = readItem(reader, refs);
  if (rest !== null && typeof rest === "object" && !Array.isArray(rest)) {
    Object.assign(attrs, rest);
  }

  return attrs;
}

function readAttributes(reader: RdsReader, refs: RefTable): RAttributes {
  const attrs = readItem(reader, refs);
  if (attrs !== null && typeof attrs === "object" && !Array.isArray(attrs)) {
    return attrs as RAttributes;
  }
  return {};
}

function readLength(reader: RdsReader): number {
  const len = reader.readInt();
  if (len === -1) {
    // Long vector: two ints forming a 64-bit length
    const hi = reader.readInt();
    const lo = reader.readInt();
    return hi * 0x100000000 + (lo >>> 0);
  }
  return len;
}

function readLogicalVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
): (boolean | null)[] {
  const length = readLength(reader);
  const result: (boolean | null)[] = new Array(length);

  for (let i = 0; i < length; i++) {
    const val = reader.readInt();
    result[i] = val === NA.INTEGER ? null : val !== 0;
  }

  if (hasAttributes) {
    readAttributes(reader, refs);
  }

  return result;
}

function readIntegerVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
  isObject: boolean,
): (number | null)[] | (string | null)[] {
  const length = readLength(reader);
  const raw: (number | null)[] = new Array(length);

  for (let i = 0; i < length; i++) {
    const val = reader.readInt();
    raw[i] = val === NA.INTEGER ? null : val;
  }

  if (hasAttributes) {
    const attrs = readAttributes(reader, refs);

    // Factor: resolve integer indices to level strings
    if (isObject && isFactor(attrs)) {
      const levels = attrs.levels;
      if (levels) {
        const resolved: (string | null)[] = new Array(length);
        for (let i = 0; i < length; i++) {
          const idx = raw[i];
          resolved[i] = idx === null || idx === undefined ? null : (levels[idx - 1] ?? null);
        }
        return resolved;
      }
    }
  }

  return raw;
}

function isFactor(attrs: RAttributes): boolean {
  return hasClass(attrs, "factor") || hasClass(attrs, "ordered");
}

// Shared buffer for NA_real_ bit-pattern checking (avoids per-call allocation)
const _naCheckBuf = new ArrayBuffer(8);
const _naCheckF64 = new Float64Array(_naCheckBuf);
const _naCheckU32 = new Uint32Array(_naCheckBuf);

function isNaReal(value: number): boolean {
  if (!Number.isNaN(value)) return false;
  _naCheckF64[0] = value;
  // NA_real_ has a specific NaN bit pattern: 0x7FF00000000007A2
  return _naCheckU32[1] === NA.REAL_HI && _naCheckU32[0] === NA.REAL_LO;
}

function readRealVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
  isObject: boolean,
): (number | string | null)[] {
  const length = readLength(reader);
  const raw: (number | null)[] = new Array(length);

  for (let i = 0; i < length; i++) {
    const val = reader.readDouble();
    raw[i] = isNaReal(val) ? null : val;
  }

  if (hasAttributes) {
    const attrs = readAttributes(reader, refs);

    // Date class: days since 1970-01-01 → ISO date string
    if (isObject && hasClass(attrs, "Date")) {
      return raw.map((v) => (v === null ? null : epochDaysToIsoDate(v)));
    }

    // POSIXct class: seconds since epoch → ISO datetime string (always UTC)
    if (isObject && hasClass(attrs, "POSIXct")) {
      return raw.map((v) => (v === null ? null : epochSecondsToIsoDatetime(v)));
    }
  }

  return raw;
}

function hasClass(attrs: RAttributes, className: string): boolean {
  return attrs.class?.includes(className) ?? false;
}

function epochDaysToIsoDate(days: number): string {
  const ms = Math.round(days) * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function epochSecondsToIsoDatetime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  return new Date(ms).toISOString();
}

function readStringVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
): (string | null)[] {
  const length = readLength(reader);
  const result: (string | null)[] = new Array(length);

  // Inline CHARSXP reading to avoid readItem dispatch overhead per element
  for (let i = 0; i < length; i++) {
    const flags = reader.readInt();
    const gpFlags = (flags & FLAGS.GP_MASK) >>> FLAGS.GP_SHIFT;
    result[i] = readCharsxp(reader, gpFlags);
  }

  if (hasAttributes) {
    readAttributes(reader, refs);
  }

  return result;
}

function readGenericVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
  isObject: boolean,
): unknown {
  const length = readLength(reader);
  const elements: unknown[] = new Array(length);

  for (let i = 0; i < length; i++) {
    elements[i] = readItem(reader, refs);
  }

  if (hasAttributes) {
    const attrs = readAttributes(reader, refs);

    // Data frame: pivot column-major list into row-major array of objects
    if (isObject && hasClass(attrs, "data.frame") && attrs.names) {
      return columnsToRows(attrs.names, elements);
    }

    // Named list (not a data frame): return as object with named keys
    if (attrs.names) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < attrs.names.length && i < elements.length; i++) {
        const name = attrs.names[i];
        if (name !== undefined) {
          obj[name] = elements[i];
        }
      }
      return obj;
    }
  }

  return elements;
}

function columnsToRows(names: string[], columns: unknown[]): Record<string, unknown>[] {
  if (names.length === 0 || columns.length === 0) return [];

  const firstCol = columns[0];
  const nRows = Array.isArray(firstCol) ? firstCol.length : 0;
  if (nRows === 0) return [];

  // Pre-filter to valid (name, array) pairs to avoid per-cell checks
  const nCols = Math.min(names.length, columns.length);
  const validCols: { name: string; data: unknown[] }[] = [];
  for (let c = 0; c < nCols; c++) {
    const name = names[c];
    const col = columns[c];
    if (name !== undefined && Array.isArray(col)) {
      validCols.push({ name, data: col });
    }
  }

  const rows: Record<string, unknown>[] = new Array(nRows);
  for (let r = 0; r < nRows; r++) {
    const row: Record<string, unknown> = {};
    for (let c = 0; c < validCols.length; c++) {
      // biome-ignore lint/style/noNonNullAssertion: bounded by validCols.length
      const vc = validCols[c]!;
      row[vc.name] = vc.data[r] ?? null;
    }
    rows[r] = row;
  }

  return rows;
}

function readRawVector(reader: RdsReader, refs: RefTable, hasAttributes: boolean): Uint8Array {
  const length = readLength(reader);
  const data = reader.readBytes(length);

  if (hasAttributes) {
    readAttributes(reader, refs);
  }

  return data;
}

function readComplexVector(
  reader: RdsReader,
  refs: RefTable,
  hasAttributes: boolean,
): { re: number | null; im: number | null }[] {
  const length = readLength(reader);
  const result: { re: number | null; im: number | null }[] = new Array(length);

  for (let i = 0; i < length; i++) {
    const re = reader.readDouble();
    const im = reader.readDouble();
    result[i] = {
      re: isNaReal(re) ? null : re,
      im: isNaReal(im) ? null : im,
    };
  }

  if (hasAttributes) {
    readAttributes(reader, refs);
  }

  return result;
}

function readAltrep(reader: RdsReader, refs: RefTable): unknown {
  // ALTREP serialization: class info pairlist, state, then attr (usually NILVALUE)
  const info = readItem(reader, refs);
  const state = readItem(reader, refs);
  readItem(reader, refs); // attr (typically NILVALUE, discard)

  // compact_intseq / compact_realseq: state is REALSXP(3) = [n, start, step]
  if (isCompactSeq(state)) {
    const seq = state as [number, number, number];
    const n = seq[0];
    const start = seq[1];
    const step = seq[2];
    const result: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = start + i * step;
    }
    return result;
  }

  // wrap_*: state is a list/vector containing the actual data
  if (Array.isArray(state)) {
    return state;
  }

  void info;
  return state;
}

function isCompactSeq(state: unknown): boolean {
  return (
    Array.isArray(state) &&
    state.length === 3 &&
    typeof state[0] === "number" &&
    typeof state[1] === "number" &&
    typeof state[2] === "number"
  );
}
