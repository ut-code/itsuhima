import { type McpServer, ResourceNotFoundError, ResourceTemplate } from "@modelcontextprotocol/server";
import { ServiceError } from "../services/errors.js";
import { getEvent, listMyEvents } from "../services/events.js";
import { type McpContext, missingScope } from "./context.js";
import { formatEventDetail } from "./eventDetail.js";
import { formatDate, sanitize } from "./format.js";

/**
 * イベントの Resource (`itsuhima://event/{eventId}`)。ユーザーが「このイベントを見て」と会話に添付できるようにする。
 * 内容は get_event (summary) と同じ。
 */
export function registerEventResource(server: McpServer, ctx: McpContext) {
  server.registerResource(
    "event",
    new ResourceTemplate("itsuhima://event/{eventId}", {
      list: async () => {
        if (missingScope(ctx, "read")) return { resources: [] };
        const events = await listMyEvents(ctx.db, ctx.actor);
        return {
          resources: events.map((e) => ({
            uri: `itsuhima://event/${e.id}`,
            // 一覧の名前は、クライアントの UI に出るだけで、LLM には渡らない想定。それでもタグは潰しておく
            name: sanitize(e.name) || e.id,
            description: `${formatDate(e.startDate)}〜${formatDate(e.endDate)} (${e.isHost ? "主催者" : "参加者"})`,
            mimeType: "text/plain",
          })),
        };
      },
    }),
    {
      title: "イツヒマのイベント",
      description: "イベントの日程の範囲、参加形態、自分の回答、参加できる人数の集計。",
      mimeType: "text/plain",
    },
    async (uri, { eventId }) => {
      const scopeError = missingScope(ctx, "read");
      if (scopeError) throw new Error(scopeError);
      try {
        const event = await getEvent(ctx.db, ctx.actor, String(eventId));
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: formatEventDetail(ctx, event) }] };
      } catch (e) {
        if (e instanceof ServiceError && e.reason === "event_not_found") {
          throw new ResourceNotFoundError(uri.href, "イベントが見つかりません。");
        }
        throw e;
      }
    },
  );
}
