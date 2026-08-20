export const TID = {
  // auth
  loginEmail: "login-email-input",
  loginPassword: "login-password-input",
  loginSubmit: "login-submit-button",
  loginError: "login-error-message",
  logoutBtn: "logout-button",
  // nav
  nav: (k) => `nav-${k}`,
  // dashboard
  totalPaisa: "dashboard-total-paisa",
  statCash: "stat-cash-balance",
  statBank: "stat-total-bank",
  statUpi: "stat-total-upi",
  accountBreakdownRow: (id) => `account-breakdown-${id}`,
  // accounts
  addAccountBtn: "add-account-button",
  accountForm: "account-form",
  accountFormSubmit: "account-form-submit",
  accountRow: (id) => `account-row-${id}`,
  accountToggle: (id) => `account-toggle-${id}`,
  accountEdit: (id) => `account-edit-${id}`,
  accountView: (id) => `account-view-${id}`,
  transferBtn: "open-transfer-button",
  transferForm: "transfer-form",
  transferSubmit: "transfer-submit",
  adjustBtn: (id) => `account-adjust-${id}`,
  // retail
  addSaleBtn: "add-sale-button",
  saleForm: "sale-form",
  saleSubmit: "sale-form-submit",
  // wholesale
  addCustomerBtn: "add-customer-button",
  addSupplyBtn: "add-supply-button",
  addWholesalePaymentBtn: "add-wholesale-payment-button",
  wholesalePaymentSubmit: "wholesale-payment-submit",
  // stock
  addStockBtn: "add-stock-button",
  stockSubmit: "stock-form-submit",
  // credit card
  addCardBtn: "add-card-button",
  cardSubmit: "card-form-submit",
  cardTxnBtn: (id) => `card-txn-${id}`,
  // poonji
  addPoonjiBtn: "add-poonji-button",
  poonjiSubmit: "poonji-form-submit",
};
