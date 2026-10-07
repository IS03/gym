"use client";

import { Button } from "@/components/ui/button";

/** A GET form used for Reload would discard authorization_id. Reload this URL instead. */
export default function OAuthConsentError() {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 py-8">
    <h1 className="text-2xl font-semibold">No pudimos cargar la conexión</h1>
    <p role="alert" className="text-sm text-muted-foreground">Intentá nuevamente. Tu solicitud se conserva.</p>
    <Button type="button" className="h-[50px] rounded-[14px]" onClick={() => window.location.reload()}>
      Reintentar
    </Button>
  </main>;
}
