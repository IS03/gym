"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { brandAssets } from "@/lib/brand";

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
    <div className="mx-auto grid w-full max-w-sm overflow-hidden rounded-2xl bg-card text-card-foreground shadow-sm ring-1 ring-foreground/10 md:max-w-4xl md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="flex min-h-56 items-center justify-center bg-[#0b0b0d] px-6 py-8 dark:bg-[#151518] md:min-h-[29rem] md:px-10">
        <Image
          src={brandAssets.lockupMobile}
          width={360}
          height={236}
          alt="OWNLEVEL"
          sizes="216px"
          className="h-auto w-full max-w-[13.5rem] object-contain md:hidden"
        />
        <Image
          src={brandAssets.lockupHorizontal}
          width={720}
          height={173}
          alt="OWNLEVEL"
          sizes="336px"
          className="hidden h-auto w-full max-w-[21rem] object-contain md:block"
        />
      </section>

      <section className="flex min-h-[16rem] flex-col justify-center px-6 py-8 sm:px-8 md:px-9">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Entrenamiento y nutrición, en un solo lugar.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-6 h-11 w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden /> Redirigiendo…
            </>
          ) : (
            "Continuar con Google"
          )}
        </Button>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
