export const MIN_STEM = 40;
export const MAX_STEM = 260;
export const MAX_LEAF_PAIRS = 5;
export const MAX_FLOWERS = 4;

export type PlantShape = {
  growth: number;
  stemPx: number;
  leafPairs: number;
  flowers: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function plantShape(
  score: number,
  topScore: number,
  featuresCount = 0
): PlantShape {
  const growth = topScore > 0 ? clamp01(score / topScore) : 0;
  const stemPx = Math.round(MIN_STEM + (MAX_STEM - MIN_STEM) * growth);
  const leafPairs = Math.min(MAX_LEAF_PAIRS, Math.floor(growth * MAX_LEAF_PAIRS));
  const flowers = Math.min(MAX_FLOWERS, Math.floor(Math.max(0, featuresCount) / 2));
  return { growth, stemPx, leafPairs, flowers };
}
