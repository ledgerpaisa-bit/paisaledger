import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) {
      toast.error("Sign-in failed. Please try again.");
      navigate("/login", { replace: true });
      return;
    }
    loginWithToken(token)
      .then(() => navigate("/", { replace: true }))
      .catch(() => {
        toast.error("Sign-in failed. Please try again.");
        navigate("/login", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
      Signing you in…
    </div>
  );
}
