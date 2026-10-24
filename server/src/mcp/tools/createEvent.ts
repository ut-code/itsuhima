import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DEFAULT_PARTICIPATION_OPTION, generateDistinctColor } from "../../../../common/colors.js";
import { eventReqSchema } from "../../../../common/validators.js";
import { createEvent, getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { formatEventDetail } from "../eventDetail.js";
import { toolError, toolText } from "../format.js";
import { dateSchema, timeSchema } from "../schemas.js";

export function registerCreateEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "create_event",
    {
      title: "イベントを作る",
      description:
        "日程調整のイベントを新しく作る。作った人が主催者になる。日付と時刻は Asia/Tokyo の壁時計として扱う。" +
        "作る前に list_events を呼び、現在日時で相対的な日付 (「来週」など) を直し、同じ名前や日程のイベントがもうないか確かめること" +
        " (あれば、ユーザーに示して、それを使うか新しく作るか確かめる)。" +
        "参加形態は、作った後は MCP では変えられない (Web の画面で変える) ので、ここで決めておくこと。" +
        "作ったら、返される共有 URL を参加者に送ってもらう。名前・説明・日程の範囲・時間帯を間違えたときは update_event で直すか、delete_event で消せる。",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("イベント名。"),
        start_date: dateSchema("候補の期間の最初の日"),
        end_date: dateSchema("候補の期間の最後の日 (この日を含む)。start_date 以降"),
        start_time: timeSchema("1 日のうち、回答できる時間帯の始まり", "既定は 09:00").default("09:00"),
        end_time: timeSchema(
          "1 日のうち、回答できる時間帯の終わり。その日の終わりまでなら 24:00",
          "既定は 21:00",
        ).default("21:00"),
        description: z.string().max(1000).optional().describe("イベントの説明 (任意)。"),
        participation_options: z
          .array(z.object({ label: z.string().min(1).max(50).describe("参加形態のラベル (例: 対面、オンライン)。") }))
          .min(1)
          .max(10)
          .optional()
          .describe(
            `参加形態の一覧。省略すると「${DEFAULT_PARTICIPATION_OPTION.label}」が 1 つだけできる。色は自動で割り当てる。`,
          ),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, start_date, end_date, start_time, end_time, description, participation_options }) => {
      const scopeError = missingScope(ctx, "create");
      if (scopeError) return toolError(scopeError);

      const labels = participation_options?.map((o) => o.label) ?? [DEFAULT_PARTICIPATION_OPTION.label];
      if (new Set(labels).size !== labels.length) {
        return toolError("参加形態のラベルが重複しています。ラベルはそれぞれ違うものにしてください。");
      }
      // 1 つ目は既定の色、2 つ目からは既存の色と違う色にする (Web のフォームと同じ)
      const colors: string[] = [];
      const options = labels.map((label) => {
        const color = colors.length === 0 ? DEFAULT_PARTICIPATION_OPTION.color : generateDistinctColor(colors);
        colors.push(color);
        return { id: crypto.randomUUID(), label, color };
      });

      // 日付の前後、時刻の前後などは、Web と同じスキーマで確かめる
      const parsed = eventReqSchema.safeParse({
        name,
        description: description ?? "",
        startDate: start_date,
        endDate: end_date,
        allowedRanges: [{ startTime: start_time, endTime: end_time }],
        options,
      });
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n");
        return toolError(`イベントを作れませんでした。次を直して、もう一度呼んでください。\n${issues}`);
      }

      try {
        const { id } = await createEvent(ctx.db, ctx.actor, parsed.data);
        const event = await getEvent(ctx.db, ctx.actor, id);
        return toolText(
          [
            "イベントを作りました。",
            `event_id: ${id}`,
            `共有 URL: ${ctx.origin}/e/${id}  ← 参加者にこの URL を送ると、回答してもらえる`,
            "",
            formatEventDetail(ctx, event),
          ].join("\n"),
        );
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
