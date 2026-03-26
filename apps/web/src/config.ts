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
    return window.__APP_DATA__?.TUSD_PATH || import.meta.env.VITE_TUSD_PATH;
  },
};

// User ID management
const USER_ID_KEY = "hopefest_user_id";

function generateUserId(): string {
  return crypto.randomUUID();
}

export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}
