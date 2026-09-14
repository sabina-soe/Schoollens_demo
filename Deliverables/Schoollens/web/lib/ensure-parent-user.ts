import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureParentUser(supabase: SupabaseClient, user: User) {
  const { data } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (data) return;
  await supabase.from("users").insert({
    id: user.id,
    role: "parent",
    "phone/email": user.email ?? user.phone,
    created_at: new Date().toISOString(),
  });
}
