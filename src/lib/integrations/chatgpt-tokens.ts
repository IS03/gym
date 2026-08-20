import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type IntegrationAuthEvent =
  | "missing_authorization"
  | "malformed_bearer"
  | "invalid_token_shape"
  | "token_hash_not_found"
  | "token_authenticated";

export function logIntegrationAuthEvent(event: IntegrationAuthEvent) {
  console.info(`[ownlevel-chatgpt-auth] ${event}`);
}

export type IntegrationApiToken = {
  id: string;
  token_prefix: string;
  label: string;
  scope: "meals:write";
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

async function webUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

export function hashIntegrationToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function newIntegrationToken() {
  return `ownlevel_${randomBytes(32).toString("base64url")}`;
}

export async function listIntegrationApiTokens(): Promise<IntegrationApiToken[]> {
  const { supabase, userId } = await webUser();
  const { data, error } = await supabase
    .from("integration_api_tokens")
    .select("id,token_prefix,label,scope,created_at,last_used_at,revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Leer claves de integración: ${error.message}`);
  return (data ?? []) as IntegrationApiToken[];
}

export async function createIntegrationApiToken(): Promise<{
  rawToken: string;
  token: IntegrationApiToken;
}> {
  const { supabase, userId } = await webUser();
  const rawToken = newIntegrationToken();
  const prefix = `${rawToken.slice(0, 18)}…`;
  const { data, error } = await supabase
    .from("integration_api_tokens")
    .insert({
      user_id: userId,
      token_hash: hashIntegrationToken(rawToken),
      token_prefix: prefix,
      label: "ChatGPT",
      scope: "meals:write",
    })
    .select("id,token_prefix,label,scope,created_at,last_used_at,revoked_at")
    .single();
  if (error?.code === "23505") {
    throw new Error("Ya existe una clave activa. Revocala antes de crear otra.");
  }
  if (error) throw new Error(`Crear clave de integración: ${error.message}`);
  return { rawToken, token: data as IntegrationApiToken };
}

export async function revokeIntegrationApiToken(id: string): Promise<void> {
  const { supabase, userId } = await webUser();
  const { error } = await supabase
    .from("integration_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(`Revocar clave de integración: ${error.message}`);
}

export async function authenticateIntegrationToken(rawToken: string) {
  if (!/^ownlevel_[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    logIntegrationAuthEvent("invalid_token_shape");
    return null;
  }
  const admin = createAdminClient();
  const tokenHash = hashIntegrationToken(rawToken);
  const { data, error } = await admin
    .from("integration_api_tokens")
    .select("id,user_id,scope")
    .eq("token_hash", tokenHash)
    .eq("scope", "meals:write")
    .is("revoked_at", null)
    .maybeSingle();
  // Permite comprobar credenciales administrativas en un preview previo a la
  // migración. En producción la tabla existe; cualquier otro fallo es interno.
  if (error?.code === "PGRST205") {
    logIntegrationAuthEvent("token_hash_not_found");
    return null;
  }
  if (error) throw new Error("No se pudo autenticar la integración.");
  if (!data) {
    logIntegrationAuthEvent("token_hash_not_found");
    return null;
  }

  const { error: usageError } = await admin
    .from("integration_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("revoked_at", null);
  if (usageError) throw new Error("No se pudo registrar el uso de la integración.");

  logIntegrationAuthEvent("token_authenticated");
  return { userId: String(data.user_id), tokenId: String(data.id) };
}
