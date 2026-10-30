import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { findCandidates } from "../../lib/availability.js";
import { type McpContext, missingScope } from "../context.js";
import { availabilityOf, formatCandidate, headcountNotes, loadEvent } from "../eventDetail.js";
import { sanitize, toolError, toolText, untrustedBlock } from "../format.js";
import { eventUrlSchema } from "../schemas.js";

export function registerFindCommonAvailability(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "find_common_availability",
    {
      title: "参加できる時間帯を探す",
      description:
        "回答を集計し、参加できる人数が多い時間帯を多い順に返す (同じ人数なら早い順)。" +
        "get_event にも集計 (上位 5 件、30 分以上) があるので、それで足りなければ、件数や条件を変えて探すときに使う。" +
        "人数は回答した人の中で数え、まだ回答していない人は数に入らない。" +
        "回答した全員が参加できる時間帯だけに絞るには、min_people に回答した人数 (get_event の「回答」の人数) を渡す。",
      inputSchema: z.object({
        event_url: eventUrlSchema,
        min_duration_minutes: z
          .number()
          .int()
          .min(15)
          .max(24 * 60)
          .default(30)
          .describe("この分数以上続く時間帯だけを返す。15 分単位。"),
        min_people: z.number().int().min(1).default(1).describe("この人数以上が参加できる時間帯だけを返す。"),
        top_n: z.number().int().min(1).max(50).default(10).describe("返す件数の上限。"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ event_url, min_duration_minutes, min_people, top_n }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);

      const loaded = await loadEvent(ctx, event_url);
      if (!("event" in loaded)) return loaded;
      const { event } = loaded;

      const candidates = findCandidates(availabilityOf(event), {
        minDurationMinutes: min_duration_minutes,
        minPeople: min_people,
        limit: top_n,
      });
      if (candidates.length === 0) {
        return toolText(
          event.participants.length === 0
            ? "まだ誰も回答していません。"
            : `条件 (${min_duration_minutes} 分以上、${min_people} 人以上) に合う時間帯はありません。` +
                "min_duration_minutes や min_people を小さくするか、回答が集まるのを待ってください。",
        );
      }

      const facts = candidates.map((c, i) => formatCandidate(c, i + 1, event));
      const untrusted = candidates.flatMap((c, i) => {
        const ids = new Set(c.members.map((m) => m.participantId));
        const absent = event.participants.filter((p) => !ids.has(p.id));
        return [
          `候補[${i + 1}] 参加できる人: ${c.members.map((m) => `"${sanitize(m.name)}"`).join(", ")}`,
          `候補[${i + 1}] 参加できない人: ${absent.map((p) => `"${sanitize(p.name)}"`).join(", ") || "なし"}`,
        ];
      });
      return toolText(
        [
          `参加できる人数の多い時間帯 (timezone: ${event.timezone}):`,
          ...headcountNotes(event),
          ...facts,
          "",
          untrustedBlock(untrusted),
        ].join("\n"),
      );
    },
  );
}
