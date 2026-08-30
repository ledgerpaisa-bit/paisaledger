import { useEffect, useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Smartphone, UserPlus, Check, X, ShieldCheck } from "lucide-react";
import SocialAuthButtons from "@/components/SocialAuthButtons";

const TID = {
  name: "setup-name-input",
  email: "setup-email-input",
  password: "setup-password-input",
  confirm: "setup-confirm-input",
  submit: "setup-submit-button",
  otp: "setup-otp-input",
  otpSubmit: "setup-otp-submit-button",
  error: "setup-error-message",
};

const RESEND_COOLDOWN_SECONDS = 45;

const Rule = ({ ok, label }) => (
  <div className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600" : "text-slate-400"}`}>
    {ok ? <Check size={13} /> : <X size={13} />} {label}
  </div>
);

export default function Setup() {
  const { user, requestSignupOtp, verifySignupOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // "form" | "otp"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (user) return <Navigate to="/" replace />;

  const lenOk = password.length >= 8;
  const matchOk = confirm.length > 0 && password === confirm;
  const canSubmit = lenOk && matchOk && email.includes("@");

  const sendOtp = async () => {
    setError("");
    if (!lenOk) return setError("Password must be at least 8 characters long");
    if (!matchOk) return setError("Passwords do not match");
    setLoading(true);
    try {
      await requestSignupOtp(email, password, name);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(`Verification code sent to ${email}`);
    } catch (err) {
      const msg = apiError(err, "Could not send verification code");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitForm = (e) => {
    e.preventDefault();
    sendOtp();
  };

  const resend = () => {
    if (cooldown > 0 || loading) return;
    sendOtp();
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) return setError("Enter the 6-digit code from your email");
    setLoading(true);
    try {
      await verifySignupOtp(email, otp.trim());
      toast.success("Account created!");
      navigate("/");
    } catch (err) {
      const msg = apiError(err, "Verification failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center rounded-md">
              <Smartphone size={20} className="text-white" />
            </div>
            <div className="font-display font-black text-lg tracking-tight text-slate-900">
              MOBILE<span className="text-blue-600">TRACKER</span>
            </div>
          </div>

          {step === "form" ? (
            <>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 mb-4">
                <UserPlus size={14} /> Create your account
              </div>
              <h1 className="font-display font-black text-3xl text-slate-900 tracking-tight">
                Sign up
              </h1>
              <p className="text-sm text-slate-500 mt-2 mb-8">
                Create your own account to track your business — your data stays private to you, and your password is hashed and never stored in plain text.
              </p>

              <SocialAuthButtons />

              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-xs text-slate-400">OR</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <form onSubmit={submitForm} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Your name (optional)</label>
                  <input
                    data-testid={TID.name}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Email</label>
                  <input
                    data-testid={TID.email}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
                  <input
                    data-testid={TID.password}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                    placeholder="Create a password"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Confirm password</label>
                  <input
                    data-testid={TID.confirm}
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                    placeholder="Re-enter password"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Rule ok={lenOk} label="At least 8 characters" />
                  <Rule ok={matchOk} label="Passwords match" />
                </div>

                {error && (
                  <div data-testid={TID.error} className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}
                <button
                  data-testid={TID.submit}
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full h-11 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending code…" : "Send verification code"}
                </button>
                <p className="text-sm text-slate-500 text-center pt-2">
                  Already have an account?{" "}
                  <Link to="/login" className="text-blue-600 font-semibold hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 mb-4">
                <ShieldCheck size={14} /> Check your inbox
              </div>
              <h1 className="font-display font-black text-3xl text-slate-900 tracking-tight">
                Verify your email
              </h1>
              <p className="text-sm text-slate-500 mt-2 mb-8">
                We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>. Enter it below to finish creating your account.
              </p>

              <form onSubmit={submitOtp} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Verification code</label>
                  <input
                    data-testid={TID.otp}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                    placeholder="••••••"
                  />
                </div>

                {error && (
                  <div data-testid={TID.error} className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  data-testid={TID.otpSubmit}
                  type="submit"
                  disabled={loading || otp.trim().length !== 6}
                  className="w-full h-11 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Verifying…" : "Verify & create account"}
                </button>

                <div className="flex items-center justify-between text-sm pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                    className="text-slate-500 hover:underline"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0 || loading}
                    className="text-blue-600 font-semibold hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:block relative bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1595411425732-e69c1abe2763?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMG1pbmltYWxpc3QlMjBnZW9tZXRyeXxlbnwwfHx8fDE3ODY4NjA5NDR8MA&ixlib=rb-4.1.0&q=85"
          alt="Abstract geometry"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="font-display font-black text-4xl tracking-tight leading-tight">
            Your business,<br />your keys.
          </div>
          <p className="text-slate-200 mt-3 max-w-md">
            Create your own private account. Only you can access your own data.
          </p>
        </div>
      </div>
    </div>
  );
}
