import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=checking, false=unauth, obj=auth
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("mbt_token");
      if (!token) {
        setUser(false);
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch {
        localStorage.removeItem("mbt_token");
        setUser(false);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("mbt_token", res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const setup = useCallback(async (email, password, name) => {
    const res = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("mbt_token", res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // Two-step, OTP-verified signup: request a code, then verify it to actually
  // create the account.
  const requestSignupOtp = useCallback(async (email, password, name) => {
    const res = await api.post("/auth/register/request-otp", { email, password, name });
    return res.data;
  }, []);

  const verifySignupOtp = useCallback(async (email, otp) => {
    const res = await api.post("/auth/register/verify-otp", { email, otp });
    localStorage.setItem("mbt_token", res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mbt_token");
    setUser(false);
    window.location.href = "/login";
  }, []);

  // Used by the OAuth callback page: the backend already minted a JWT after a
  // successful Google/Facebook/Apple sign-in, we just need to adopt it.
  const loginWithToken = useCallback(async (token) => {
    localStorage.setItem("mbt_token", token);
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, setup, logout, loginWithToken, requestSignupOtp, verifySignupOtp }),
    [user, loading, login, setup, logout, loginWithToken, requestSignupOtp, verifySignupOtp]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
