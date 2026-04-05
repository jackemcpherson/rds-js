import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDataFrame, parseRds, RdsError, toRows, UnsupportedTypeError } from "../src/index.js";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

describe("parseRds", () => {
  describe("scalar values", () => {
    it("parses a scalar integer", async () => {
      const result = await parseRds(fixture("scalar_int.rds"));
      expect(result).toEqual([42]);
    });

    it("parses a scalar double", async () => {
      const result = await parseRds(fixture("scalar_double.rds"));
      expect(result).toEqual([3.14]);
    });

    it("parses a scalar string", async () => {
      const result = await parseRds(fixture("scalar_string.rds"));
      expect(result).toEqual(["hello"]);
    });
  });

  describe("vectors", () => {
    it("parses integer vector", async () => {
      const result = await parseRds(fixture("integers.rds"));
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("parses double vector", async () => {
      const result = await parseRds(fixture("doubles.rds"));
      expect(result).toEqual([1.1, 2.2, 3.3]);
    });

    it("parses string vector", async () => {
      const result = await parseRds(fixture("strings.rds"));
      expect(result).toEqual(["hello", "world", "foo"]);
    });

    it("parses logical vector", async () => {
      const result = await parseRds(fixture("logicals.rds"));
      expect(result).toEqual([true, false, true, false]);
    });
  });

  describe("NA handling", () => {
    it("maps NA integers to null", async () => {
      const result = await parseRds(fixture("integers_na.rds"));
      expect(result).toEqual([1, null, 3]);
    });

    it("maps NA doubles to null", async () => {
      const result = await parseRds(fixture("doubles_na.rds"));
      expect(result).toEqual([1.1, null, 3.3]);
    });

    it("maps NA strings to null", async () => {
      const result = await parseRds(fixture("strings_na.rds"));
      expect(result).toEqual(["hello", null, "world"]);
    });

    it("maps NA logicals to null", async () => {
      const result = await parseRds(fixture("logicals_na.rds"));
      expect(result).toEqual([true, null, false]);
    });
  });

  describe("factors", () => {
    it("resolves factors to strings", async () => {
      const result = await parseRds(fixture("factor.rds"));
      expect(result).toEqual(["red", "blue", "red", "green"]);
    });

    it("maps NA factor values to null", async () => {
      const result = await parseRds(fixture("factor_na.rds"));
      expect(result).toEqual(["red", null, "green"]);
    });
  });

  describe("data frames", () => {
    it("returns column-major DataFrame for data frames", async () => {
      const result = await parseRds(fixture("dataframe.rds"));
      expect(isDataFrame(result)).toBe(true);
      if (!isDataFrame(result)) return;

      expect(result.names).toEqual(["name", "age", "score", "passed"]);
      expect(result.columns[0]).toEqual(["Alice", "Bob", "Charlie"]);
      expect(result.columns[1]).toEqual([30, 25, 35]);
      expect(result.columns[2]).toEqual([95.5, 87.3, 92.1]);
      expect(result.columns[3]).toEqual([true, true, false]);
    });

    it("converts to row objects via toRows()", async () => {
      const result = await parseRds(fixture("dataframe.rds"));
      if (!isDataFrame(result)) return;
      expect(toRows(result)).toEqual([
        { name: "Alice", age: 30, score: 95.5, passed: true },
        { name: "Bob", age: 25, score: 87.3, passed: true },
        { name: "Charlie", age: 35, score: 92.1, passed: false },
      ]);
    });

    it("handles NAs in data frames", async () => {
      const result = await parseRds(fixture("dataframe_na.rds"));
      if (!isDataFrame(result)) return;
      expect(toRows(result)).toEqual([
        { x: 1, y: "a", z: 1.1 },
        { x: null, y: null, z: 2.2 },
        { x: 3, y: "c", z: null },
      ]);
    });

    it("resolves factor columns in data frames", async () => {
      const result = await parseRds(fixture("dataframe_factor.rds"));
      if (!isDataFrame(result)) return;
      const rows = toRows(result);
      expect(rows[0]?.team).toBe("Adelaide");
      expect(rows[1]?.team).toBe("Brisbane");
      expect(rows[2]?.team).toBe("Carlton");
    });

    it("parses empty data frame", async () => {
      const result = await parseRds(fixture("empty_dataframe.rds"));
      expect(isDataFrame(result)).toBe(true);
      if (!isDataFrame(result)) return;
      expect(result.names).toEqual([]);
      expect(result.columns).toEqual([]);
      expect(toRows(result)).toEqual([]);
    });

    it("parses data frame with date column", async () => {
      const result = await parseRds(fixture("dataframe_dates.rds"));
      if (!isDataFrame(result)) return;
      const rows = toRows(result);
      expect(rows[0]?.name).toBe("match1");
      expect(rows[0]?.date).toBe("2024-03-15");
      expect(rows[1]?.date).toBe("2024-03-22");
    });
  });

  describe("dates", () => {
    it("converts Date to ISO date strings", async () => {
      const result = await parseRds(fixture("dates.rds"));
      expect(result).toEqual(["2024-01-15", "2024-06-30", "2024-12-25"]);
    });

    it("converts POSIXct to ISO datetime strings", async () => {
      const result = await parseRds(fixture("datetimes.rds"));
      expect(result).toEqual(["2024-01-15T10:30:00.000Z", "2024-06-30T14:00:00.000Z"]);
    });
  });

  describe("other types", () => {
    it("parses NULL", async () => {
      const result = await parseRds(fixture("null.rds"));
      expect(result).toBeNull();
    });

    it("parses named list as object", async () => {
      const result = await parseRds(fixture("named_list.rds"));
      expect(result).toEqual({ a: [1], b: ["hello"], c: [true] });
    });

    it("parses raw bytes", async () => {
      const result = await parseRds(fixture("raw.rds"));
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([0x00, 0x01, 0x02, 0xff]);
    });
  });

  describe("errors", () => {
    it("throws RdsError for empty input", async () => {
      await expect(parseRds(new Uint8Array(0))).rejects.toThrow(RdsError);
    });

    it("throws RdsError for truncated input", async () => {
      await expect(parseRds(new Uint8Array([0x58, 0x0a]))).rejects.toThrow(RdsError);
    });

    it("throws RdsError for bzip2 compressed input", async () => {
      const bzip2 = new Uint8Array([0x42, 0x5a, 0x68, 0x00]);
      await expect(parseRds(bzip2)).rejects.toThrow(RdsError);
      await expect(parseRds(bzip2)).rejects.toThrow(/bzip2/);
    });

    it("throws RdsError for xz compressed input", async () => {
      const xz = new Uint8Array([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);
      await expect(parseRds(xz)).rejects.toThrow(RdsError);
      await expect(parseRds(xz)).rejects.toThrow(/xz/);
    });

    it("throws RdsError for unsupported format (ASCII)", async () => {
      // "A\n" header followed by version 2 and R version ints
      const buf = new Uint8Array([
        0x41,
        0x0a, // "A\n"
        0x00,
        0x00,
        0x00,
        0x02, // version 2
        0x00,
        0x04,
        0x01,
        0x02, // writer R version
        0x00,
        0x02,
        0x03,
        0x00, // min reader R version
      ]);
      await expect(parseRds(buf)).rejects.toThrow(RdsError);
      await expect(parseRds(buf)).rejects.toThrow(/format/i);
    });

    it("throws UnsupportedTypeError for unsupported SEXPTYPE", async () => {
      // XDR header with version 2, then a CLOSXP (type 3) flags int
      const buf = new Uint8Array([
        0x58,
        0x0a, // "X\n"
        0x00,
        0x00,
        0x00,
        0x02, // version 2
        0x00,
        0x04,
        0x01,
        0x02, // writer R version
        0x00,
        0x02,
        0x03,
        0x00, // min reader R version
        0x00,
        0x00,
        0x00,
        0x03, // CLOSXP (type 3)
      ]);
      await expect(parseRds(buf)).rejects.toThrow(UnsupportedTypeError);
    });
  });
});
