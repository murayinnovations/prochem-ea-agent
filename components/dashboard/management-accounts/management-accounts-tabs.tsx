"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PivotTable, type PivotTableProps } from "./pivot-table";
import { AgedDebtorsTab } from "./aged-debtors-tab";
import { AgedCreditorsTab } from "./aged-creditors-tab";
import { StockLevelsTab } from "./stock-levels-tab";
import { LoanFacilitiesTab } from "./loan-facilities-tab";
import { DirectorsAccountTab } from "./directors-account-tab";
import type {
  AgedDebtorRow,
  AgedCreditorRow,
  StockLevelRow,
  LoanFacilityRow,
  DirectorsAccountRow,
} from "@/lib/queries/management-accounts";

interface Props {
  pnl: PivotTableProps;
  cashflow: PivotTableProps;
  agedDebtors: AgedDebtorRow[];
  agedCreditors: AgedCreditorRow[];
  stockLevels: StockLevelRow[];
  loanFacilities: LoanFacilityRow[];
  directorsAccount: DirectorsAccountRow[];
}

const TABS = [
  { value: "pnl", label: "Profit & Loss" },
  { value: "cashflow", label: "Cash Flow" },
  { value: "debtors", label: "Aged Debtors" },
  { value: "creditors", label: "Aged Creditors" },
  { value: "stock", label: "Stock Levels" },
  { value: "loans", label: "Loan Facilities" },
  { value: "directors", label: "Directors Account" },
] as const;

const TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent px-1 pb-2.5 text-slate-500 hover:text-slate-800 data-active:border-amber-500 data-active:bg-transparent data-active:text-amber-700 data-active:after:opacity-0";

function EmptyTabState({ label }: { label: string }) {
  return <p className="py-16 text-center text-sm text-slate-400">No {label} data for this upload.</p>;
}

export function ManagementAccountsTabs({
  pnl,
  cashflow,
  agedDebtors,
  agedCreditors,
  stockLevels,
  loanFacilities,
  directorsAccount,
}: Props) {
  return (
    <Tabs defaultValue="pnl">
      <TabsList variant="line" className="mb-5 h-auto w-full justify-start gap-5 border-b border-slate-200 bg-transparent p-0">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className={TRIGGER_CLASS}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="pnl">
        {pnl.rows.length > 0 ? <PivotTable {...pnl} /> : <EmptyTabState label="P&L" />}
      </TabsContent>
      <TabsContent value="cashflow">
        {cashflow.rows.length > 0 ? <PivotTable {...cashflow} /> : <EmptyTabState label="Cash Flow" />}
      </TabsContent>
      <TabsContent value="debtors">
        <AgedDebtorsTab rows={agedDebtors} />
      </TabsContent>
      <TabsContent value="creditors">
        <AgedCreditorsTab rows={agedCreditors} />
      </TabsContent>
      <TabsContent value="stock">
        <StockLevelsTab rows={stockLevels} />
      </TabsContent>
      <TabsContent value="loans">
        <LoanFacilitiesTab rows={loanFacilities} />
      </TabsContent>
      <TabsContent value="directors">
        <DirectorsAccountTab rows={directorsAccount} />
      </TabsContent>
    </Tabs>
  );
}
