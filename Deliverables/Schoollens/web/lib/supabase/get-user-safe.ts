import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getUserSafe(
  supabase: SupabaseClient,
  timeoutMs = 2500,
): Promise<User | null> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("auth timeout")), timeoutMs);
      }),
    ]);
    return result.data.user ?? null;
  } catch {
    return null;
  }
}
