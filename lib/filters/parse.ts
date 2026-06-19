import type { ZodSchema } from "zod";

/** Safely parse URL search params through a Zod schema, returning defaults on error. */
export function parseSearchParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | string[] | undefined>,
): T {
  // Flatten any array values to first element
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) flat[k] = v[0] ?? "";
    else if (v != null) flat[k] = v;
  }
  return schema.parse(flat);
}
