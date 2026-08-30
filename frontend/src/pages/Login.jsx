import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { TID } from "@/constants/testIds/app";
import { Smartphone } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      const msg = apiError(err, "Login failed");
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
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center rounded-md">
              <Smartphone size={20} className="text-white" />
            </div>
            <div className="font-display font-black text-lg tracking-tight text-slate-900">
              MOBILE<span className="text-blue-600">TRACKER</span>
            </div>
          </div>
          <h1 className="font-display font-black text-3xl text-slate-900 tracking-tight">Sign in</h1>
          <p className="text-sm text-slate-500 mt-2 mb-8">
            Access your business balance & profit console.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Email</label>
              <input
                data-testid={TID.loginEmail}
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
                data-testid={TID.loginPassword}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div data-testid={TID.loginError} className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <button
              data-testid={TID.loginSubmit}
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-sm text-slate-500 text-center pt-2">
              Don't have an account?{" "}
              <Link to="/setup" className="text-blue-600 font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </form>
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
            Every rupee,<br />in its place.
          </div>
          <p className="text-slate-200 mt-3 max-w-md">
            Track cash, bank & UPI balances, retail and wholesale sales, and profit — all in one console.
          </p>
        </div>
      </div>
    </div>
  );
}
