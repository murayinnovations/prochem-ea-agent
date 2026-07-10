import { formatAccountingNumber } from "@/lib/formatters";
import type { LoanFacilityRow } from "@/lib/queries/management-accounts";

export function LoanFacilitiesTab({ rows }: { rows: LoanFacilityRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Facility</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700">{r.facility_name}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-900">
                  {formatAccountingNumber(r.amount)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-16 text-center text-sm text-slate-400">
                  No loan facilities recorded.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-3">Grand Total</td>
                <td className="px-4 py-3 text-right font-mono">{formatAccountingNumber(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
