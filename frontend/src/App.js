import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AccountLedger from "@/pages/AccountLedger";
import Retail from "@/pages/Retail";
import Wholesale from "@/pages/Wholesale";
import Stock from "@/pages/Stock";
import CreditCards from "@/pages/CreditCards";
import Poonji from "@/pages/Poonji";
import Profit from "@/pages/Profit";
import Settings from "@/pages/Settings";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading || user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Toaster position="bottom-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="accounts/:id" element={<AccountLedger />} />
              <Route path="retail" element={<Retail />} />
              <Route path="stock" element={<Stock />} />
              <Route path="purchases" element={<Stock />} />
              <Route path="wholesale" element={<Wholesale defaultTab="supplies" />} />
              <Route path="customers" element={<Wholesale defaultTab="customers" />} />
              <Route path="payments" element={<Wholesale defaultTab="payments" />} />
              <Route path="credit-cards" element={<CreditCards />} />
              <Route path="poonji" element={<Poonji />} />
              <Route path="profit" element={<Profit />} />
              <Route path="reports" element={<Profit />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
