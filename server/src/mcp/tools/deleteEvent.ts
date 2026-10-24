import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { deleteEvent, getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { toolError, toolText } from "../format.js";
import { eventIdSchema } from "../schemas.js";

export function registerDeleteEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "delete_event",
    {
      title: "イベントを消す",
      description:
        "自分が主催したイベントを消す。参加者の回答もすべて消え、取り消せない。" +
        "依頼がはっきりしていても、回答が 0 人でも、消す前には毎回、どのイベントか (名前と日程) と回答した人数をユーザーに示して確かめること。" +
        "回答した人数は list_events で分かる。",
      inputSchema: z.object({
        event_id: eventIdSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ event_id }) => {
      const scopeError = missingScope(ctx, "manage");
      if (scopeError) return toolError(scopeError);

      try {
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        await deleteEvent(ctx.db, ctx.actor, event_id);
        return toolText(`イベント ${event_id} を消しました (回答 ${event.guests.length} 件も消えました)。`);
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
