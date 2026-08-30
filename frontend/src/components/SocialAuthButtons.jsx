import { API } from "@/lib/api";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M18 9a9 9 0 1 0-10.4 8.89v-6.29H5.31V9h2.29V7.02c0-2.26 1.35-3.51 3.41-3.51.99 0 2.02.18 2.02.18v2.22h-1.14c-1.12 0-1.47.7-1.47 1.42V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9Z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#000"
      d="M14.94 6.13a3.5 3.5 0 0 0-1.67 2.94c0 1.6.94 2.68 1.98 3.28-.36 1.07-.9 2.02-1.6 2.87-.65.79-1.35 1.5-2.28 1.5-.9 0-1.2-.55-2.27-.55-1.05 0-1.4.57-2.24.57-.9 0-1.6-.75-2.28-1.6-1.35-1.7-2.4-4.4-1.05-6.55.7-1.13 1.86-1.85 3.05-1.87.85-.02 1.6.6 2.16.6.55 0 1.5-.74 2.53-.63a3.1 3.1 0 0 1 2.67 1.44Zm-3.02-2.86c.5-.6.85-1.42.76-2.27-.72.03-1.6.5-2.12 1.1-.46.53-.87 1.38-.76 2.2.8.06 1.6-.4 2.12-1.03Z"
    />
  </svg>
);

const BUTTON_CLASS =
  "w-full h-11 flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors";

export default function SocialAuthButtons() {
  return (
    <div className="space-y-2.5">
      <a href={`${API}/auth/google/login`} className={BUTTON_CLASS}>
        <GoogleIcon /> Continue with Google
      </a>
      <a href={`${API}/auth/facebook/login`} className={BUTTON_CLASS}>
        <FacebookIcon /> Continue with Facebook
      </a>
      <a href={`${API}/auth/apple/login`} className={BUTTON_CLASS}>
        <AppleIcon /> Continue with Apple
      </a>
    </div>
  );
}
