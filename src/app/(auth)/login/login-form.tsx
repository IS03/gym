"use client";

import { Dumbbell, LoaderCircle } from "lucide-react";
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
    <Card className="surface-elevated border-border/70">
      <CardHeader className="space-y-3 pt-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Dumbbell className="size-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-3xl font-semibold tracking-tight">Appgym</CardTitle>
          <CardDescription>
            Entrenamiento y nutrición, en un solo lugar.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          {pending ? <><LoaderCircle className="animate-spin" aria-hidden /> Redirigiendo…</> : "Continuar con Google"}
        </Button>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
