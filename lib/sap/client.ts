/**
 * SAP B1 Service Layer client. Built behind an interface so we can swap
 * in MockSapClient during development and RealSapClient in production.
 *
 * Usage:
 *   const sap = process.env.USE_MOCK_SAP === "true"
 *     ? new MockSapClient()
 *     : new RealSapClient(config);
 *   const customers = await sap.getCustomers({ updatedSince: lastSync });
 */

import { z } from "zod";

// ============================================================
// TYPES
// ============================================================

export const SapCustomer = z.object({
  CardCode: z.string(),
  CardName: z.string(),
  GroupCode: z.number().nullable(),
  Country: z.string().nullable(),
  Currency: z.string().nullable(),
  CreditLine: z.number().nullable(),
  Valid: z.string().nullable(), // 'tYES' / 'tNO'
  UpdateDate: z.string(),
  // Custom UDFs commonly used:
  U_Cluster: z.string().nullable().optional(),
  U_Channel: z.string().nullable().optional(),
  U_SalesGroup: z.string().nullable().optional(),
});
export type SapCustomer = z.infer<typeof SapCustomer>;

export const SapInvoice = z.object({
  DocEntry: z.number(),
  DocNum: z.number(),
  CardCode: z.string(),
  DocDate: z.string(),
  DocDueDate: z.string(),
  DocTotal: z.number(),
  DocTotalSys: z.number(), // in local currency (KES)
  DocCurrency: z.string(),
  DocRate: z.number(),
  PaidToDate: z.number(),
  DocumentStatus: z.string(), // 'bost_Open' / 'bost_Close'
  UpdateDate: z.string(),
  DocumentLines: z.array(
    z.object({
      LineNum: z.number(),
      ItemCode: z.string(),
      Quantity: z.number(),
      LineTotal: z.number(),
    }),
  ),
});
export type SapInvoice = z.infer<typeof SapInvoice>;

export interface SyncQuery {
  updatedSince?: Date;
  limit?: number;
  skip?: number;
}

// ============================================================
// INTERFACE
// ============================================================

export interface SapClient {
  login(): Promise<void>;
  getCustomers(q?: SyncQuery): Promise<SapCustomer[]>;
  getInvoices(q?: SyncQuery): Promise<SapInvoice[]>;
  getPayments(q?: SyncQuery): Promise<unknown[]>;
  getFxRates(q?: SyncQuery): Promise<unknown[]>;
}

// ============================================================
// REAL CLIENT
// ============================================================

export interface SapConfig {
  baseUrl: string;       // e.g. https://sap.client.com:50000
  companyDB: string;
  userName: string;
  password: string;
}

export class RealSapClient implements SapClient {
  private sessionCookie?: string;
  private sessionExpires = 0;

  constructor(private cfg: SapConfig) {}

  async login() {
    const res = await fetch(`${this.cfg.baseUrl}/b1s/v1/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        CompanyDB: this.cfg.companyDB,
        UserName: this.cfg.userName,
        Password: this.cfg.password,
      }),
    });
    if (!res.ok) throw new Error(`SAP login failed: ${res.status}`);
    const cookie = res.headers.get("set-cookie");
    if (!cookie) throw new Error("No session cookie returned");
    this.sessionCookie = cookie;
    this.sessionExpires = Date.now() + 25 * 60 * 1000; // refresh before 30min expiry
  }

  private async ensureSession() {
    if (!this.sessionCookie || Date.now() > this.sessionExpires) {
      await this.login();
    }
  }

  private async fetchAll<T>(path: string, parser: z.ZodSchema<T>, q?: SyncQuery): Promise<T[]> {
    await this.ensureSession();
    const params = new URLSearchParams();
    params.set("$top", String(q?.limit ?? 100));
    params.set("$skip", String(q?.skip ?? 0));
    if (q?.updatedSince) {
      const iso = q.updatedSince.toISOString().split("T")[0];
      params.set("$filter", `UpdateDate ge '${iso}'`);
    }

    const results: T[] = [];
    let skip = q?.skip ?? 0;
    const pageSize = q?.limit ?? 100;

    while (true) {
      params.set("$skip", String(skip));
      const res = await fetch(`${this.cfg.baseUrl}${path}?${params}`, {
        headers: { Cookie: this.sessionCookie!, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`SAP ${path} failed: ${res.status}`);
      const body = (await res.json()) as { value: unknown[]; "odata.nextLink"?: string };
      for (const row of body.value) results.push(parser.parse(row));
      if (!body["odata.nextLink"] || body.value.length < pageSize) break;
      skip += pageSize;
    }

    return results;
  }

  getCustomers(q?: SyncQuery) {
    return this.fetchAll("/b1s/v1/BusinessPartners", SapCustomer, q);
  }
  getInvoices(q?: SyncQuery) {
    return this.fetchAll("/b1s/v1/Invoices", SapInvoice, q);
  }
  async getPayments(_q?: SyncQuery): Promise<unknown[]> { throw new Error("TODO"); }
  async getFxRates(_q?: SyncQuery): Promise<unknown[]> { throw new Error("TODO"); }
}

// ============================================================
// MOCK CLIENT — for local dev before SAP access is granted
// ============================================================

export class MockSapClient implements SapClient {
  async login() { /* noop */ }

  async getCustomers(): Promise<SapCustomer[]> {
    // Returns ~10 seeded customers matching screenshot patterns
    // (Quick Mart Limited, Majid Al Futaim, BIDCORO AFRICA, Scooby Enterprises, etc.)
    return MOCK_CUSTOMERS;
  }
  async getInvoices(): Promise<SapInvoice[]> { return MOCK_INVOICES; }
  async getPayments() { return []; }
  async getFxRates() { return MOCK_FX_RATES; }
}

const MOCK_CUSTOMERS: SapCustomer[] = [
  // populate with realistic seed data
];
const MOCK_INVOICES: SapInvoice[] = [];
const MOCK_FX_RATES: unknown[] = [];
