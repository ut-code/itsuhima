import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ServiceError } from "../../services/errors.js";
import { type SubmissionInput, submitAvailability, updateAvailability } from "../../services/events.js";
import type { McpContext } from "../context.js";
import { serviceErrorResult } from "../errors.js";
import { type EventDetail, formatSlots, loadEvent } from "../eventDetail.js";
import { toolError, toolText } from "../format.js";
import {
  commentSchema,
  eventUrlSchema,
  nameSchema,
  participantIdSchema,
  type RangeInput,
  rangeSchema,
} from "../schemas.js";

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

/** 回答した結果 (participant_id と、登録した時間帯) */
function formatResult(
  message: string,
  participant: { id: string; slots: { startAt: string; endAt: string; optionId: string }[] },
  timezone: string,
) {
  return [
    `${message} (時間帯 ${participant.slots.length} 件)。`,
    `participant_id: ${participant.id}  ← この回答を直すときは、update_availability にこの値を渡す`,
    "登録した時間帯:",
    ...formatSlots(participant.slots, timezone).map((line) => `  - ${line}`),
  ].join("\n");
}

export function registerSubmitAvailability(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "submit_availability",
    {
      title: "日程を回答する",
      description:
        "イベントに、参加できる時間帯を新しく回答する。すでに回答した人の回答を直すときは update_availability を使うこと " +
        "(同じ名前で回答し直すと、回答が 2 つになる)。" +
        "先に get_event で日程の範囲・入力できる時間帯・参加形態の ID・回答した人の名前を確かめ、時間帯はその中に 15 分単位で収め、" +
        "日をまたぐ時間帯は日付ごとに分けること (外れた時間帯があれば、切り詰めずにエラーになる)。" +
        "依頼が入力できる時間帯から外れているとき、終わりの時刻が分からないとき、参加形態が複数あってどれか分からないときは、" +
        "決めつけずにユーザーに確かめること。",
      inputSchema: z.object({
        event_url: eventUrlSchema,
        name: nameSchema.describe("参加者として表示される名前。ユーザーに聞いて決める。"),
        ranges: z.array(rangeSchema).min(1).describe("参加できる時間帯の配列。続いている時間帯は 1 つにまとめること。"),
        comment: commentSchema.optional().describe("主催者に伝えるコメント (任意)。"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ event_url, name, ranges, comment }) => {
      const loaded = await loadEvent(ctx, event_url);
      if (!("event" in loaded)) return loaded;
      const { event } = loaded;
      const resolved = toSlots(event, ranges);
      if ("error" in resolved) return toolError(resolved.error);

      try {
        const participant = await submitAvailability(ctx.db, ctx.actor, event.id, {
          name,
          comment,
          slots: resolved.slots,
        });
        return toolText(formatResult("日程を回答しました", participant, event.timezone));
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );

  server.registerTool(
    "update_availability",
    {
      title: "回答を直す",
      description:
        "回答を置き換える。ranges は差分ではなく全体の置き換えなので、残したい時間帯も必ず含めること。" +
        '先に get_event (include="slots") で、直す回答の participant_id と今の時間帯を取得すること。' +
        "どの回答を直すかは、名前をユーザーに示して確かめること (URL を知っている人は誰でも、ほかの人の回答も直せてしまう)。" +
        "ユーザーの依頼が、今の時間帯に足すのか置き換えるのか分からないとき (例: 「木曜なら空いてる」) は、ユーザーに確かめること。",
      inputSchema: z.object({
        event_url: eventUrlSchema,
        participant_id: participantIdSchema,
        ranges: z.array(rangeSchema).describe("直した後の、参加できる時間帯の全体。空の配列にすると、すべて消える。"),
        name: nameSchema.optional().describe("表示名を変えるときだけ指定する。省略すると今の名前のまま。"),
        comment: commentSchema.optional().describe("コメントを変えるときだけ指定する。空文字にすると消える。"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ event_url, participant_id, ranges, name, comment }) => {
      const loaded = await loadEvent(ctx, event_url);
      if (!("event" in loaded)) return loaded;
      const { event } = loaded;
      const current = event.participants.find((p) => p.id === participant_id);
      if (!current) {
        return serviceErrorResult(new ServiceError("participant_not_found", "回答が見つかりません。"));
      }
      const resolved = toSlots(event, ranges);
      if ("error" in resolved) return toolError(resolved.error);

      try {
        const participant = await updateAvailability(ctx.db, ctx.actor, event.id, participant_id, {
          name: name ?? current.name,
          comment: comment ?? current.comment,
          slots: resolved.slots,
        });
        return toolText(
          formatResult("回答を直しました (直す前の回答は、Web の変更の履歴から戻せます)", participant, event.timezone),
        );
      } catch (e) {
        return serviceErrorResult(e);
      }
    },
  );
}
