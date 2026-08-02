export const CREDITS_PER_XP_DIVISOR = 10;

export function creditsForXp(xp: number | null | undefined): number {
  if (!xp || xp <= 0) {
    return 0;
  }
  return Math.floor(xp / CREDITS_PER_XP_DIVISOR);
}
