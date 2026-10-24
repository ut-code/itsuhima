import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DEFAULT_PARTICIPATION_OPTION, generateDistinctColor } from "../../../../common/colors.js";
import { eventReqSchema } from "../../../../common/validators.js";
import { createEvent, getEvent } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { formatEventDetail } from "../eventDetail.js";
import { EVENT_TIMEZONE, toolError, toolText } from "../format.js";

const dateSchema = (role: string) =>
  z.iso.date().describe(`${role} (${EVENT_TIMEZONE} の日付、YYYY-MM-DD。例: 2026-11-02)。`);

const timeSchema = (role: string, defaultTime: string) =>
  z
    .string()
    .regex(/^(([01]\d|2[0-3]):(00|15|30|45)|24:00)$/, "HH:mm で、15 分単位 (:00 / :15 / :30 / :45) で指定してください")
    .default(defaultTime)
    .describe(`${role} (${EVENT_TIMEZONE} の時刻、HH:mm、15 分単位。既定は ${defaultTime})。`);

export function registerCreateEvent(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "create_event",
    {
      title: "イベントを作る",
      description:
        "日程調整のイベントを新しく作る。作った人が主催者になる。日付と時刻は Asia/Tokyo の壁時計として扱う。" +
        "「来週」などの相対的な日付は、先に list_events で現在日時を確かめてから直し、解釈が分かれるとき (例: 日曜の「来週」) はユーザーに確かめること。" +
        "作ったら、返される共有 URL を参加者に送ってもらう。",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("イベント名。"),
        start_date: dateSchema("候補の期間の最初の日"),
        end_date: dateSchema("候補の期間の最後の日 (この日を含む)。start_date 以降"),
        start_time: timeSchema("1 日のうち、回答できる時間帯の始まり", "09:00"),
        end_time: timeSchema("1 日のうち、回答できる時間帯の終わり。その日の終わりまでなら 24:00", "21:00"),
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
