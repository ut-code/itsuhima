import { relations, sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();

/** 日程調整プロジェクト。ユーザには「イベント」と表示。 */
export const project = sqliteTable("event", {
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
});

/** 日程調整プロジェクトにおいて入力が許可された時間帯。(注: 現在は 1 つの日程調整プロジェクトにつき 1 つのみ設定可能) */
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
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
    participantId: text()
      .notNull()
      .references(() => participant.id, { onDelete: "cascade", onUpdate: "cascade" }),
    optionId: text()
      .notNull()
      .references(() => participationOption.id, { onUpdate: "cascade" }),
  },
  (t) => [
    index("slot_eventId_startAt_idx").on(t.eventId, t.startAt),
    index("slot_participantId_idx").on(t.participantId),
    index("slot_optionId_idx").on(t.optionId),
  ],
);

/**
 * イベントの参加者。ホスト (作成者) とゲストを role で区別する。
 * name が null なら、まだ回答していない (イベントを作っただけのホスト)。
 */
export const participant = sqliteTable(
  "participant",
  {
    id: text().primaryKey().$defaultFn(uuid),
    eventId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text({ enum: ["host", "guest"] }).notNull(),
    name: text(),
    comment: text(),
    browserId: text().notNull(),
    updatedAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex("participant_eventId_browserId_key").on(t.eventId, t.browserId),
    check("participant_role_check", sql`${t.role} IN ('host', 'guest')`),
  ],
);

/** 参加形態。 */
export const participationOption = sqliteTable(
  "option",
  {
    id: text().primaryKey().$defaultFn(uuid),
    label: text().notNull(),
    color: text().notNull(),
    eventId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [uniqueIndex("option_eventId_label_key").on(t.eventId, t.label)],
);

export const projectRelations = relations(project, ({ many }) => ({
  allowedRanges: many(allowedRange),
  slots: many(slot),
  participants: many(participant),
  participationOptions: many(participationOption),
}));

export const allowedRangeRelations = relations(allowedRange, ({ one }) => ({
  project: one(project, { fields: [allowedRange.eventId], references: [project.id] }),
}));

export const slotRelations = relations(slot, ({ one }) => ({
  project: one(project, { fields: [slot.eventId], references: [project.id] }),
  participant: one(participant, { fields: [slot.participantId], references: [participant.id] }),
  participationOption: one(participationOption, {
    fields: [slot.optionId],
    references: [participationOption.id],
  }),
}));

export const participantRelations = relations(participant, ({ one, many }) => ({
  project: one(project, { fields: [participant.eventId], references: [project.id] }),
  slots: many(slot),
}));

export const participationOptionRelations = relations(participationOption, ({ one, many }) => ({
  project: one(project, { fields: [participationOption.eventId], references: [project.id] }),
  slots: many(slot),
}));
