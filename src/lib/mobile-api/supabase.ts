import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createResilientSupabaseFetch } from "@/lib/supabase/resilient-fetch";
import {
  isRejectedMobileAccessToken,
  MobileApiUnauthorizedError,
  type MobileAuthenticatedContext,
  type MobileDailyMetricsRepository,
  type MobileMetricDefinitionRow,
  type MobileMetricValueRow,
} from "./daily-metrics";

const MOBILE_API_REQUEST_TIMEOUT_MS = 10_000;

function requiredPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error("Missing Supabase public configuration");
  }
  return { url, publishableKey };
}

function createMobileRequestClient(accessToken: string): SupabaseClient {
  const { url, publishableKey } = requiredPublicConfig();
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: createResilientSupabaseFetch(undefined, {
        requestTimeoutMs: MOBILE_API_REQUEST_TIMEOUT_MS,
      }),
    },
  });
}

function repositoryFor(supabase: SupabaseClient): MobileDailyMetricsRepository {
  return {
    async readDefinitions(userId) {
      const result = await supabase
        .from("user_metrics")
        .select("id,system_key,name,unit,value_type")
        .eq("user_id", userId)
        .order("sort_order")
        .order("created_at");
      if (result.error) throw result.error;

      return (result.data ?? []).map((row): MobileMetricDefinitionRow => {
        if (
          row.value_type !== "integer" &&
          row.value_type !== "decimal" &&
          row.value_type !== "duration"
        ) {
          throw new Error("Invalid daily metric definition");
        }

        return {
          id: String(row.id),
          systemKey:
            typeof row.system_key === "string" ? row.system_key : null,
          label: String(row.name),
          unit: typeof row.unit === "string" ? row.unit : null,
          valueType: row.value_type,
        };
      });
    },

    async readValues(userId, date) {
      const result = await supabase
        .from("daily_metric_values")
        .select("metric_id,value")
        .eq("user_id", userId)
        .eq("metric_date", date);
      if (result.error) throw result.error;

      return (result.data ?? []).map((row): MobileMetricValueRow => ({
        metricId: String(row.metric_id),
        value: row.value,
      }));
    },

    async readLatestRecordedDate(userId, throughDate) {
      const result = await supabase
        .from("daily_metric_values")
        .select("metric_date")
        .eq("user_id", userId)
        .lte("metric_date", throughDate)
        .order("metric_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data?.metric_date
        ? String(result.data.metric_date)
        : null;
    },
  };
}

export async function authenticateMobileAccessToken(
  accessToken: string,
): Promise<MobileAuthenticatedContext> {
  const supabase = createMobileRequestClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    if (isRejectedMobileAccessToken(error)) {
      throw new MobileApiUnauthorizedError();
    }
    throw error;
  }
  if (!data.user?.id) {
    throw new MobileApiUnauthorizedError();
  }

  return {
    userId: data.user.id,
    repository: repositoryFor(supabase),
  };
}
