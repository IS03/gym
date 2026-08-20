"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationApiToken } from "@/lib/integrations/chatgpt-tokens";
import { createChatgptKeyAction, revokeChatgptKeyAction } from "./actions";

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Cordoba",
});

export function ChatgptIntegration({
  initialTokens,
}: {
  initialTokens: IntegrationApiToken[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      setCopied(false);
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

  async function copyToken() {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
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
            <Button type="button" variant="outline" className="w-full" onClick={copyToken}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copiada" : "Copiar clave"}
            </Button>
          </div>
        ) : null}

        {active ? (
          <div className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{active.token_prefix}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                Activa
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Creada: {dateTime.format(new Date(active.created_at))}
            </p>
            <p className="text-xs text-muted-foreground">
              Último uso: {active.last_used_at ? dateTime.format(new Date(active.last_used_at)) : "Nunca"}
            </p>
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Una clave revocada deja de funcionar inmediatamente. OWNLEVEL sólo guarda su hash.
        </p>
      </CardContent>
    </Card>
  );
}
