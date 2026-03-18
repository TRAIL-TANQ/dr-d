import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * GET /api/settings?userId=xxx
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("name, grade, school, xp, level, streak")
    .eq("line_user_id", userId)
    .single();

  return NextResponse.json({ user: user ?? null });
}

/**
 * POST /api/settings
 * Body: { action: "update_profile", userId, name?, grade?, school? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, name, grade, school } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (action === "update_profile") {
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name.trim();
      if (grade !== undefined) updates.grade = grade;
      if (school !== undefined) updates.school = school.trim();

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "no fields to update" }, { status: 400 });
      }

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("line_user_id", userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("settings error:", e);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
