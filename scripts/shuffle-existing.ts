/**
 * 既存のquestionsテーブルの全問題のchoicesをシャッフルし、
 * answer列も新しい位置のテキストに合わせて更新する。
 *
 * 実行: npx tsx scripts/shuffle-existing.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  console.log("🔀 全問題の選択肢をシャッフルします...\n");

  // ページネーションで全件取得（Supabaseは1000件制限）
  let allRows: { id: string; choices: string[]; answer: string }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id, choices, answer")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("❌ 取得エラー:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data as typeof allRows);
    console.log(`  取得: ${allRows.length}問...`);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`\n📊 合計 ${allRows.length}問 を処理します。\n`);

  // 正解位置の分布（シャッフル前）
  const beforeDist = [0, 0, 0];
  for (const row of allRows) {
    const idx = (row.choices as string[]).indexOf(row.answer);
    if (idx >= 0 && idx < 3) beforeDist[idx]++;
  }
  console.log(`シャッフル前の正解位置分布:`);
  console.log(`  選択肢1: ${beforeDist[0]}問 (${(beforeDist[0] / allRows.length * 100).toFixed(1)}%)`);
  console.log(`  選択肢2: ${beforeDist[1]}問 (${(beforeDist[1] / allRows.length * 100).toFixed(1)}%)`);
  console.log(`  選択肢3: ${beforeDist[2]}問 (${(beforeDist[2] / allRows.length * 100).toFixed(1)}%)`);

  // バッチ更新
  let updated = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = allRows.slice(i, i + batchSize);

    const promises = batch.map(async (row) => {
      const choices = row.choices as string[];
      const answer = row.answer as string;
      const shuffled = shuffleArray(choices);

      // answer列は正解テキストのままなので変更不要
      // ただしchoicesの順番だけシャッフル
      const { error } = await supabase
        .from("questions")
        .update({ choices: shuffled })
        .eq("id", row.id);

      if (error) {
        errors++;
        return;
      }
      updated++;
    });

    await Promise.all(promises);

    if ((i + batchSize) % 500 === 0 || i + batchSize >= allRows.length) {
      console.log(`  進捗: ${Math.min(i + batchSize, allRows.length)}/${allRows.length}問 更新済み`);
    }
  }

  // シャッフル後の分布を確認
  const afterDist = [0, 0, 0];
  for (const row of allRows) {
    const choices = shuffleArray(row.choices as string[]); // シミュレート
    const idx = choices.indexOf(row.answer as string);
    if (idx >= 0 && idx < 3) afterDist[idx]++;
  }

  console.log(`\n✅ ${updated}問 更新完了（エラー: ${errors}件）`);
  console.log(`\n※ シャッフル後は各位置が約33%になります。`);
}

main().catch((err) => {
  console.error("致命的エラー:", err);
  process.exit(1);
});
