import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * GET /api/report?userId=xxx
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // User
  const { data: user } = await supabase
    .from("users")
    .select("name, grade, school, xp, level, streak")
    .eq("line_user_id", userId)
    .single();

  // Study logs
  const { data: studyLogs } = await supabase
    .from("study_logs")
    .select("subject, minutes, earned_xp, date, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  // Check-ins
  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("checked_in_at, checked_out_at, earned_xp")
    .eq("user_id", userId)
    .order("checked_in_at", { ascending: false })
    .limit(200);

  // Compute aggregates
  const logs = studyLogs ?? [];
  const cis = checkIns ?? [];

  // Total study minutes from logs
  const totalStudyMin = logs.reduce((s, l) => s + (l.minutes ?? 0), 0);

  // Total check-in minutes
  let totalCheckinMin = 0;
  for (const c of cis) {
    if (c.checked_in_at && c.checked_out_at) {
      totalCheckinMin += (new Date(c.checked_out_at).getTime() - new Date(c.checked_in_at).getTime()) / 60000;
    }
  }

  // Sessions count
  const sessionsCount = cis.length;

  // Past 7 days daily minutes (study + checkin)
  const now = new Date();
  const weekData: { date: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];

    let dayMin = 0;
    // study logs
    for (const l of logs) {
      if (l.date === ds) dayMin += l.minutes ?? 0;
    }
    // check-ins
    for (const c of cis) {
      if (!c.checked_in_at || !c.checked_out_at) continue;
      const cDate = new Date(c.checked_in_at).toISOString().split("T")[0];
      if (cDate === ds) {
        dayMin += (new Date(c.checked_out_at).getTime() - new Date(c.checked_in_at).getTime()) / 60000;
      }
    }
    weekData.push({ date: ds, minutes: Math.round(dayMin) });
  }

  // Subject breakdown from study_logs
  const subjectMap = new Map<string, number>();
  for (const l of logs) {
    subjectMap.set(l.subject, (subjectMap.get(l.subject) ?? 0) + (l.minutes ?? 0));
  }
  const subjects = Array.from(subjectMap.entries())
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  // Recent 10 entries (merged study_logs + check-ins)
  const recent = logs.slice(0, 10).map((l) => ({
    type: "study" as const,
    subject: l.subject,
    minutes: l.minutes,
    xp: l.earned_xp,
    date: l.date,
  }));

  return NextResponse.json({
    user: user ?? { name: "ゲスト", xp: 0, level: 1, streak: 0 },
    totalMinutes: Math.round(totalStudyMin + totalCheckinMin),
    sessionsCount,
    weekData,
    subjects,
    recent,
  });
}
