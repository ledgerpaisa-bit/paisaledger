import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate, todayISO } from "@/lib/format";
import { PageHeader, Card, Button, Field, Input, Select, Textarea, Modal, Badge, EmptyState } from "@/components/shared";
import { TID } from "@/constants/testIds/app";
import { Plus, Users, Truck, Banknote } from "lucide-react";

export default function Wholesale() {
  const [tab, setTab] = useState("customers");
  const [customers, setCustomers] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [custOpen, setCustOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [cust, setCust] = useState({ name: "", phone: "", notes: "" });
  const [supply, setSupply] = useState({ customer_id: "", description: "", amount: "", cost: "", date: todayISO() });
  const [pay, setPay] = useState({ customer_id: "", amount: "", account_id: "", date: todayISO(), notes: "" });

  const load = () => {
    api.get("/wholesale/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get("/wholesale/supplies").then((r) => setSupplies(r.data)).catch(() => {});
    api.get("/wholesale/payments").then((r) => setPayments(r.data)).catch(() => {});
    api.get("/accounts", { params: { active: true } }).then((r) => setAccounts(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding || 0), 0);

  const addCust = async (e) => { e.preventDefault(); try { await api.post("/wholesale/customers", cust); toast.success("Customer added"); setCustOpen(false); setCust({ name: "", phone: "", notes: "" }); load(); } catch (err) { toast.error(apiError(err)); } };
  const addSupply = async (e) => { e.preventDefault(); try { await api.post("/wholesale/supplies", { ...supply, amount: Number(supply.amount), cost: Number(supply.cost || 0), date: supply.date ? new Date(supply.date).toISOString() : null }); toast.success("Supply recorded — receivable increased (not Paisa)"); setSupplyOpen(false); setSupply({ customer_id: "", description: "", amount: "", cost: "", date: todayISO() }); load(); } catch (err) { toast.error(apiError(err)); } };
  const addPay = async (e) => { e.preventDefault(); try { await api.post("/wholesale/payments", { ...pay, amount: Number(pay.amount), date: pay.date ? new Date(pay.date).toISOString() : null }); toast.success("Payment received — receivable reduced, account credited"); setPayOpen(false); setPay({ customer_id: "", amount: "", account_id: "", date: todayISO(), notes: "" }); load(); } catch (err) { toast.error(apiError(err)); } };

  const tabs = [
    { k: "customers", label: "Customers", icon: Users },
    { k: "supplies", label: "Supplies", icon: Truck },
    { k: "payments", label: "Payments", icon: Banknote },
  ];

  return (
    <div>
      <PageHeader title="Wholesale" subtitle="Supplies create receivables. Paisa increases only when the customer pays." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Total Receivable</div><div className="font-mono font-semibold text-2xl text-amber-600 mt-2">{formatINR(totalOutstanding)}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Customers</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{customers.length}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase font-semibold text-slate-500">Total Supplied</div><div className="font-mono font-semibold text-2xl text-slate-900 mt-2">{formatINR(supplies.reduce((s, x) => s + x.amount, 0))}</div></Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-md">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === t.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>
        <div>
          {tab === "customers" && <Button onClick={() => setCustOpen(true)} data-testid={TID.addCustomerBtn}><Plus size={16} /> Add Customer</Button>}
          {tab === "supplies" && <Button onClick={() => setSupplyOpen(true)} data-testid={TID.addSupplyBtn} disabled={customers.length === 0}><Plus size={16} /> Add Supply</Button>}
          {tab === "payments" && <Button onClick={() => setPayOpen(true)} data-testid={TID.addWholesalePaymentBtn} disabled={customers.length === 0 || accounts.length === 0}><Plus size={16} /> Receive Payment</Button>}
        </div>
      </div>

      <Card className="overflow-hidden">
        {tab === "customers" && (customers.length === 0 ? <EmptyState title="No customers" subtitle="Add a wholesale customer (e.g. A Shop)." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Phone</th><th className="px-4 py-3 font-semibold text-right">Outstanding</th></tr></thead>
            <tbody>{customers.map((c) => <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-900">{c.name}</td><td className="px-4 py-3 text-slate-500">{c.phone || "—"}</td><td className="px-4 py-3 text-right font-mono font-semibold">{c.outstanding > 0 ? <span className="text-amber-600">{formatINR(c.outstanding)}</span> : <Badge tone="green">Settled</Badge>}</td></tr>)}</tbody>
          </table>
        ))}
        {tab === "supplies" && (supplies.length === 0 ? <EmptyState title="No supplies" subtitle="Record goods supplied to a wholesale customer." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold text-right">Amount</th><th className="px-4 py-3 font-semibold text-right">Profit</th></tr></thead>
            <tbody>{supplies.map((s) => <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.date)}</td><td className="px-4 py-3 font-medium text-slate-900">{s.customer_name}</td><td className="px-4 py-3 text-slate-600">{s.description}</td><td className="px-4 py-3 text-right font-mono">{formatINR(s.amount)}</td><td className="px-4 py-3 text-right font-mono text-emerald-600">{formatINR(s.profit)}</td></tr>)}</tbody>
          </table>
        ))}
        {tab === "payments" && (payments.length === 0 ? <EmptyState title="No payments" subtitle="Receive a payment against outstanding." /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Received In</th><th className="px-4 py-3 font-semibold text-right">Amount</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(p.date)}</td><td className="px-4 py-3 font-medium text-slate-900">{p.customer_name}</td><td className="px-4 py-3"><Badge tone="blue">{p.account_name}</Badge></td><td className="px-4 py-3 text-right font-mono text-emerald-600">{formatINR(p.amount)}</td></tr>)}</tbody>
          </table>
        ))}
      </Card>

      <Modal open={custOpen} onClose={() => setCustOpen(false)} title="Add Wholesale Customer">
        <form onSubmit={addCust} className="space-y-4">
          <Field label="Name"><Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} required placeholder="e.g. A Shop" /></Field>
          <Field label="Phone"><Input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={cust.notes} onChange={(e) => setCust({ ...cust, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setCustOpen(false)}>Cancel</Button><Button type="submit">Add</Button></div>
        </form>
      </Modal>

      <Modal open={supplyOpen} onClose={() => setSupplyOpen(false)} title="Record Supply">
        <form onSubmit={addSupply} className="space-y-4">
          <Field label="Customer"><Select value={supply.customer_id} onChange={(e) => setSupply({ ...supply, customer_id: e.target.value })} required><option value="">Select</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Description"><Input value={supply.description} onChange={(e) => setSupply({ ...supply, description: e.target.value })} required placeholder="e.g. 10 units Redmi" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost"><Input type="number" step="0.01" value={supply.cost} onChange={(e) => setSupply({ ...supply, cost: e.target.value })} className="font-mono" /></Field>
            <Field label="Supply Amount"><Input type="number" step="0.01" value={supply.amount} onChange={(e) => setSupply({ ...supply, amount: e.target.value })} required className="font-mono" /></Field>
          </div>
          <Field label="Date"><Input type="date" value={supply.date} onChange={(e) => setSupply({ ...supply, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setSupplyOpen(false)}>Cancel</Button><Button type="submit">Record</Button></div>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Receive Wholesale Payment">
        <form onSubmit={addPay} className="space-y-4">
          <Field label="Customer"><Select value={pay.customer_id} onChange={(e) => setPay({ ...pay, customer_id: e.target.value })} required><option value="">Select</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {formatINR(c.outstanding)}</option>)}</Select></Field>
          <Field label="Amount"><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required className="font-mono" /></Field>
          <Field label="Received In"><Select value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })} required><option value="">Select account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button type="submit" data-testid={TID.wholesalePaymentSubmit}>Receive</Button></div>
        </form>
      </Modal>
    </div>
  );
}
