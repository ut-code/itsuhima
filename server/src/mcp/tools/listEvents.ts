import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listMyEvents } from "../../services/events.js";
import { eventUrl, type McpContext, missingScope } from "../context.js";
import { formatDate, formatNow, sanitize, toolError, toolText, untrustedBlock } from "../format.js";
import { EVENT_TIMEZONE } from "../schemas.js";

/** ログインして使うときだけ (`/mcp`) 登録する */
export function registerListEvents(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "list_events",
    {
      title: "自分のイベントの一覧",
      description:
        "ユーザーがログインして作ったイベントと回答したイベントの一覧と、現在日時を返す (ログインせずに作ったものや、Web で回答したものは含まない)。" +
        "role を省くと、作ったイベントと回答したイベントの両方を返す。各イベントの URL、回答した人数、ユーザーの回答の participant_id も返す。" +
        "相対的な日付を直すときや、イベントを作る前 (同じイベントがもうないか) にも使う。",
      inputSchema: z.object({
        role: z
          .enum(["host", "guest"])
          .optional()
          .describe("host なら自分が作ったイベント、guest なら回答したイベントだけに絞る。"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ role }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) return toolError(scopeError);
      if (ctx.actor.userId === null) return toolError("ログインしていないので、一覧はありません。");

      const all = await listMyEvents(ctx.db, ctx.actor.userId);
      const events = role ? all.filter((e) => (role === "host" ? e.isHost : e.participantId !== null)) : all;
      const now = `現在日時: ${formatNow(EVENT_TIMEZONE)}`;
      if (events.length === 0) {
        return toolText(`${now}\n該当するイベントはありません。`);
      }

      const facts = events.map(
        (e) =>
          `- event_id: ${e.id} / URL: ${eventUrl(ctx, e.id)} / ${formatDate(e.startDate)}〜${formatDate(e.endDate)} (${e.timezone})` +
          ` / ${e.isHost ? "作ったイベント" : "回答したイベント"} / 回答した人数: ${e.participantCount}` +
          ` / あなたの回答: ${e.participantId ? `participant_id=${e.participantId}` : "なし"}` +
          (e.deleted ? " / 削除済み (Web で URL を開くと戻せる)" : ""),
      );
      const untrusted = events.map((e) => `event[${e.id}] name: "${sanitize(e.name)}"`);
      return toolText([now, `${events.length} 件のイベント:`, ...facts, "", untrustedBlock(untrusted)].join("\n"));
    },
  );
}
