import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, CreditCard as CardIcon, Coins } from "lucide-react";

export default function CreditCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [txns, setTxns] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [txnCard, setTxnCard] = useState(null);
  const [card, setCard] = useState({ name: "", bank_name: "", last4: "", limit: "", notes: "" });
  const [txn, setTxn] = useState({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ card_id: "", account_id: "", amount: "", date: todayISO() });
  const openPay = (cardId) => { setPay({ card_id: cardId || "", account_id: "", amount: "", date: todayISO() }); setPayOpen(true); };

  const load = () => {
    api.get("/creditcards").then((r) => setCards(r.data)).catch(() => {});
    api.get("/accounts", { params: { active: true } }).then((r) => setAccounts(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") setAddOpen(true);
    if (searchParams.get("pay") === "1") setPayOpen(true);
  }, [searchParams]);
  const loadTxns = (id) => { api.get(`/creditcards/${id}/transactions`).then((r) => setTxns((t) => ({ ...t, [id]: r.data }))).catch(() => {}); };

  const addCard = async (e) => { e.preventDefault(); try { await api.post("/creditcards", { ...card, limit: Number(card.limit || 0) }); toast.success("Card added"); setAddOpen(false); setCard({ name: "", bank_name: "", last4: "", limit: "", notes: "" }); load(); } catch (err) { toast.error(apiError(err)); } };
  const addTxn = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/creditcards/${txnCard.id}/transactions`, { ...txn, amount: Number(txn.amount), account_id: txn.kind === "payment" ? txn.account_id : null, date: txn.date ? new Date(txn.date).toISOString() : null });
      toast.success(txn.kind === "spend" ? "Spend recorded" : "Payment recorded — account debited");
      setTxnCard(null); setTxn({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() }); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const payBill = async (e) => {
    e.preventDefault();
    if (!pay.card_id) return toast.error("Select a credit card");
    if (!pay.account_id) return toast.error("Select the paying account");
    try {
      await api.post(`/creditcards/${pay.card_id}/transactions`, {
        kind: "payment", amount: Number(pay.amount), account_id: pay.account_id,
        description: "Credit card bill payment",
        date: pay.date ? new Date(pay.date).toISOString() : null,
      });
      toast.success("Bill paid — card outstanding & account balance reduced");
      setPayOpen(false); setPay({ card_id: "", account_id: "", amount: "", date: todayISO() }); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div>
      <PageHeader title="Credit Cards" subtitle="Track card spends and payments. Payments debit a Paisa account."
        action={<div className="flex gap-2"><Button variant="outline" onClick={() => openPay(null)} data-testid="pay-bill-open"><Coins size={16} /> Pay Bill</Button><Button onClick={() => setAddOpen(true)} data-testid={TID.addCardBtn}><Plus size={16} /> Add Card</Button></div>} />

      <Card className="p-5 mb-6"><div className="text-xs uppercase font-semibold text-slate-500">Total Outstanding</div><div className="font-mono font-semibold text-2xl text-rose-600 mt-2">{formatINR(totalOutstanding)}</div></Card>

      {cards.length === 0 ? <Card><EmptyState title="No cards" subtitle="Add a credit card to track outstanding." /></Card> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-slate-900 flex items-center justify-center text-white"><CardIcon size={18} /></div>
                  <div><div className="font-display font-bold text-slate-900">{c.name}</div><div className="text-xs text-slate-400">{c.bank_name || "—"}{c.last4 ? ` · ····${c.last4}` : ""}</div></div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button variant="outline" onClick={() => navigate(`/credit-cards/${c.id}`)} data-testid={`card-ledger-${c.id}`}>Ledger</Button>
                  <Button variant="outline" onClick={() => openPay(c.id)} data-testid={`card-pay-bill-${c.id}`}>Pay Bill</Button>
                  <Button variant="outline" onClick={() => { setTxnCard(c); setTxn({ kind: "spend", amount: "", account_id: "", description: "", date: todayISO() }); }} data-testid={TID.cardTxnBtn(c.id)}>Add Txn</Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div><div className="text-xs text-slate-500">Outstanding</div><div className="font-mono font-semibold text-lg text-rose-600">{formatINR(c.outstanding)}</div></div>
                <div><div className="text-xs text-slate-500">Limit</div><div className="font-mono font-semibold text-lg text-slate-900">{formatINR(c.limit)}</div></div>
                <div><div className="text-xs text-slate-500">Available</div><div className="font-mono font-semibold text-lg text-teal-600">{formatINR(c.limit - c.outstanding)}</div></div>
              </div>
              <button onClick={() => loadTxns(c.id)} className="text-xs text-blue-600 mt-3 hover:underline">View transactions</button>
              {txns[c.id] && (
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2 max-h-48 overflow-y-auto">
                  {txns[c.id].length === 0 ? <div className="text-xs text-slate-400">No transactions</div> : txns[c.id].map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <div><Badge tone={t.kind === "spend" ? "red" : "green"}>{t.kind}</Badge> <span className="text-slate-500 ml-1">{formatDate(t.date)}</span>{t.account_name && <span className="text-xs text-slate-400 ml-1">· {t.account_name}</span>}</div>
                      <span className="font-mono">{formatINR(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Credit Card">
        <form onSubmit={addCard} className="space-y-4">
          <Field label="Card Name"><Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} required placeholder="e.g. HDFC Regalia" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank"><Input value={card.bank_name} onChange={(e) => setCard({ ...card, bank_name: e.target.value })} /></Field>
            <Field label="Last 4"><Input value={card.last4} maxLength={4} onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, "") })} className="font-mono" /></Field>
          </div>
          <Field label="Credit Limit"><Input type="number" step="0.01" value={card.limit} onChange={(e) => setCard({ ...card, limit: e.target.value })} className="font-mono" /></Field>
          <Field label="Notes"><Textarea rows={2} value={card.notes} onChange={(e) => setCard({ ...card, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit">Add</Button></div>
        </form>
      </Modal>

      <Modal open={!!txnCard} onClose={() => setTxnCard(null)} title={`Transaction — ${txnCard?.name || ""}`}>
        <form onSubmit={addTxn} className="space-y-4">
          <Field label="Type">
            <Select value={txn.kind} onChange={(e) => setTxn({ ...txn, kind: e.target.value })}>
              <option value="spend">Spend (increase outstanding)</option>
              <option value="payment">Payment (decrease outstanding)</option>
            </Select>
          </Field>
          <Field label="Amount"><Input type="number" step="0.01" value={txn.amount} onChange={(e) => setTxn({ ...txn, amount: e.target.value })} required className="font-mono" /></Field>
          {txn.kind === "payment" && (
            <Field label="Pay From Account" hint="This account will be debited (Paisa decreases)">
              <Select value={txn.account_id} onChange={(e) => setTxn({ ...txn, account_id: e.target.value })} required><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}</Select>
            </Field>
          )}
          <Field label="Description"><Input value={txn.description} onChange={(e) => setTxn({ ...txn, description: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={txn.date} onChange={(e) => setTxn({ ...txn, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setTxnCard(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Pay Credit Card Bill" testid="pay-bill-modal">
        <form onSubmit={payBill} className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            Paying a bill reduces the card's outstanding and the selected account balance by the same amount. It is not an expense — the original purchase was already recorded.
          </p>
          <Field label="Credit Card">
            <Select data-testid="pay-bill-card-select" value={pay.card_id} onChange={(e) => setPay({ ...pay, card_id: e.target.value })} required>
              <option value="">Select card</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {formatINR(c.outstanding)}</option>)}
            </Select>
          </Field>
          <Field label="Pay From Account" hint="This Cash/Bank/UPI account will be debited">
            <Select data-testid="pay-bill-account-select" value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })} required>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}
            </Select>
          </Field>
          <Field label="Amount"><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required className="font-mono" /></Field>
          <Field label="Date"><Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button type="submit" data-testid="pay-bill-submit">Pay Bill</Button></div>
        </form>
      </Modal>
    </div>
  );
}
