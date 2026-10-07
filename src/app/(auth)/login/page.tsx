import { LoginForm } from "./login-form";
import { safeAuthRedirectPath } from "@/lib/security/auth-redirect";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authError = params.error === "auth";

  return <LoginForm authError={authError} next={safeAuthRedirectPath(params.next)} />;
}
