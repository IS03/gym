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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  authError?: boolean;
};

export function LoginForm({ authError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    authError ? "No se pudo completar el inicio de sesión." : null,
  );
  const [pending, setPending] = useState(false);

  async function handleGoogle() {
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Revisá tu correo para el enlace de acceso.");
      }
    } catch {
      setError("Configurá Supabase en .env.local (URL y anon key).");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Appgym</CardTitle>
        <CardDescription>
          Ingresá con Google o por correo con enlace mágico (sin contraseña).
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
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">o</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@ejemplo.com"
              className="h-11"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Fase 0: autenticación y navegación base.
        </p>
      </CardContent>
    </Card>
  );
}
