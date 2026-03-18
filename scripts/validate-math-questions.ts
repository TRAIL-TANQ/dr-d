/**
 * 算数・数学の問題の正解を Claude API で検証するスクリプト
 * 疑わしい問題のリストを JSON で出力する
 *
 * 実行: npx tsx scripts/validate-math-questions.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Question {
  id: string;
  textbook: string;
  chapter: string;
  section: string;
  difficulty: number;
  q: string;
  choices: string[];
  answer: string;
}

interface ValidationResult {
  id: string;
  textbook: string;
  chapter: string;
  section: string;
  difficulty: number;
  question: string;
  choices: string[];
  stated_answer: string;
  ai_verdict: "correct" | "wrong" | "ambiguous";
  ai_correct_answer?: string;
  ai_reason: string;
}

async function fetchAllMathQuestions(): Promise<Question[]> {
  const mathTextbooks = [
    "小学算数4年", "小学算数5年", "小学算数6年",
    "体系数学1", "体系数学2",
  ];

  const all: Question[] = [];
  for (const tb of mathTextbooks) {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("questions")
        .select("id, textbook, chapter, section, difficulty, q, choices, answer")
        .eq("textbook", tb)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error(`Error fetching ${tb}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      all.push(...(data as Question[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }
  return all;
}

async function validateBatch(questions: Question[]): Promise<ValidationResult[]> {
  const prompt = questions.map((q, i) =>
    `[${i + 1}] 問題: ${q.q}\n選択肢: ${(q.choices as string[]).map((c, j) => `${j + 1}.${c}`).join(" / ")}\n記載された正解: ${q.answer}`
  ).join("\n\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: [
      "あなたは算数・数学の問題検証の専門家です。",
      "各問題の正解が数学的に正しいか検証してください。",
      "JSON配列のみ返してください:",
      `[{"index":1,"verdict":"correct|wrong|ambiguous","correct_answer":"正しい答え（wrongの場合）","reason":"理由を1文で"}]`,
      "correctは正解が合っている、wrongは間違い、ambiguousは曖昧・複数解釈可能。",
    ].join("\n"),
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const results = JSON.parse(match[0]) as {
      index: number;
      verdict: "correct" | "wrong" | "ambiguous";
      correct_answer?: string;
      reason: string;
    }[];

    return results
      .filter((r) => r.verdict !== "correct")
      .map((r) => {
        const q = questions[r.index - 1];
        return {
          id: q.id,
          textbook: q.textbook,
          chapter: q.chapter,
          section: q.section,
          difficulty: q.difficulty,
          question: q.q,
          choices: q.choices as string[],
          stated_answer: q.answer,
          ai_verdict: r.verdict,
          ai_correct_answer: r.correct_answer,
          ai_reason: r.reason,
        };
      });
  } catch {
    return [];
  }
}

async function main() {
  console.log("🔍 算数・数学の問題を検証します...\n");

  const questions = await fetchAllMathQuestions();
  console.log(`📊 ${questions.length}問 を取得しました\n`);

  const suspicious: ValidationResult[] = [];
  const batchSize = 10;
  let processed = 0;

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    process.stdout.write(`  [${processed + batch.length}/${questions.length}] 検証中...`);

    try {
      const results = await validateBatch(batch);
      suspicious.push(...results);
      console.log(` ${results.length > 0 ? `⚠️ ${results.length}件の疑わしい問題` : "✅"}`);
    } catch (err) {
      console.log(` ❌ エラー: ${err instanceof Error ? err.message : err}`);
    }

    processed += batch.length;
    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✨ 検証完了！ ${suspicious.length}件の疑わしい問題が見つかりました。`);

  if (suspicious.length > 0) {
    const outFile = "validation-results.json";
    writeFileSync(outFile, JSON.stringify(suspicious, null, 2), "utf-8");
    console.log(`📄 結果を ${outFile} に出力しました。\n`);

    // Summary
    const byVerdict = { wrong: 0, ambiguous: 0 };
    for (const s of suspicious) {
      byVerdict[s.ai_verdict as keyof typeof byVerdict]++;
    }
    console.log(`  ❌ 正解が間違い: ${byVerdict.wrong}件`);
    console.log(`  ❓ 曖昧: ${byVerdict.ambiguous}件`);
  }
}

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
