import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card, Button } from "@/components/shared";
import { User, Mail, ShieldCheck, LogOut } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();

  const rows = [
    { icon: User, label: "Name", value: user?.name || "Owner" },
    { icon: Mail, label: "Email", value: user?.email },
    { icon: ShieldCheck, label: "Role", value: "Owner" },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your owner account and session." />
      <Card className="max-w-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display font-bold text-slate-900">Account</h3>
        </div>
        <div>
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
                <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide font-semibold text-slate-500">{r.label}</div>
                  <div className="text-slate-900 font-medium">{r.value}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
          <Button variant="danger" onClick={logout} data-testid="settings-logout-button">
            <LogOut size={16} /> Sign out
          </Button>
          <p className="text-xs text-slate-500 mt-3">
            Passwords are stored as bcrypt hashes and never shown in plain text.
          </p>
        </div>
      </Card>
    </div>
  );
}
