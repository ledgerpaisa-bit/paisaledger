import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus } from "lucide-react";

const empty = { mobile_model: "", imei: "", sale_price: "", cost_price: "", account_id: "", stock_item_id: "", date: todayISO(), notes: "" };

export default function Retail() {
  const [sales, setSales] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [stock, setStock] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => {
    api.get("/retail/sales").then((r) => setSales(r.data)).catch(() => {});
    api.get("/accounts", { params: { active: true } }).then((r) => setAccounts(r.data)).catch(() => {});
    api.get("/stock", { params: { status: "in_stock" } }).then((r) => setStock(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const pickStock = (sid) => {
    const item = stock.find((s) => s.id === sid);
    if (item) setForm((f) => ({ ...f, stock_item_id: sid, mobile_model: item.mobile_model, imei: item.imei || "", cost_price: item.purchase_price }));
    else setForm((f) => ({ ...f, stock_item_id: "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/retail/sales", {
        mobile_model: form.mobile_model, imei: form.imei || null,
        sale_price: Number(form.sale_price), cost_price: Number(form.cost_price),
        account_id: form.account_id, stock_item_id: form.stock_item_id || null,
        date: form.date ? new Date(form.date).toISOString() : null, notes: form.notes,
      });
      toast.success("Sale recorded — account credited");
      setOpen(false); setForm(empty); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div>
      <PageHeader title="Retail Sales" subtitle="Record mobile sales and the account where payment was received."
        action={<Button onClick={() => { setForm(empty); setOpen(true); }} data-testid={TID.addSaleBtn} disabled={accounts.length === 0}><Plus size={16} /> New Sale</Button>} />

      {accounts.length === 0 && <Card className="p-4 mb-4 text-sm text-amber-700 bg-amber-50 border-amber-200">Add at least one account before recording sales.</Card>}

      <Card className="overflow-hidden">
        {sales.length === 0 ? (
          <EmptyState title="No sales yet" subtitle="Record your first mobile sale." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">IMEI</th>
                  <th className="px-4 py-3 font-semibold">Received In</th>
                  <th className="px-4 py-3 font-semibold text-right">Cost</th>
                  <th className="px-4 py-3 font-semibold text-right">Sale</th>
                  <th className="px-4 py-3 font-semibold text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.mobile_model}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.imei || "—"}</td>
                    <td className="px-4 py-3"><Badge tone="blue">{s.account_name}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatINR(s.cost_price)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">{formatINR(s.sale_price)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">{formatINR(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Retail Sale" testid={TID.saleForm}>
        <form onSubmit={submit} className="space-y-4">
          {stock.length > 0 && (
            <Field label="Pick from Stock (optional)" hint="Auto-fills model, IMEI and cost">
              <Select value={form.stock_item_id} onChange={(e) => pickStock(e.target.value)}>
                <option value="">Manual entry</option>
                {stock.map((s) => <option key={s.id} value={s.id}>{s.mobile_model}{s.imei ? ` · ${s.imei}` : ""} — cost {formatINR(s.purchase_price)}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Mobile Model"><Input value={form.mobile_model} onChange={(e) => setForm({ ...form, mobile_model: e.target.value })} required placeholder="e.g. iPhone 15 128GB" /></Field>
          <Field label="IMEI"><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="font-mono" placeholder="Optional" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost Price"><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required className="font-mono" /></Field>
            <Field label="Sale Price"><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} required className="font-mono" /></Field>
          </div>
          <Field label="Payment Received In">
            <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} required>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" data-testid={TID.saleSubmit}>Record Sale</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
