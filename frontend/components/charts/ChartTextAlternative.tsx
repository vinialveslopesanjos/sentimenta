"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ListTree } from "lucide-react";

export interface ChartTextColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export type ChartTextRow = Record<string, ReactNode>;

interface ChartTextAlternativeProps {
  chartId: string;
  title: string;
  summary: string;
  period: string;
  unit: string;
  columns: ChartTextColumn[];
  rows: ChartTextRow[];
  className?: string;
}

export function ChartTextAlternative({
  chartId,
  title,
  summary,
  period,
  unit,
  columns,
  rows,
  className = "",
}: ChartTextAlternativeProps) {
  const ta = useTranslations("charts.accessibility");
  const summaryId = `${chartId}-text-summary`;

  return (
    <section
      data-testid={`${chartId}-text-alternative`}
      data-chart-alternative-for={chartId}
      aria-labelledby={summaryId}
      className={`mt-4 rounded-xl p-3.5 ${className}`}
      style={{
        backgroundColor: "var(--bg-subtle)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)" }}
        >
          <ListTree className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p
            id={summaryId}
            data-testid={`${chartId}-summary`}
            style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "var(--text-primary)" }}
          >
            <span style={{ fontWeight: 800 }}>{ta("quickRead")}:</span> {summary}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: "0.7rem" }}>
            <div className="flex gap-1.5">
              <dt style={{ color: "var(--text-muted)", fontWeight: 700 }}>{ta("periodLabel")}:</dt>
              <dd data-testid={`${chartId}-period`} style={{ color: "var(--text-primary)" }}>{period}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt style={{ color: "var(--text-muted)", fontWeight: 700 }}>{ta("unitLabel")}:</dt>
              <dd data-testid={`${chartId}-unit`} style={{ color: "var(--text-primary)" }}>{unit}</dd>
            </div>
          </dl>
        </div>
      </div>

      <details className="group mt-3" data-testid={`${chartId}-data-details`}>
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: "var(--primary)", fontSize: "0.74rem", fontWeight: 750 }}
        >
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          {ta("dataDetails")}
        </summary>
        <div className="mt-2 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <table data-testid={`${chartId}-data-table`} className="w-full border-collapse" style={{ fontSize: "0.74rem" }}>
            <caption className="sr-only">
              {ta("tableCaption", { title, period, unit })}
            </caption>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`whitespace-nowrap px-3 py-2 ${column.numeric ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text-muted)", fontWeight: 800 }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: rowIndex === rows.length - 1 ? "none" : "1px solid var(--border)" }}>
                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap px-3 py-2 ${column.numeric ? "text-right tabular-nums" : "text-left"}`}
                        style={{ color: "var(--text-primary)" }}
                      >
                        {value == null || value === "" ? ta("notAvailable") : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
