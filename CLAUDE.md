# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

rds-js is a TypeScript library for parsing R [RDS files](https://cran.r-project.org/doc/manuals/r-release/R-ints.html#Serialization-Formats) in JavaScript/TypeScript. Zero dependencies, web-standard APIs only. Data frames are returned as column-major `DataFrame` objects.

## Commands

```bash
bun install              # Install dependencies
bun run test             # Run tests (vitest)
bun run typecheck        # Type-check without emitting (tsc --noEmit)
bun run check            # Lint + format check (biome check .)
bun run format           # Auto-format (biome format --write .)
bun run build            # Build (esbuild → dist/index.js + dist/index.d.ts)
```

## Architecture

- **`src/index.ts`** — Public API exports (`parseRds`, `isDataFrame`, `toRows`, error classes)
- **`src/parser.ts`** — Core RDS parsing logic: format validation, SEXP type dispatcher, data frame pivoting
- **`src/reader.ts`** — Binary reader (XDR big-endian byte order) over `Uint8Array`
- **`src/types.ts`** — SEXP codes, flags, NA sentinels, `DataFrame` interface
- **`src/errors.ts`** — `RdsError` and `UnsupportedTypeError`
- **`src/decompress.ts`** — Gzip decompression via web-standard `DecompressionStream`
- **`test/fixtures/`** — Binary .rds test files for all supported R types

## Key Constraints

- **Zero dependencies** — web-standard APIs only (`DecompressionStream`, `DataView`, `TextDecoder`).
- **Strict TypeScript** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`.
- **No `any`** — Biome enforces `noExplicitAny: "error"`. Use `unknown` and narrow.
- **No default exports** — Biome enforces `noDefaultExport: "error"`, with overrides only for `*.config.ts`.
- **Bun** as package manager, **Biome** for lint+format, **Vitest** for tests.
- Works in Node.js 20+, Bun, Deno, Cloudflare Workers, and modern browsers.

## Documentation (TSDoc)

Follow Google-style TSDoc conventions. Document all public functions, exported interfaces/types, and module-level constants with `@param`, `@returns`, `@throws`, and `@example` tags. Skip docs for self-explanatory one-liners.

## Testing

- Test fixtures are binary .rds files in `test/fixtures/`.
- Tests cover all supported R types: scalars, vectors, factors, data frames, dates, NA handling.
- Never hit real APIs — all tests use fixture files.
