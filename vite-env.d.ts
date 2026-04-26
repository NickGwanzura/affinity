/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GEMINI_API_KEY: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
