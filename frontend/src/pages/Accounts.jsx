import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, todayISO } from "@/lib/format";
import {
  PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState,
  accountTypeTone, accountTypeLabel,
} from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, ArrowLeftRight, Power, Pencil, Eye, SlidersHorizontal } from "lucide-react";

const emptyForm = {
  type: "cash", name: "", bank_name: "", last4: "", opening_balance: "", notes: "", allow_negative: false,
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [transfer, setTransfer] = useState({ source_account_id: "", dest_account_id: "", amount: "", notes: "" });
  const [adjust, setAdjust] = useState({ new_balance: "", reason: "" });
  const navigate = useNavigate();

  const load = () => api.get("/accounts").then((r) => setAccounts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  }, [searchParams]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ type: a.type, name: a.name, bank_name: a.bank_name || "", last4: a.last4 || "",
      opening_balance: a.opening_balance, notes: a.notes || "", allow_negative: a.allow_negative });
    setFormOpen(true);
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/accounts/${editing.id}`, {
          name: form.name, bank_name: form.bank_name, last4: form.last4,
          notes: form.notes, allow_negative: form.allow_negative,
        });
        toast.success("Account updated");
      } else {
        await api.post("/accounts", { ...form, opening_balance: Number(form.opening_balance || 0) });
        toast.success("Account created");
      }
      setFormOpen(false);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const toggleStatus = async (a) => {
    try { await api.patch(`/accounts/${a.id}/status`); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const submitTransfer = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transfers", { ...transfer, amount: Number(transfer.amount) });
      toast.success("Transfer complete");
      setTransferOpen(false);
      setTransfer({ source_account_id: "", dest_account_id: "", amount: "", notes: "" });
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/accounts/${adjustOpen.id}/adjust`, {
        new_balance: Number(adjust.new_balance), reason: adjust.reason,
      });
      toast.success("Balance adjusted (adjustment transaction recorded)");
      setAdjustOpen(null);
      setAdjust({ new_balance: "", reason: "" });
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const activeAccounts = accounts.filter((a) => a.active);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Cash, Bank & UPI accounts. Every balance is Paisa."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)} data-testid={TID.transferBtn}>
              <ArrowLeftRight size={16} /> Transfer
            </Button>
            <Button onClick={openNew} data-testid={TID.addAccountBtn}>
              <Plus size={16} /> Add Account
            </Button>
          </div>
        }
      />

      {accounts.length === 0 ? (
        <Card><EmptyState title="No accounts yet" subtitle="Add Cash, HDFC Bank, SBI, UPI etc." action={<Button onClick={openNew}><Plus size={16} /> Add Account</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Opening</th>
                  <th className="px-4 py-3 font-semibold text-right">Current Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} data-testid={TID.accountRow(a.id)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-400">
                        {a.bank_name || "—"}{a.last4 ? ` · ····${a.last4}` : ""}
                        {a.allow_negative ? " · allows negative" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={accountTypeTone(a.type)}>{accountTypeLabel(a.type)}</Badge></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatINR(a.opening_balance)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatINR(a.current_balance)}</td>
                    <td className="px-4 py-3">
                      {a.active ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button data-testid={TID.accountView(a.id)} onClick={() => navigate(`/accounts/${a.id}`)} title="Ledger" className="p-2 rounded hover:bg-slate-200 text-slate-600"><Eye size={16} /></button>
                        <button data-testid={TID.adjustBtn(a.id)} onClick={() => { setAdjustOpen(a); setAdjust({ new_balance: a.current_balance, reason: "" }); }} title="Adjust" className="p-2 rounded hover:bg-slate-200 text-slate-600"><SlidersHorizontal size={16} /></button>
                        <button data-testid={TID.accountEdit(a.id)} onClick={() => openEdit(a)} title="Edit" className="p-2 rounded hover:bg-slate-200 text-slate-600"><Pencil size={16} /></button>
                        <button data-testid={TID.accountToggle(a.id)} onClick={() => toggleStatus(a)} title="Activate/Deactivate" className={`p-2 rounded hover:bg-slate-200 ${a.active ? "text-emerald-600" : "text-slate-400"}`}><Power size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Account form */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Account" : "Add Account"} testid={TID.accountForm}>
        <form onSubmit={saveAccount} className="space-y-4">
          <Field label="Account Type">
            <Select value={form.type} disabled={!!editing} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Account</option>
              <option value="upi">UPI Account</option>
            </Select>
          </Field>
          <Field label="Account Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. HDFC Bank / Cash / Google Pay" />
          </Field>
          {form.type !== "cash" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank / Provider">
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="HDFC / SBI / GPay" />
              </Field>
              <Field label="Last 4 digits" hint="Full number not stored">
                <Input value={form.last4} maxLength={4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "") })} placeholder="1234" className="font-mono" />
              </Field>
            </div>
          )}
          {!editing && (
            <Field label="Opening Balance">
              <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} placeholder="0" className="font-mono" />
            </Field>
          )}
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.allow_negative} onChange={(e) => setForm({ ...form, allow_negative: e.target.checked })} className="w-4 h-4 accent-blue-600" />
            Allow negative balance for this account
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" data-testid={TID.accountFormSubmit}>{editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Transfer */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer Between Accounts" testid={TID.transferForm}>
        <form onSubmit={submitTransfer} className="space-y-4">
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            Transfers move money between your own accounts. Total Paisa does not change.
          </p>
          <Field label="From">
            <Select value={transfer.source_account_id} onChange={(e) => setTransfer({ ...transfer, source_account_id: e.target.value })} required>
              <option value="">Select source</option>
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}
            </Select>
          </Field>
          <Field label="To">
            <Select value={transfer.dest_account_id} onChange={(e) => setTransfer({ ...transfer, dest_account_id: e.target.value })} required>
              <option value="">Select destination</option>
              {activeAccounts.filter((a) => a.id !== transfer.source_account_id).map((a) => <option key={a.id} value={a.id}>{a.name} — {formatINR(a.current_balance)}</option>)}
            </Select>
          </Field>
          <Field label="Amount">
            <Input type="number" step="0.01" min="0" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} required className="font-mono" />
          </Field>
          <Field label="Notes">
            <Input value={transfer.notes} onChange={(e) => setTransfer({ ...transfer, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button type="submit" data-testid={TID.transferSubmit}>Transfer</Button>
          </div>
        </form>
      </Modal>

      {/* Adjust */}
      <Modal open={!!adjustOpen} onClose={() => setAdjustOpen(null)} title={`Adjust Balance — ${adjustOpen?.name || ""}`}>
        <form onSubmit={submitAdjust} className="space-y-4">
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            Setting a new balance records an adjustment transaction for the difference (audit trail preserved).
          </p>
          <Field label="New Balance">
            <Input type="number" step="0.01" value={adjust.new_balance} onChange={(e) => setAdjust({ ...adjust, new_balance: e.target.value })} required className="font-mono" />
          </Field>
          <Field label="Reason">
            <Input value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} required placeholder="e.g. cash count correction" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAdjustOpen(null)}>Cancel</Button>
            <Button type="submit">Record Adjustment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
