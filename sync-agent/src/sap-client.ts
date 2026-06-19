import sql from "mssql";

const config: sql.config = {
  server: process.env.SAP_SQL_HOST!,
  port: parseInt(process.env.SAP_SQL_PORT ?? "1433"),
  database: process.env.SAP_SQL_DATABASE!,
  user: process.env.SAP_SQL_USER!,
  password: process.env.SAP_SQL_PASSWORD!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 120_000,
};

let pool: sql.ConnectionPool | null = null;

export async function getSapPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  pool = await sql.connect(config);
  return pool;
}

export async function closeSapPool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export async function querySap<T = any>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const p = await getSapPool();
  const req = p.request();
  for (const [k, v] of Object.entries(params)) {
    req.input(k, v);
  }
  const result = await req.query<T>(query);
  return result.recordset;
}

// --- Entity-specific fetchers ---

export interface SapCustomer {
  CardCode: string;
  CardName: string;
  CardType: string;
  GroupCode: number | null;
  Country: string | null;
  Currency: string | null;
  CreditLine: number | null;
  Balance: number | null;
  validFor: string | null;
  U_Cluster: string | null;
  U_Channel: string | null;
  U_SalesGroup: string | null;
  CreateDate: Date | null;
  UpdateDate: Date | null;
}

export function fetchCustomers(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      CardCode, CardName, CardType, GroupCode, Country, Currency,
      CreditLine, Balance, validFor,
      U_Cluster, U_Channel, U_SalesGroup,
      CreateDate, UpdateDate
    FROM OCRD
    ${filter}
    ORDER BY UpdateDate ASC
  `;
  return querySap<SapCustomer>(query, updatedSince ? { updatedSince } : {});
}

export function fetchCustomersWithoutUdfs(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      CardCode, CardName, CardType, GroupCode, Country, Currency,
      CreditLine, Balance, validFor,
      NULL AS U_Cluster, NULL AS U_Channel, NULL AS U_SalesGroup,
      CreateDate, UpdateDate
    FROM OCRD
    ${filter}
    ORDER BY UpdateDate ASC
  `;
  return querySap<SapCustomer>(query, updatedSince ? { updatedSince } : {});
}

export interface SapItem {
  ItemCode: string;
  ItemName: string;
  ItmsGrpCod: number | null;
  ItmsGrpNam: string | null;
  U_Brand: string | null;
  U_Category: string | null;
  InvntryUom: string | null;
  SalUnitMsr: string | null;
  validFor: string | null;
  CreateDate: Date | null;
  UpdateDate: Date | null;
}

export function fetchItems(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE i.UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      i.ItemCode, i.ItemName, i.ItmsGrpCod,
      g.ItmsGrpNam,
      i.U_Brand, i.U_Category,
      i.InvntryUom, i.SalUnitMsr, i.validFor,
      i.CreateDate, i.UpdateDate
    FROM OITM i
    LEFT JOIN OITB g ON i.ItmsGrpCod = g.ItmsGrpCod
    ${filter}
    ORDER BY i.UpdateDate ASC
  `;
  return querySap<SapItem>(query, updatedSince ? { updatedSince } : {});
}

export function fetchItemsWithoutUdfs(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE i.UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      i.ItemCode, i.ItemName, i.ItmsGrpCod,
      g.ItmsGrpNam,
      NULL AS U_Brand, NULL AS U_Category,
      i.InvntryUom, i.SalUnitMsr, i.validFor,
      i.CreateDate, i.UpdateDate
    FROM OITM i
    LEFT JOIN OITB g ON i.ItmsGrpCod = g.ItmsGrpCod
    ${filter}
    ORDER BY i.UpdateDate ASC
  `;
  return querySap<SapItem>(query, updatedSince ? { updatedSince } : {});
}

export interface SapInvoice {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  DocDate: Date;
  DocDueDate: Date | null;
  DocTotal: number;
  DocTotalSy: number;  // SAP 9.3: system currency total (no trailing 's')
  DocCur: string;
  DocRate: number;
  PaidToDate: number;
  DocStatus: string;
  CANCELED: string;
  SlpCode: number | null;
  SlpName: string | null;
  VatSum: number | null;
  CreateDate: Date | null;
  UpdateDate: Date | null;
}

export function fetchInvoices(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE i.UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      i.DocEntry, i.DocNum, i.CardCode, i.DocDate, i.DocDueDate,
      i.DocTotal, i.DocTotalSy, i.DocCur, i.DocRate, i.PaidToDate,
      i.DocStatus, i.CANCELED,
      i.SlpCode, s.SlpName,
      i.VatSum,
      i.CreateDate, i.UpdateDate
    FROM OINV i
    LEFT JOIN OSLP s ON i.SlpCode = s.SlpCode
    ${filter}
    ORDER BY i.UpdateDate ASC
  `;
  return querySap<SapInvoice>(query, updatedSince ? { updatedSince } : {});
}

export interface SapInvoiceLine {
  DocEntry: number;
  LineNum: number;
  ItemCode: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
  TotalSumSy: number;
}

export function fetchInvoiceLinesForDocs(docEntries: number[]) {
  if (docEntries.length === 0) return Promise.resolve([]);
  const list = docEntries.join(",");
  const query = `
    SELECT DocEntry, LineNum, ItemCode, Quantity, Price, LineTotal, TotalSumSy
    FROM INV1
    WHERE DocEntry IN (${list})
  `;
  return querySap<SapInvoiceLine>(query);
}

export interface SapPayment {
  DocEntry: number;
  CardCode: string;
  DocDate: Date;
  DocTotal: number;
  DocTotalFC: number;
  DocCurr: string;
  Canceled: string;
  CreateDate: Date | null;
  UpdateDate: Date | null;
}

export function fetchPayments(updatedSince?: Date) {
  const filter = updatedSince ? `WHERE UpdateDate >= @updatedSince` : ``;
  const query = `
    SELECT
      DocEntry, CardCode, DocDate,
      DocTotal, DocTotalFC, DocCurr, Canceled,
      CreateDate, UpdateDate
    FROM ORCT
    ${filter}
    ORDER BY UpdateDate ASC
  `;
  return querySap<SapPayment>(query, updatedSince ? { updatedSince } : {});
}
