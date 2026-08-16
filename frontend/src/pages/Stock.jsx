import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Textarea, Modal, Badge, EmptyState } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, Trash2 } from "lucide-react";

const empty = { mobile_model: "", imei: "", purchase_price: "", date: todayISO(), notes: "" };

export default function Stock() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/stock").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/stock", { ...form, purchase_price: Number(form.purchase_price), date: form.date ? new Date(form.date).toISOString() : null });
      toast.success("Stock item added");
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
      <PageHeader title="Stock" subtitle="Inventory of mobiles available to sell."
        action={<Button onClick={() => { setForm(empty); setOpen(true); }} data-testid={TID.addStockBtn}><Plus size={16} /> Add Item</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Items In Stock</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{inStock.length}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Stock Value (cost)</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{formatINR(inStock.reduce((s, i) => s + i.purchase_price, 0))}</div></Card>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? <EmptyState title="No stock" subtitle="Add mobiles to your inventory." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Added</th><th className="px-4 py-3 font-semibold">Model</th><th className="px-4 py-3 font-semibold">IMEI</th><th className="px-4 py-3 font-semibold text-right">Cost</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold text-right"></th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(i.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{i.mobile_model}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{i.imei || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(i.purchase_price)}</td>
                  <td className="px-4 py-3">{i.status === "sold" ? <Badge tone="slate">Sold</Badge> : <Badge tone="green">In stock</Badge>}</td>
                  <td className="px-4 py-3 text-right">{i.status !== "sold" && <button onClick={() => del(i.id)} className="p-2 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={16} /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Stock Item">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Mobile Model"><Input value={form.mobile_model} onChange={(e) => setForm({ ...form, mobile_model: e.target.value })} required /></Field>
          <Field label="IMEI"><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className="font-mono" /></Field>
          <Field label="Purchase Price"><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} required className="font-mono" /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" data-testid={TID.stockSubmit}>Add</Button></div>
        </form>
      </Modal>
    </div>
  );
}
