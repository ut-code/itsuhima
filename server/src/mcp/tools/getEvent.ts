import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { McpContext } from "../context.js";
import { formatEventDetail, loadEvent } from "../eventDetail.js";
import { toolText } from "../format.js";
import { eventUrlSchema } from "../schemas.js";

export function registerGetEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "get_event",
    {
      title: "イベントの詳細",
      description:
        "イベントの日程の範囲、入力できる時間帯、現在日時、参加形態の ID、回答 (participant_id)、参加できる人数の集計を返す。" +
        "回答 (submit_availability・update_availability) の前に必ず呼び、返された ID と時間帯の制約に従うこと。",
      inputSchema: z.object({
        event_url: eventUrlSchema,
        include: z
          .enum(["summary", "slots"])
          .default("summary")
          .describe("summary (既定) は回答の件数まで。slots は各回答の時間帯も返す (回答が多いと長くなる)。"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ event_url, include }) => {
      const loaded = await loadEvent(ctx, event_url);
      if (!("event" in loaded)) return loaded;
      return toolText(formatEventDetail(ctx, loaded.event, { includeSlots: include === "slots" }));
    },
  );
}
