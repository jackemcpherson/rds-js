/** R SEXPTYPE codes for the types we support. */
export const SEXP = {
  NIL: 0,
  SYM: 1,
  LIST: 2, // pairlist (dotted pair)
  CHAR: 9,
  LGL: 10,
  INT: 13,
  REAL: 14,
  CPLX: 15,
  STR: 16,
  VEC: 19, // generic vector (list)
  RAW: 24,
} as const;

/** Pseudo-SEXPTYPE codes used during serialization. */
export const PSEUDO = {
  ALTREP: 238,
  NILVALUE: 254,
  GLOBALENV: 253,
  EMPTYENV: 242,
  BASEENV: 241,
  BASENAMESPACE: 247,
  NAMESPACESXP: 249,
  PACKAGESXP: 250,
  MISSINGARG: 251,
  REF: 255,
} as const;

/** Bit masks for the packed flags integer. */
export const FLAGS = {
  TYPE_MASK: 0xff as const,
  OBJECT_BIT: 0x100 as const,
  ATTR_BIT: 0x200 as const,
  TAG_BIT: 0x400 as const,
  GP_SHIFT: 12 as const,
  GP_MASK: 0x0ffff000 as const,
};

/** NA sentinel values in R's binary format. */
export const NA = {
  INTEGER: -2147483648, // 0x80000000 as signed int32
  // NA_REAL is a specific NaN: 0x7FF00000000007A2
  REAL_HI: 0x7ff00000,
  REAL_LO: 0x000007a2,
} as const;

/** CHARSXP encoding bits (within the GP field). */
export const CHAR_ENCODING = {
  LATIN1: 0x4 as const,
  UTF8: 0x8 as const,
  BYTES: 0x20 as const,
};

/** Serialization format versions we support. */
export const SUPPORTED_VERSIONS = [2, 3] as const;

/**
 * Column-major representation of an R data frame.
 *
 * This is the natural storage format for R data frames and avoids the
 * memory cost of pivoting to row-major objects (which can OOM on large
 * datasets like 685K+ rows).
 */
export interface DataFrame {
  readonly names: readonly string[];
  readonly columns: readonly unknown[][];
}
