import { formatGbp, interpretTenderPence, localStamp } from "@tillpro/shared";
import type { CustomerRecord, ProductRecord, StaffPublic } from "@tillpro/shared";
import { create } from "zustand";
import { CATEGORIES, CUSTOMERS, DEFAULT_SETTINGS, DEMO_ADMIN_USERNAME, DEMO_STAFF, PRODUCTS } from "../../../data/catalog";
import type { CategoryView, DemoStaff } from "../../../data/catalog";
import type {
  AuditEntry,
  BasketLine,
  CompletedSale,
  DialogState,
  DrawerEvent,
  FlashMessage,
  HeldSale,
  ManagerAction,
  Tender,
  TillScreen,
} from "../domain";
import { findProduct, paymentLabel, reprice, staffCanOverride, totalsOf } from "../domain";

interface TillState {
  screen: TillScreen;
  staff: StaffPublic | null;
  categories: CategoryView[];
  products: ProductRecord[];
  customers: CustomerRecord[];
  settings: typeof DEFAULT_SETTINGS;
  categoryId: string | null;
  buffer: string;
  lines: BasketLine[];
  selectedLineId: string | null;
  basketDiscountPct: number;
  noVat: boolean;
  customer: CustomerRecord | null;
  tenders: Tender[];
  paidPence: number;
  changePence: number;
  saleComplete: boolean;
  totalPence: number;
  discountPence: number;
  vatPence: number;
  nextSlip: number;
  history: CompletedSale[];
  held: HeldSale[];
  audit: AuditEntry[];
  drawer: DrawerEvent[];
  dialog: DialogState | null;
  message: FlashMessage | null;
  kiosk: boolean;
  licenceLabel: string;
  licenceBanner: string | null;
  pressDigit: (digit: string) => void;
  pressDoubleZero: () => void;
  backspace: () => void;
  clearBuffer: () => void;
  enter: () => void;
  moveSelection: (delta: number) => void;
  selectLine: (id: string) => void;
  deselectLine: () => void;
  changeSelectedQty: (delta: number) => void;
  openPriceChange: () => void;
  openCategory: (id: string) => void;
  backToCategories: () => void;
  addProduct: (productId: string) => void;
  confirmAge: (yes: boolean) => void;
  toggleNoVat: () => void;
  quickCash: (pence: number) => void;
  cash: () => void;
  openCard: () => void;
  resolveCard: (approved: boolean) => void;
  newSale: () => void;
  openDialog: (dialog: DialogState) => void;
  closeDialog: () => void;
  attachCustomer: (customer: CustomerRecord | null) => void;
  saveCustomer: (customer: CustomerRecord) => void;
  addManual: (description: string, pricePence: number, vatRate: 0 | 5 | 20) => void;
  applyLineDiscount: (pct: number) => void;
  applyBasketDiscount: (pct: number) => void;
  requestVoidLine: () => void;
  requestVoidBasket: () => void;
  requestPriceOverride: () => void;
  applyPriceOverride: (pricePence: number) => void;
  holdSale: () => void;
  recallSale: (id: string) => void;
  recordPetty: (amountPence: number, reason: string) => void;
  refundSale: (slipNo: number, reason: string) => void;
  approveManager: (pin: string) => Promise<boolean>;
  accounts: DemoStaff[];
  login: (id: string, pin: string) => Promise<boolean>;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  saveTillStaff: (input: { id: string; name: string; role: StaffPublic["role"]; pin?: string; active: boolean }) => Promise<string | null>;
  hydrate: () => Promise<void>;
  saveProductRecord: (product: ProductRecord) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  saveCategoryRecord: (category: CategoryView) => Promise<void>;
  saveSettingsRecord: (settings: TillState["settings"]) => Promise<void>;
  adjustStockQty: (productId: string, qtyDelta: number, reason: string) => Promise<void>;
  logOff: () => void;
  setScreen: (screen: TillScreen) => void;
  setKiosk: (on: boolean) => void;
  flash: (text: string, tone?: FlashMessage["tone"]) => void;
  priceCheck: () => { name: string; pricePence: number; vatRate: number } | null;
}

function blankSale() {
  return {
    lines: [] as BasketLine[],
    selectedLineId: null as string | null,
    basketDiscountPct: 0,
    noVat: false,
    customer: null as CustomerRecord | null,
    tenders: [] as Tender[],
    paidPence: 0,
    changePence: 0,
    saleComplete: false,
    totalPence: 0,
    discountPence: 0,
    vatPence: 0,
    buffer: "",
  };
}

