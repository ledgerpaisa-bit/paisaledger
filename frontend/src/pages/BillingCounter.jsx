import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Receipt, Search, Plus, Trash2, LogOut, Smartphone } from "lucide-react";
import { apiError } from "@/lib/api";
import { getBillingClient, getBillingActor, staffLogout } from "@/lib/billingAuth";
import { formatINR } from "@/lib/format";

export default function BillingCounter() {
  const navigate = useNavigate();
  const client = getBillingClient();
  const actor = getBillingActor();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [cart, setCart] = useState([]); // [{stock_item_id, mobile_model, imei, sale_price}]
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!client) return;
    client.get("/billing/accounts").then((r) => {
      setAccounts(r.data);
      if (r.data.length) setAccountId(r.data[0].id);
    }).catch((err) => toast.error(apiError(err, "Could not load payment accounts")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!client) return;
    setLoadingSearch(true);
    const t = setTimeout(() => {
      client.get("/billing/stock", { params: query ? { q: query } : {} })
        .then((r) => setResults(r.data))
        .catch((err) => toast.error(apiError(err, "Search failed")))
        .finally(() => setLoadingSearch(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!client) return <Navigate to="/staff-login" replace />;

  const cartIds = useMemo(() => new Set(cart.map((c) => c.stock_item_id)), [cart]);
  const total = useMemo(() => cart.reduce((s, c) => s + (Number(c.sale_price) || 0), 0), [cart]);

  const addToCart = (item) => {
    if (cartIds.has(item.id)) {
      toast.info("Already added to this bill");
      return;
    }
    setCart((c) => [...c, {
      stock_item_id: item.id,
      mobile_model: item.mobile_model,
      imei: item.imei,
      sale_price: item.purchase_price,
    }]);
  };

  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.stock_item_id !== id));

  const updatePrice = (id, value) =>
    setCart((c) => c.map((x) => (x.stock_item_id === id ? { ...x, sale_price: value } : x)));

  const completeBill = async () => {
    if (cart.length === 0) return toast.error("Add at least one mobile to the bill");
    if (!accountId) return toast.error("Choose a payment account");
    for (const item of cart) {
      if (!item.sale_price || Number(item.sale_price) <= 0) {
        return toast.error(`Enter a valid price for ${item.mobile_model}`);
      }
    }
    setSubmitting(true);
    try {
      const res = await client.post("/bills", {
        items: cart.map((c) => ({ stock_item_id: c.stock_item_id, sale_price: Number(c.sale_price) })),
        account_id: accountId,
        customer_name: customerName.trim() || undefined,
      });
      toast.success(`Bill #${res.data.bill_number} created`);
      navigate(`/bills/${res.data.id}/receipt`);
    } catch (err) {
      toast.error(apiError(err, "Could not complete bill"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-slate-900 text-white h-14 flex items-center px-4 lg:px-8 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-md">
            <Receipt size={16} className="text-white" />
          </div>
          <div className="font-display font-black tracking-tight">BILLING COUNTER</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300 hidden sm:inline">
            {actor?.type === "staff" ? `Staff: ${actor.name || actor.username}` : "Owner"}
          </span>
          {actor?.type === "staff" ? (
            <button onClick={staffLogout} data-testid="billing-staff-logout" className="flex items-center gap-1.5 text-slate-300 hover:text-white">
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-slate-300 hover:text-white">
              Back to Dashboard
            </button>
          )}
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-6xl mx-auto grid lg:grid-cols-5 gap-6">
        {/* Search + results */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-md">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="billing-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in-stock mobile by model or IMEI…"
                className="w-full h-11 pl-9 pr-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {loadingSearch && <div className="p-6 text-center text-sm text-slate-400">Searching…</div>}
            {!loadingSearch && results.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                {query ? "No in-stock mobile matches that search." : "No mobiles in stock right now."}
              </div>
            )}
            {!loadingSearch && results.map((item) => (
              <div key={item.id} data-testid={`billing-stock-row-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{item.mobile_model}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.imei ? `IMEI ${item.imei}` : "No IMEI recorded"} · Cost {formatINR(item.purchase_price)}
                  </div>
                </div>
                <button
                  data-testid={`billing-add-${item.id}`}
                  onClick={() => addToCart(item)}
                  disabled={cartIds.has(item.id)}
                  className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center gap-1.5"
                >
                  <Plus size={15} /> Add
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-display font-bold text-slate-900">This Bill ({cart.length} item{cart.length !== 1 ? "s" : ""})</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[40vh]">
            {cart.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">Add mobiles from the left to start a bill.</div>
            )}
            {cart.map((item) => (
              <div key={item.stock_item_id} data-testid={`cart-row-${item.stock_item_id}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{item.mobile_model}</div>
                    {item.imei && <div className="text-xs text-slate-400 truncate">IMEI {item.imei}</div>}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.stock_item_id)}
                    data-testid={`cart-remove-${item.stock_item_id}`}
                    className="text-slate-400 hover:text-rose-600 flex-shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-slate-500">Sale price</span>
                  <input
                    type="number"
                    min="0"
                    value={item.sale_price}
                    onChange={(e) => updatePrice(item.stock_item_id, e.target.value)}
                    data-testid={`cart-price-${item.stock_item_id}`}
                    className="w-32 h-9 px-2 rounded-md border border-slate-300 bg-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Customer name (optional)</label>
              <input
                data-testid="billing-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Payment received in</label>
              <select
                data-testid="billing-account-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
              >
                {accounts.length === 0 && <option value="">No accounts found</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span data-testid="billing-total" className="font-mono font-bold text-2xl text-slate-900">{formatINR(total)}</span>
            </div>
            <button
              onClick={completeBill}
              disabled={submitting || cart.length === 0}
              data-testid="billing-complete-button"
              className="w-full h-12 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Complete Bill"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
