# rds-js

[![CI](https://github.com/jackemcpherson/rds-js/actions/workflows/ci.yml/badge.svg)](https://github.com/jackemcpherson/rds-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@jackemcpherson/rds-js)](https://www.npmjs.com/package/@jackemcpherson/rds-js)

Parse R [RDS files](https://cran.r-project.org/doc/manuals/r-release/R-ints.html#Serialization-Formats) in JavaScript/TypeScript. Zero dependencies, web-standard APIs only.

- Data frames become column-major `DataFrame` objects for memory efficiency
- Factors resolve to strings
- Dates become ISO 8601 strings
- NA values become `null`

## Install

```sh
npm install @jackemcpherson/rds-js
```

## Usage

```ts
import { parseRds, isDataFrame, toRows } from "@jackemcpherson/rds-js";

const response = await fetch("https://example.com/data.rds");
const buffer = new Uint8Array(await response.arrayBuffer());
const result = await parseRds(buffer);

// Data frames return column-major DataFrame objects
if (isDataFrame(result)) {
  console.log(result.names);    // ["name", "score"]
  console.log(result.columns);  // [["Alice", "Bob"], [95.5, 87.3]]

  // Convert to row objects for small datasets
  const rows = toRows(result);
  // => [{ name: "Alice", score: 95.5 }, { name: "Bob", score: 87.3 }]
}
```

`parseRds` accepts a `Uint8Array` and returns `Promise<unknown>`. Data frames are returned as `DataFrame` objects (`{ names: string[], columns: unknown[][] }`). Use `toRows()` to convert to row objects when needed. Gzip-compressed files are decompressed automatically.

## Supported types

| R type | JS output |
|--------|-----------|
| Data frame | `DataFrame` (`{ names: string[], columns: unknown[][] }`) |
| Integer/real vector | `number[]` |
| Character vector | `string[]` |
| Logical vector | `boolean[]` |
| Factor | `string[]` (resolved from levels) |
| Date | `string` (ISO 8601, e.g. `"2024-03-15"`) |
| POSIXct | `string` (ISO 8601, e.g. `"2024-03-15T10:30:00.000Z"`) |
| NA | `null` |
| NULL | `null` |
| Named list | `Record<string, unknown>` |
| Raw vector | `Uint8Array` |

Unsupported types (closures, environments, byte-code, etc.) throw `UnsupportedTypeError`.

## Errors

```ts
import { parseRds, RdsError, UnsupportedTypeError } from "@jackemcpherson/rds-js";

try {
  const data = await parseRds(buffer);
} catch (e) {
  if (e instanceof RdsError) {
    // Malformed file, unsupported compression, etc.
  }
  if (e instanceof UnsupportedTypeError) {
    // File contains an R type this library doesn't handle
    console.log(e.sexpType);
  }
}
```

## Runtime compatibility

Works in any environment with `DecompressionStream`, `DataView`, and `TextDecoder`:

- Node.js 20+
- Bun
- Deno
- Cloudflare Workers
- Modern browsers

## Contributing

```sh
bun install
bun run test        # run tests
bun run check       # lint & format
bun run typecheck   # type check
bun run build       # build
```

## License

MIT
