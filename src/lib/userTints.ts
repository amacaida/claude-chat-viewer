// Per-user row tints for the conversation sidebar ("fusion" palette).
//
// 20 OKLCH-derived colors in two tiers: users 1-10 get subtle pastels
// (hues 36deg apart, lightness alternating 0.95/0.966, chroma <= 0.055),
// users 11-20 get saturated pastels (hues offset 18deg between tier-1 hues,
// lightness 0.90/0.935, chroma <= 0.10). Within each tier, colors are
// pre-ordered greedily so each next user gets the color farthest (OKLab
// distance) from all colors already assigned. Worst-case contrast on any
// tint: 12.9:1 for gray-900 titles, 5.5:1 for gray-600 metadata (WCAG AA).
export const USER_TINTS: readonly string[] = [
  // tier 1 - subtle pastel
  "#d9f9d8",
  "#fdeefe",
  "#d4f5fe",
  "#feebd5",
  "#f7f7cd",
  "#d4fef5",
  "#fef0ec",
  "#ecf5fe",
  "#fee8ee",
  "#edecfe",
  // tier 2 - saturated
  "#f8dc90",
  "#a0f3ca",
  "#e7d5fd",
  "#fdd2d2",
  "#bbe5fd",
  "#a3fcfe",
  "#d9f6ad",
  "#fedff1",
  "#fee4d3",
  "#e2e9fe",
];

// Assigns each user a stable tint: sorted by account UUID so a given user
// keeps the same color across reloads, wrapping around past 20 users.
export function assignUserTints(userUuids: Iterable<string>): Map<string, string> {
  const sorted = Array.from(new Set(userUuids)).sort();
  const tints = new Map<string, string>();
  sorted.forEach((uuid, index) => {
    tints.set(uuid, USER_TINTS[index % USER_TINTS.length]);
  });
  return tints;
}
