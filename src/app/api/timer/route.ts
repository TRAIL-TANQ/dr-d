import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * POST /api/timer
 * Body: { action: "complete", userId, subject, minutes, memo? }
 */
export async function POST(req: Request) {
  try {
    const { action, userId, subject, minutes, memo } = await req.json();

    if (action !== "complete") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }
    if (!userId || !subject || !minutes) {
      return NextResponse.json({ error: "userId, subject, minutes are required" }, { status: 400 });
    }

    const earnedXp = minutes * 2;

    // Insert study log
    const { error: logErr } = await supabase.from("study_logs").insert({
      user_id: userId,
      subject,
      minutes,
      memo: memo?.trim() || null,
      earned_xp: earnedXp,
    });

    if (logErr) {
      console.error("study_logs insert error:", logErr);
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    // Update user XP
    const { data: user } = await supabase
      .from("users")
      .select("id, xp, level")
      .eq("line_user_id", userId)
      .single();

    let newXp = earnedXp;
    let newLevel = 1;
    if (user) {
      newXp = user.xp + earnedXp;
      newLevel = Math.floor(newXp / 100) + 1;
      await supabase
        .from("users")
        .update({ xp: newXp, level: newLevel })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      earnedXp,
      totalXp: newXp,
      level: newLevel,
    });
  } catch (e) {
    console.error("timer error:", e);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
