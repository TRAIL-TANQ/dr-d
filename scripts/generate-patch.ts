/**
 * 欠損バッチのみ補完するパッチスクリプト
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFF_LABELS: Record<number, string> = {
  1: "基礎（定義・用語の確認）",
  2: "標準（教科書の例題レベル）",
  3: "やや応用（練習問題レベル）",
  4: "応用（章末問題レベル）",
  5: "発展（入試レベル）",
};

const PATCHES = [
  { textbook: "小学算数5年", chapter: "合同と角", section: "合同な図形", difficulty: 3, subject: "elem_math" },
];

async function generate(textbook: string, subject: string, chapter: string, section: string, difficulty: number) {
  const subjectLabels: Record<string, string> = {
    math: "中学数学", english: "中学英語", science: "中学理科",
    geography: "中学社会・地理", history: "中学歴史", world_history: "高校世界史", elem_math: "小学算数",
  };
  const system = [
    `あなたは${subjectLabels[subject]}の問題作成の専門家です。`,
    `教科書「${textbook}」の「${chapter}」章、「${section}」の範囲で問題を3問作成してください。`,
    `難易度: ${difficulty}/5（${DIFF_LABELS[difficulty]}）`,
    `\nJSON配列のみ返してください:`,
    `[{"q":"問題文","choices":["選択肢A","選択肢B","選択肢C"],"answer":0,"hint":"ヒント1文","explanation":"解説2〜3文"}]`,
    `\nルール:`,
    `- answerは正解の選択肢のindex(0,1,2)`,
    `- 3択（choices配列は必ず3要素）`,
    `- 問題文は日本語で、用語や概念を正確に出題すること`,
    `- 3問ちょうど生成すること`,
    `- 同じパターンの問題を避け、バリエーションを持たせること`,
  ].join("\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: `${textbook}「${chapter}」→「${section}」難易度${difficulty} の問題を3問、JSON配列で。` }],
  });

  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`JSON解析失敗: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function main() {
  console.log(`\n🔧 パッチ: ${PATCHES.length}バッチを補完\n`);
  let total = 0;

  for (const p of PATCHES) {
    process.stdout.write(`  ${p.section} (Lv.${p.difficulty})... `);
    try {
      const questions = await generate(p.textbook, p.subject, p.chapter, p.section, p.difficulty);
      const rows = questions.map((q: any) => ({
        textbook: p.textbook,
        chapter: p.chapter,
        section: p.section,
        difficulty: p.difficulty,
        q: q.q,
        choices: shuffleArray(q.choices),
        answer: q.choices[q.answer] ?? q.choices[0],
        hint: q.hint || null,
        explanation: q.explanation || null,
        times_used: 0,
        correct_rate: 0,
      }));
      const { error } = await supabase.from("questions").insert(rows);
      if (error) throw new Error(error.message);
      total += rows.length;
      console.log(`✅ ${rows.length}問`);
    } catch (err) {
      console.log(`❌ ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n✨ パッチ完了！ ${total}問を補完しました。\n`);
}

main().catch((err) => { console.error("致命的エラー:", err); process.exit(1); });
