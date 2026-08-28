import {
  authenticateChatgptAuthorization,
  type ChatgptAuthDependencies,
} from "./chatgpt-auth";
import type { ChatgptMealError } from "./chatgpt-contract";

export type ChatgptStatusResult =
  | {
      status: 200;
      body: { ok: true; connected: true };
    }
  | {
      status: 401 | 500;
      body: ChatgptMealError;
    };

export async function handleChatgptStatusRequest(
  authorization: string | null,
  dependencies: ChatgptAuthDependencies,
): Promise<ChatgptStatusResult> {
  const authentication = await authenticateChatgptAuthorization(
    authorization,
    dependencies,
  );
  if (!authentication.ok) return authentication;

  return { status: 200, body: { ok: true, connected: true } };
}
