import { relations } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();

/** 日程調整プロジェクト。ユーザには「イベント」と表示。 */
export const project = sqliteTable("Project", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  /** 注: 日付部分のみ利用。時間は考慮しない。 */
  startDate: text().notNull(),
  /** 注: 日付部分のみ利用。時間は考慮しない。 */
  endDate: text().notNull(),
});

/** 日程調整プロジェクトにおいて入力が許可された時間帯。(注: 現在は 1 つの日程調整プロジェクトにつき 1 つのみ設定可能) */
export const allowedRange = sqliteTable(
  "AllowedRange",
  {
    id: text().primaryKey().$defaultFn(uuid),
    /** 注: 時間部分のみ利用。日付は考慮しない。 */
    startTime: text().notNull(),
    /** 注: 時間部分のみ利用。日付は考慮しない。 */
    endTime: text().notNull(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [index("AllowedRange_projectId_idx").on(t.projectId)],
);

/** あるゲストが参加可能な時間帯の 1 つ。日を跨がない。 */
export const slot = sqliteTable(
  "Slot",
  {
    id: text().primaryKey().$defaultFn(uuid),
    from: text().notNull(),
    to: text().notNull(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
    // Postgres では RESTRICT だったが、SQLite の RESTRICT は即時に検査されるため、Project の削除からの CASCADE で
    // Guest と Slot を同時に消すと失敗しうる。文の終わりに検査する NO ACTION (既定) にする
    guestId: text()
      .notNull()
      .references(() => guest.id, { onUpdate: "cascade" }),
    participationOptionId: text()
      .notNull()
      .references(() => participationOption.id, { onUpdate: "cascade" }),
  },
  (t) => [
    index("Slot_projectId_idx").on(t.projectId),
    index("Slot_guestId_idx").on(t.guestId),
    index("Slot_participationOptionId_idx").on(t.participationOptionId),
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
  "ParticipationOption",
  {
    id: text().primaryKey().$defaultFn(uuid),
    label: text().notNull(),
    color: text().notNull(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [uniqueIndex("ParticipationOption_projectId_label_key").on(t.projectId, t.label)],
);

export const projectRelations = relations(project, ({ many }) => ({
  allowedRanges: many(allowedRange),
  slots: many(slot),
  hosts: many(host),
  guests: many(guest),
  participationOptions: many(participationOption),
}));

export const allowedRangeRelations = relations(allowedRange, ({ one }) => ({
  project: one(project, { fields: [allowedRange.projectId], references: [project.id] }),
}));

export const slotRelations = relations(slot, ({ one }) => ({
  project: one(project, { fields: [slot.projectId], references: [project.id] }),
  guest: one(guest, { fields: [slot.guestId], references: [guest.id] }),
  participationOption: one(participationOption, {
    fields: [slot.participationOptionId],
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
  project: one(project, { fields: [participationOption.projectId], references: [project.id] }),
  slots: many(slot),
}));
