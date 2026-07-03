export function isStale(cycleDate: string | null, now: Date, maxDays = 28): boolean {
  if (!cycleDate) return true;
  const ageDays = (now.getTime() - new Date(cycleDate).getTime()) / 86_400_000;
  return ageDays > maxDays;
}
