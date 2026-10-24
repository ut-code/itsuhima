import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * イベントの参加者。ホスト (作成者) とゲストを role で区別する。
 * name が null なら、まだ回答していない (イベントを作っただけのホスト)。
 * 持ち主は、ブラウザ (browserId) かユーザー (userId) のどちらか一方。
 */
export const participant = sqliteTable(
  "participant",
  {
    id: text().primaryKey().$defaultFn(uuid),
    eventId: text()
      .notNull()
      .references(() => event.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text({ enum: ["host", "guest"] }).notNull(),
    name: text(),
    comment: text(),
    /** ログインせずに作成・回答した参加者のブラウザ。ユーザーの参加者なら null */
    browserId: text(),
    /** ログインして作成・回答した (またはログインして紐づけた) 参加者のユーザー。ブラウザの参加者なら null */
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    updatedAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (t) => [
    index("participant_eventId_idx").on(t.eventId),
    // 本人の参加者を browserId・userId だけで引く (`ownedBy`) ので、それぞれを先頭にする。
    // SQLite の UNIQUE は NULL 同士を重複とみなさないので、ブラウザの参加者もユーザーの参加者も、それぞれ何人いてもよい
    uniqueIndex("participant_browserId_eventId_key").on(t.browserId, t.eventId),
    uniqueIndex("participant_userId_eventId_key").on(t.userId, t.eventId),
    // ホストはイベントにつき 1 人
    uniqueIndex("participant_eventId_host_key")
      .on(t.eventId)
      .where(sql`${t.role} = 'host'`),
    check("participant_role_check", sql`${t.role} IN ('host', 'guest')`),
    check("participant_owner_check", sql`(${t.browserId} IS NULL) <> (${t.userId} IS NULL)`),
    // 未回答 (name が null) はホストだけ。ゲストは回答したときに作る
    check("participant_answered_check", sql`${t.role} = 'host' OR ${t.name} IS NOT NULL`),
  ],
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

export const eventRelations = relations(event, ({ many }) => ({
  allowedRanges: many(allowedRange),
  slots: many(slot),
  participants: many(participant),
  options: many(option),
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

// ---- 認証 (Better Auth) ----
// auth.config.ts から `npx auth generate` で生成したもの。手で変えない (生成し直したときに差分が出る)。
// 日時は Better Auth の既定のまま integer (ミリ秒) で持つ (アプリのテーブルは ISO 文字列)。

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
