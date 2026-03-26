// App data injected by server
interface AppData {
  TUSD_PATH: string;
}

declare global {
  interface Window {
    __APP_DATA__?: AppData;
  }
}

export const config = {
  get tusdPath(): string {
    // First check server-injected data, then Vite env, then fallback
    return (
      window.__APP_DATA__?.TUSD_PATH ||
      import.meta.env.VITE_TUSD_PATH
    );
  },
};
