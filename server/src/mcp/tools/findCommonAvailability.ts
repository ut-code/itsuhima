import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { findCandidates } from "../../../../common/availability.js";
import { getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { availabilityOf, formatByOption, isMember } from "../eventDetail.js";
import { formatInterval, sanitize, toolError, toolText, untrustedBlock } from "../format.js";
import { eventIdSchema } from "../schemas.js";

export function registerFindCommonAvailability(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "find_common_availability",
    {
      title: "参加できる時間帯を探す",
      description:
        "回答を集計し、参加できる人数が多い時間帯を多い順に返す (同じ人数なら早い順)。" +
        "主催者か、回答した参加者だけが使える。",
      inputSchema: z.object({
        event_id: eventIdSchema,
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
    async ({ event_id, min_duration_minutes, min_people, top_n }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);

      let event: Awaited<ReturnType<typeof getEvent>>;
      try {
        event = await getEvent(ctx.db, ctx.actor, event_id);
      } catch (e) {
        return serviceErrorResult(e);
      }
      if (!isMember(event)) {
        return toolError(
          "集計は、このイベントの主催者か、回答した参加者だけが見られます。submit_availability で回答すると見られるようになります。",
        );
      }

      const candidates = findCandidates(availabilityOf(event), {
        minDurationMinutes: min_duration_minutes,
        minPeople: min_people,
        limit: top_n,
      });
      if (candidates.length === 0) {
        return toolText(
          event.guests.length === 0
            ? "まだ誰も回答していません。"
            : `条件 (${min_duration_minutes} 分以上、${min_people} 人以上) に合う時間帯はありません。` +
                "min_duration_minutes や min_people を小さくするか、回答が集まるのを待ってください。",
        );
      }

      const tz = event.timezone;
      const facts = candidates.map(
        (c, i) =>
          `${i + 1}. ${formatInterval(c, tz)} — ${c.members.length} 人 / ${event.guests.length} 人中 (${formatByOption(c.members)})`,
      );
      const untrusted = candidates.flatMap((c, i) => {
        const ids = new Set(c.members.map((m) => m.participantId));
        const absent = event.guests.filter((g) => !ids.has(g.id));
        return [
          `候補[${i + 1}] 参加できる人: ${c.members.map((m) => `"${sanitize(m.name)}"`).join(", ")}`,
          `候補[${i + 1}] 参加できない人: ${absent.map((g) => `"${sanitize(g.name)}"`).join(", ") || "なし"}`,
        ];
      });
      return toolText(
        [`参加できる人数の多い時間帯 (timezone: ${tz}):`, ...facts, "", untrustedBlock(untrusted)].join("\n"),
      );
    },
  );
}
