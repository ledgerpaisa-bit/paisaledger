import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Printer, ArrowLeft, Receipt as ReceiptIcon } from "lucide-react";
import { apiError } from "@/lib/api";
import { getBillingClient, getBillingActor } from "@/lib/billingAuth";
import { formatINR } from "@/lib/format";

export default function BillReceipt() {
  const { id } = useParams();
  const client = getBillingClient();
  const actor = getBillingActor();
  const [bill, setBill] = useState(null);
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;
    client.get(`/bills/${id}`)
      .then((r) => setBill(r.data))
      .catch((err) => { setError(apiError(err, "Could not load this bill")); toast.error(apiError(err)); });
    client.get("/billing/business").then((r) => setBusiness(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!client) return <Navigate to="/staff-login" replace />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-rose-600 font-medium">{error}</p>
          <Link to="/billing" className="text-blue-600 hover:underline text-sm mt-3 inline-block">Back to Billing Counter</Link>
        </div>
      </div>
    );
  }

  if (!bill) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .receipt-paper { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-20 bg-slate-900 text-white h-14 flex items-center px-4 lg:px-8 justify-between">
        <Link to="/billing" className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex items-center gap-2">
          <ReceiptIcon size={16} />
          <span className="font-display font-bold">Bill #{bill.bill_number}</span>
        </div>
        <button
          onClick={() => window.print()}
          data-testid="receipt-print-button"
          className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-semibold"
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <div className="py-8 px-4">
        <div className="receipt-paper bg-white max-w-md mx-auto rounded-md shadow-md p-6">
          <div className="text-center mb-5">
            <div className="font-display font-black text-lg text-slate-900">
              {business?.business_name || "RECEIPT"}
            </div>
            {business?.gst_number && (
              <div className="text-xs text-slate-500 mt-0.5">GSTIN: {business.gst_number}</div>
            )}
            <div className="text-xs text-slate-400 mt-1">Bill #{bill.bill_number}</div>
          </div>

          <div className="flex justify-between text-sm text-slate-600 mb-4">
            <span>{new Date(bill.date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            {bill.customer_name && <span className="font-medium text-slate-900">{bill.customer_name}</span>}
          </div>

          <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
            {bill.items.map((item) => (
              <div key={item.stock_item_id} className="flex justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="text-slate-900 truncate">{item.mobile_model}</div>
                  {item.imei && <div className="text-xs text-slate-400">IMEI {item.imei}</div>}
                </div>
                <div className="font-mono text-slate-900 flex-shrink-0">{formatINR(item.sale_price)}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3">
            <span className="font-semibold text-slate-900">Total</span>
            <span data-testid="receipt-total" className="font-mono font-bold text-xl text-slate-900">{formatINR(bill.total_amount)}</span>
          </div>
          <div className="text-xs text-slate-400 text-right mt-1">Paid via {bill.account_name}</div>

          <div className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-dashed border-slate-300">
            Thank you for your business!
            {bill.staff_name && <div className="mt-1">Billed by {bill.staff_name}</div>}
          </div>
        </div>

        <p className="no-print text-center text-xs text-slate-400 mt-4 max-w-md mx-auto">
          Tip: tap Print, then choose "Save as PDF" to share this receipt on WhatsApp.
        </p>
        {actor?.type === "owner" && (
          <div className="no-print text-center mt-2">
            <Link to="/billing" className="text-blue-600 text-sm hover:underline">Start another bill</Link>
          </div>
        )}
      </div>
    </div>
  );
}
