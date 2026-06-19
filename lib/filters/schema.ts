import { z } from "zod";

const pageInt = z.coerce.number().int().min(1).catch(1);
const pageSizeInt = z.coerce.number().int().min(10).max(200).catch(50);
const bool = z.coerce
  .string()
  .transform((v) => v === "true")
  .catch(true);

export const customersFilterSchema = z.object({
  search:     z.string().catch(""),
  country:    z.string().catch(""),
  activeOnly: bool,
  sort:       z.enum(["name", "revenue30d", "ar", "lastOrder"]).catch("name"),
  sortDir:    z.enum(["asc", "desc"]).catch("asc"),
  page:       pageInt,
  pageSize:   pageSizeInt,
});

export type CustomersFilter = z.infer<typeof customersFilterSchema>;

export const invoicesFilterSchema = z.object({
  dateFrom:       z.string().catch(""),
  dateTo:         z.string().catch(""),
  status:         z.enum(["O", "C", "all"]).catch("all"),
  customerSearch: z.string().catch(""),
  minAmount:      z.coerce.number().optional().catch(undefined),
  maxAmount:      z.coerce.number().optional().catch(undefined),
  sort:           z.enum(["date", "amount", "customer"]).catch("date"),
  sortDir:        z.enum(["asc", "desc"]).catch("desc"),
  page:           pageInt,
  pageSize:       pageSizeInt,
});

export type InvoicesFilter = z.infer<typeof invoicesFilterSchema>;

export const brandsFilterSchema = z.object({
  search:  z.string().catch(""),
  group:   z.string().catch(""),
  sort:    z.enum(["name", "revenue30d", "volume30d"]).catch("revenue30d"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
  page:    pageInt,
  pageSize: pageSizeInt,
});

export type BrandsFilter = z.infer<typeof brandsFilterSchema>;
