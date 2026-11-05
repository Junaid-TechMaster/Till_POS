import type { CustomerRecord, ProductRecord, ShopSettings, StaffPublic, VatRate } from "@tillpro/shared";
import { QUICK_CASH_DEFAULTS_PENCE } from "@tillpro/shared";

export interface DemoStaff extends StaffPublic {
  pin: string;
}

export interface CategoryView {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  image?: string | null;
}

export const DEMO_ADMIN_USERNAME = "demo-shop";

export const DEMO_STAFF: DemoStaff[] = [
  { id: "1", name: "Admin", role: "admin", active: true, pin: "DemoShop-12345" },
];

export const CATEGORIES: CategoryView[] = [
  { id: "fruit", name: "Fruit & Veg", color: "#1f8a34", sortOrder: 1 },
  { id: "grocery", name: "Grocery", color: "#e07a1f", sortOrder: 2 },
  { id: "household", name: "Household", color: "#2f80ed", sortOrder: 3 },
  { id: "pet", name: "Pet Food", color: "#c0392b", sortOrder: 4 },
  { id: "cards", name: "Greeting Cards", color: "#1e9e52", sortOrder: 5 },
  { id: "drinks", name: "Drinks", color: "#8e44ad", sortOrder: 6 },
  { id: "stationery", name: "Stationery", color: "#2471a3", sortOrder: 7 },
  { id: "lottery", name: "Lottery", color: "#c4920a", sortOrder: 8 },
  { id: "bills", name: "Bill Payments", color: "#148f77", sortOrder: 9 },
  { id: "topups", name: "Top-ups", color: "#00838f", sortOrder: 10 },
  { id: "bakery", name: "Bakery", color: "#d35400", sortOrder: 11 },
  { id: "frozen", name: "Frozen", color: "#2e86c1", sortOrder: 12 },
  { id: "snacks", name: "Snacks", color: "#e74c3c", sortOrder: 13 },
  { id: "news", name: "Newspapers", color: "#5d6d7e", sortOrder: 14 },
  { id: "alcohol", name: "Off Licence", color: "#6c3483", sortOrder: 15 },
  { id: "toiletries", name: "Toiletries", color: "#0e8f78", sortOrder: 16 },
];

function item(
  id: string,
  name: string,
  categoryId: string,
  pricePence: number,
  vatRate: VatRate,
  extra: Partial<ProductRecord> = {},
): ProductRecord {
  return {
    id,
    name,
    categoryId,
    pricePence,
    vatRate,
    plu: id,
    barcode: `000${id.padStart(10, "0")}`,
    costPence: extra.costPence ?? Math.round(pricePence * 0.62),
    stockQty: extra.stockQty ?? 24,
    minStock: extra.minStock ?? 6,
    image: null,
    ageRestricted: extra.ageRestricted ?? false,
    active: true,
  };
}

export const PRODUCTS: ProductRecord[] = [
  item("101", "Bananas", "fruit", 35, 0),
  item("102", "Apples 4 pack", "fruit", 180, 0),
  item("103", "Carrots 1kg", "fruit", 70, 0),
  item("104", "Tomatoes", "fruit", 110, 0),
  item("201", "Whole milk 2L", "grocery", 145, 0),
  item("202", "White loaf", "grocery", 130, 0),
  item("203", "Eggs 6", "grocery", 160, 0),
  item("204", "Basmati rice 1kg", "grocery", 190, 0),
  item("301", "Washing-up liquid", "household", 125, 20),
  item("302", "Kitchen roll", "household", 200, 20),
  item("303", "Bin liners", "household", 150, 20),
  item("304", "Gas top-up", "household", 1000, 5),
  item("401", "Dog food tin", "pet", 110, 20),
  item("402", "Cat food pouch", "pet", 85, 20),
  item("403", "Cat litter", "pet", 450, 20),
  item("501", "Birthday card", "cards", 250, 20),
  item("502", "Thank you card", "cards", 200, 20),
  item("503", "Envelope pack", "cards", 175, 20),
  item("601", "Sparkling water", "drinks", 80, 20),
  item("602", "Orange juice 1L", "drinks", 190, 20),
  item("603", "Cola can", "drinks", 110, 20),
  item("604", "Still water", "drinks", 70, 20),
  item("701", "Blue pen", "stationery", 80, 20),
  item("702", "Notebook", "stationery", 150, 20),
  item("703", "Sticky tape", "stationery", 120, 20),
  item("801", "Draw entry £2", "lottery", 200, 0),
  item("802", "Scratch card £1", "lottery", 100, 0, { ageRestricted: true }),
  item("803", "Draw entry £5", "lottery", 500, 0),
  item("901", "Electric key £10", "bills", 1000, 5),
  item("902", "Council payment", "bills", 2000, 0),
  item("903", "Phone bill payment", "bills", 1500, 20),
  item("1001", "Mobile credit £10", "topups", 1000, 0),
  item("1002", "Mobile credit £20", "topups", 2000, 0),
  item("1003", "Calling credit £5", "topups", 500, 20),
  item("1101", "Bread roll", "bakery", 60, 0),
  item("1102", "Doughnut", "bakery", 100, 20),
  item("1103", "Sausage roll", "bakery", 140, 20),
  item("1201", "Frozen peas", "frozen", 150, 0),
  item("1202", "Ice cream tub", "frozen", 250, 20),
  item("1203", "Frozen chips", "frozen", 220, 0),
  item("1301", "Ready salted crisps", "snacks", 90, 20),
  item("1302", "Chocolate bar", "snacks", 100, 20),
  item("1303", "Biscuits", "snacks", 140, 20),
  item("1401", "Daily paper", "news", 120, 0),
  item("1402", "Weekend paper", "news", 200, 0),
  item("1403", "Puzzle magazine", "news", 250, 20),
  item("1501", "Lager 4 pack", "alcohol", 550, 20, { ageRestricted: true }),
  item("1502", "Red wine", "alcohol", 650, 20, { ageRestricted: true }),
  item("1503", "Cider can", "alcohol", 180, 20, { ageRestricted: true }),
  item("1601", "Soap bar", "toiletries", 100, 20),
  item("1602", "Toothpaste", "toiletries", 160, 20),
  item("1603", "Shampoo", "toiletries", 220, 20),
];

export const CUSTOMERS: CustomerRecord[] = [
  { id: "c1", name: "A. Rahman", phone: "07111 000111", email: "", notes: "" },
  { id: "c2", name: "Priya Shah", phone: "07222 000222", email: "", notes: "Account" },
  { id: "c3", name: "Tom Ellis", phone: "07333 000333", email: "", notes: "" },
];

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "TillPro Demo Shop",
  addressLines: ["12 Market Street", "Manchester", "M1 1AE"],
  vatNumber: "GB000000000",
  phone: "0161 496 0123",
  posNumber: 1,
  receiptFooter: "Thank you. Please keep this receipt.",
  quickCashPence: [...QUICK_CASH_DEFAULTS_PENCE],
  voidPinThresholdPence: 500,
};
