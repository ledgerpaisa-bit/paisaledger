import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Smartphone,
  Truck,
  Package,
  CreditCard,
  Landmark,
  TrendingUp,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TID } from "@/constants/testIds/app";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/accounts", label: "Accounts", icon: Wallet, key: "accounts" },
  { to: "/retail", label: "Retail Sales", icon: Smartphone, key: "retail" },
  { to: "/wholesale", label: "Wholesale", icon: Truck, key: "wholesale" },
  { to: "/stock", label: "Stock", icon: Package, key: "stock" },
  { to: "/credit-cards", label: "Credit Cards", icon: CreditCard, key: "credit-cards" },
  { to: "/poonji", label: "Fixed Poonji", icon: Landmark, key: "poonji" },
  { to: "/profit", label: "Profit", icon: TrendingUp, key: "profit" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="font-display font-black text-lg text-white tracking-tight leading-none">
          MOBILE<span className="text-blue-500">TRACKER</span>
        </div>
        <div className="text-xs text-slate-400 mt-1">Balance & Profit</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              data-testid={TID.nav(item.key)}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 mb-2">
          <div className="text-sm text-white font-medium truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 truncate">{user?.email}</div>
        </div>
        <button
          data-testid={TID.logoutBtn}
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-left">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-slate-900 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden mr-3 text-slate-700"
            onClick={() => setOpen(!open)}
            data-testid="mobile-menu-toggle"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="font-display font-bold text-slate-900">Business Console</div>
        </header>
        <main className="p-4 lg:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
