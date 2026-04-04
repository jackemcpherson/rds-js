# rds-js

Parse R [RDS files](https://cran.r-project.org/doc/manuals/r-release/R-ints.html#Serialization-Formats) in JavaScript/TypeScript. Zero dependencies, web-standard APIs only.

- Data frames become arrays of row objects
- Factors resolve to strings
- Dates become ISO 8601 strings
- NA values become `null`

## Install

```sh
npm install rds-js
```

## Usage

```ts
import { parseRds } from "rds-js";

const response = await fetch("https://example.com/data.rds");
const buffer = new Uint8Array(await response.arrayBuffer());
const rows = await parseRds(buffer);
// => [{ name: "Alice", score: 95.5 }, { name: "Bob", score: 87.3 }, ...]
```

`parseRds` accepts a `Uint8Array` and returns `Promise<unknown>`. Gzip-compressed files are decompressed automatically.

## Supported types

| R type | JS output |
|--------|-----------|
| Data frame | `Record<string, unknown>[]` (row objects) |
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
import { parseRds, RdsError, UnsupportedTypeError } from "rds-js";

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
