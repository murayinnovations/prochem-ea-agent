/**
 * Dev utility: parse a management-accounts workbook without touching the
 * database, and print row counts per sheet for a quick eyeball check.
 *
 * Usage: npx tsx scripts/preview-management-accounts.ts <path-to-xlsx-or-xls>
 */

import fs from "fs";
import { parseManagementAccountsWorkbook } from "../lib/management-accounts/parser";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/preview-management-accounts.ts <path-to-xlsx-or-xls>");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const result = parseManagementAccountsWorkbook(buffer, filePath);

console.log(`Period:  ${result.periodLabel ?? "(undetected)"} (${result.periodMonth ?? "—"})`);
console.log(`Sheets found:   ${result.sheetNames.join(", ")}`);
console.log(`Sheets parsed:  ${result.parsedSheets.join(", ") || "(none)"}`);
if (Object.keys(result.skippedSheets).length > 0) {
  console.log("Sheets skipped:");
  for (const [name, reason] of Object.entries(result.skippedSheets)) {
    console.log(`  - ${name}: ${reason}`);
  }
}
console.log("\nRow counts:");
console.table({
  pnl_lines: result.pnlLines.length,
  cashflow_lines: result.cashflowLines.length,
  aged_debtors_snapshots: result.agedDebtors.length,
  aged_creditors_snapshots: result.agedCreditors.length,
  mgmt_stock_snapshots: result.stockLevels.length,
  loan_facilities: result.loanFacilities.length,
  directors_account_entries: result.directorsAccount.length,
});
