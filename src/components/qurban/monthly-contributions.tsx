"use client";

import { useQurban } from "./demo-provider";
import { money, shortMoney, totals } from "@/lib/qurban-demo";

export function MonthlyContributions() {
  const { state, periodId } = useQurban();
  const period = state.periods.find((p) => p.id === periodId)!;
  const entries = totals(state, periodId).entries;
  const dates = [
    period.start.slice(0, 7),
    period.due.slice(0, 7),
    ...entries.map((t) => t.date.slice(0, 7)),
  ].sort();
  const first = new Date(`${dates[0]}-01T12:00:00Z`);
  const last = new Date(`${dates.at(-1)}-01T12:00:00Z`);
  const count =
    (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    last.getUTCMonth() -
    first.getUTCMonth() +
    1;
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1),
    );
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: new Intl.DateTimeFormat("id-ID", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(date),
      total: entries
        .filter((e) => e.date.slice(0, 7) === key)
        .reduce(
          (sum, e) => sum + (e.type === "deposit" ? e.amount : -e.amount),
          0,
        ),
    };
  });
  const maximum = Math.max(...months.map((m) => Math.abs(m.total)), 1);
  return (
    <section className="qm-monthly">
      <h3>Perkembangan iuran</h3>
      <p>Setoran bersih per bulan</p>
      <div>
        {months.map((month) => (
          <div
            className="qm-month-row"
            key={month.key}
            aria-label={`${month.label}: ${money(month.total)}`}
          >
            <span>{month.label}</span>
            <div>
              <i
                className={month.total < 0 ? "is-negative" : ""}
                style={{ width: `${(Math.abs(month.total) / maximum) * 100}%` }}
              />
            </div>
            <strong>{shortMoney(month.total)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
