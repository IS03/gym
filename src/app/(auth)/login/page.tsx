import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/today");
    }
  } catch {
    // Sin variables de entorno: se muestra el formulario con error al enviar.
  }

  const params = await searchParams;
  const authError = params.error === "auth";

  return <LoginForm authError={authError} />;
}
