import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDateTime, formatDate } from "@/lib/format";
import { PageHeader, Card, Badge, EmptyState, Field, Select, Input, Button } from "@/components/shared";
import { ArrowLeft, FileDown, FileText, RotateCcw } from "lucide-react";

const KIND_LABELS = { spend: "Spend / Purchase", payment: "Payment", refund: "Credit / Refund" };
const KIND_TONE = { spend: "red", payment: "green", refund: "violet" };

export default function CreditCardLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [txns, setTxns] = useState([]);
  const [filters, setFilters] = useState({ from_date: "", to_date: "", kind: "" });
  const [stmt, setStmt] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    if (filters.kind) params.kind = filters.kind;
    api.get(`/creditcards/${id}/ledger`, { params }).then((r) => { setCard(r.data.card); setTxns(r.data.transactions); }).catch(() => {});
  }, [id, filters]);
  useEffect(() => { load(); }, [load]);

  const openStatement = () => {
    const params = {};
    if (filters.from_date) params.from_date = filters.from_date;
    if (filters.to_date) params.to_date = filters.to_date;
    api.get(`/creditcards/${id}/statement`, { params }).then((r) => setStmt(r.data)).catch(() => {});
  };

  const exportCSV = () => {
    const header = ["Date", "Type", "Description", "Charge", "Payment", "Running Outstanding", "Reference"];
    const lines = txns.map((t) => [formatDate(t.date), KIND_LABELS[t.kind] || t.kind, (t.description || "").replace(/,/g, " "),
      t.kind === "spend" ? t.amount : "", t.kind !== "spend" ? t.amount : "", t.running_outstanding, String(t.id).slice(0, 8)]);
    const csv = [header, ...lines].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${card.name}-statement.csv`; a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(String(card.name), 14, 18);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${card.bank_name || ""} ${card.last4 ? "····" + card.last4 : ""}`.trim(), 14, 24);
    let startY = 32;
    if (stmt) {
      doc.setFontSize(9);
      doc.text(`Opening ${formatINR(stmt.opening_balance)}  |  Charges ${formatINR(stmt.charges)}  |  Payments ${formatINR(stmt.payments)}  |  Refunds ${formatINR(stmt.refunds)}`, 14, 30);
      doc.text(`Closing ${formatINR(stmt.closing_outstanding)}  |  Available ${formatINR(stmt.available)}`, 14, 35);
      startY = 41;
    }
    const src = stmt ? stmt.transactions : txns;
    const rows = src.map((t) => [formatDate(t.date), KIND_LABELS[t.kind] || t.kind, t.description || "",
      t.kind === "spend" ? formatINR(t.amount) : "", t.kind !== "spend" ? formatINR(t.amount) : "", formatINR(t.running_outstanding)]);
    autoTable(doc, { head: [["Date", "Type", "Description", "Charge", "Payment", "Outstanding"]], body: rows, startY, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] } });
    doc.save(`${card.name}-statement.pdf`);
  };

  const reverse = async (t) => {
    if (t.category === "purchase") { toast.error("This charge is linked to a stock purchase — reverse it from Purchases/Stock."); return; }
    if (!window.confirm(`Reverse this ${KIND_LABELS[t.kind] || t.kind} of ${formatINR(t.amount)}? This undoes its effect on balances.`)) return;
    try {
      await api.delete(`/creditcards/${id}/transactions/${t.id}`);
      toast.success("Transaction reversed");
      load(); if (stmt) openStatement();
    } catch (err) { toast.error(apiError(err)); }
  };

  if (!card) return <div className="text-slate-400">Loading…</div>;
  const available = (card.limit || 0) - (card.outstanding || 0);

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"><ArrowLeft size={16} /> Back</button>
      <PageHeader title={card.name} subtitle={`${card.bank_name || "Credit Card"}${card.last4 ? ` · ····${card.last4}` : ""}`}
        action={<div className="flex gap-2"><Button variant="outline" onClick={openStatement} data-testid="view-statement-btn"><FileText size={16} /> Statement</Button><Button variant="outline" onClick={exportCSV} data-testid="export-csv-btn"><FileDown size={16} /> CSV</Button><Button variant="outline" onClick={exportPDF} data-testid="export-pdf-btn"><FileDown size={16} /> PDF</Button></div>} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Outstanding</div><div className="font-mono font-semibold text-xl text-rose-600 mt-1" data-testid="cardledger-outstanding">{formatINR(card.outstanding)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Credit Limit</div><div className="font-mono font-semibold text-xl text-slate-900 mt-1">{formatINR(card.limit)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase font-semibold text-slate-500">Available Limit</div><div className="font-mono font-semibold text-xl text-teal-600 mt-1" data-testid="cardledger-available">{formatINR(available)}</div></Card>
      </div>

      {stmt && (
        <div className="bg-white border border-slate-200 rounded-md p-5 mb-4" data-testid="statement-panel">
          <div className="flex items-center justify-between mb-3"><h3 className="font-display font-bold text-slate-900">Statement</h3><button onClick={() => setStmt(null)} className="text-xs text-slate-400 hover:text-slate-700">Hide</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
            <div><div className="text-xs text-slate-500">Opening</div><div className="font-mono font-semibold">{formatINR(stmt.opening_balance)}</div></div>
            <div><div className="text-xs text-slate-500">Purchases</div><div className="font-mono font-semibold text-slate-900">{formatINR(stmt.purchases)}</div></div>
            <div><div className="text-xs text-slate-500">Charges</div><div className="font-mono font-semibold text-rose-600">{formatINR(stmt.charges)}</div></div>
            <div><div className="text-xs text-slate-500">Payments</div><div className="font-mono font-semibold text-emerald-600">{formatINR(stmt.payments)}</div></div>
            <div><div className="text-xs text-slate-500">Refunds</div><div className="font-mono font-semibold text-violet-600">{formatINR(stmt.refunds)}</div></div>
            <div><div className="text-xs text-slate-500">Closing</div><div className="font-mono font-semibold text-slate-900">{formatINR(stmt.closing_outstanding)}</div></div>
          </div>
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="From"><Input type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
              <option value="">All types</option><option value="spend">Spend / Purchase</option><option value="payment">Payment</option><option value="refund">Credit / Refund</option>
            </Select>
          </Field>
          <Button variant="outline" onClick={() => setFilters({ from_date: "", to_date: "", kind: "" })}>Clear</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {txns.length === 0 ? <EmptyState title="No transactions" subtitle="Purchases, spends, payments and refunds for this card will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Description / Reference</th><th className="px-4 py-3 font-semibold text-right">Charge</th><th className="px-4 py-3 font-semibold text-right">Payment</th><th className="px-4 py-3 font-semibold text-right">Outstanding</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>{txns.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(t.date)}</td>
                  <td className="px-4 py-3"><Badge tone={KIND_TONE[t.kind]}>{KIND_LABELS[t.kind] || t.kind}</Badge></td>
                  <td className="px-4 py-3 text-slate-700">{t.description || (t.kind === "payment" ? "Bill payment" : "Card spend")}{t.account_name && <span className="text-xs text-slate-400"> · from {t.account_name}</span>}<span className="block text-[10px] text-slate-300 font-mono">ref {String(t.id).slice(0, 8)}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">{t.kind === "spend" ? formatINR(t.amount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{t.kind !== "spend" ? formatINR(t.amount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatINR(t.running_outstanding)}</td>
                  <td className="px-4 py-3 text-right">{t.category !== "purchase" ? <button onClick={() => reverse(t)} data-testid={`reverse-txn-${t.id}`} className="p-1.5 rounded hover:bg-rose-50 text-rose-500" title="Reverse transaction"><RotateCcw size={15} /></button> : <span className="text-[10px] text-slate-300">stock</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