function withTotals(lines: BasketLine[], basketDiscountPct: number, noVat: boolean) {
  const priced = reprice(lines, basketDiscountPct, noVat);
  const totals = totalsOf(priced, basketDiscountPct, noVat);
  return { lines: priced, ...totals };
}

let lineSeq = 1;
const nextLineId = () => `L${lineSeq++}`;

export const useTillStore = create<TillState>((set, get) => ({
  screen: "sale",
  staff: typeof window !== "undefined" && window.till ? null : DEMO_STAFF[0],
  accounts: DEMO_STAFF,
  categories: CATEGORIES,
  products: PRODUCTS,
  customers: CUSTOMERS,
  settings: DEFAULT_SETTINGS,
  categoryId: null,
  ...blankSale(),
  nextSlip: 1001,
  history: [],
  held: [],
  audit: [],
  drawer: [],
  dialog: null,
  message: null,
  kiosk: false,
  licenceLabel: "",
  licenceBanner: null,

  flash: (text, tone = "info") => {
    const token = Date.now();
    set({ message: { text, tone, token } });
    window.setTimeout(() => {
      if (get().message?.token === token) set({ message: null });
    }, 2800);
  },

  pressDigit: (digit) => {
    if (get().dialog || get().saleComplete) return;
    set({ buffer: `${get().buffer}${digit}`.slice(0, 18) });
  },
  pressDoubleZero: () => {
    if (get().dialog || get().saleComplete) return;
    set({ buffer: `${get().buffer}00`.slice(0, 18) });
  },
  backspace: () => set({ buffer: get().buffer.slice(0, -1) }),
  clearBuffer: () => {
    const state = get();
    if (state.saleComplete) {
      state.newSale();
      return;
    }
    if (state.dialog) return;
    if (state.lines.length > 0) {
      const descriptions = state.lines.map((line) => line.description).join(", ");
      set({
        ...withTotals([], state.basketDiscountPct, state.noVat),
        selectedLineId: null,
        buffer: "",
        tenders: [],
        paidPence: 0,
        changePence: 0,
      });
      pushAudit("void_basket", descriptions);
      get().flash("Basket cleared", "good");
      return;
    }
    set({ buffer: "" });
  },

  enter: () => {
    const state = get();
    if (state.dialog) return;
    if (state.saleComplete) {
      state.newSale();
      return;
    }
    if (!state.buffer) return;
    const product = findProduct(state.products, state.buffer);
    if (!product) {
      state.flash("Item not found", "bad");
      return;
    }
    set({ buffer: "" });
    if (product.ageRestricted) {
      set({ dialog: { name: "age", productId: product.id, qty: 1 } });
      return;
    }
    commitProduct(product, 1);
  },

  moveSelection: (delta) => {
    const { lines, selectedLineId } = get();
    if (lines.length === 0) return;
    const index = lines.findIndex((line) => line.id === selectedLineId);
    const start = index < 0 ? (delta > 0 ? -1 : 0) : index;
    const next = lines[Math.max(0, Math.min(lines.length - 1, start + delta))];
    if (next) set({ selectedLineId: next.id });
  },
  selectLine: (id) => set({ selectedLineId: id }),
  deselectLine: () => set({ selectedLineId: null }),

  changeSelectedQty: (delta) => {
    const state = get();
    const line = state.lines.find((item) => item.id === state.selectedLineId);
    if (!line) {
      state.flash("Select a basket line first", "bad");
      return;
    }
    const qty = line.qty + delta;
    if (qty < 1) {
      state.flash("Quantity is already 1", "info");
      return;
    }
    const lines = state.lines.map((item) => (item.id === line.id ? { ...item, qty } : item));
    set({ ...withTotals(lines, state.basketDiscountPct, state.noVat) });
  },

  openPriceChange: () => {
    const state = get();
    if (!state.lines.some((line) => line.id === state.selectedLineId)) {
      state.flash("Select a basket line first", "bad");
      return;
    }
    set({ dialog: { name: "priceOverride" }, buffer: "" });
  },
  openCategory: (id) => set({ categoryId: id }),
  backToCategories: () => set({ categoryId: null }),

  addProduct: (productId) => {
    const state = get();
    if (state.dialog) return;
    if (state.saleComplete) state.newSale();
    const product = get().products.find((item) => item.id === productId && item.active);
    if (!product) return;
    let qty = 1;
    const buffer = get().buffer;
    if (/^\d{1,2}$/.test(buffer) && Number(buffer) >= 1) {
      qty = Number(buffer);
      set({ buffer: "" });
    }
    if (product.ageRestricted) {
      set({ dialog: { name: "age", productId, qty } });
      return;
    }
    commitProduct(product, qty);
  },

  confirmAge: (yes) => {
    const dialog = get().dialog;
    if (dialog?.name !== "age") return;
    set({ dialog: null });
    if (!yes) {
      get().flash("Age check cancelled", "info");
      return;
    }
    const product = get().products.find((item) => item.id === dialog.productId);
    if (!product) return;
    pushAudit("age_check", `${product.name} confirmed`);
    commitProduct(product, dialog.qty);
  },

  toggleNoVat: () => {
    if (get().dialog) return;
    const noVat = !get().noVat;
    const next = withTotals(get().lines, get().basketDiscountPct, noVat);
    set({ noVat, ...next });
  },

  quickCash: (pence) => tender(pence),
  cash: () => {
    const state = get();
    if (state.dialog) return;
    if (state.saleComplete) return;
    if (state.lines.length === 0) {
      state.flash("Nothing to pay", "bad");
      return;
    }
    const due = state.totalPence - state.paidPence;
    if (!state.buffer) {
      tender(due);
      return;
    }
    const amount = interpretTenderPence(state.buffer);
    if (amount === null || amount <= 0) {
      state.flash("Enter a cash amount, then Cash", "bad");
      return;
    }
    set({ buffer: "" });
    tender(amount);
  },

  openCard: () => {
    const state = get();
    if (state.saleComplete || state.dialog) return;
    const due = state.totalPence - state.paidPence;
    if (state.lines.length === 0 || due <= 0) {
      state.flash(state.lines.length === 0 ? "Nothing to pay" : "Nothing left to pay", "bad");
      return;
    }
    set({ dialog: { name: "card" } });
  },

  resolveCard: (approved) => {
    const state = get();
    if (state.dialog?.name !== "card") return;
    set({ dialog: null });
    if (!approved) {
      state.flash("Card declined", "bad");
      pushAudit("card_declined", formatGbp(state.totalPence - state.paidPence));
      return;
    }
    const due = get().totalPence - get().paidPence;
    const authCode = `TP${Date.now().toString().slice(-6)}`;
    addTender({ type: "card", amountPence: due, authCode });
  },

  newSale: () => set({ ...blankSale(), dialog: null, categoryId: null }),

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),

  attachCustomer: (customer) => set({ customer, dialog: null }),
  saveCustomer: (customer) => {
    set({
      customers: [...get().customers.filter((item) => item.id !== customer.id), customer],
      customer,
      dialog: null,
    });
  },

  addManual: (description, pricePence, vatRate) => {
    if (!description.trim() || pricePence <= 0) {
      get().flash("Enter a description and a price", "bad");
      return;
    }
    const line: BasketLine = {
      id: nextLineId(),
      productId: null,
      description: description.trim(),
      qty: 1,
      unitPricePence: pricePence,
      discountPct: 0,
      vatRate,
      costPence: 0,
      ageRestricted: false,
      amountPence: 0,
    };
    const lines = [...get().lines, line];
    set({ ...withTotals(lines, get().basketDiscountPct, get().noVat), selectedLineId: line.id, dialog: null, buffer: "" });
    pushAudit("manual_item", `${line.description} ${formatGbp(pricePence)}`);
  },

  applyLineDiscount: (pct) => {
    const selected = get().lines.find((line) => line.id === get().selectedLineId);
    if (!selected) {
      get().flash("Select a basket line first", "bad");
      return;
    }
    const lines = get().lines.map((line) => (line.id === selected.id ? { ...line, discountPct: pct } : line));
    set({ ...withTotals(lines, get().basketDiscountPct, get().noVat), dialog: null, buffer: "" });
  },

  applyBasketDiscount: (pct) => {
    set({ ...withTotals(get().lines, pct, get().noVat), basketDiscountPct: pct, dialog: null, buffer: "" });
  },

  requestVoidLine: () => {
    const line = get().lines.find((item) => item.id === get().selectedLineId);
    if (!line) {
      get().flash("Select a basket line first", "bad");
      return;
    }
    voidSelectedLine();
  },

  requestVoidBasket: () => {
    if (get().lines.length === 0) {
      get().flash("Basket is already empty", "info");
      return;
    }
    if (get().totalPence >= get().settings.voidPinThresholdPence && !staffCanOverride(get().staff)) {
      set({ dialog: { name: "manager", purpose: "Void the basket", action: { type: "voidBasket" } } });
      return;
    }
    voidBasket();
  },

  requestPriceOverride: () => {
    const line = get().lines.find((item) => item.id === get().selectedLineId);
    if (!line) {
      get().flash("Select a basket line first", "bad");
      return;
    }
    const price = interpretTenderPence(get().buffer);
    if (price === null || price <= 0) {
      set({ dialog: { name: "priceOverride" } });
      return;
    }
    askPriceOverride(price);
  },

  applyPriceOverride: (pricePence) => askPriceOverride(pricePence),

  holdSale: () => {
    const state = get();
    if (state.lines.length === 0) {
      state.flash("Nothing to hold", "bad");
      return;
    }
    const held: HeldSale = {
      id: `H${Date.now()}`,
      at: localStamp(),
      lines: state.lines,
      basketDiscountPct: state.basketDiscountPct,
      noVat: state.noVat,
      customer: state.customer,
      label: state.lines.map((line) => line.description).slice(0, 2).join(", "),
    };
    set({ held: [held, ...state.held], ...blankSale(), dialog: null });
    void window.till?.saveHeld?.(held.id, held.label, held);
    void window.till?.saveOpenSale?.(null);
    get().flash("Sale held", "good");
  },

  recallSale: (id) => {
    const held = get().held.find((item) => item.id === id);
    if (!held) return;
    if (get().lines.length > 0) {
      get().flash("Hold or clear the current sale first", "bad");
      return;
    }
    const priced = withTotals(held.lines, held.basketDiscountPct, held.noVat);
    set({
      held: get().held.filter((item) => item.id !== id),
      ...priced,
      basketDiscountPct: held.basketDiscountPct,
      noVat: held.noVat,
      customer: held.customer,
      dialog: null,
      selectedLineId: held.lines[0]?.id ?? null,
    });
    void window.till?.deleteHeld?.(id);
  },

  recordPetty: (amountPence, reason) => {
    if (amountPence <= 0 || !reason.trim()) {
      get().flash("Enter an amount and a reason", "bad");
      return;
    }
    const staff = requireStaff();
    const sale: CompletedSale = {
      slipNo: get().nextSlip,
      at: localStamp(),
      staffId: staff.id,
      staffName: staff.name,
      lines: [],
      basketDiscountPct: 0,
      noVat: false,
      totalPence: 0,
      discountPence: 0,
      vatPence: 0,
      paidPence: 0,
      changePence: 0,
      paymentLabel: "PAY OUT",
      payOutPence: amountPence,
      customerName: null,
      kind: "payout",
      reason: reason.trim(),
      tenders: [],
    };
    set({ history: [sale, ...get().history], nextSlip: get().nextSlip + 1, dialog: null, buffer: "" });
    pushAudit("petty_cash", `${formatGbp(amountPence)} ${reason.trim()}`);
    void persistCompleted(sale);
    get().flash("Pay out recorded", "good");
  },

  refundSale: (slipNo, reason) => {
    const original = get().history.find((sale) => sale.slipNo === slipNo && sale.kind === "sale");
    if (!original) {
      get().flash("Sale not found", "bad");
      return;
    }
    if (!reason.trim()) {
      get().flash("A reason is required", "bad");
      return;
    }
    const staff = requireStaff();
    const refund: CompletedSale = {
      ...original,
      slipNo: get().nextSlip,
      at: localStamp(),
      staffId: staff.id,
      staffName: staff.name,
      kind: "refund",
      reason: reason.trim(),
      paymentLabel: original.paymentLabel,
      changePence: 0,
      paidPence: original.totalPence,
      payOutPence: original.totalPence,
      refundOfSlip: slipNo,
    };
    set({ history: [refund, ...get().history], nextSlip: get().nextSlip + 1, dialog: null });
    pushAudit("refund", `Slip ${slipNo}: ${reason.trim()}`);
    void persistCompleted(refund);
    get().flash(`Refund ${formatGbp(original.totalPence)} recorded`, "good");
  },

  approveManager: async (pin) => {
    const dialog = get().dialog;
    if (dialog?.name !== "manager") return false;
    if (window.till?.checkManager) {
      const result = await window.till.checkManager(pin);
      if (!result.ok || !result.staff) {
        get().flash("Manager PIN not recognised", "bad");
        return false;
      }
      pushAudit("manager_override", `${dialog.purpose} by ${result.staff.name}`);
      runManagerAction(dialog.action);
      return true;
    }
    const manager = DEMO_STAFF.find(
      (person) => person.pin === pin && person.active && (person.role === "manager" || person.role === "admin"),
    );
    if (!manager) {
      get().flash("Manager PIN not recognised", "bad");
      return false;
    }
    pushAudit("manager_override", `${dialog.purpose} by ${manager.name}`);
    runManagerAction(dialog.action);
    return true;
  },

  login: async (id, pin) => {
    if (window.till?.login) {
      const result = await window.till.login(id, pin);
      if (!result.ok || !result.staff) return false;
      set({ staff: result.staff, screen: "sale", dialog: null });
      return true;
    }
    const staff = get().accounts.find((person) => person.role === "cashier" && person.id === id.trim() && person.pin === pin && person.active);
    if (!staff) return false;
    set({ staff, screen: "sale", dialog: null });
    pushAudit("login", staff.name);
    return true;
  },

  loginAdmin: async (username, password) => {
    if (window.till?.loginAdmin) {
      const result = await window.till.loginAdmin(username, password);
      if (!result.ok || !result.staff) return false;
      set({ staff: result.staff, screen: "sale", dialog: null });
      return true;
    }
    const admin = get().accounts.find((person) => person.role === "admin" && person.active);
    if (!admin || username.trim().toLowerCase() !== DEMO_ADMIN_USERNAME || password !== admin.pin) return false;
    set({ staff: admin, screen: "sale", dialog: null });
    pushAudit("login", admin.name);
    return true;
  },

  saveTillStaff: async (input) => {
    const actor = get().staff;
    if (!actor) return "Sign in required.";
    if (window.till?.saveStaff) {
      try {
        await window.till.saveStaff(input, actor.id);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save.";
        return message.replace(/^Error invoking remote method '[^']+': /, "");
      }
    }
    const accounts = get().accounts;
    if (actor.role !== "admin") {
      if (input.id !== actor.id || input.role !== "cashier" || !input.pin) return "A cashier can only change their own PIN.";
      set({ accounts: accounts.map((person) => (person.id === actor.id ? { ...person, pin: input.pin ?? person.pin } : person)) });
      return null;
    }
    if (input.role === "cashier" && accounts.some((person) => person.role === "cashier" && person.active && person.id !== input.id)) {
      return "Only one cashier can be added.";
    }
    if (input.role === "admin" && input.id !== "1") return "The admin account is the shop account from the dashboard.";
    const existing = accounts.find((person) => person.id === input.id);
    if (!existing) {
      if (!input.pin) return "Enter a PIN.";
      set({ accounts: [...accounts, { id: input.id, name: input.name, role: input.role, pin: input.pin, active: true }] });
      return null;
    }
    set({
      accounts: accounts.map((person) =>
        person.id === input.id ? { ...person, name: input.name, role: input.role, pin: input.pin || person.pin, active: input.active } : person,
      ),
    });
    return null;
  },

  hydrate: async () => {
    if (!window.till?.bootstrap) return;
    const data = await window.till.bootstrap();
    const open = data.openSale as {
      lines?: BasketLine[];
      basketDiscountPct?: number;
      noVat?: boolean;
      customer?: CustomerRecord | null;
      tenders?: Tender[];
      paidPence?: number;
      buffer?: string;
      selectedLineId?: string | null;
    } | null;
    const lines = open?.lines ?? [];
    const priced = withTotals(lines, open?.basketDiscountPct ?? 0, open?.noVat ?? false);
    set({
      products: data.products,
      categories: data.categories.filter((category) => category.active),
      customers: data.customers,
      settings: data.settings,
      history: data.history as CompletedSale[],
      held: data.held.map((item) => item.payload as HeldSale),
      nextSlip: data.nextSlip,
      ...priced,
      basketDiscountPct: open?.basketDiscountPct ?? 0,
      noVat: open?.noVat ?? false,
      customer: open?.customer ?? null,
      tenders: open?.tenders ?? [],
      paidPence: open?.paidPence ?? 0,
      buffer: open?.buffer ?? "",
      selectedLineId: open?.selectedLineId ?? null,
      staff: null,
    });
  },

  saveProductRecord: async (product) => {
    if (window.till?.saveProduct) {
      const products = await window.till.saveProduct(product);
      set({ products });
      return;
    }
    set({ products: [...get().products.filter((item) => item.id !== product.id), product] });
  },

  removeProduct: async (id) => {
    if (window.till?.deleteProduct) {
      set({ products: await window.till.deleteProduct(id) });
      return;
    }
    set({ products: get().products.map((item) => (item.id === id ? { ...item, active: false } : item)) });
  },

  saveCategoryRecord: async (category) => {
    if (window.till?.saveCategory) {
      const categories = await window.till.saveCategory(category);
      set({ categories: categories.filter((item) => item.active) });
      return;
    }
    set({ categories: [...get().categories.filter((item) => item.id !== category.id), category] });
  },

  saveSettingsRecord: async (settings) => {
    if (window.till?.saveSettings) {
      const saved = await window.till.saveSettings(settings);
      set({ settings: saved });
      return;
    }
    set({ settings });
  },

  adjustStockQty: async (productId, qtyDelta, reason) => {
    const staff = get().staff;
    if (window.till?.adjustStock) {
      set({ products: await window.till.adjustStock(productId, qtyDelta, reason, staff?.id ?? "") });
      return;
    }
    set({
      products: get().products.map((item) => (item.id === productId ? { ...item, stockQty: item.stockQty + qtyDelta } : item)),
    });
  },

  logOff: () => {
    const staff = get().staff;
    if (staff) pushAudit("logoff", staff.name);
    set({ staff: null, dialog: null, screen: "sale" });
  },

  setScreen: (screen) => set({ screen, dialog: null }),
  setKiosk: (on) => set({ kiosk: on }),

  priceCheck: () => {
    const product = findProduct(get().products, get().buffer);
    if (!product) return null;
    return { name: product.name, pricePence: product.pricePence, vatRate: product.vatRate };
  },
}));

