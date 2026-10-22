import { relations } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/** あるゲストが参加可能な時間帯の 1 つ。日を跨がない。 */
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
    // Postgres では RESTRICT だったが、SQLite の RESTRICT は即時に検査されるため、Project の削除からの CASCADE で
    // Guest と Slot を同時に消すと失敗しうる。文の終わりに検査する NO ACTION (既定) にする
    guestId: text()
      .notNull()
      .references(() => guest.id, { onUpdate: "cascade" }),
    optionId: text()
      .notNull()
      .references(() => participationOption.id, { onUpdate: "cascade" }),
  },
  (t) => [
    index("slot_eventId_startAt_idx").on(t.eventId, t.startAt),
    index("slot_guestId_idx").on(t.guestId),
    index("slot_optionId_idx").on(t.optionId),
  ],
);

/** 日程調整プロジェクトの作成者。 */
export const host = sqliteTable(
  "Host",
  {
    id: text().primaryKey().$defaultFn(uuid),
    browserId: text().notNull(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [
    uniqueIndex("Host_browserId_projectId_key").on(t.browserId, t.projectId),
    index("Host_projectId_idx").on(t.projectId),
  ],
);

/** 日程調整プロジェクトの参加者。 */
export const guest = sqliteTable(
  "Guest",
  {
    id: text().primaryKey().$defaultFn(uuid),
    name: text().notNull(),
    comment: text(),
    browserId: text().notNull(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [
    uniqueIndex("Guest_browserId_projectId_key").on(t.browserId, t.projectId),
    index("Guest_projectId_idx").on(t.projectId),
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
  hosts: many(host),
  guests: many(guest),
  participationOptions: many(participationOption),
}));

export const allowedRangeRelations = relations(allowedRange, ({ one }) => ({
  project: one(project, { fields: [allowedRange.eventId], references: [project.id] }),
}));

export const slotRelations = relations(slot, ({ one }) => ({
  project: one(project, { fields: [slot.eventId], references: [project.id] }),
  guest: one(guest, { fields: [slot.guestId], references: [guest.id] }),
  participationOption: one(participationOption, {
    fields: [slot.optionId],
    references: [participationOption.id],
  }),
}));

export const hostRelations = relations(host, ({ one }) => ({
  project: one(project, { fields: [host.projectId], references: [project.id] }),
}));

export const guestRelations = relations(guest, ({ one, many }) => ({
  project: one(project, { fields: [guest.projectId], references: [project.id] }),
  slots: many(slot),
}));

export const participationOptionRelations = relations(participationOption, ({ one, many }) => ({
  project: one(project, { fields: [participationOption.eventId], references: [project.id] }),
  slots: many(slot),
}));
