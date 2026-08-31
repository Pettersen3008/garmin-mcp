import { describe, expect, it } from "bun:test";
import { parseLocalDate } from "../src/index.ts";

describe("parseLocalDate", () => {
  it("given calendar dates, when parsing, then accepts valid dates and rejects invalid dates", () => {
    expect(String(parseLocalDate("2024-02-29"))).toBe("2024-02-29");
    expect(() => parseLocalDate("2023-02-29")).toThrow(RangeError);
    expect(() => parseLocalDate("2024-2-29")).toThrow(RangeError);
  });
});
