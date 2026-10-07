"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OAuthConnections({ clientIds }: { clientIds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function revoke(clientId: string) {
    setPending(clientId);
    setMessage("");
    try {
      const response = await fetch("/api/oauth/revoke", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      if (!response.ok) throw new Error("revoke_failed");
      const result = await response.json();
      setMessage(result.oauth_cleanup_pending
        ? "El registro de comidas ya está bloqueado. La desconexión de Supabase quedó pendiente."
        : "Conexión revocada. ChatGPT ya no puede registrar comidas.");
      router.refresh();
    } catch { setMessage("No pudimos revocar la conexión. Intentá nuevamente."); }
    finally { setPending(null); }
  }
  return (
    <section className="rounded-[20px] bg-card p-4 shadow-sm ring-1 ring-foreground/8">
      <h2 className="font-semibold">OWNLEVEL Meals · OAuth</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Podés quitar el permiso para registrar comidas sin cambiar tus tokens privados anteriores.
      </p>
      {clientIds.length === 0 && <p className="mt-3 text-sm">Sin conexiones OAuth autorizadas.</p>}
      {clientIds.map((clientId) => (
        <div key={clientId} className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm">ChatGPT · registro de comidas</span>
          <Button variant="outline" disabled={pending !== null} onClick={() => revoke(clientId)}>
            {pending === clientId ? "Revocando…" : "Revocar conexión"}
          </Button>
        </div>
      ))}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>
  );
}