function requireStaff(): StaffPublic {
  const staff = useTillStore.getState().staff;
  if (!staff) throw new Error("Not signed in");
  return staff;
}

function persistCompleted(sale: CompletedSale) {
  void window.till?.completeSale?.(sale).then((saved) => {
    useTillStore.setState((state) => ({
      products: saved.products,
      nextSlip: saved.nextSlip,
      history: state.history.map((item) => (item.at === sale.at ? { ...item, slipNo: saved.sale.slipNo } : item)),
    }));
  });
}

function pushAudit(action: string, detail: string) {
  const staff = useTillStore.getState().staff;
  if (staff && window.till?.audit) void window.till.audit(staff.id, action, detail);
  const entry: AuditEntry = {
    id: `A${Date.now()}`,
    at: localStamp(),
    staffId: staff?.id ?? "",
    action,
    detail,
  };
  useTillStore.setState({ audit: [entry, ...useTillStore.getState().audit] });
}

function commitProduct(product: ProductRecord, qty: number) {
  const state = useTillStore.getState();
  const existing = state.lines.find(
    (line) => line.productId === product.id && line.discountPct === 0 && line.unitPricePence === product.pricePence,
  );
  let lines: BasketLine[];
  let selected = existing?.id ?? "";
  if (existing) {
    lines = state.lines.map((line) => (line.id === existing.id ? { ...line, qty: line.qty + qty } : line));
    selected = existing.id;
  } else {
    const line: BasketLine = {
      id: nextLineId(),
      productId: product.id,
      description: product.name,
      qty,
      unitPricePence: product.pricePence,
      discountPct: 0,
      vatRate: product.vatRate,
      costPence: product.costPence,
      ageRestricted: product.ageRestricted,
      amountPence: 0,
    };
    lines = [...state.lines, line];
    selected = line.id;
  }
  useTillStore.setState({
    ...withTotals(lines, state.basketDiscountPct, state.noVat),
    selectedLineId: selected,
  });
}

