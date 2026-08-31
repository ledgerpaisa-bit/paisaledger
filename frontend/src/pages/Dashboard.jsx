import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Card } from "@/components/shared";
import { accountTypeLabel } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import {
  Package, Wallet, CreditCard, PiggyBank, TrendingUp, ChevronRight,
  Banknote, Smartphone, Truck, ShoppingCart, Landmark, Coins, Plus, Boxes, Bell,
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
    <div className="bg-white border border-slate-200 rounded-md p-4 stagger-in h-full">
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

const MiniStat = ({ label, value, tone = "slate", isCount, testid, icon: Icon }) => {
  const t = TONES[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 relative">
      {Icon && (
        <div className={`absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center ${t.chip}`}>
          <Icon size={14} />
        </div>
      )}
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 pr-8">{label}</div>
      <div data-testid={testid} className={`font-mono font-semibold text-lg mt-1 ${t.text}`}>
        {isCount ? value : formatINR(value)}
      </div>
    </div>
  );
};

const Op = ({ children }) => (
  <div className="font-mono font-bold text-lg sm:text-xl lg:text-2xl text-slate-400 px-1 flex items-center justify-center h-6 sm:h-full w-full sm:w-auto">{children}</div>
);

const utilTone = (u) => {
  if (u > 70) return "rose";
  if (u > 30) return "amber";
  return "emerald";
};

const AccountIcon = ({ type }) => {
  if (type === "cash") return <Banknote size={16} />;
  if (type === "bank") return <Landmark size={16} />;
  return <Smartphone size={16} />;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="text-slate-400">Loading…</div>;

  const leftTotal = data.stock_value + data.total_paisa;
  const rightTotal = data.credit_card_outstanding + data.fixed_poonji + data.total_profit;
  const isBalanced = Math.abs(leftTotal - rightTotal) < 0.01;

  const quickActions = [
    { label: "Add Purchase", icon: ShoppingCart, tone: "emerald", to: "/purchases?new=1", tid: "qa-add-purchase" },
    { label: "Retail Sale", icon: Smartphone, tone: "blue", to: "/retail?new=1", tid: "qa-retail-sale" },
    { label: "Wholesale Supply", icon: Truck, tone: "violet", to: "/wholesale?new=1", tid: "qa-wholesale-supply" },
    { label: "Receive Payment", icon: Coins, tone: "emerald", to: "/payments?new=1", tid: "qa-receive-payment" },
    { label: "Add Cash/Bank/UPI", icon: Landmark, tone: "blue", to: "/accounts?new=1", tid: "qa-add-account" },
    { label: "Add Credit Card", icon: CreditCard, tone: "rose", to: "/credit-cards?new=1", tid: "qa-add-card" },
    { label: "Pay Credit Card Bill", icon: Coins, tone: "amber", to: "/credit-cards?pay=1", tid: "qa-pay-card-bill" },
    { label: "Add Fixed Poonji", icon: PiggyBank, tone: "violet", to: "/poonji?new=1", tid: "qa-add-poonji" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your complete business position at a glance.</p>
      </div>

      {data.due_reminders && data.due_reminders.length > 0 && (
        <div data-testid="due-reminders-alert" className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2"><Bell size={16} /> Credit Card Dues</div>
          <div className="space-y-1">
            {data.due_reminders.map((r) => (
              <div key={r.card_id} className="text-sm text-amber-900 flex flex-wrap gap-x-2">
                <span className="font-semibold">{r.name}</span>
                <span className={r.overdue ? "text-rose-600 font-semibold" : ""}>{r.overdue ? "OVERDUE" : `due in ${r.days_left}d`} ({formatDate(r.due_date)})</span>
                <span>· min {formatINR(r.min_due)}</span>
                <span>· outstanding {formatINR(r.outstanding)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORE BUSINESS POSITION — colorful equation, matches the reference mockup */}
      <div className="stagger-in">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-1.5 sm:gap-2">
          <div className="flex-1 min-w-[130px]">
            <SummaryCard label="Stock Value" value={data.stock_value} tone="blue" icon={Package} testid="summary-stock-value" />
          </div>
          <Op>+</Op>
          <div className="flex-1 min-w-[130px]">
            <SummaryCard label="Paisa (Cash+Bank)" value={data.total_paisa} tone="emerald" icon={Wallet} testid={TID.totalPaisa} />
          </div>
          <Op>=</Op>
          <div className="flex-1 min-w-[130px]">
            <SummaryCard label="Credit Card Outstanding" value={data.credit_card_outstanding} tone="rose" icon={CreditCard} testid="summary-cc-outstanding" />
          </div>
          <Op>+</Op>
          <div className="flex-1 min-w-[130px]">
            <SummaryCard label="Fixed Poonji" value={data.fixed_poonji} tone="violet" icon={PiggyBank} testid="summary-fixed-poonji" />
          </div>
          <Op>+</Op>
          <div className="flex-1 min-w-[130px]">
            <SummaryCard label="Profit" value={data.total_profit} tone="amber" icon={TrendingUp} testid="summary-profit" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-2.5 bg-white border border-slate-200 rounded-md px-5 py-3">
          <div className="text-xs sm:text-sm text-slate-500">
            Total (Left Side): <span className="font-mono font-bold text-emerald-600" data-testid="cbp-left-total">{formatINR(leftTotal)}</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-500">
            Total (Right Side): <span className="font-mono font-bold text-rose-600" data-testid="cbp-right-total">{formatINR(rightTotal)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs sm:text-sm text-slate-500">Business Status:</span>
            <span
              data-testid="business-status-badge"
              className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {isBalanced ? "Balanced" : "Out of balance"}
            </span>
          </div>
        </div>
      </div>

      {/* BUSINESS VOLUME — one row of 5, matches the reference mockup exactly */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStat label="Total Stock (Units)" value={data.total_stock_units} isCount tone="blue" icon={Smartphone} testid="vol-stock-units" />
        <MiniStat label="Total Purchases" value={data.total_purchase} tone="emerald" icon={Package} testid="vol-total-purchase" />
        <MiniStat label="Total Sales (Retail)" value={data.retail_sales_total} tone="violet" icon={ShoppingCart} testid="vol-retail-sales" />
        <MiniStat label="Total Sales (Wholesale)" value={data.wholesale_sales_total} tone="teal" icon={Truck} testid="vol-wholesale-sales" />
        <MiniStat label="Total Receivable" value={data.wholesale_receivable} tone="rose" icon={Coins} testid="liq-receivable" />
      </div>

      {/* STOCK VALUE SUMMARY / PAISA SUMMARY / CREDIT CARD SUMMARY — side by side, matches the reference mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Stock Value Summary</h3>
            <span className="font-mono font-bold text-slate-900" data-testid="stock-summary-total">{formatINR(data.stock_value)}</span>
          </div>
          {(!data.stock_by_brand || data.stock_by_brand.length === 0) ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No stock in hand yet. Add a purchase to see brand-wise stock value here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide font-semibold text-slate-500 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-semibold">Brand</th>
                    <th className="px-5 py-2.5 font-semibold">Models</th>
                    <th className="px-5 py-2.5 font-semibold">Units</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock_by_brand.map((b) => (
                    <tr key={b.brand} data-testid={`stock-summary-row-${b.brand}`} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2.5 font-medium text-slate-900">{b.brand}</td>
                      <td className="px-5 py-2.5 text-slate-600">{b.models}</td>
                      <td className="px-5 py-2.5 text-slate-600">{b.units}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900">{formatINR(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={() => navigate("/stock")}
            data-testid="stock-summary-view-all"
            className="w-full flex items-center justify-center gap-1 text-sm font-semibold text-blue-600 hover:underline px-5 py-3 border-t border-slate-200"
          >
            View All Stock <ChevronRight size={14} />
          </button>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Paisa Summary</h3>
            <span className="font-mono font-bold text-slate-900" data-testid="paisa-summary-total">{formatINR(data.total_paisa)}</span>
          </div>
          <div>
            {[
              { key: "cash", label: "Cash in Hand", value: data.cash_balance, type: "cash" },
              { key: "bank", label: "Bank Accounts", value: data.total_bank, type: "bank" },
              { key: "upi", label: "UPI / Other", value: data.total_upi, type: "upi" },
            ].map((row) => (
              <div
                key={row.key}
                data-testid={`paisa-summary-row-${row.key}`}
                className="flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                    <AccountIcon type={row.type} />
                  </div>
                  <span className="font-medium text-slate-900 text-sm">{row.label}</span>
                </div>
                <span className="font-mono font-semibold text-slate-900 text-sm">{formatINR(row.value)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/accounts")}
            data-testid="paisa-summary-view-all"
            className="w-full flex items-center justify-center gap-1 text-sm font-semibold text-blue-600 hover:underline px-5 py-3 border-t border-slate-200"
          >
            View All Accounts <ChevronRight size={14} />
          </button>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Credit Card Summary</h3>
            <span className="font-mono font-bold text-slate-900" data-testid="card-summary-total">{formatINR(data.credit_card_outstanding)}</span>
          </div>
          {(!data.card_summary || data.card_summary.length === 0) ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No credit cards yet. Add one to see per-card outstanding here.
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {data.card_summary.map((c) => {
                const barClass = { rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500" }[utilTone(c.utilization)];
                return (
                  <div key={c.id} data-testid={`card-summary-row-${c.id}`}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-900">
                        {c.name}{c.bank_name ? ` · ${c.bank_name}` : ""}{c.last4 ? ` ····${c.last4}` : ""}
                      </span>
                      <span className="font-mono text-slate-600 text-xs sm:text-sm whitespace-nowrap ml-2">
                        {formatINR(c.outstanding)} / {formatINR(c.limit)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barClass}`}
                        style={{ width: `${Math.min(c.utilization, 100)}%` }}
                      />
                    </div>
                    {c.due_date && c.outstanding > 0.001 && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Due {formatDate(c.due_date)}{c.min_due > 0 ? ` · Min due ${formatINR(c.min_due)}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => navigate("/credit-cards")}
            data-testid="card-summary-view-all"
            className="w-full flex items-center justify-center gap-1 text-sm font-semibold text-blue-600 hover:underline px-5 py-3 border-t border-slate-200"
          >
            View All Cards <ChevronRight size={14} />
          </button>
        </Card>
      </div>

      {/* WHOLESALE OUTSTANDING + QUICK ACTIONS — matches the reference mockup's bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Wholesale Outstanding (Receivable)</h3>
            <span className="font-mono font-bold text-slate-900" data-testid="wholesale-summary-total">{formatINR(data.wholesale_receivable)}</span>
          </div>
          {(!data.wholesale_by_shop || data.wholesale_by_shop.length === 0) ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No wholesale receivable right now. Amounts shops still owe you will show up here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
              {data.wholesale_by_shop.map((s) => (
                <button
                  key={s.customer_id}
                  data-testid={`wholesale-summary-row-${s.customer_id}`}
                  onClick={() => navigate("/customers")}
                  className="flex items-center gap-3 border border-slate-200 rounded-md px-4 py-3 hover:bg-slate-50 hover:border-blue-300 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Truck size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{s.name}</div>
                    <div className="font-mono font-semibold text-amber-600 text-sm">{formatINR(s.outstanding)}</div>
                    <div className="text-[11px] text-slate-400">Outstanding</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate("/customers")}
            data-testid="wholesale-summary-view-all"
            className="w-full flex items-center justify-center gap-1 text-sm font-semibold text-blue-600 hover:underline px-5 py-3 border-t border-slate-200"
          >
            View All Customers <ChevronRight size={14} />
          </button>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-display font-bold text-slate-900">Quick Actions</h3>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              const t = TONES[qa.tone];
              return (
                <button
                  key={qa.tid}
                  data-testid={qa.tid}
                  onClick={() => navigate(qa.to)}
                  className="flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-md border border-slate-200 text-xs font-medium text-slate-700 text-center hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center ${t.chip}`}>
                    <Icon size={18} />
                  </span>
                  {qa.label}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ACCOUNT-WISE BALANCE — not in the reference mockup, kept for real account-ledger navigation */}
      <Card>
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
                    <AccountIcon type={a.type} />
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
    </div>
  );
}
