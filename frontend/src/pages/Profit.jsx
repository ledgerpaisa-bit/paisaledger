import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { PageHeader, Card, StatCard, Field, Input, Button, Badge, EmptyState } from "@/components/shared";

export default function Profit() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState({ from_date: "", to_date: "" });

  const load = useCallback(() => {
    const params = {};
    if (range.from_date) params.from_date = range.from_date;
    if (range.to_date) params.to_date = range.to_date;
    api.get("/profit", { params }).then((r) => setData(r.data)).catch(() => {});
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Profit" subtitle="Retail + wholesale profit over a period." />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Field label="From"><Input type="date" value={range.from_date} onChange={(e) => setRange({ ...range, from_date: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={range.to_date} onChange={(e) => setRange({ ...range, to_date: e.target.value })} /></Field>
          <Button variant="outline" onClick={() => setRange({ from_date: "", to_date: "" })}>All time</Button>
        </div>
      </Card>

      {!data ? <div className="text-slate-400">Loading…</div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 rounded-md p-6">
              <div className="text-xs uppercase tracking-widest font-semibold text-emerald-400">Total Profit</div>
              <div className="font-mono font-bold text-3xl lg:text-4xl text-white mt-2">{formatINR(data.total_profit)}</div>
              <div className="text-slate-400 text-sm mt-1">Revenue {formatINR(data.total_revenue)}</div>
            </div>
            <StatCard label="Retail Profit" value={data.retail_profit} accent="emerald" sub={`${data.retail_count} sales · rev ${formatINR(data.retail_revenue)}`} />
            <StatCard label="Wholesale Profit" value={data.wholesale_profit} accent="blue" sub={`${data.wholesale_count} supplies · rev ${formatINR(data.wholesale_revenue)}`} />
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h3 className="font-display font-bold text-slate-900">Retail Sales in Period</h3></div>
            {data.sales.length === 0 ? <EmptyState title="No sales in this period" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200"><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Model</th><th className="px-4 py-3 font-semibold text-right">Cost</th><th className="px-4 py-3 font-semibold text-right">Sale</th><th className="px-4 py-3 font-semibold text-right">Profit</th></tr></thead>
                  <tbody>{data.sales.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.mobile_model}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">{formatINR(s.cost_price)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatINR(s.sale_price)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">{formatINR(s.profit)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
