import "server-only";

import { createAdminClient } from "../supabase/admin";
import type { ChatgptMealInput, ChatgptMealSuccess } from "./chatgpt-contract";
import { PossibleDuplicateError } from "./chatgpt-meals";

export async function persistChatgptMeal(
  userId: string,
  meal: ChatgptMealInput,
): Promise<ChatgptMealSuccess> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_chatgpt_meal_for_integration", {
    p_user_id: userId,
    p_log_date: meal.date,
    p_title: meal.title,
    p_description: meal.description,
    p_calories: meal.calories,
    p_protein_g: meal.protein_g,
    p_carbs_g: meal.carbs_g,
    p_fat_g: meal.fat_g,
    p_idempotency_key: meal.idempotency_key,
    p_force_duplicate: meal.force_duplicate,
  });
  if (error?.message.includes("possible_duplicate")) {
    throw new PossibleDuplicateError();
  }
  if (error) throw new Error("No se pudo persistir la comida.");
  return data as ChatgptMealSuccess;
}
