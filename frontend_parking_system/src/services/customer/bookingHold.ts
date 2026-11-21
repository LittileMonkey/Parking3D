/** Remaining seconds for a backend-issued deadline; null means no usable deadline. */
export function remainingHoldSeconds(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
