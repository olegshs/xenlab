/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the source code repository (from .env). */
  readonly VITE_SOURCE_URL?: string;
  /** Public URL of the deployed site (from .env). */
  readonly VITE_SITE_URL?: string;
  /** Google Analytics 4 measurement ID (G-…); analytics is off when empty. */
  readonly VITE_GA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
