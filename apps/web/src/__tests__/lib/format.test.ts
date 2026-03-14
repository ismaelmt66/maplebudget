import { describe, it, expect } from "vitest";
import { money, ymd, parseYMD, addDays } from "@/lib/format";

describe("money", () => {
  it("formats positive numbers as CAD currency", () => {
    const result = money(1234.56);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("formats zero", () => {
    const result = money(0);
    expect(result).toContain("0");
  });

  it("formats negative numbers", () => {
    const result = money(-50);
    expect(result).toContain("50");
  });
});

describe("ymd", () => {
  it("converts Date to YYYY-MM-DD", () => {
    const d = new Date(2026, 0, 15);
    expect(ymd(d)).toBe("2026-01-15");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 2, 5);
    expect(ymd(d)).toBe("2026-03-05");
  });
});

describe("parseYMD", () => {
  it("parses YYYY-MM-DD to Date", () => {
    const d = parseYMD("2026-01-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const d = new Date(2026, 0, 15);
    const result = addDays(d, 10);
    expect(result.getDate()).toBe(25);
    expect(d.getDate()).toBe(15); // original unchanged
  });

  it("subtracts days with negative value", () => {
    const d = new Date(2026, 0, 15);
    const result = addDays(d, -10);
    expect(result.getDate()).toBe(5);
  });

  it("handles month boundaries", () => {
    const d = new Date(2026, 0, 30);
    const result = addDays(d, 5);
    expect(result.getMonth()).toBe(1);
  });
});
