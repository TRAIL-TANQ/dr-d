import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `あなたはDr.D、学習診断AIの博士キャラクター。
生徒が問題を間違えたとき、答えを直接教えてはいけない。
生徒が自分で正解にたどり着けるよう、ヒントや問いかけで導いて。
短く2〜3文で返答すること。やさしく励ましながら。
数式はプレーンテキストで表記。`;

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  try {
    const { question, studentAnswer, correctAnswer, conversationHistory } =
      (await req.json()) as {
        question: string;
        studentAnswer: string;
        correctAnswer: string;
        conversationHistory: TutorMessage[];
      };

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build messages: initial context + conversation history
    const messages: TutorMessage[] = [
      {
        role: "user",
        content: [
          `【問題】${question}`,
          `【生徒の答え】${studentAnswer}`,
          `【正解】${correctAnswer}`,
          ``,
          `生徒がこの問題を間違えました。答えを教えずに、ヒントと問いかけで正解に導いてください。`,
        ].join("\n"),
      },
      ...(conversationHistory ?? []),
    ];

    // Streaming response
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
    });

    // Return as SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
              controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("tutor stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("tutor error:", e);
    return new Response(
      JSON.stringify({ error: "チューターの応答に失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
