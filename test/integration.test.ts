import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRds } from "../src/index.js";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

describe("large data frame", () => {
  it("parses a 1000-row mixed-type data frame", async () => {
    const result = await parseRds(fixture("large_dataframe.rds"));

    expect(Array.isArray(result)).toBe(true);
    const rows = result as Record<string, unknown>[];
    expect(rows.length).toBe(1000);

    const firstRow = rows[0];
    expect(firstRow.id).toBe(1);
    expect(firstRow.name).toBe("item_1");
    expect(typeof firstRow.value).toBe("number");
    expect(typeof firstRow.category).toBe("string");
    expect(firstRow.date).toBe("2020-01-01");

    const lastRow = rows[999];
    expect(lastRow.id).toBe(1000);
    expect(lastRow.name).toBe("item_1000");
    expect(lastRow.date).toBe("2022-09-26");
  });

  it("preserves NA values across columns", async () => {
    const rows = (await parseRds(fixture("large_dataframe.rds"))) as Record<string, unknown>[];
    const activeValues = rows.map((r) => r.active);

    expect(activeValues).toContain(true);
    expect(activeValues).toContain(false);
    expect(activeValues).toContain(null);
  });

  it("resolves all factor levels", async () => {
    const rows = (await parseRds(fixture("large_dataframe.rds"))) as Record<string, unknown>[];
    const categories = new Set(rows.map((r) => r.category));

    expect(categories).toContain("A");
    expect(categories).toContain("B");
    expect(categories).toContain("C");
    expect(categories.size).toBe(3);
  });
});
