export interface GoalSummaryItem {
  title: string;
  daysLeft: number | null;
  overdue: boolean;
}

export interface GoalBannerSummary {
  count: number;
  overdueCount: number;
  maxOverdueDays: number;
  title: string;
  tone: "danger" | "warning";
}

export function goalBannerSummary(items: GoalSummaryItem[]): GoalBannerSummary | null {
  if (!items.length) return null;
  const overdue = items.filter((item) => item.overdue);
  const ordered = items.map((item, index) => ({ item, index })).sort((a, b) => {
    if (a.item.overdue !== b.item.overdue) return a.item.overdue ? -1 : 1;
    if (a.item.overdue && b.item.overdue) {
      const days = (a.item.daysLeft ?? 0) - (b.item.daysLeft ?? 0);
      return days || a.index - b.index;
    }
    const days = (a.item.daysLeft ?? Number.POSITIVE_INFINITY) - (b.item.daysLeft ?? Number.POSITIVE_INFINITY);
    return days || a.index - b.index;
  });
  return {
    count: items.length,
    overdueCount: overdue.length,
    maxOverdueDays: overdue.reduce((max, item) => Math.max(max, Math.abs(Math.min(item.daysLeft ?? 0, 0))), 0),
    title: ordered[0].item.title,
    tone: overdue.length ? "danger" : "warning",
  };
}
