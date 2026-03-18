import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * POST /api/checkin
 * Body: { action: "checkin" | "checkout" | "status" | "stats", line_user_id, name? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, line_user_id, name } = body;

    if (!line_user_id) {
      return NextResponse.json({ error: "line_user_id is required" }, { status: 400 });
    }

    if (action === "status") {
      return handleStatus(line_user_id);
    }
    if (action === "stats") {
      return handleStats(line_user_id);
    }
    if (action === "checkin") {
      return handleCheckin(line_user_id, name);
    }
    if (action === "checkout") {
      return handleCheckout(line_user_id);
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("checkin error:", e);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

async function handleStatus(lineUserId: string) {
  // Find active check-in (no checkout)
  const { data: active } = await supabase
    .from("check_ins")
    .select("id, checked_in_at, seat_id")
    .eq("user_id", lineUserId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1);

  // Get user
  const { data: user } = await supabase
    .from("users")
    .select("name, xp, level, streak, last_visit_date")
    .eq("line_user_id", lineUserId)
    .single();

  return NextResponse.json({
    checkedIn: active && active.length > 0,
    checkIn: active?.[0] ?? null,
    user: user ?? null,
  });
}

async function handleStats(lineUserId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Monthly visit count
  const { count: monthlyVisits } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", lineUserId)
    .gte("checked_in_at", monthStart);

  // Total study minutes (from completed check-ins)
  const { data: completed } = await supabase
    .from("check_ins")
    .select("checked_in_at, checked_out_at")
    .eq("user_id", lineUserId)
    .not("checked_out_at", "is", null);

  let totalMinutes = 0;
  if (completed) {
    for (const c of completed) {
      const start = new Date(c.checked_in_at).getTime();
      const end = new Date(c.checked_out_at).getTime();
      totalMinutes += (end - start) / 60000;
    }
  }

  // Get user streak
  const { data: user } = await supabase
    .from("users")
    .select("streak, xp, level")
    .eq("line_user_id", lineUserId)
    .single();

  return NextResponse.json({
    streak: user?.streak ?? 0,
    monthlyVisits: monthlyVisits ?? 0,
    totalMinutes: Math.round(totalMinutes),
    xp: user?.xp ?? 0,
    level: user?.level ?? 1,
  });
}

async function handleCheckin(lineUserId: string, name?: string) {
  // Check if already checked in
  const { data: active } = await supabase
    .from("check_ins")
    .select("id")
    .eq("user_id", lineUserId)
    .is("checked_out_at", null)
    .limit(1);

  if (active && active.length > 0) {
    return NextResponse.json({ error: "すでに入室中です", alreadyCheckedIn: true }, { status: 409 });
  }

  // Upsert user
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, streak, last_visit_date, xp, level")
    .eq("line_user_id", lineUserId)
    .single();

  const today = new Date().toISOString().split("T")[0];
  let newStreak = 1;
  let currentXp = 0;
  let currentLevel = 1;

  // Check if already checked in today (for XP dedup)
  const { count: todayCheckins } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", lineUserId)
    .gte("checked_in_at", today + "T00:00:00")
    .lte("checked_in_at", today + "T23:59:59");

  const isFirstToday = (todayCheckins ?? 0) === 0;
  const xpToAdd = isFirstToday ? 30 : 0;

  if (existingUser) {
    currentXp = existingUser.xp;
    currentLevel = existingUser.level;
    const lastVisit = existingUser.last_visit_date;

    if (lastVisit === today) {
      newStreak = existingUser.streak;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      newStreak = lastVisit === yesterdayStr ? existingUser.streak + 1 : 1;
    }

    const newXp = currentXp + xpToAdd;
    const newLevel = Math.floor(newXp / 100) + 1;

    await supabase
      .from("users")
      .update({
        streak: newStreak,
        last_visit_date: today,
        xp: newXp,
        level: newLevel,
        ...(name ? { name } : {}),
      })
      .eq("id", existingUser.id);

    currentXp = newXp;
    currentLevel = newLevel;
  } else {
    const newXp = 30; // first ever = always first today
    const newLevel = 1;
    await supabase.from("users").insert({
      line_user_id: lineUserId,
      name: name ?? "ゲスト",
      xp: newXp,
      level: newLevel,
      streak: 1,
      last_visit_date: today,
    });
    currentXp = newXp;
    currentLevel = newLevel;
  }

  // Insert check-in
  const { data: checkIn, error } = await supabase
    .from("check_ins")
    .insert({ user_id: lineUserId, earned_xp: xpToAdd })
    .select("id, checked_in_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    checkIn,
    streak: newStreak,
    xp: currentXp,
    level: currentLevel,
    earnedXp: xpToAdd,
    isFirstToday,
  });
}

async function handleCheckout(lineUserId: string) {
  const { data: active } = await supabase
    .from("check_ins")
    .select("id, checked_in_at")
    .eq("user_id", lineUserId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1);

  if (!active || active.length === 0) {
    return NextResponse.json({ error: "入室記録がありません" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("check_ins")
    .update({ checked_out_at: now })
    .eq("id", active[0].id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const start = new Date(active[0].checked_in_at).getTime();
  const end = new Date(now).getTime();
  const minutes = Math.round((end - start) / 60000);

  return NextResponse.json({ success: true, minutes });
}
