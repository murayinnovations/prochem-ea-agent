import { Fragment } from "react";
import { format, parseISO } from "date-fns";
import { formatAccountingNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PivotTableData } from "@/lib/queries/management-accounts";

export type PivotTableProps = PivotTableData;

// The template names its roll-up rows a handful of consistent ways (e.g.
// "COST OF SALES" after several "COST OF SALES - <brand>" lines). This is a
// naming-convention heuristic, not a parsed flag — if finance renames a
// summary line it just stops bolding, it won't break anything.
const SUBTOTAL_LABELS = new Set([
  "gross turnover-general trading",
  "cost of sales",
  "gross profit",
  "administrative expenses",
  "operating expenses",
  "fuel",
  "motor vehicle running expenses",
  "financial expenses",
  "operating profit",
  "total profit",
  "inflows from operations",
  "inflows from others",
  "total inflows",
  "total outflows",
  "surplus/deficit",
  "motor vehicles running expenses & repairs",
  "cash inflows",
  "cash outflows",
]);

function isSubtotalRow(label: string): boolean {
  const norm = label.trim().toLowerCase();
  if (SUBTOTAL_LABELS.has(norm)) return true;
  return /\btotal\b/.test(norm) && !norm.includes(" - ");
}

function monthLabel(iso: string): string {
  try {
    return format(parseISO(iso), "MMM yy");
  } catch {
    return iso;
  }
}

type AnnotatedRow = PivotTableData["rows"][number] & {
  showSectionBreak: boolean;
};

// Plain helper (not the component body) so the running `lastSection`
// mutation isn't flagged as a render-immutability violation.
function annotateSectionBreaks(rows: PivotTableData["rows"]): AnnotatedRow[] {
  let lastSection: string | null = null;
  return rows.map((row) => {
    const showSectionBreak = !!row.section && row.section !== lastSection;
    lastSection = row.section ?? lastSection;
    return { ...row, showSectionBreak };
  });
}

export function PivotTable({ months, rows }: PivotTableProps) {
  const annotatedRows = annotateSectionBreaks(rows);

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 min-w-[160px] sm:min-w-[240px] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
              Account
            </th>
            {months.map((m) => (
              <th
                key={m}
                className="sticky top-0 z-20 min-w-[110px] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-xs font-semibold text-slate-600"
              >
                {monthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {annotatedRows.map((row, i) => {
            const bold = isSubtotalRow(row.label);

            return (
              <Fragment key={`${row.label}-${i}`}>
                {row.showSectionBreak && (
                  <tr className="bg-slate-100/70">
                    <td
                      colSpan={months.length + 1}
                      className="sticky left-0 z-10 bg-slate-100/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {row.section}
                    </td>
                  </tr>
                )}
                <tr className={cn("hover:bg-slate-50", bold && "bg-amber-50/50")}>
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-2 text-slate-700",
                      bold && "bg-amber-50/50 font-semibold text-slate-900",
                    )}
                  >
                    {row.label}
                  </td>
                  {row.values.map((v, vi) => (
                    <td
                      key={vi}
                      className={cn(
                        "px-4 py-2 text-right font-mono text-slate-700",
                        bold && "font-semibold text-slate-900",
                        v !== null && v < 0 && "text-red-600",
                      )}
                    >
                      {formatAccountingNumber(v)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={months.length + 1} className="py-16 text-center text-sm text-slate-400">
                No data for this sheet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
