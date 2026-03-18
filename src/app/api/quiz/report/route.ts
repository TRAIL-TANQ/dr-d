import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * POST /api/quiz/report
 * Reports a question issue (wrong answer, bad question, etc.)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question_id, reporter_name, report_type, comment } = body;

    if (!question_id || !reporter_name || !report_type) {
      return NextResponse.json(
        { error: "question_id, reporter_name, report_type are required" },
        { status: 400 },
      );
    }

    const validTypes = ["wrong_answer", "bad_question", "duplicate_choices", "other"];
    if (!validTypes.includes(report_type)) {
      return NextResponse.json(
        { error: `report_type must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Check for duplicate report (same user + same question)
    const { data: existing } = await supabase
      .from("question_reports")
      .select("id")
      .eq("question_id", question_id)
      .eq("reporter_name", reporter_name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "この問題はすでに報告済みです", duplicate: true },
        { status: 409 },
      );
    }

    // Insert report
    const { error } = await supabase.from("question_reports").insert({
      question_id,
      reporter_name,
      report_type,
      comment: comment?.trim() || null,
    });

    if (error) {
      console.error("report insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("report error:", e);
    return NextResponse.json({ error: "報告の送信に失敗しました" }, { status: 500 });
  }
}
