"use server";

import { updateTag } from "next/cache";
import { DASHBOARD_DATA_TAG } from "@/lib/cache";

// Expires every cached dashboard query so the next render reads fresh from Supabase.
export async function refreshDashboardData() {
  updateTag(DASHBOARD_DATA_TAG);
}
