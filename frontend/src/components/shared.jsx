import { useEffect } from "react";
import { formatINR } from "@/lib/format";
import { X } from "lucide-react";

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-md ${className}`}>{children}</div>
);

export const StatCard = ({ label, value, accent = "slate", sub, testid, big }) => {
  const colors = {
    slate: "text-slate-900",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    violet: "text-violet-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-md p-5 stagger-in">
      <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">{label}</div>
      <div
        data-testid={testid}
        className={`font-mono font-semibold mt-2 ${big ? "text-3xl lg:text-4xl" : "text-2xl"} ${colors[accent]}`}
      >
        {typeof value === "number" ? formatINR(value) : value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
};

export const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md text-sm font-semibold transition-colors disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Field = ({ label, children, hint }) => (
  <div>
    <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const Input = (props) => (
  <input
    {...props}
    className={`w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors ${props.className || ""}`}
  />
);

export const Select = ({ children, ...props }) => (
  <select
    {...props}
    className={`w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors ${props.className || ""}`}
  >
    {children}
  </select>
);

export const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors ${props.className || ""}`}
  />
);

export const Modal = ({ open, onClose, title, children, testid }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        data-testid={testid}
        className="relative bg-white border border-slate-200 rounded-md w-full max-w-lg shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-display font-bold text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Badge = ({ children, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const EmptyState = ({ title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-md bg-slate-100 border border-slate-200 mb-4" />
    <div className="font-display font-bold text-slate-900">{title}</div>
    {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-sm">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const accountTypeTone = (type) =>
  type === "cash" ? "green" : type === "bank" ? "blue" : "violet";

export const accountTypeLabel = (type) =>
  type === "cash" ? "Cash" : type === "bank" ? "Bank" : "UPI";
