import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState, DatePicker } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, Trash2 } from "lucide-react";

const empty = {
  mobile_model: "", imei: "", purchase_price: "",
  payment_method: "cash", account_id: "", card_id: "",
  date: todayISO(), notes: "",
};

const PM_LABELS = {
  cash: "Cash", bank: "Bank Account", upi: "UPI Account",
  credit_card: "Credit Card", poonji: "Fixed Poonji",
};

export default function Stock() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(() => {
    api.get("/stock").then((r) => setItems(r.data)).catch(() => {});
    api.get("/accounts", { params: { active: true } }).then((r) => setAccounts(r.data)).catch(() => {});
    api.get("/creditcards").then((r) => setCards(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const [searchParams] = useSearchParams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (searchParams.get("new") === "1") { setForm(empty); setOpen(true); } }, [searchParams]);

  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c.name]));
  const typeAccounts = useMemo(() => (["cash", "bank", "upi"].includes(form.payment_method)
    ? accounts.filter((a) => a.type === form.payment_method) : []), [accounts, form.payment_method]);
  const openCards = useMemo(() => cards.filter((c) => !c.closed), [cards]);

  const paidVia = (i) => {
    if (i.payment_method === "account") return accMap[i.account_id] || "Account";
    if (i.payment_method === "credit_card") return `${cardMap[i.card_id] || "Card"} (Credit)`;
    if (i.payment_method === "poonji") return "Fixed Poonji";
    return "—";
  };
  const paidTone = (i) => {
    if (i.payment_method === "credit_card") return "red";
    if (i.payment_method === "poonji") return "violet";
    if (i.payment_method === "account") return "blue";
    return "slate";
  };

  const submit = async (e) => {
    e.preventDefault();
    const pm = form.payment_method;
    let payment = {};
    if (["cash", "bank", "upi"].includes(pm)) {
      if (!form.account_id) return toast.error(`Select which ${PM_LABELS[pm]} received the payment`);
      payment = { payment_method: "account", account_id: form.account_id };
    } else if (pm === "credit_card") {
      if (!form.card_id) return toast.error("Select which credit card was used");
      payment = { payment_method: "credit_card", card_id: form.card_id };
    } else if (pm === "poonji") {
      payment = { payment_method: "poonji" };
    }
    try {
      await api.post("/stock", {
        mobile_model: form.mobile_model, imei: form.imei || null,
        purchase_price: Number(form.purchase_price),
        date: form.date ? new Date(form.date).toISOString() : null,
        notes: form.notes, ...payment,
      });
      let msg = "Purchase added — account debited";
      if (pm === "credit_card") msg = "Purchase added — card outstanding increased";
      else if (pm === "poonji") msg = "Purchase added — funded from Fixed Poonji";
      toast.success(msg);
      setOpen(false); setForm(empty); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const del = async (id) => {
    try { await api.delete(`/stock/${id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const inStock = items.filter((i) => i.status === "in_stock");

  return (
    <div>
      <PageHeader title="Purchases & Stock" subtitle="Buy inventory and record how each purchase was paid."
        action={<Button onClick={() => { setForm(empty); setOpen(true); }} data-testid={TID.addStockBtn}><Plus size={16} /> Add Purchase</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Items In Stock</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{inStock.length}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Stock Value (cost)</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{formatINR(inStock.reduce((s, i) => s + i.purchase_price, 0))}</div></Card>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? <EmptyState title="No purchases yet" subtitle="Add your first purchase and choose how it was paid." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Added</th><th className="px-4 py-3 font-semibold">Model</th><th className="px-4 py-3 font-semibold">IMEI</th><th className="px-4 py-3 font-semibold">Paid Via</th><th className="px-4 py-3 font-semibold text-right">Cost</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold text-right"></th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(i.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{i.mobile_model}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{i.imei || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={paidTone(i)}>{paidVia(i)}</Badge></td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(i.purchase_price)}</td>
                  <td className="px-4 py-3">{i.status === "sold" ? <Badge tone="slate">Sold</Badge> : <Badge tone="green">In stock</Badge>}</td>
                  <td className="px-4 py-3 text-right">{i.status !== "sold" && (i.payment_method === "none" || !i.payment_method) && <button onClick={() => del(i.id)} className="p-2 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={16} /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Purchase">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Mobile Model"><Input value={form.mobile_model} onChange={(e) => setForm({ ...form, mobile_model: e.target.value })} required placeholder="e.g. Redmi Note 13" /></Field>
          <Field label="IMEI"><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="font-mono" placeholder="Optional" /></Field>
          <Field label="Purchase Price"><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} required className="font-mono" /></Field>

          <Field label="Payment Method" hint="How this purchase was paid">
            <Select
              data-testid="stock-payment-method"
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value, account_id: "", card_id: "" })}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank Account</option>
              <option value="upi">UPI Account</option>
              <option value="credit_card">Credit Card</option>
              <option value="poonji">Fixed Poonji</option>
            </Select>
          </Field>

          {["cash", "bank", "upi"].includes(form.payment_method) && (
            <Field label={`Select ${PM_LABELS[form.payment_method]}`} hint="This account will be debited (Paisa decreases)">
              <Select data-testid="stock-account-select" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
                <option value="">Select account</option>
                {typeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}
              </Select>
              {typeAccounts.length === 0 && <p className="text-xs text-amber-600 mt-1">No {PM_LABELS[form.payment_method]} found. Add one under Cash &amp; Bank.</p>}
            </Field>
          )}

          {form.payment_method === "credit_card" && (
            <Field label="Select Credit Card" hint="Increases this card's outstanding; Paisa unchanged">
              <Select data-testid="stock-card-select" value={form.card_id} onChange={(e) => setForm({ ...form, card_id: e.target.value })} required>
                <option value="">Select card</option>
                {openCards.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {formatINR(c.outstanding)} · avail {formatINR(c.limit - c.outstanding)}</option>)}
              </Select>
              {cards.length === 0 && <p className="text-xs text-amber-600 mt-1">No credit cards yet. Add one under Credit Cards.</p>}
            </Field>
          )}

          {form.payment_method === "poonji" && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded p-2">
              Funded from owner capital. Stock Value and Fixed Poonji both increase; Cash/Bank/UPI are untouched.
            </p>
          )}

          <Field label="Date"><DatePicker testid="stock-date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" data-testid={TID.stockSubmit}>Add Purchase</Button></div>
        </form>
      </Modal>
    </div>
  );
}
