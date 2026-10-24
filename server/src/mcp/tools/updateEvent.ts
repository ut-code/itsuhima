import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { editEventReqSchema } from "../../../../common/validators.js";
import { getEvent, updateEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { formatEventDetail } from "../eventDetail.js";
import { toolError, toolText } from "../format.js";
import { dateSchema, eventIdSchema, timeSchema } from "../schemas.js";

export function registerUpdateEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "update_event",
    {
      title: "イベントを直す",
      description:
        "自分が主催したイベントの名前・説明・日程の範囲・入力できる時間帯を直す。指定しなかった項目は変えない。" +
        "誰かが回答した後は、日程の範囲と入力できる時間帯は変えられない (名前と説明は変えられる)。" +
        "参加形態は、ここでは変えられない (Web の画面で変える)。" +
        "「再来週にずらして」のような相対的な言い方は、どの日付にするかをユーザーに示して確かめてから直すこと。",
      inputSchema: z.object({
        event_id: eventIdSchema,
        name: z.string().min(1).max(100).optional().describe("新しいイベント名。"),
        description: z.string().max(1000).optional().describe("新しい説明。空文字にすると消える。"),
        start_date: dateSchema("新しい候補の期間の最初の日").optional(),
        end_date: dateSchema("新しい候補の期間の最後の日 (この日を含む)").optional(),
        start_time: timeSchema("新しい、1 日のうち回答できる時間帯の始まり", "省略すると今のまま").optional(),
        end_time: timeSchema(
          "新しい、1 日のうち回答できる時間帯の終わり",
          "その日の終わりまでなら 24:00。省略すると今のまま",
        ).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ event_id, name, description, start_date, end_date, start_time, end_time }) => {
      const scopeError = missingScope(ctx, "create");
      if (scopeError) return toolError(scopeError);

      const changesSchedule = [start_date, end_date, start_time, end_time].some((v) => v !== undefined);
      if (name === undefined && description === undefined && !changesSchedule) {
        return toolError("変える項目を 1 つ以上指定してください。");
      }

      try {
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        if (!event.isHost) {
          return toolError("この操作は、イベントの主催者だけができます。");
        }
        // サービス層は、回答があると日程と時間帯の変更を黙って無視するので、ここで断る
        if (changesSchedule && event.guests.length > 0) {
          return toolError(
            `もう ${event.guests.length} 人が回答しているので、日程の範囲と入力できる時間帯は変えられません。` +
              "名前と説明だけなら変えられます。日程を変えたいときは、そのことをユーザーに伝えてください。",
          );
        }

        // 前後を確かめられるよう、片方だけ指定されたら、もう片方は今の値で補う
        const range = event.allowedRanges[0];
        const parsed = editEventReqSchema.safeParse({
          name,
          description,
          ...(start_date !== undefined || end_date !== undefined
            ? { startDate: start_date ?? event.startDate, endDate: end_date ?? event.endDate }
            : {}),
          ...(start_time !== undefined || end_time !== undefined
            ? {
                allowedRanges: [
                  {
                    startTime: start_time ?? range?.startTime ?? "00:00",
                    endTime: end_time ?? range?.endTime ?? "24:00",
                  },
                ],
              }
            : {}),
        });
        if (!parsed.success) {
          const issues = parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n");
          return toolError(`イベントを直せませんでした。次を直して、もう一度呼んでください。\n${issues}`);
        }

        await updateEvent(ctx.db, ctx.actor, event_id, parsed.data);
        const updated = await getEvent(ctx.db, ctx.actor, event_id);
        return toolText(`イベントを直しました。\n\n${formatEventDetail(ctx, updated)}`);
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
