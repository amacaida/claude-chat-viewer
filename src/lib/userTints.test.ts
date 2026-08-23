import { describe, expect, test } from "bun:test";
import { assignUserTints, USER_TINTS } from "./userTints";

describe("assignUserTints", () => {
  test("assigns colors in palette order by sorted uuid", () => {
    const tints = assignUserTints(["b", "a", "c"]);
    expect(tints.get("a")).toBe(USER_TINTS[0]);
    expect(tints.get("b")).toBe(USER_TINTS[1]);
    expect(tints.get("c")).toBe(USER_TINTS[2]);
  });

  test("is stable regardless of input order and duplicates", () => {
    const a = assignUserTints(["x", "y", "z"]);
    const b = assignUserTints(["z", "y", "x", "y"]);
    expect(a).toEqual(b);
  });

  test("wraps around past 20 users", () => {
    const uuids = Array.from({ length: 21 }, (_, i) => `u${String(i).padStart(2, "0")}`);
    const tints = assignUserTints(uuids);
    expect(tints.get("u20")).toBe(USER_TINTS[0]);
  });

  test("palette has 20 distinct colors", () => {
    expect(USER_TINTS).toHaveLength(20);
    expect(new Set(USER_TINTS).size).toBe(20);
  });
});
