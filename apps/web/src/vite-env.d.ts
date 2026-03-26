/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TUSD_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";
