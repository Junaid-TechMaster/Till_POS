import { VAT_RATES, formatGbp, type ProductRecord, type VatRate } from "@tillpro/shared";
import { useState } from "react";
import { takeCatalogueTab, type CatalogueTab } from "../catalogueNav";
import { StockEditor } from "./StockScreen";
import { useTillStore } from "../store/useTillStore";

const COLOURS = ["#1f8a34", "#0e7c86", "#1d4e89", "#c45500", "#b42318", "#6b3fa0", "#8a6a12", "#334155"];

const empty = (): ProductRecord => ({
  id: `p${Date.now()}`,
  name: "",
  barcode: "",
  plu: "",
  categoryId: useTillStore.getState().categories[0]?.id ?? "grocery",
  pricePence: 0,
  costPence: 0,
  vatRate: 20,
  stockQty: 0,
  minStock: 0,
  image: null,
  ageRestricted: false,
  active: true,
});

type Tab = CatalogueTab;

export function ProductsScreen() {
  const products = useTillStore((state) => state.products);
  const categories = useTillStore((state) => state.categories);
  const setScreen = useTillStore((state) => state.setScreen);
  const saveProduct = useTillStore((state) => state.saveProductRecord);
  const removeProduct = useTillStore((state) => state.removeProduct);
  const saveCategory = useTillStore((state) => state.saveCategoryRecord);
  const [tab, setTab] = useState<Tab>(takeCatalogueTab);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ProductRecord | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(COLOURS[0]);
  const [categoryImage, setCategoryImage] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const shown = products.filter((product) => `${product.name} ${product.barcode} ${product.plu}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="screen-page" data-testid="products-screen">
      <header className="page-head">
        <h1 className="text-2xl font-extrabold">Catalogue</h1>
        <div className="flex gap-2">
          <button type="button" className={`tp-btn ${tab === "products" ? "tone-green" : "tone-teal"}`} onClick={() => setTab("products")}>
            Products
          </button>
          <button type="button" className={`tp-btn ${tab === "categories" ? "tone-green" : "tone-teal"}`} onClick={() => setTab("categories")}>
            Categories
          </button>
          <button type="button" className={`tp-btn ${tab === "stock" ? "tone-green" : "tone-teal"}`} onClick={() => setTab("stock")}>
            Stock
          </button>
          <button type="button" className="tp-btn tone-clear" onClick={() => setScreen("sale")}>
            Close
          </button>
        </div>
      </header>

      {tab === "stock" ? <StockEditor /> : null}

      {tab === "categories" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <form
            className="flex flex-col gap-2 rounded bg-white p-3 text-[var(--tp-ink)]"
            onSubmit={(event) => {
              event.preventDefault();
              const name = categoryName.trim();
              if (!name) return;
              const existing = categories.find((category) => category.id === editingCategoryId);
              const id = existing?.id ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Date.now()}`);
              void saveCategory({
                id,
                name,
                color: categoryColor,
                sortOrder: existing?.sortOrder ?? categories.length + 1,
                image: categoryImage,
              });
              setCategoryName("");
              setCategoryImage(null);
              setEditingCategoryId(null);
            }}
          >
            <h2 className="text-xl font-extrabold">{editingCategoryId ? "Edit category" : "Add a category"}</h2>
            <label className="field">
              Name
              <input data-osk="true" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required placeholder="Category name" />
            </label>
            <label className="field">
              Image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCategoryImage(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {categoryImage ? <img src={categoryImage} alt="" className="h-16 w-16 rounded object-cover" /> : null}
            <div className="choice-grid cols-4">
              {COLOURS.map((color) => (
                <button key={color} type="button" className="tp-btn" style={{ background: color, outline: categoryColor === color ? "3px solid white" : undefined }} onClick={() => setCategoryColor(color)} />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="tp-btn tone-green">
                Save category
              </button>
              {editingCategoryId ? (
                <button
                  type="button"
                  className="tp-btn tone-clear"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCategoryName("");
                    setCategoryColor(COLOURS[0]);
                    setCategoryImage(null);
                  }}
                >
                  New category
                </button>
              ) : null}
            </div>
            <p>Tap a category below. Its name appears in the Name box so you can change it.</p>
          </form>
          <div className="min-h-0 overflow-auto rounded bg-white">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="flex w-full items-center gap-3 border-b border-[#e1e7e9] px-3 py-3 text-left"
                onClick={() => {
                  setEditingCategoryId(category.id);
                  setCategoryName(category.name);
                  setCategoryColor(category.color);
                  setCategoryImage(category.image ?? null);
                }}
              >
                {category.image ? (
                  <img src={category.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded" style={{ background: category.color }} />
                )}
                <span className="font-extrabold text-[var(--tp-ink)]">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex gap-2">
              <input data-osk="true" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, barcode or PLU" className="min-h-14 min-w-0 flex-1 rounded border-2 border-[#b7c4c8] px-3 text-xl text-[var(--tp-ink)]" />
              <button type="button" className="tp-btn tone-green" onClick={() => setDraft(empty())}>
                Add product
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded bg-white">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PLU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.filter((product) => product.active).map((product) => (
                    <tr key={product.id}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <button type="button" className="linkish" onClick={() => setDraft(product)}>
                          <span className="grid grid-cols-5 px-2">
                            <span>{product.plu}</span>
                            <span>{product.name}</span>
                            <span>{categories.find((category) => category.id === product.categoryId)?.name ?? ""}</span>
                            <span>{formatGbp(product.pricePence)}</span>
                            <span>{product.stockQty}</span>
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="min-h-0 overflow-auto rounded bg-white p-3 text-[var(--tp-ink)]">
            {draft ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.name.trim()) return;
                  void saveProduct({ ...draft, name: draft.name.trim(), plu: draft.plu || draft.id, barcode: draft.barcode || draft.plu || draft.id });
                  setDraft(null);
                }}
              >
                <h2 className="text-xl font-extrabold">{products.some((product) => product.id === draft.id) ? "Edit product" : "New product"}</h2>
                <label className="field">
                  Name
                  <input data-osk="true" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="field">
                    Barcode
                    <input value={draft.barcode} onChange={(event) => setDraft({ ...draft, barcode: event.target.value })} />
                  </label>
                  <label className="field">
                    PLU
                    <input value={draft.plu} onChange={(event) => setDraft({ ...draft, plu: event.target.value })} />
                  </label>
                </div>
                <label className="field">
                  Category
                  <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="field">
                    Price £
                    <input value={(draft.pricePence / 100).toFixed(2)} onChange={(event) => setDraft({ ...draft, pricePence: Math.round(Number(event.target.value || 0) * 100) })} />
                  </label>
                  <label className="field">
                    Cost £
                    <input value={(draft.costPence / 100).toFixed(2)} onChange={(event) => setDraft({ ...draft, costPence: Math.round(Number(event.target.value || 0) * 100) })} />
                  </label>
                </div>
                <div className="choice-grid cols-3">
                  {VAT_RATES.map((rate) => (
                    <button key={rate} type="button" className={`tp-btn ${draft.vatRate === rate ? "tone-green" : "tone-ghost"}`} onClick={() => setDraft({ ...draft, vatRate: rate as VatRate })}>
                      VAT {rate}%
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="field">
                    Stock
                    <input value={String(draft.stockQty)} onChange={(event) => setDraft({ ...draft, stockQty: Number(event.target.value) })} />
                  </label>
                  <label className="field">
                    Minimum
                    <input value={String(draft.minStock)} onChange={(event) => setDraft({ ...draft, minStock: Number(event.target.value) })} />
                  </label>
                </div>
                <label className="field">
                  Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setDraft({ ...draft, image: String(reader.result) });
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                <button type="button" className={`tp-btn ${draft.ageRestricted ? "tone-red" : "tone-ghost"}`} onClick={() => setDraft({ ...draft, ageRestricted: !draft.ageRestricted })}>
                  {draft.ageRestricted ? "Age restricted" : "Not age restricted"}
                </button>
                <div className="flex gap-2">
                  <button type="submit" className="tp-btn tone-green">
                    Save
                  </button>
                  {products.some((product) => product.id === draft.id) ? (
                    <button
                      type="button"
                      className="tp-btn tone-clear"
                      onClick={() => {
                        void removeProduct(draft.id);
                        setDraft(null);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="text-lg font-bold">Choose Add product, or tap a product in the list to change its price, category, or stock.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
