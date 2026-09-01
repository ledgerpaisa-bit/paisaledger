import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import staffApi from "@/lib/staffApi";
import { apiError } from "@/lib/api";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in as staff? Skip straight to the billing counter.
  if (localStorage.getItem("mbt_staff_token")) {
    return <Navigate to="/billing" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await staffApi.post("/auth/staff/login", { username: username.trim().toLowerCase(), pin });
      localStorage.setItem("mbt_staff_token", res.data.access_token);
      localStorage.setItem("mbt_staff_info", JSON.stringify(res.data.staff));
      toast.success(`Welcome, ${res.data.staff.name}`);
      navigate("/billing");
    } catch (err) {
      const msg = apiError(err, "Login failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 bg-blue-600 flex items-center justify-center rounded-md">
            <Receipt size={20} className="text-white" />
          </div>
          <div className="font-display font-black text-lg tracking-tight text-slate-900">
            BILLING<span className="text-blue-600">COUNTER</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-6">
          <h1 className="font-display font-black text-2xl text-slate-900 tracking-tight text-center">Staff Login</h1>
          <p className="text-sm text-slate-500 mt-2 mb-6 text-center">
            Enter the username and PIN your shop owner gave you.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Username</label>
              <input
                data-testid="staff-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                placeholder="e.g. ramesh"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">PIN</label>
              <input
                data-testid="staff-login-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="current-password"
                className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 tracking-[0.3em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                placeholder="••••"
              />
            </div>
            {error && (
              <div data-testid="staff-login-error" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <button
              data-testid="staff-login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-400 text-center mt-6">
          Shop owner? <a href="/login" className="text-blue-600 hover:underline">Sign in here instead</a>
        </p>
      </div>
    </div>
  );
}
