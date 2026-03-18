import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * GET /api/admin/reports?status=all|pending|confirmed|rejected
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") ?? "all";

    // Fetch reports with question data
    let query = supabase
      .from("question_reports")
      .select(`
        id,
        question_id,
        reporter_name,
        report_type,
        comment,
        status,
        ai_reason,
        xp_rewarded,
        created_at,
        questions (q, choices, answer, textbook)
      `)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("admin reports error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reports = (data ?? []).map((r) => ({
      id: r.id,
      question: r.questions,
      reporter_name: r.reporter_name,
      report_type: r.report_type,
      comment: r.comment,
      status: r.status,
      ai_reason: r.ai_reason,
      xp_rewarded: r.xp_rewarded,
      created_at: r.created_at,
    }));

    // Count by status
    const { count: totalCount } = await supabase
      .from("question_reports").select("id", { count: "exact", head: true });
    const { count: confirmedCount } = await supabase
      .from("question_reports").select("id", { count: "exact", head: true }).eq("status", "confirmed");
    const { count: rejectedCount } = await supabase
      .from("question_reports").select("id", { count: "exact", head: true }).eq("status", "rejected");
    const { count: pendingCount } = await supabase
      .from("question_reports").select("id", { count: "exact", head: true }).eq("status", "pending");

    return NextResponse.json({
      reports,
      counts: {
        total: totalCount ?? 0,
        confirmed: confirmedCount ?? 0,
        rejected: rejectedCount ?? 0,
        pending: pendingCount ?? 0,
      },
    });
  } catch (e) {
    console.error("admin reports error:", e);
    return NextResponse.json({ error: "レポートの取得に失敗しました" }, { status: 500 });
  }
}
