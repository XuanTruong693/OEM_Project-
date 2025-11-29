const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const defaultOrigins = ["http://localhost:4000", "http://127.0.0.1:4000"];
const allowedOriginList = [
  ...(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  ...defaultOrigins,
];

const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
const isOriginAllowed = allowedOriginList.includes(currentOrigin);

const isGoogleAuthEnabled = Boolean(googleClientId) && isOriginAllowed;
const googleDisabledReason = !googleClientId
  ? "Thiếu VITE_GOOGLE_CLIENT_ID"
  : !isOriginAllowed
  ? `Origin ${currentOrigin} chưa có trong VITE_GOOGLE_ALLOWED_ORIGINS/Google Console`
  : "";

export {
  googleClientId,
  isGoogleAuthEnabled,
  googleDisabledReason,
  isOriginAllowed,
  allowedOriginList,
};
