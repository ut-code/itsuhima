import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listMyEvents } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { EVENT_TIMEZONE, formatDate, formatNow, sanitize, toolError, toolText, untrustedBlock } from "../format.js";

export function registerListEvents(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_events",
    {
      title: "イベントの一覧",
      description:
        "自分が主催した、または回答したイツヒマのイベントの一覧と、現在日時を返す。" +
        "role を省くと、主催したイベントと回答したイベントの両方を返す。",
      inputSchema: z.object({
        role: z
          .enum(["host", "guest"])
          .optional()
          .describe("host なら自分が主催したイベント、guest なら参加者として回答したイベントだけに絞る。"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ role }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);

      const all = await listMyEvents(ctx.db, ctx.actor);
      const events = role ? all.filter((e) => (role === "host" ? e.isHost : !e.isHost)) : all;
      const now = `現在日時: ${formatNow(EVENT_TIMEZONE)}`;
      if (events.length === 0) {
        return toolText(`${now}\n該当するイベントはありません。`);
      }

      const facts = events.map(
        (e) =>
          `- event_id: ${e.id} / ${formatDate(e.startDate)}〜${formatDate(e.endDate)} (${e.timezone}) / ${e.isHost ? "主催者" : "参加者"}`,
      );
      const untrusted = events.map((e) => `event[${e.id}] name: "${sanitize(e.name)}"`);
      return toolText([now, `${events.length} 件のイベント:`, ...facts, "", untrustedBlock(untrusted)].join("\n"));
    },
  );
}
