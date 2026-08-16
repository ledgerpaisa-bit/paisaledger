import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Textarea, Modal, EmptyState } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, Trash2 } from "lucide-react";

const empty = { amount: "", description: "", date: todayISO() };

export default function Poonji() {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/poonji").then((r) => setEntries(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const [searchParams] = useSearchParams();
  useEffect(() => { if (searchParams.get("new") === "1") setOpen(true); }, [searchParams]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/poonji", { ...form, amount: Number(form.amount), date: form.date ? new Date(form.date).toISOString() : null });
      toast.success("Capital entry added");
      setOpen(false); setForm(empty); load();
    } catch (err) { toast.error(apiError(err)); }
  };
  const del = async (id) => { try { await api.delete(`/poonji/${id}`); load(); } catch (err) { toast.error(apiError(err)); } };

  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader title="Fixed Poonji" subtitle="Owner's invested capital. Kept separate from Paisa."
        action={<Button onClick={() => { setForm(empty); setOpen(true); }} data-testid={TID.addPoonjiBtn}><Plus size={16} /> Add Capital</Button>} />

      <div className="bg-violet-600 rounded-md p-6 mb-6">
        <div className="text-xs uppercase tracking-widest font-semibold text-violet-200">Total Fixed Poonji (Capital)</div>
        <div className="font-mono font-bold text-4xl text-white mt-2">{formatINR(total)}</div>
        <p className="text-violet-200 text-sm mt-2">This capital is NOT added to Total Paisa automatically. Paisa reflects only actual money in your accounts.</p>
      </div>

      <Card className="overflow-hidden">
        {entries.length === 0 ? <EmptyState title="No capital entries" subtitle="Record the owner's invested capital." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold text-right">Amount</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.date)}</td>
                <td className="px-4 py-3 text-slate-900">{e.description}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-violet-600">{formatINR(e.amount)}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => del(e.id)} className="p-2 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Capital (Fixed Poonji)">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Amount"><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="font-mono" /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="e.g. Initial investment" /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" data-testid={TID.poonjiSubmit}>Add</Button></div>
        </form>
      </Modal>
    </div>
  );
}
