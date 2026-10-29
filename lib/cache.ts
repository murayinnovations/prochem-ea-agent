import { unstable_cache } from "next/cache";

// Every dashboard query is cached under this tag, so one refresh clears them all.
export const DASHBOARD_DATA_TAG = "dashboard-data";
// Data comes from a periodic SAP sync — an hour is fresh enough, and the
// refresh button covers anything more urgent.
export const DASHBOARD_REVALIDATE_SECONDS = 3600;

// Shares the tag and lifetime of the cached queries, so the timestamp resets
// whenever the data cache does and approximates when the data was last fetched.
export const getLastRefreshed = unstable_cache(
  async (): Promise<string> => new Date().toISOString(),
  ["dashboard-last-refreshed"],
  { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_DATA_TAG] },
);
