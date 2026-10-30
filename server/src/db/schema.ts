import { relations, sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EventSnapshot, ParticipantSnapshot } from "../services/snapshots.js";

const uuid = () => crypto.randomUUID();

/** 日程調整のイベント。 */
export const event = sqliteTable(
  "event",
  {
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
    /**
     * ログインして作った人。null なら匿名で作ったもので、URL を知っている全員が編集できる。
     * ユーザーを削除すると null (匿名) になる
     */
    ownerUserId: text().references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("event_ownerUserId_idx").on(t.ownerUserId)],
);

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
    /**
     * ログインして回答した人。null なら匿名の回答で、URL を知っている全員が編集できる。
     * ユーザーを削除すると null (匿名) になる
     */
    userId: text().references(() => user.id, { onDelete: "set null" }),
    updatedAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (t) => [
    index("participant_eventId_idx").on(t.eventId),
    // ログインした人は、1 つのイベントに 1 つだけ回答する
    uniqueIndex("participant_eventId_userId_key")
      .on(t.eventId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    index("participant_userId_idx").on(t.userId),
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
    /** 変えた人。null なら匿名 (ユーザーを削除したときも null になる) */
    userId: text().references(() => user.id, { onDelete: "set null" }),
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
export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("publicKey").notNull(),
  privateKey: text("privateKey").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClient = sqliteTable(
  "oauthClient",
  {
    id: text("id").primaryKey(),
    clientId: text("clientId").notNull().unique(),
    clientSecret: text("clientSecret"),
    clientDiscoveryId: text("clientDiscoveryId"),
    disabled: integer("disabled", { mode: "boolean" }).default(false),
    skipConsent: integer("skipConsent", { mode: "boolean" }),
    enableEndSession: integer("enableEndSession", { mode: "boolean" }),
    subjectType: text("subjectType"),
    scopes: text("scopes", { mode: "json" }),
    clientCredentialsScopes: text("clientCredentialsScopes", {
      mode: "json",
    }).default([]),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts", { mode: "json" }),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("softwareId"),
    softwareVersion: text("softwareVersion"),
    softwareStatement: text("softwareStatement"),
    redirectUris: text("redirectUris", { mode: "json" }).notNull(),
    postLogoutRedirectUris: text("postLogoutRedirectUris", { mode: "json" }),
    backchannelLogoutUri: text("backchannelLogoutUri"),
    backchannelLogoutSessionRequired: integer("backchannelLogoutSessionRequired", { mode: "boolean" }),
    tokenEndpointAuthMethod: text("tokenEndpointAuthMethod"),
    applicationType: text("applicationType"),
    jwks: text("jwks"),
    jwksUri: text("jwksUri"),
    grantTypes: text("grantTypes", { mode: "json" }),
    responseTypes: text("responseTypes", { mode: "json" }),
    requirePKCE: integer("requirePKCE", { mode: "boolean" }),
    dpopBoundAccessTokens: integer("dpopBoundAccessTokens", {
      mode: "boolean",
    }).default(false),
    referenceId: text("referenceId"),
    metadata: text("metadata", { mode: "json" }),
  },
  (table) => [index("oauthClient_userId_idx").on(table.userId)],
);

export const oauthResource = sqliteTable("oauthResource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("accessTokenTtl"),
  refreshTokenTtl: integer("refreshTokenTtl"),
  signingAlgorithm: text("signingAlgorithm"),
  signingKeyId: text("signingKeyId"),
  allowedScopes: text("allowedScopes", { mode: "json" }),
  customClaims: text("customClaims", { mode: "json" }),
  dpopBoundAccessTokensRequired: integer("dpopBoundAccessTokensRequired", {
    mode: "boolean",
  }).default(false),
  disabled: integer("disabled", { mode: "boolean" }).default(false),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  policyVersion: integer("policyVersion").default(1),
  metadata: text("metadata", { mode: "json" }),
});

export const oauthClientResource = sqliteTable(
  "oauthClientResource",
  {
    id: text("id").primaryKey(),
    clientId: text("clientId")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resourceId")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("oauthClientResource_clientId_resourceId_uidx").on(table.clientId, table.resourceId),
    index("oauthClientResource_clientId_idx").on(table.clientId),
    index("oauthClientResource_resourceId_idx").on(table.resourceId),
  ],
);

export const oauthRefreshToken = sqliteTable(
  "oauthRefreshToken",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("clientId")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("sessionId").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("referenceId"),
    authorizationCodeId: text("authorizationCodeId"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requestedUserInfoClaims", { mode: "json" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    rotatedAt: integer("rotatedAt", { mode: "timestamp_ms" }),
    rotationReplayResponse: text("rotationReplayResponse"),
    rotationReplayExpiresAt: integer("rotationReplayExpiresAt", {
      mode: "timestamp_ms",
    }),
    authTime: integer("authTime", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (table) => [
    index("oauthRefreshToken_clientId_idx").on(table.clientId),
    index("oauthRefreshToken_sessionId_idx").on(table.sessionId),
    index("oauthRefreshToken_userId_idx").on(table.userId),
    index("oauthRefreshToken_authorizationCodeId_idx").on(table.authorizationCodeId),
  ],
);

export const oauthAccessToken = sqliteTable(
  "oauthAccessToken",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("clientId")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("sessionId").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("referenceId"),
    authorizationCodeId: text("authorizationCodeId"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requestedUserInfoClaims", { mode: "json" }),
    refreshId: text("refreshId").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (table) => [
    index("oauthAccessToken_clientId_idx").on(table.clientId),
    index("oauthAccessToken_sessionId_idx").on(table.sessionId),
    index("oauthAccessToken_userId_idx").on(table.userId),
    index("oauthAccessToken_authorizationCodeId_idx").on(table.authorizationCodeId),
    index("oauthAccessToken_refreshId_idx").on(table.refreshId),
  ],
);

export const oauthConsent = sqliteTable(
  "oauthConsent",
  {
    id: text("id").primaryKey(),
    clientId: text("clientId")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("referenceId"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requestedUserInfoClaims", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("oauthConsent_clientId_idx").on(table.clientId), index("oauthConsent_userId_idx").on(table.userId)],
);

export const oauthClientAssertion = sqliteTable("oauthClientAssertion", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  oauthClients: many(oauthClient),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
  oauthClientResources: many(oauthClientResource),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const oauthResourceRelations = relations(oauthResource, ({ many }) => ({
  oauthClientResources: many(oauthClientResource),
}));

export const oauthClientResourceRelations = relations(oauthClientResource, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthClientResource.clientId],
    references: [oauthClient.clientId],
  }),
  oauthResource: one(oauthResource, {
    fields: [oauthClientResource.resourceId],
    references: [oauthResource.identifier],
  }),
}));

export const oauthRefreshTokenRelations = relations(oauthRefreshToken, ({ one, many }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthRefreshToken.clientId],
    references: [oauthClient.clientId],
  }),
  session: one(session, {
    fields: [oauthRefreshToken.sessionId],
    references: [session.id],
  }),
  user: one(user, {
    fields: [oauthRefreshToken.userId],
    references: [user.id],
  }),
  oauthAccessTokens: many(oauthAccessToken),
}));

export const oauthAccessTokenRelations = relations(oauthAccessToken, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthAccessToken.clientId],
    references: [oauthClient.clientId],
  }),
  session: one(session, {
    fields: [oauthAccessToken.sessionId],
    references: [session.id],
  }),
  user: one(user, {
    fields: [oauthAccessToken.userId],
    references: [user.id],
  }),
  oauthRefreshToken: one(oauthRefreshToken, {
    fields: [oauthAccessToken.refreshId],
    references: [oauthRefreshToken.id],
  }),
}));

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}));
