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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.5a4.7 4.7 0 0 1-2.04 3.08v2.52h3.31c1.94-1.79 3.03-4.43 3.03-7.43Z" />
      <path fill="#34A853" d="M12 22c2.75 0 5.06-.91 6.75-2.34l-3.3-2.52c-.92.61-2.09.97-3.45.97-2.66 0-4.91-1.8-5.72-4.22H2.87v2.6A10.2 10.2 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.28 13.9A6.1 6.1 0 0 1 5.96 12c0-.66.11-1.3.32-1.9V7.5H2.87A10.2 10.2 0 0 0 1.8 12c0 1.63.39 3.17 1.07 4.5l3.41-2.6Z" />
      <path fill="#EA4335" d="M12 5.89c1.49 0 2.83.51 3.89 1.52l2.92-2.92C17.06 2.86 14.75 2 12 2a10.2 10.2 0 0 0-9.13 5.5l3.41 2.6C7.09 7.69 9.34 5.89 12 5.89Z" />
    </svg>
  );
}

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
    <div className="mx-auto grid w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-card/95 text-card-foreground shadow-[0_24px_64px_-36px_oklch(0_0_0_/_0.48),0_6px_20px_-14px_oklch(0_0_0_/_0.22)] backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 md:max-w-4xl md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <section className="login-brand-surface flex min-h-[15.5rem] items-center justify-center px-6 py-10 md:min-h-[31rem] md:px-10">
        <div className="relative z-10 flex w-full justify-center drop-shadow-[0_14px_22px_rgba(0,0,0,0.32)]">
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
        </div>
      </section>

      <section className="flex min-h-[17rem] flex-col justify-center bg-card/75 px-6 py-9 sm:px-8 md:px-10">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Tu espacio personal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">Iniciar sesión</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Entrenamiento y nutrición, en un solo lugar.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-7 h-12 w-full rounded-xl border-border/80 bg-background px-4 font-semibold shadow-[0_1px_2px_oklch(0_0_0_/_0.06),0_8px_18px_-16px_oklch(0_0_0_/_0.4)] hover:-translate-y-px hover:border-primary/35 hover:bg-muted/45 hover:shadow-[0_8px_20px_-16px_oklch(0_0_0_/_0.42)] dark:bg-card"
          onClick={handleGoogle}
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden /> Redirigiendo…
            </>
          ) : (
            <>
              <GoogleMark />
              Continuar con Google
            </>
          )}
        </Button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
          Usá la cuenta de Google con la que registrás tu progreso.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
