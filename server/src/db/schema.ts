import { relations, sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EventSnapshot, ParticipantSnapshot } from "../services/snapshots.js";

const uuid = () => crypto.randomUUID();

/** 日程調整のイベント。 */
export const event = sqliteTable("event", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  /** イベントのタイムゾーンでの日付 ("YYYY-MM-DD") */
  startDate: text().notNull(),
  /** イベントのタイムゾーンでの日付 ("YYYY-MM-DD")。この日を含む */
  endDate: text().notNull(),
  /** 日付と時間帯は、このタイムゾーンの壁時計で解釈する (IANA のタイムゾーン名) */
  timezone: text().notNull().default("Asia/Tokyo"),
  createdAt: text()
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  /** 論理削除した日時 (UTC の ISO 8601)。null なら削除されていない */
  deletedAt: text(),
});

/** イベントで入力できる時間帯。(注: 現在は 1 つのイベントにつき 1 つのみ設定可能) */
export const allowedRange = sqliteTable(
  "allowedRange",
  {
    id: text().primaryKey().$defaultFn(uuid),
    /** イベントのタイムゾーンでの時刻 ("HH:mm") */
    startTime: text().notNull(),
    /** イベントのタイムゾーンでの時刻 ("HH:mm")。その日の終わりまでなら "24:00" */
    endTime: text().notNull(),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [index("allowedRange_eventId_idx").on(t.eventId)],
);

/** ある参加者が参加可能な時間帯の 1 つ。日を跨がない。 */
export const slot = sqliteTable(
  "slot",
  {
    id: text().primaryKey().$defaultFn(uuid),
    /** UTC の ISO 8601 */
    startAt: text().notNull(),
    /** UTC の ISO 8601 */
    endAt: text().notNull(),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
    participantId: text()
      .notNull()
      .references(() => participant.id, { onDelete: "cascade", onUpdate: "cascade" }),
    optionId: text()
      .notNull()
      .references(() => option.id, { onUpdate: "cascade" }),
  },
  (t) => [
    index("slot_eventId_startAt_idx").on(t.eventId, t.startAt),
    index("slot_participantId_idx").on(t.participantId),
    index("slot_optionId_idx").on(t.optionId),
  ],
);

/** イベントに回答した人。URL を知っていれば誰でも編集できる */
export const participant = sqliteTable(
  "participant",
  {
    id: text().primaryKey().$defaultFn(uuid),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text().notNull(),
    comment: text(),
    updatedAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (t) => [index("participant_eventId_idx").on(t.eventId)],
);

/** 参加形態。 */
export const option = sqliteTable(
  "option",
  {
    id: text().primaryKey().$defaultFn(uuid),
    label: text().notNull(),
    color: text().notNull(),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [uniqueIndex("option_eventId_label_key").on(t.eventId, t.label)],
);

/**
 * イベントの設定や回答を変える・消す前のスナップショット。履歴から戻すのに使う。
 * targetId は、target が "event" ならイベントの id、"participant" なら参加者の id (消えていてもよい)。
 */
export const history = sqliteTable(
  "history",
  {
    id: text().primaryKey().$defaultFn(uuid),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
    target: text({ enum: ["event", "participant"] }).notNull(),
    targetId: text().notNull(),
    action: text({ enum: ["update", "delete"] }).notNull(),
    /** 変える前の値の JSON。回答なら slots も含む */
    before: text({ mode: "json" }).$type<EventSnapshot | ParticipantSnapshot>().notNull(),
    createdAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("history_eventId_createdAt_idx").on(t.eventId, t.createdAt),
    check("history_target_check", sql`${t.target} IN ('event', 'participant')`),
    check("history_action_check", sql`${t.action} IN ('update', 'delete')`),
  ],
);

/**
 * browserId (前の、ブラウザごとの識別子) で作ったイベントと回答したイベント。
 * browserId をやめたので、前の一覧を localStorage の控えに移す (交換する) ためだけに残す。交換した行は消す。
 * participantId は回答の id。回答していないホストなら null。
 */
export const legacyBrowserEvent = sqliteTable(
  "legacyBrowserEvent",
  {
    browserId: text().notNull(),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
    isHost: integer({ mode: "boolean" }).notNull(),
    participantId: text(),
  },
  (t) => [primaryKey({ columns: [t.browserId, t.eventId] })],
);

export const eventRelations = relations(event, ({ many }) => ({
  allowedRanges: many(allowedRange),
  slots: many(slot),
  participants: many(participant),
  options: many(option),
  histories: many(history),
}));

export const allowedRangeRelations = relations(allowedRange, ({ one }) => ({
  event: one(event, { fields: [allowedRange.eventId], references: [event.id] }),
}));

export const slotRelations = relations(slot, ({ one }) => ({
  event: one(event, { fields: [slot.eventId], references: [event.id] }),
  participant: one(participant, { fields: [slot.participantId], references: [participant.id] }),
  option: one(option, {
    fields: [slot.optionId],
    references: [option.id],
  }),
}));

export const participantRelations = relations(participant, ({ one, many }) => ({
  event: one(event, { fields: [participant.eventId], references: [event.id] }),
  slots: many(slot),
}));

export const optionRelations = relations(option, ({ one, many }) => ({
  event: one(event, { fields: [option.eventId], references: [event.id] }),
  slots: many(slot),
}));

export const historyRelations = relations(history, ({ one }) => ({
  event: one(event, { fields: [history.eventId], references: [event.id] }),
}));
