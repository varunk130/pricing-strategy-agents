import Anthropic from "@anthropic-ai/sdk";
import type { AgentId, RunEvent } from "../events";
import { AGENTS } from "../events";
import { TOOL_DEFS, executeTool } from "./tools";

export const MODEL = "claude-opus-5-5";

type Emit = (e: RunEvent) => void;
type Effort = "low" | "medium" | "high";

export interface Usage {
  input: number;
  output: number;
}

interface RunArgs {
  client: Anthropic;
  agent: AgentId;
  system: string;
  prompt: string;
  tools: string[]; // keys of TOOL_DEFS; load_skill is always added
  effort: Effort;
  emit: Emit;
  usage: Usage;
  maxTurns?: number;
}

const preview = (v: unknown, n = 280) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/**
 * One specialist agent: a manual tool-use loop on the Messages API.
 * The agent ends by calling its `submit_*` tool (structured output), except
 * for agents with no submit tool, whose final text is the output.
 */
export async function runAgent({
  client,
  agent,
  system,
  prompt,
  tools,
  effort,
  emit,
  usage,
  maxTurns = 10,
}: RunArgs): Promise<unknown> {
  const meta = AGENTS[agent];
  const toolNames = ["load_skill", ...tools];
  const terminalTool = toolNames.find((t) => TOOL_DEFS[t]?.terminal);
  const toolParams: Anthropic.Beta.Messages.BetaTool[] = toolNames.map((t) => {
    const d = TOOL_DEFS[t];
    return {
      name: d.name,
      description: d.description,
      input_schema: d.input_schema as Anthropic.Beta.Messages.BetaTool.InputSchema,
      strict: true,
    };
  });

  const fullSystem = `${system}

You are the "${meta.name}" agent on Relaya's pricing team. The team of agents is moving a B2B SaaS company from per-seat to usage-based pricing.
Your skill: ${meta.skill}. Load it with load_skill before you start.
Writing style: plain, simple English that an executive can read in one pass. Short sentences. Use exact numbers from tools. Never use em dashes or en dashes. No hype words.
Keep notes between tool calls to one short sentence.${
    terminalTool ? `\nFinish by calling ${terminalTool} exactly once.` : ""
  }`;

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let nudged = false;

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: fullSystem,
      tools: toolParams,
      messages,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      emit({ type: "error", agent, message: "The model declined this request." });
      return null;
    }

    let finalText = "";
    for (const block of response.content) {
      if (block.type === "thinking" && block.thinking.trim()) {
        emit({ type: "thinking", agent, text: preview(block.thinking, 400) });
      } else if (block.type === "text" && block.text.trim()) {
        finalText += block.text;
        if (terminalTool) emit({ type: "note", agent, text: block.text.trim() });
      }
    }
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "max_tokens") {
      emit({ type: "error", agent, message: "Response hit max_tokens." });
      return null;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      if (!terminalTool) return finalText.trim(); // text-output agent
      if (nudged) {
        emit({ type: "error", agent, message: `Agent finished without calling ${terminalTool}.` });
        return null;
      }
      nudged = true;
      messages.push({ role: "user", content: `Please call ${terminalTool} now with your final answer.` });
      continue;
    }

    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    let submitted: unknown = undefined;
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      emit({ type: "tool_call", agent, tool: tu.name, input });
      if (TOOL_DEFS[tu.name]?.terminal) {
        submitted = input;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "Submitted." });
        continue;
      }
      try {
        const out = executeTool(tu.name, input, [meta.skill]);
        if (tu.name === "load_skill" && !Array.isArray(out) && !("error" in out)) {
          emit({ type: "skill_loaded", agent, skill: String(input.name) });
        } else {
          emit({ type: "tool_result", agent, tool: tu.name, preview: preview(out) });
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      } catch (err) {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }
    if (submitted !== undefined) return submitted;
    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }

  emit({ type: "error", agent, message: "Agent ran out of turns." });
  return null;
}
