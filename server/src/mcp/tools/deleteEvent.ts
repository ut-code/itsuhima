import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DELETED_EVENT_RETENTION_DAYS, deleteEvent } from "../../services/events.js";
import { eventUrl, type McpContext } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { loadEvent } from "../eventDetail.js";
import { toolText } from "../format.js";
import { eventUrlSchema } from "../schemas.js";

export function registerDeleteEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "delete_event",
    {
      title: "イベントを消す",
      description:
        `イベントを消す。消したイベントは、${DELETED_EVENT_RETENTION_DAYS} 日たつと回答ごと完全に消える (それまでは、URL を Web で開くと戻せる)。` +
        "URL を知っている人は誰でも消せるので、ユーザーが作ったイベントでなくても消せてしまう。" +
        "依頼がはっきりしていても、消す前には毎回、どのイベントか (名前と日程) と回答した人数を get_event で確かめてユーザーに示し、確認をとること。",
      inputSchema: z.object({
        event_url: eventUrlSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ event_url }) => {
      const loaded = await loadEvent(ctx, event_url);
      if (!("event" in loaded)) return loaded;
      const { event } = loaded;

      try {
        await deleteEvent(ctx.db, ctx.actor, event.id);
      } catch (e) {
        return serviceErrorResult(e);
      }
      return toolText(
        `イベント ${event.id} を消しました (回答 ${event.participants.length} 件を含む)。` +
          `${DELETED_EVENT_RETENTION_DAYS} 日以内なら、${eventUrl(ctx, event.id)} を Web で開くと戻せます。`,
      );
    },
  );
}
