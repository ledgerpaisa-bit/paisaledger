import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, DatePicker } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, CreditCard as CardIcon, Coins, Pencil, Archive, ArchiveRestore } from "lucide-react";

const STATUS = {
  paid: { tone: "green", label: "Paid" },
  partially_paid: { tone: "amber", label: "Partially Paid" },
  due: { tone: "blue", label: "Due" },
  overdue: { tone: "red", label: "Overdue" },
  closed: { tone: "slate", label: "Closed" },
};
const emptyCard = { name: "", bank_name: "", last4: "", limit: "", opening_outstanding: "", statement_date: "", due_date: "", min_due: "", allow_over_limit: false, notes: "" };

const utilColorClass = (pct) => {
  if (pct > 70) return "bg-rose-500";
  if (pct > 30) return "bg-amber-500";
  return "bg-emerald-500";
};

function UtilBar({ pct }) {
  const color = utilColorClass(pct);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Utilization</span><span className="font-mono">{pct}%</span></div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
    </div>
  );
}

export default function CreditCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [txnCard, setTxnCard] = useState(null);
  const [card, setCard] = useState(emptyCard);
  const [txn, setTxn] = useState({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ card_id: "", account_id: "", amount: "", date: todayISO() });
  const openPay = (cardId) => { setPay({ card_id: cardId || "", account_id: "", amount: "", date: todayISO() }); setPayOpen(true); };

  const load = useCallback(() => {
    api.get("/creditcards").then((r) => setCards(r.data)).catch(() => {});
    api.get("/accounts", { params: { active: true } }).then((r) => setAccounts(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") { setEditingId(null); setCard(emptyCard); setAddOpen(true); }
    if (searchParams.get("pay") === "1") setPayOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openEdit = (c) => {
    setEditingId(c.id);
    setCard({ name: c.name, bank_name: c.bank_name || "", last4: c.last4 || "", limit: c.limit,
      opening_outstanding: "", statement_date: c.statement_date || "", due_date: c.due_date || "",
      min_due: c.min_due ?? "", allow_over_limit: !!c.allow_over_limit, notes: c.notes || "" });
    setAddOpen(true);
  };

  const saveCard = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/creditcards/${editingId}`, { name: card.name, bank_name: card.bank_name, last4: card.last4,
          limit: Number(card.limit || 0), statement_date: card.statement_date || null, due_date: card.due_date || null,
          min_due: Number(card.min_due || 0), allow_over_limit: card.allow_over_limit, notes: card.notes });
        toast.success("Card updated");
      } else {
        await api.post("/creditcards", { ...card, limit: Number(card.limit || 0), opening_outstanding: Number(card.opening_outstanding || 0),
          min_due: Number(card.min_due || 0), statement_date: card.statement_date || null, due_date: card.due_date || null });
        toast.success("Card added");
      }
      setAddOpen(false); setCard(emptyCard); setEditingId(null); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const addTxn = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/creditcards/${txnCard.id}/transactions`, { kind: txn.kind, amount: Number(txn.amount),
        account_id: txn.kind === "payment" ? txn.account_id : null, description: txn.description,
        date: txn.date ? new Date(txn.date).toISOString() : null });
      toast.success("Transaction recorded");
      setTxnCard(null); setTxn({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() }); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const payBill = async (e) => {
    e.preventDefault();
    if (!pay.card_id) return toast.error("Select a credit card");
    if (!pay.account_id) return toast.error("Select the paying account");
    try {
      await api.post(`/creditcards/${pay.card_id}/transactions`, { kind: "payment", amount: Number(pay.amount),
        account_id: pay.account_id, description: "Credit card bill payment", date: pay.date ? new Date(pay.date).toISOString() : null });
      toast.success("Bill paid — card outstanding & account reduced");
      setPayOpen(false); setPay({ card_id: "", account_id: "", amount: "", date: todayISO() }); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const openCards = cards.filter((c) => !c.closed);

  const toggleClose = async (c) => {
    if (!c.closed && c.outstanding > 0 && !window.confirm(`${c.name} still has an outstanding of ${formatINR(c.outstanding)}. Close it anyway? Its history stays accessible.`)) return;
    try { await api.patch(`/creditcards/${c.id}/close`); toast.success(c.closed ? "Card reopened" : "Card closed"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div>
      <PageHeader title="Credit Cards" subtitle="Manage cards, limits, dues and bill payments."
        action={<div className="flex gap-2"><Button variant="outline" onClick={() => openPay(null)} data-testid="pay-bill-open"><Coins size={16} /> Pay Bill</Button><Button onClick={() => { setEditingId(null); setCard(emptyCard); setAddOpen(true); }} data-testid={TID.addCardBtn}><Plus size={16} /> Add Card</Button></div>} />

      <Card className="p-5 mb-6"><div className="text-xs uppercase font-semibold text-slate-500">Total Outstanding</div><div className="font-mono font-semibold text-2xl text-rose-600 mt-2">{formatINR(totalOutstanding)}</div></Card>

      {cards.length === 0 ? <Card><EmptyState title="No cards" subtitle="Add a credit card to track outstanding, limit and dues." /></Card> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((c) => {
            const pct = c.limit > 0 ? Math.round((c.outstanding / c.limit) * 100) : 0;
            const st = STATUS[c.status] || STATUS.due;
            return (
              <Card key={c.id} className={`p-5 ${c.closed ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-slate-900 flex items-center justify-center text-white shrink-0"><CardIcon size={18} /></div>
                    <div className="min-w-0"><div className="font-display font-bold text-slate-900 truncate">{c.name}</div><div className="text-xs text-slate-400">{c.bank_name || "—"}{c.last4 ? ` · ····${c.last4}` : ""}</div></div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div><div className="text-xs text-slate-500">Outstanding</div><div className="font-mono font-semibold text-rose-600">{formatINR(c.outstanding)}</div></div>
                  <div><div className="text-xs text-slate-500">Limit</div><div className="font-mono font-semibold text-slate-900">{formatINR(c.limit)}</div></div>
                  <div><div className="text-xs text-slate-500">Available</div><div className="font-mono font-semibold text-teal-600">{formatINR(c.available)}</div></div>
                </div>
                <UtilBar pct={pct} />
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div><span className="text-slate-500">Due Date: </span><span className="font-medium text-slate-800">{c.due_date ? formatDate(c.due_date) : "—"}</span></div>
                  <div><span className="text-slate-500">Min Due: </span><span className="font-mono text-slate-800">{formatINR(c.min_due || 0)}</span></div>
                </div>

                <div className="flex gap-2 flex-wrap justify-end mt-4 pt-3 border-t border-slate-100">
                  <Button variant="outline" onClick={() => navigate(`/credit-cards/${c.id}`)} data-testid={`card-ledger-${c.id}`}>Ledger</Button>
                  {!c.closed && <Button variant="outline" onClick={() => openPay(c.id)} data-testid={`card-pay-bill-${c.id}`}>Pay Bill</Button>}
                  {!c.closed && <Button variant="outline" onClick={() => { setTxnCard(c); setTxn({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() }); }} data-testid={TID.cardTxnBtn(c.id)}>Add Txn</Button>}
                  <Button variant="outline" onClick={() => openEdit(c)} data-testid={`card-edit-${c.id}`}><Pencil size={14} /> Edit</Button>
                  <Button variant="outline" onClick={() => toggleClose(c)} data-testid={`card-close-${c.id}`}>{c.closed ? <><ArchiveRestore size={14} /> Reopen</> : <><Archive size={14} /> Close</>}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={editingId ? "Edit Credit Card" : "Add Credit Card"}>
        <form onSubmit={saveCard} className="space-y-4">
          <Field label="Card Name"><Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} required placeholder="e.g. HDFC Regalia" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank / Provider"><Input value={card.bank_name} onChange={(e) => setCard({ ...card, bank_name: e.target.value })} /></Field>
            <Field label="Last 4 digits" hint="Full number never stored"><Input value={card.last4} maxLength={4} onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, "") })} className="font-mono" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credit Limit"><Input type="number" step="0.01" value={card.limit} onChange={(e) => setCard({ ...card, limit: e.target.value })} className="font-mono" /></Field>
            {!editingId && <Field label="Opening Outstanding"><Input type="number" step="0.01" value={card.opening_outstanding} onChange={(e) => setCard({ ...card, opening_outstanding: e.target.value })} className="font-mono" /></Field>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statement Date"><DatePicker testid="card-statement-date" value={card.statement_date} onChange={(v) => setCard({ ...card, statement_date: v })} /></Field>
            <Field label="Payment Due Date"><DatePicker testid="card-due-date" value={card.due_date} onChange={(v) => setCard({ ...card, due_date: v })} /></Field>
          </div>
          <Field label="Minimum Due"><Input type="number" step="0.01" value={card.min_due} onChange={(e) => setCard({ ...card, min_due: e.target.value })} className="font-mono" /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={card.allow_over_limit} onChange={(e) => setCard({ ...card, allow_over_limit: e.target.checked })} className="w-4 h-4 accent-blue-600" /> Allow over-limit transactions</label>
          <Field label="Notes"><Textarea rows={2} value={card.notes} onChange={(e) => setCard({ ...card, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" data-testid={TID.cardSubmit}>{editingId ? "Save" : "Add"}</Button></div>
        </form>
      </Modal>

      <Modal open={!!txnCard} onClose={() => setTxnCard(null)} title={`Transaction — ${txnCard?.name || ""}`}>
        <form onSubmit={addTxn} className="space-y-4">
          <Field label="Type">
            <Select value={txn.kind} onChange={(e) => setTxn({ ...txn, kind: e.target.value })}>
              <option value="spend">Spend (increase outstanding)</option>
              <option value="payment">Payment (decrease outstanding)</option>
              <option value="refund">Credit / Refund (decrease outstanding)</option>
            </Select>
          </Field>
          <Field label="Amount"><Input type="number" step="0.01" value={txn.amount} onChange={(e) => setTxn({ ...txn, amount: e.target.value })} required className="font-mono" /></Field>
          {txn.kind === "payment" && (
            <Field label="Pay From Account" hint="This account will be debited (Paisa decreases)">
              <Select value={txn.account_id} onChange={(e) => setTxn({ ...txn, account_id: e.target.value })} required><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}</Select>
            </Field>
          )}
          <Field label="Description"><Input value={txn.description} onChange={(e) => setTxn({ ...txn, description: e.target.value })} /></Field>
          <Field label="Date"><DatePicker testid="cardtxn-date" value={txn.date} onChange={(v) => setTxn({ ...txn, date: v })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setTxnCard(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Pay Credit Card Bill" testid="pay-bill-modal">
        <form onSubmit={payBill} className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">Paying a bill reduces the card's outstanding and the selected account balance. It is not an expense — the original purchase was already recorded.</p>
          <Field label="Credit Card">
            <Select data-testid="pay-bill-card-select" value={pay.card_id} onChange={(e) => setPay({ ...pay, card_id: e.target.value })} required>
              <option value="">Select card</option>
              {openCards.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {formatINR(c.outstanding)}</option>)}
            </Select>
          </Field>
          <Field label="Pay From Account" hint="This Cash/Bank/UPI account will be debited">
            <Select data-testid="pay-bill-account-select" value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })} required>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}
            </Select>
          </Field>
          <Field label="Amount (full or partial)"><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required className="font-mono" /></Field>
          {pay.card_id && (() => { const sel = cards.find((x) => x.id === pay.card_id); return (
            <button type="button" data-testid="pay-full-btn" onClick={() => setPay({ ...pay, amount: sel ? sel.outstanding : "" })} className="text-xs text-blue-600 hover:underline">
              Pay full outstanding ({formatINR(sel ? sel.outstanding : 0)})
            </button>
          ); })()}
          <Field label="Date"><DatePicker testid="paybill-date" value={pay.date} onChange={(v) => setPay({ ...pay, date: v })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button type="submit" data-testid="pay-bill-submit">Pay Bill</Button></div>
        </form>
      </Modal>
    </div>
  );
}
