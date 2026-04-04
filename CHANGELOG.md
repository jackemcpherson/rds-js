# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
