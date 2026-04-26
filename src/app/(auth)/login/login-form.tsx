"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginFormProps = {
  authError?: boolean;
};

export function LoginForm({ authError }: LoginFormProps) {
  const [error, setError] = useState<string | null>(
    authError ? "No se pudo completar el inicio de sesión." : null,
  );
  const [pending, setPending] = useState(false);

  async function handleGoogle() {
    setError(null);
    setPending(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          /**
           * Fuerza el selector de cuenta aunque Google tenga sesión previa,
           * evitando que "reutilice" silenciosamente la cuenta anterior.
           */
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setPending(false);
      }
      // Si no hay error, Supabase redirige al proveedor; no seguimos ejecutando UI.
    } catch {
      setError("Configurá Supabase en .env.local (URL y anon key).");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Appgym</CardTitle>
        <CardDescription>
          Ingresá con tu cuenta de Google.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          {pending ? "Redirigiendo…" : "Continuar con Google"}
        </Button>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Fase 0: autenticación y navegación base.
        </p>
      </CardContent>
    </Card>
  );
}
