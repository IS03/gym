"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationApiToken } from "@/lib/integrations/chatgpt-tokens";
import { createChatgptKeyAction, revokeChatgptKeyAction } from "./actions";

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Cordoba",
});

const OPENAPI_URL =
  "https://www.ownlevel.fit/api/integrations/chatgpt/openapi";

export function ChatgptIntegration({
  initialTokens,
}: {
  initialTokens: IntegrationApiToken[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "schema" | null>(null);
  const [pending, startTransition] = useTransition();
  const active = tokens.find((token) => token.revoked_at === null);

  function createKey() {
    setError(null);
    startTransition(async () => {
      const result = await createChatgptKeyAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTokens((current) => [result.token, ...current]);
      setRawToken(result.rawToken);
      setCopied(null);
    });
  }

  function revokeKey(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeChatgptKeyAction(id);
      if (!result.ok) {
        setError(result.error ?? "No se pudo revocar la clave.");
        return;
      }
      const revokedAt = new Date().toISOString();
      setTokens((current) =>
        current.map((token) =>
          token.id === id ? { ...token, revoked_at: revokedAt } : token,
        ),
      );
      setRawToken(null);
    });
  }

  async function copyText(value: string, target: "token" | "schema") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-5 text-primary" aria-hidden />
          Integración con ChatGPT
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Una clave privada permite que tu GPT registre comidas en OWNLEVEL.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rawToken ? (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">Guardala ahora. No volveremos a mostrarla.</p>
            <code className="block break-all rounded-lg border bg-background p-3 text-xs">
              {rawToken}
            </code>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => copyText(rawToken, "token")}
            >
              {copied === "token" ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === "token" ? "Copiada" : "Copiar clave"}
            </Button>
          </div>
        ) : null}

        {active ? (
          <div className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                  Clave activa
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {active.token_prefix}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Creada: {dateTime.format(new Date(active.created_at))}
            </p>
            <p className="text-xs text-muted-foreground">
              Último uso: {active.last_used_at ? dateTime.format(new Date(active.last_used_at)) : "Nunca"}
            </p>
            {!active.last_used_at ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                La clave todavía no fue utilizada por una integración.
              </p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              className="mt-2 w-full"
              disabled={pending}
              onClick={() => revokeKey(active.id)}
            >
              {pending ? "Revocando…" : "Revocar clave"}
            </Button>
          </div>
        ) : (
          <Button type="button" className="w-full" disabled={pending} onClick={createKey}>
            {pending ? "Creando…" : "Crear clave"}
          </Button>
        )}

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" aria-hidden />
            <h3 className="text-sm font-medium">Cómo conectarlo</h3>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
            <li>Creá la clave y copiala cuando aparezca.</li>
            <li>En tu GPT privado existente, agregá o editá la Action.</li>
            <li>Importá la URL del esquema.</li>
            <li>Elegí API Key, tipo Bearer, y pegá la clave.</li>
            <li>Probá primero la operación de conexión.</li>
          </ol>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => copyText(OPENAPI_URL, "schema")}
          >
            {copied === "schema" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied === "schema" ? "URL copiada" : "Copiar URL del esquema"}
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Una clave revocada deja de funcionar inmediatamente. OWNLEVEL sólo guarda su hash.
        </p>
      </CardContent>
    </Card>
  );
}
