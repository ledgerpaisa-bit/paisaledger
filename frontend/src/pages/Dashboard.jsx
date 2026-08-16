import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/shared";
import { accountTypeLabel } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import {
  Package, Wallet, CreditCard, PiggyBank, TrendingUp, ChevronRight,
  Banknote, Smartphone, Truck, ShoppingCart, Landmark, Coins, Plus, Boxes,
} from "lucide-react";

const TONES = {
  slate: { text: "text-slate-900", chip: "bg-slate-100 text-slate-600" },
  blue: { text: "text-blue-600", chip: "bg-blue-50 text-blue-600" },
  emerald: { text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600" },
  rose: { text: "text-rose-600", chip: "bg-rose-50 text-rose-600" },
  violet: { text: "text-violet-600", chip: "bg-violet-50 text-violet-600" },
  amber: { text: "text-amber-600", chip: "bg-amber-50 text-amber-600" },
  teal: { text: "text-teal-600", chip: "bg-teal-50 text-teal-600" },
};

const SummaryCard = ({ label, value, tone = "slate", icon: Icon, testid, isCount }) => {
  const t = TONES[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 stagger-in">
      <div className={`w-9 h-9 rounded-md flex items-center justify-center mb-3 ${t.chip}`}>
        <Icon size={18} />
      </div>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</div>
      <div data-testid={testid} className={`font-mono font-bold text-xl lg:text-2xl mt-1 ${t.text}`}>
        {isCount ? value : formatINR(value)}
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, tone = "slate", isCount, testid }) => {
  const t = TONES[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">{label}</div>
      <div data-testid={testid} className={`font-mono font-semibold text-lg mt-1 ${t.text}`}>
        {isCount ? value : formatINR(value)}
      </div>
    </div>
  );
};

const Term = ({ label, value, tone }) => {
  const t = TONES[tone];
  return (
    <div className="min-w-[120px]">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</div>
      <div className={`font-mono font-bold text-lg lg:text-xl ${t.text}`}>{formatINR(value)}</div>
    </div>
  );
};

const Op = ({ children }) => (
  <div className="font-mono font-bold text-xl lg:text-2xl text-slate-500 px-1">{children}</div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-slate-400">Loading…</div>;

  const leftTotal = data.stock_value + data.total_paisa;
  const rightTotal = data.credit_card_outstanding + data.fixed_poonji + data.total_profit;

  const quickActions = [
    { label: "Add Purchase", icon: ShoppingCart, to: "/purchases?new=1", tid: "qa-add-purchase" },
    { label: "Retail Sale", icon: Smartphone, to: "/retail?new=1", tid: "qa-retail-sale" },
    { label: "Wholesale Supply", icon: Truck, to: "/wholesale?new=1", tid: "qa-wholesale-supply" },
    { label: "Receive Payment", icon: Coins, to: "/payments?new=1", tid: "qa-receive-payment" },
    { label: "Add Cash/Bank/UPI", icon: Landmark, to: "/accounts?new=1", tid: "qa-add-account" },
    { label: "Add Credit Card", icon: CreditCard, to: "/credit-cards?new=1", tid: "qa-add-card" },
    { label: "Add Fixed Poonji", icon: PiggyBank, to: "/poonji?new=1", tid: "qa-add-poonji" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your complete business position at a glance.</p>
      </div>

      {/* CORE BUSINESS POSITION */}
      <div className="bg-slate-900 rounded-md p-5 lg:p-6 stagger-in">
        <div className="text-[11px] uppercase tracking-widest font-semibold text-blue-400 mb-4">
          Core Business Position
        </div>
        <div className="flex flex-wrap items-end gap-y-4 gap-x-1">
          <Term label="Stock Value" value={data.stock_value} tone="blue" />
          <Op>+</Op>
          <Term label="Paisa" value={data.total_paisa} tone="emerald" />
          <Op>=</Op>
          <Term label="Card Outstanding" value={data.credit_card_outstanding} tone="rose" />
          <Op>+</Op>
          <Term label="Fixed Poonji" value={data.fixed_poonji} tone="violet" />
          <Op>+</Op>
          <Term label="Profit" value={data.total_profit} tone="amber" />
        </div>
        <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Assets side: <span className="font-mono font-semibold text-white" data-testid="cbp-left-total">{formatINR(leftTotal)}</span>
          </div>
          <div className="text-xs text-slate-400">
            Sources side: <span className="font-mono font-semibold text-white" data-testid="cbp-right-total">{formatINR(rightTotal)}</span>
          </div>
        </div>
      </div>

      {/* 5 SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Stock Value" value={data.stock_value} tone="blue" icon={Package} testid="summary-stock-value" />
        <SummaryCard label="Paisa" value={data.total_paisa} tone="emerald" icon={Wallet} testid={TID.totalPaisa} />
        <SummaryCard label="Credit Card Outstanding" value={data.credit_card_outstanding} tone="rose" icon={CreditCard} testid="summary-cc-outstanding" />
        <SummaryCard label="Fixed Poonji" value={data.fixed_poonji} tone="violet" icon={PiggyBank} testid="summary-fixed-poonji" />
        <SummaryCard label="Profit" value={data.total_profit} tone="amber" icon={TrendingUp} testid="summary-profit" />
      </div>

      {/* BUSINESS VOLUME */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Business Volume</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Total Stock Units" value={data.total_stock_units} isCount tone="slate" testid="vol-stock-units" />
          <MiniStat label="Total Purchase" value={data.total_purchase} tone="blue" testid="vol-total-purchase" />
          <MiniStat label="Retail Sales" value={data.retail_sales_total} tone="emerald" testid="vol-retail-sales" />
          <MiniStat label="Wholesale Sales" value={data.wholesale_sales_total} tone="teal" testid="vol-wholesale-sales" />
        </div>
      </div>

      {/* LIQUIDITY & LIMITS */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Liquidity &amp; Limits</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MiniStat label="Wholesale Receivable" value={data.wholesale_receivable} tone="amber" testid="liq-receivable" />
          <MiniStat label="Cash Balance" value={data.cash_balance} tone="emerald" testid={TID.statCash} />
          <MiniStat label="Total Bank Balance" value={data.total_bank} tone="blue" testid={TID.statBank} />
          <MiniStat label="Total UPI Balance" value={data.total_upi} tone="violet" testid={TID.statUpi} />
          <MiniStat label="Available Card Limit" value={data.available_credit_limit} tone="teal" testid="liq-available-limit" />
        </div>
      </div>

      {/* ACCOUNT-WISE + QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Account-wise Balance</h3>
            <span className="text-xs text-slate-400">Click to open ledger</span>
          </div>
          {data.accounts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No accounts yet. Add Cash, Bank or UPI accounts to start tracking Paisa.
            </div>
          ) : (
            <div>
              {data.accounts.map((a) => (
                <button
                  key={a.id}
                  data-testid={TID.accountBreakdownRow(a.id)}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                      {a.type === "cash" ? <Banknote size={16} /> : a.type === "bank" ? <Landmark size={16} /> : <Smartphone size={16} />}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{a.name}</div>
                      <div className="text-xs text-slate-400">
                        {accountTypeLabel(a.type)}{a.bank_name ? ` · ${a.bank_name}` : ""}{a.last4 ? ` ····${a.last4}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 text-sm">{formatINR(a.current_balance)}</span>
                    <ChevronRight size={15} className="text-slate-300" />
                  </div>
                </button>
              ))}
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200">
                <span className="font-display font-bold text-slate-900 text-sm">Total Paisa</span>
                <span className="font-mono font-bold text-emerald-600">{formatINR(data.total_paisa)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-display font-bold text-slate-900">Quick Actions</h3>
          </div>
          <div className="p-3 grid grid-cols-1 gap-2">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.tid}
                  data-testid={qa.tid}
                  onClick={() => navigate(qa.to)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                    <Icon size={15} />
                  </span>
                  {qa.label}
                  <Plus size={14} className="ml-auto text-slate-300" />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
