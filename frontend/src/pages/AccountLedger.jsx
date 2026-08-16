import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatINR, formatDateTime } from "@/lib/format";
import { PageHeader, Card, Badge, EmptyState, Field, Select, Input, Button } from "@/components/shared";
import { ArrowLeft } from "lucide-react";

const TYPE_LABELS = {
  opening: "Opening", retail_sale: "Retail Sale", wholesale_payment: "Wholesale Payment",
  purchase: "Purchase", transfer_in: "Transfer In", transfer_out: "Transfer Out",
  adjustment: "Adjustment", cc_payment: "Card Payment",
};
const TYPE_TONE = {
  opening: "slate", retail_sale: "green", wholesale_payment: "green", purchase: "red",
  transfer_in: "blue", transfer_out: "amber", adjustment: "violet", cc_payment: "red",
};

export default function AccountLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [txns, setTxns] = useState([]);
  const [filters, setFilters] = useState({ from_date: "", to_date: "", txn_type: "" });

  const load = useCallback(() => {
    const params = {};
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    if (filters.txn_type) params.txn_type = filters.txn_type;
    api.get(`/accounts/${id}/ledger`, { params }).then((r) => {
      setAccount(r.data.account);
      setTxns(r.data.transactions);
    }).catch(() => {});
  }, [id, filters]);

  useEffect(() => { load(); }, [load]);

  if (!account) return <div className="text-slate-400">Loading…</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <PageHeader
        title={account.name}
        subtitle={`${account.type.toUpperCase()}${account.bank_name ? ` · ${account.bank_name}` : ""}${account.last4 ? ` · ····${account.last4}` : ""}`}
        action={
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current Balance</div>
            <div className="font-mono font-bold text-2xl text-slate-900">{formatINR(account.current_balance)}</div>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="From"><Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={filters.txn_type} onChange={(e) => setFilters({ ...filters, txn_type: e.target.value })}>
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Button variant="outline" onClick={() => setFilters({ from_date: "", to_date: "", txn_type: "" })}>Clear</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {txns.length === 0 ? (
          <EmptyState title="No transactions" subtitle="Money movements for this account will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Debit</th>
                  <th className="px-4 py-3 font-semibold text-right">Credit</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(t.date)}</td>
                    <td className="px-4 py-3"><Badge tone={TYPE_TONE[t.txn_type]}>{TYPE_LABELS[t.txn_type] || t.txn_type}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">{t.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600">{t.direction === "debit" ? formatINR(t.amount) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{t.direction === "credit" ? formatINR(t.amount) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatINR(t.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
