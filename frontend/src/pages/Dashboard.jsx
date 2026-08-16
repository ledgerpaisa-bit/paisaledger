import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatINR } from "@/lib/format";
import { PageHeader, Card, StatCard, Badge, EmptyState, Button } from "@/components/shared";
import { accountTypeTone, accountTypeLabel } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { ChevronRight, Wallet, Banknote, Smartphone } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-slate-400">Loading…</div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Account balances, receivables and profit at a glance." />

      {/* Total Paisa hero */}
      <div className="bg-slate-900 rounded-md p-6 lg:p-8 mb-6 stagger-in relative overflow-hidden">
        <div className="text-xs uppercase tracking-widest font-semibold text-blue-400">Total Paisa</div>
        <div
          data-testid={TID.totalPaisa}
          className="font-mono font-bold text-4xl lg:text-6xl text-white mt-2"
        >
          {formatINR(data.total_paisa)}
        </div>
        <p className="text-slate-400 text-sm mt-2">
          Money actually held across all active Cash, Bank & UPI accounts.
        </p>
      </div>

      {/* Type totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Cash Balance" value={data.cash_balance} accent="emerald" testid={TID.statCash} />
        <StatCard label="Total Bank Balance" value={data.total_bank} accent="blue" testid={TID.statBank} />
        <StatCard label="Total UPI Balance" value={data.total_upi} accent="violet" testid={TID.statUpi} />
      </div>

      {/* Account breakdown + other metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900">Account-wise Balance</h3>
            <span className="text-xs text-slate-400">Click any account to open its ledger</span>
          </div>
          {data.accounts.length === 0 ? (
            <EmptyState
              title="No accounts yet"
              subtitle="Add your Cash, Bank and UPI accounts to start tracking Paisa."
              action={<Button onClick={() => navigate("/accounts")}>Go to Accounts</Button>}
            />
          ) : (
            <div>
              {data.accounts.map((a) => (
                <button
                  key={a.id}
                  data-testid={TID.accountBreakdownRow(a.id)}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                      {a.type === "cash" ? <Banknote size={18} /> : a.type === "bank" ? <Wallet size={18} /> : <Smartphone size={18} />}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-400">
                        {accountTypeLabel(a.type)}{a.bank_name ? ` · ${a.bank_name}` : ""}{a.last4 ? ` ····${a.last4}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-slate-900">{formatINR(a.current_balance)}</span>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </button>
              ))}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-t border-slate-200">
                <span className="font-display font-bold text-slate-900">Total Paisa</span>
                <span className="font-mono font-bold text-blue-600 text-lg">{formatINR(data.total_paisa)}</span>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <StatCard label="Total Profit" value={data.total_profit} accent="emerald" sub={`${data.total_sales} retail sales`} />
          <StatCard label="Wholesale Receivable" value={data.wholesale_receivable} accent="amber" sub="Not counted in Paisa until paid" />
          <StatCard label="Credit Card Outstanding" value={data.credit_card_outstanding} accent="rose" />
          <StatCard label="Stock Value" value={data.stock_value} accent="slate" sub={`${data.stock_count} items in stock`} />
          <StatCard label="Fixed Poonji (Capital)" value={data.fixed_poonji} accent="violet" sub="Invested capital, kept separate from Paisa" />
        </div>
      </div>
    </div>
  );
}
