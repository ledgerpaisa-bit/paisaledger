import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { formatINR, formatDateTime } from "@/lib/format";
import { PageHeader, Card, Badge, EmptyState, Field, Select, Input, Button } from "@/components/shared";
import { ArrowLeft } from "lucide-react";

const KIND_LABELS = { spend: "Spend / Purchase", payment: "Payment" };
const KIND_TONE = { spend: "red", payment: "green" };

export default function CreditCardLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [txns, setTxns] = useState([]);
  const [filters, setFilters] = useState({ from_date: "", to_date: "", kind: "" });

  const load = useCallback(() => {
    const params = {};
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    if (filters.kind) params.kind = filters.kind;
    api.get(`/creditcards/${id}/ledger`, { params }).then((r) => {
      setCard(r.data.card);
      setTxns(r.data.transactions);
    }).catch(() => {});
  }, [id, filters]);

  useEffect(() => { load(); }, [load]);

  if (!card) return <div className="text-slate-400">Loading…</div>;
  const available = (card.limit || 0) - (card.outstanding || 0);

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <PageHeader
        title={card.name}
        subtitle={`${card.bank_name || "Credit Card"}${card.last4 ? ` · ····${card.last4}` : ""}`}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Outstanding</div><div className="font-mono font-semibold text-xl text-rose-600 mt-1" data-testid="cardledger-outstanding">{formatINR(card.outstanding)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Credit Limit</div><div className="font-mono font-semibold text-xl text-slate-900 mt-1">{formatINR(card.limit)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Available Limit</div><div className="font-mono font-semibold text-xl text-teal-600 mt-1" data-testid="cardledger-available">{formatINR(available)}</div></Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="From"><Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
              <option value="">All types</option>
              <option value="spend">Spend / Purchase</option>
              <option value="payment">Payment</option>
            </Select>
          </Field>
          <Button variant="outline" onClick={() => setFilters({ from_date: "", to_date: "", kind: "" })}>Clear</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {txns.length === 0 ? (
          <EmptyState title="No transactions" subtitle="Spends, purchases and payments for this card will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Description / Reference</th>
                  <th className="px-4 py-3 font-semibold text-right">Charge</th>
                  <th className="px-4 py-3 font-semibold text-right">Payment</th>
                  <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(t.date)}</td>
                    <td className="px-4 py-3"><Badge tone={KIND_TONE[t.kind]}>{KIND_LABELS[t.kind] || t.kind}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">
                      {t.description || (t.kind === "payment" ? "Bill payment" : "Card spend")}
                      {t.account_name && <span className="text-xs text-slate-400"> · from {t.account_name}</span>}
                      <span className="block text-[10px] text-slate-300 font-mono">ref {String(t.id).slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600">{t.kind === "spend" ? formatINR(t.amount) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{t.kind === "payment" ? formatINR(t.amount) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatINR(t.running_outstanding)}</td>
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
