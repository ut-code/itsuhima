/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" ならログイン (Google) を出す */
  readonly VITE_LOGIN_ENABLED?: string;
}