function tender(amountPence: number) {
  const state = useTillStore.getState();
  if (state.saleComplete || state.dialog) return;
  if (state.lines.length === 0) {
    state.flash("Nothing to pay", "bad");
    return;
  }
  if (amountPence <= 0) {
    state.flash("Enter a cash amount", "bad");
    return;
  }
  addTender({ type: "cash", amountPence });
}

function addTender(tender: Tender) {
  const state = useTillStore.getState();
  const tenders = [...state.tenders, tender];
  const paid = tenders.reduce((sum, item) => sum + item.amountPence, 0);
  if (paid < state.totalPence) {
    useTillStore.setState({ tenders, paidPence: paid, changePence: 0, buffer: "" });
    state.flash(`Still due ${formatGbp(state.totalPence - paid)}`, "info");
    return;
  }
  const change = paid - state.totalPence;
  const staff = state.staff;
  const sale: CompletedSale = {
    slipNo: state.nextSlip,
    at: localStamp(),
    staffId: staff?.id ?? "",
    staffName: staff?.name ?? "",
    lines: state.lines,
    basketDiscountPct: state.basketDiscountPct,
    noVat: state.noVat,
    totalPence: state.totalPence,
    discountPence: state.discountPence,
    vatPence: state.vatPence,
    paidPence: paid,
    changePence: change,
    paymentLabel: paymentLabel(tenders),
    payOutPence: 0,
    customerName: state.customer?.name ?? null,
    kind: "sale",
    tenders,
  };
  useTillStore.setState({
    tenders,
    paidPence: paid,
    changePence: change,
    saleComplete: true,
    buffer: "",
    history: [sale, ...state.history],
    nextSlip: state.nextSlip + 1,
    dialog: { name: "change" },
  });
  void persistCompleted(sale);
  void window.till?.saveOpenSale?.(null);
}

