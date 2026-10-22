/**
 * サービス層のエラーの理由。HTTP のステータスへの変換は呼び出す側 (`app.ts` の `onError`) が行う。
 */
export type ServiceErrorReason =
  | "project_not_found"
  | "submission_not_found"
  | "not_host"
  | "already_submitted"
  | "options_empty"
  | "option_in_use";

/**
 * サービス層が投げる業務エラー。message は Web UI にそのまま表示する既定の文で、
 * 呼び出し元 (P2 の MCP など) が reason を見て差し替えてよい。
 */
export class ServiceError extends Error {
  constructor(
    readonly reason: ServiceErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
