interface ImportMetaEnv {
  readonly VITE_LAST_UPDATE: string;
  readonly VITE_LAST_UPDATE_YEAR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
