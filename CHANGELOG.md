# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-11

### Added

- `parseRds(data, { maxDecompressedBytes })` — optional ceiling on the
  decompressed payload size; gzip bombs abort mid-stream with `RdsError`
- Adversarial test corpus (negative/oversized/truncated lengths, deep
  nesting, gzip bomb) and an "Untrusted input" section in the README

### Fixed

- Negative read/vector/string lengths are rejected as `RdsError` instead
  of moving the parser cursor backwards (potential non-termination on
  crafted input)
- Length claims beyond the remaining data are rejected before
  allocation; residual allocation failures surface as `RdsError`, never
  an uncontrolled `RangeError`
- SEXP recursion depth is capped at 1,000 levels (stack-overflow
  protection on deeply nested crafted input)

## [0.2.0] - 2026-04-05

### Changed

- **BREAKING**: R data frames now return `DataFrame` objects (`{ names: string[], columns: unknown[][] }`) instead of row-major arrays of objects. This reduces memory usage by 3.7x and improves parse time by 2.2x for large datasets.

### Added

- `DataFrame` type for column-major data frame representation
- `isDataFrame()` type guard to check if a parsed value is a DataFrame
- `toRows()` convenience helper to convert a DataFrame back to row-major format for small datasets

## [0.1.0] - 2026-04-05

### Added

- `parseRds(data: Uint8Array): Promise<unknown>` — parse RDS files from a byte buffer
- Gzip decompression via web-standard `DecompressionStream`
- Data frame → array of row objects conversion
- Factor → string resolution
- Date → ISO 8601 date string (`"2024-03-15"`)
- POSIXct → ISO 8601 datetime string (`"2024-03-15T10:30:00.000Z"`)
- NA → `null` for all types (integer, real, string, logical)
- ALTREP compact sequence expansion (e.g. `1:1000`)
- Named list → plain object conversion
- `RdsError` for malformed files and unsupported compression
- `UnsupportedTypeError` for unhandled R types (closures, environments, etc.)
