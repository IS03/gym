import { redirect } from "next/navigation";
import { getVerifiedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let authenticated = false;
  try {
    authenticated = Boolean(await getVerifiedRequestContext());
  } catch {
    // Variables de entorno ausentes o cliente no inicializable.
  }

  redirect(authenticated ? "/home" : "/login");
}
