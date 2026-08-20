import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=checking, false=unauth, obj=auth
  const [needsSetup, setNeedsSetup] = useState(null); // null=unknown, bool once known
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const s = await api.get("/auth/setup-status");
        setNeedsSetup(s.data.needs_setup);
      } catch {
        setNeedsSetup(false);
      }
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
    const res = await api.post("/auth/setup", { email, password, name });
    localStorage.setItem("mbt_token", res.data.access_token);
    setNeedsSetup(false);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mbt_token");
    setUser(false);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, needsSetup, loading, login, setup, logout }),
    [user, needsSetup, loading, login, setup, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
