import api from "./api";
import staffApi from "./staffApi";

// The billing counter and receipt pages are reachable either by the shop
// owner (their normal mbt_token session) or by shop staff (a separate
// mbt_staff_token session, no access to anything else in the app). Both
// hit the same backend routes, which accept either token type — this just
// picks the right axios client + a small "who is using this" label.
export function getBillingClient() {
  if (localStorage.getItem("mbt_token")) return api;
  if (localStorage.getItem("mbt_staff_token")) return staffApi;
  return null;
}

export function getBillingActor() {
  if (localStorage.getItem("mbt_token")) return { type: "owner" };
  const raw = localStorage.getItem("mbt_staff_info");
  if (raw) {
    try {
      return { type: "staff", ...JSON.parse(raw) };
    } catch {
      // ignore malformed cache
    }
  }
  return null;
}

export function staffLogout() {
  localStorage.removeItem("mbt_staff_token");
  localStorage.removeItem("mbt_staff_info");
  window.location.href = "/staff-login";
}