function voidSelectedLine() {
  const state = useTillStore.getState();
  const line = state.lines.find((item) => item.id === state.selectedLineId);
  if (!line) return;
  const lines = state.lines.filter((item) => item.id !== line.id);
  useTillStore.setState({
    ...withTotals(lines, state.basketDiscountPct, state.noVat),
    selectedLineId: null,
    dialog: null,
  });
  pushAudit("void_line", line.description);
  useTillStore.getState().flash("Line voided", "good");
}

function voidBasket() {
  const descriptions = useTillStore.getState().lines.map((line) => line.description).join(", ");
  useTillStore.setState({ ...blankSale(), dialog: null });
  pushAudit("void_basket", descriptions);
  useTillStore.getState().flash("Basket voided", "good");
}

function askPriceOverride(pricePence: number) {
  const state = useTillStore.getState();
  if (!state.lines.some((line) => line.id === state.selectedLineId)) {
    state.flash("Select a basket line first", "bad");
    return;
  }
  if (!staffCanOverride(state.staff)) {
    setDialog({ name: "manager", purpose: "Price override", action: { type: "priceOverride", pricePence } });
    return;
  }
  applyOverride(pricePence);
}

function applyOverride(pricePence: number) {
  const state = useTillStore.getState();
  const lines = state.lines.map((line) =>
    line.id === state.selectedLineId ? { ...line, unitPricePence: pricePence } : line,
  );
  useTillStore.setState({ ...withTotals(lines, state.basketDiscountPct, state.noVat), dialog: null, buffer: "" });
  pushAudit("price_override", formatGbp(pricePence));
}

function setDialog(dialog: DialogState) {
  useTillStore.setState({ dialog });
}

function runManagerAction(action: ManagerAction) {
  if (action.type === "voidLine") voidSelectedLine();
  else if (action.type === "voidBasket") voidBasket();
  else if (action.type === "priceOverride") applyOverride(action.pricePence);
  else useTillStore.getState().refundSale(action.slipNo, action.reason);
}

export function openDrawer(reason: string) {
  const staff = useTillStore.getState().staff;
  const event: DrawerEvent = {
    id: `D${Date.now()}`,
    at: localStamp(),
    staffId: staff?.id ?? "",
    reason,
  };
  useTillStore.setState({ drawer: [event, ...useTillStore.getState().drawer] });
  if (window.till?.recordDrawer) void window.till.recordDrawer(staff?.id ?? "", reason);
  else pushAudit("no_sale", reason);
  useTillStore.getState().flash("Cash drawer opened", "good");
}
