/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 本番以外のビルドで、画面とタイトルに出すラベル (例: STAGING) */
  readonly VITE_ENV_LABEL?: string;
}
