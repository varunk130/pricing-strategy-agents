import { runPipeline } from "@/lib/agents/pipeline";
import { isPricingModel } from "@/lib/agents/tools";
import { buildDemoScript, DEMO_GOAL } from "@/lib/demo";
import type { RunEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    mode?: "live" | "demo";
    goal?: string;
    startModel?: unknown;
  };
  const goal = (body.goal ?? "").trim().slice(0, 500) || DEMO_GOAL;
  const live = body.mode === "live" && hasKey();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: RunEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (live) {
          const start = isPricingModel(body.startModel) ? body.startModel : undefined;
          await runPipeline(goal, emit, start);
        } else {
          for (const { delay, event } of buildDemoScript(goal)) {
            if (req.signal.aborted) break;
            await new Promise((r) => setTimeout(r, delay));
            emit(event);
          }
        }
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
  });
}
