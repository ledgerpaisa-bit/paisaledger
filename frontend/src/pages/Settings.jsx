import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, Button, Field, Input } from "@/components/shared";
import { User, Mail, ShieldCheck, LogOut, Building2 } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const [biz, setBiz] = useState({ business_name: "", logo_url: "" });

  useEffect(() => { api.get("/settings").then((r) => setBiz({ business_name: r.data.business_name || "", logo_url: r.data.logo_url || "" })).catch(() => {}); }, []);

  const save = async (e) => {
    e.preventDefault();
    try { await api.put("/settings", biz); toast.success("Business profile saved"); }
    catch (err) { toast.error(apiError(err)); }
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
          {biz.logo_url ? <img src={biz.logo_url} alt="logo preview" className="h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : null}
          <div className="flex justify-end"><Button type="submit" data-testid="settings-save-business">Save</Button></div>
        </form>
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
