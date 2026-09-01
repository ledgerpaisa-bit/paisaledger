import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, Button, Field, Input, Badge } from "@/components/shared";
import { User, Mail, ShieldCheck, LogOut, Building2, Bell, Users, Plus, KeyRound, Ban, RotateCcw } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const [biz, setBiz] = useState({ business_name: "", logo_url: "", gst_number: "" });
  const [sending, setSending] = useState(false);
  const [staff, setStaff] = useState([]);
  const [newStaff, setNewStaff] = useState({ username: "", pin: "", name: "" });
  const [addingStaff, setAddingStaff] = useState(false);
  const [pinResetId, setPinResetId] = useState(null);
  const [pinResetValue, setPinResetValue] = useState("");

  const loadStaff = () => api.get("/staff").then((r) => setStaff(r.data)).catch(() => {});

  useEffect(() => { api.get("/settings").then((r) => setBiz({ business_name: r.data.business_name || "", logo_url: r.data.logo_url || "", gst_number: r.data.gst_number || "" })).catch(() => {}); loadStaff(); }, []);

  const addStaff = async (e) => {
    e.preventDefault();
    setAddingStaff(true);
    try {
      await api.post("/staff", newStaff);
      toast.success(`Staff login "${newStaff.username}" created`);
      setNewStaff({ username: "", pin: "", name: "" });
      loadStaff();
    } catch (err) { toast.error(apiError(err)); }
    finally { setAddingStaff(false); }
  };

  const toggleStaffActive = async (s) => {
    try {
      await api.put(`/staff/${s.id}`, { active: !s.active });
      toast.success(s.active ? `${s.username} deactivated` : `${s.username} re-activated`);
      loadStaff();
    } catch (err) { toast.error(apiError(err)); }
  };

  const submitPinReset = async (staffId) => {
    if (!/^[0-9]{4,6}$/.test(pinResetValue)) return toast.error("PIN must be 4 to 6 digits");
    try {
      await api.put(`/staff/${staffId}`, { pin: pinResetValue });
      toast.success("PIN updated");
      setPinResetId(null);
      setPinResetValue("");
    } catch (err) { toast.error(apiError(err)); }
  };

  const save = async (e) => {
    e.preventDefault();
    try { await api.put("/settings", biz); toast.success("Business profile saved"); }
    catch (err) { toast.error(apiError(err)); }
  };

  const sendTestReminder = async () => {
    setSending(true);
    try {
      const r = await api.post("/reminders/test");
      toast.success(r.data.due_cards > 0
        ? `Test reminder sent to ${r.data.to} (${r.data.due_cards} card${r.data.due_cards !== 1 ? "s" : ""} due)`
        : `Test email sent to ${r.data.to} — no dues in the next 3 days`);
    } catch (err) { toast.error(apiError(err)); }
    finally { setSending(false); }
  };

  const rows = [
    { icon: User, label: "Name", value: user?.name || "Owner" },
    { icon: Mail, label: "Email", value: user?.email },
    { icon: ShieldCheck, label: "Role", value: "Owner" },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business profile and your owner account." />

      <Card className="max-w-xl mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Building2 size={18} className="text-slate-500" /><h3 className="font-display font-bold text-slate-900">Business Profile</h3></div>
        <form onSubmit={save} className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Used as branding on the top of exported credit-card statement PDFs.</p>
          <Field label="Business / Shop Name"><Input data-testid="settings-business-name" value={biz.business_name} onChange={(e) => setBiz({ ...biz, business_name: e.target.value })} placeholder="e.g. Sharma Mobiles" /></Field>
          <Field label="Logo URL" hint="Optional. A direct https image link shown on statements."><Input data-testid="settings-logo-url" value={biz.logo_url} onChange={(e) => setBiz({ ...biz, logo_url: e.target.value })} placeholder="https://…/logo.png" /></Field>
          <Field label="GST Number" hint="Optional. Shown on billing receipts, below your shop name."><Input data-testid="settings-gst-number" value={biz.gst_number} onChange={(e) => setBiz({ ...biz, gst_number: e.target.value.toUpperCase() })} placeholder="e.g. 22AAAAA0000A1Z5" /></Field>
          {biz.logo_url ? <img src={biz.logo_url} alt="logo preview" className="h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : null}
          <div className="flex justify-end"><Button type="submit" data-testid="settings-save-business">Save</Button></div>
        </form>
      </Card>

      <Card className="max-w-xl mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Bell size={18} className="text-slate-500" /><h3 className="font-display font-bold text-slate-900">Payment Reminders</h3></div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-600">Every day at <span className="font-semibold">9:00 AM IST</span>, you'll get an email at <span className="font-semibold">{user?.email}</span> if any credit card payment is due within the next 3 days.</p>
          <p className="text-xs text-slate-400">Reminders run automatically. Send a test email now to confirm delivery.</p>
          <div className="flex justify-end"><Button variant="outline" onClick={sendTestReminder} disabled={sending} data-testid="settings-test-reminder"><Bell size={15} /> {sending ? "Sending…" : "Send test reminder"}</Button></div>
        </div>
      </Card>

      <Card className="max-w-xl mb-6">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Users size={18} className="text-slate-500" /><h3 className="font-display font-bold text-slate-900">Billing Counter Staff</h3></div>
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-4">
            Give shop staff a simple username + PIN login for the Billing Counter only — they never see your Dashboard, Reports or Settings.
            Staff sign in at <span className="font-mono">/staff-login</span>.
          </p>

          {staff.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md mb-4">
              {staff.map((s) => (
                <div key={s.id} data-testid={`staff-row-${s.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0"><User size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{s.name}</div>
                    <div className="text-xs text-slate-400 truncate">@{s.username}</div>
                  </div>
                  <Badge tone={s.active ? "green" : "slate"}>{s.active ? "Active" : "Deactivated"}</Badge>
                  <Button variant="ghost" className="!h-8 !px-2" title="Reset PIN" onClick={() => { setPinResetId(pinResetId === s.id ? null : s.id); setPinResetValue(""); }} data-testid={`staff-reset-pin-${s.id}`}>
                    <KeyRound size={15} />
                  </Button>
                  <Button variant="ghost" className="!h-8 !px-2" title={s.active ? "Deactivate" : "Re-activate"} onClick={() => toggleStaffActive(s)} data-testid={`staff-toggle-${s.id}`}>
                    {s.active ? <Ban size={15} className="text-rose-600" /> : <RotateCcw size={15} className="text-emerald-600" />}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {pinResetId && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <Input
                type="text" inputMode="numeric" maxLength={6} placeholder="New 4-6 digit PIN"
                value={pinResetValue} onChange={(e) => setPinResetValue(e.target.value.replace(/\D/g, ""))}
                className="max-w-[160px]" data-testid="staff-pin-reset-input"
              />
              <Button onClick={() => submitPinReset(pinResetId)} data-testid="staff-pin-reset-submit">Save PIN</Button>
              <Button variant="outline" onClick={() => setPinResetId(null)}>Cancel</Button>
            </div>
          )}

          <form onSubmit={addStaff} className="grid sm:grid-cols-3 gap-3 items-end">
            <Field label="Username"><Input required placeholder="e.g. ramesh" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase() })} data-testid="staff-new-username" /></Field>
            <Field label="PIN (4-6 digits)"><Input required type="text" inputMode="numeric" maxLength={6} placeholder="1234" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, "") })} data-testid="staff-new-pin" /></Field>
            <Field label="Display name (optional)"><Input placeholder="e.g. Ramesh" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} data-testid="staff-new-name" /></Field>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" disabled={addingStaff} data-testid="staff-add-submit"><Plus size={15} /> {addingStaff ? "Adding…" : "Add Staff Login"}</Button>
            </div>
          </form>
        </div>
      </Card>

      <Card className="max-w-xl">
        <div className="px-5 py-4 border-b border-slate-200"><h3 className="font-display font-bold text-slate-900">Account</h3></div>
        <div>
          {rows.map((r) => { const Icon = r.icon; return (
            <div key={r.label} className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500"><Icon size={18} /></div>
              <div><div className="text-xs uppercase tracking-wide font-semibold text-slate-500">{r.label}</div><div className="text-slate-900 font-medium">{r.value}</div></div>
            </div>
          ); })}
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
          <Button variant="danger" onClick={logout} data-testid="settings-logout-button"><LogOut size={16} /> Sign out</Button>
          <p className="text-xs text-slate-500 mt-3">Passwords are stored as bcrypt hashes and never shown in plain text.</p>
        </div>
      </Card>
    </div>
  );
}
