import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getEvent, type SubmissionInput, submitAvailability, updateMyAvailability } from "../../services/events.js";
import { type McpContext, missingScope } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import type { EventDetail } from "../eventDetail.js";
import { formatInterval, toolError, toolText } from "../format.js";
import { eventIdSchema, type RangeInput, rangeSchema } from "../schemas.js";

const nameSchema = z.string().min(1).max(50);
const commentSchema = z.string().max(500);

/**
 * ツールの ranges を、サービス層の Slot にする。参加形態が 1 つだけなら、省略された ID を補う。
 * 補えなければ、エラーの文を返す。
 */
function toSlots(event: EventDetail, ranges: RangeInput[]): { error: string } | { slots: SubmissionInput["slots"] } {
  const onlyOption = event.options.length === 1 ? event.options[0].id : undefined;
  const slots: SubmissionInput["slots"] = [];
  for (const [i, range] of ranges.entries()) {
    const optionId = range.participation_option_id ?? onlyOption;
    if (!optionId) {
      return {
        error:
          `${i + 1} 件目の時間帯に participation_option_id がありません。このイベントには参加形態が複数あるので省略できません。` +
          `get_event で参加形態の ID (${event.options.map((o) => o.id).join(", ")}) とラベルを確かめ、どれにするかユーザーに聞いてください。`,
      };
    }
    slots.push({ startAt: new Date(range.start), endAt: new Date(range.end), optionId });
  }
  return { slots };
}

/** 回答した結果 (登録した時間帯と、次の更新で使う version) */
function formatResult(
  message: string,
  guest: { version: string; slots: { startAt: string; endAt: string; optionId: string }[] },
  timezone: string,
) {
  return [
    `${message} (時間帯 ${guest.slots.length} 件)。`,
    `version: ${guest.version}  ← 次に update_availability を呼ぶときは、based_on_version にこの値を渡すこと`,
    "登録した時間帯:",
    ...[...guest.slots]
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((s) => `  - ${formatInterval(s, timezone)} [option ${s.optionId}]`),
  ].join("\n");
}

export function registerSubmitAvailability(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "submit_availability",
    {
      title: "日程を回答する",
      description:
        "イベントに、自分が参加できる時間帯を新しく回答する。回答済みなら update_availability を使うこと。" +
        "先に get_event で日程の範囲・入力できる時間帯・参加形態の ID を確かめ、時間帯はその中に 15 分単位で収め、" +
        "日をまたぐ時間帯は日付ごとに分けること (外れた時間帯があれば、切り詰めずにエラーになる)。" +
        "依頼が入力できる時間帯から外れているとき、終わりの時刻が分からないとき、参加形態が複数あってどれか分からないときは、" +
        "決めつけずにユーザーに確かめること。",
      inputSchema: z.object({
        event_id: eventIdSchema,
        name: nameSchema.describe("参加者として表示される自分の名前。"),
        ranges: z.array(rangeSchema).min(1).describe("参加できる時間帯の配列。続いている時間帯は 1 つにまとめること。"),
        comment: commentSchema.optional().describe("主催者に伝えるコメント (任意)。"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ event_id, name, ranges, comment }) => {
      const scopeError = missingScope(ctx, "submit");
      if (scopeError) return toolError(scopeError);

      try {
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        const resolved = toSlots(event, ranges);
        if ("error" in resolved) return toolError(resolved.error);

        const guest = await submitAvailability(ctx.db, ctx.actor, event_id, { name, comment, slots: resolved.slots });
        if (!guest) throw new Error("回答した参加者が見つかりません");
        return toolText(formatResult("日程を回答しました", guest, event.timezone));
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );

  server.registerTool(
    "update_availability",
    {
      title: "回答を更新する",
      description:
        "自分の回答を置き換える。ranges は差分ではなく全体の置き換えなので、残したい時間帯も必ず含めること。" +
        "先に get_event で今の回答と version を取得し、その version を based_on_version に渡すこと。" +
        "時間帯を足すときは、get_event の「登録した時間帯」に新しい時間帯を加えて渡す。" +
        "ユーザーの依頼が、今の時間帯に足すのか置き換えるのか分からないとき (例: 「木曜なら空いてる」) は、ユーザーに確かめること。",
      inputSchema: z.object({
        event_id: eventIdSchema,
        based_on_version: z
          .string()
          .describe("get_event (または直前の回答) が返した version。その後に別の端末で更新されていればエラーになる。"),
        ranges: z.array(rangeSchema).describe("更新後の、参加できる時間帯の全体。空の配列にすると、すべて消える。"),
        name: nameSchema.optional().describe("表示名を変えるときだけ指定する。省略すると今の名前のまま。"),
        comment: commentSchema.optional().describe("コメントを変えるときだけ指定する。空文字にすると消える。"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ event_id, based_on_version, ranges, name, comment }) => {
      const scopeError = missingScope(ctx, "submit");
      if (scopeError) return toolError(scopeError);

      try {
        const event = await getEvent(ctx.db, ctx.actor, event_id);
        const me = event.meAsGuest;
        if (!me) {
          return toolError("このイベントにはまだ回答していません。submit_availability で回答してください。");
        }
        const resolved = toSlots(event, ranges);
        if ("error" in resolved) return toolError(resolved.error);

        const guest = await updateMyAvailability(
          ctx.db,
          ctx.actor,
          event_id,
          { name: name ?? me.name, comment: comment ?? me.comment, slots: resolved.slots },
          based_on_version,
        );
        if (!guest) throw new Error("回答した参加者が見つかりません");
        return toolText(formatResult("回答を更新しました", guest, event.timezone));
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
