import { useTillStore } from "./store/useTillStore";

export type CatalogueTab = "products" | "categories" | "stock";

let openOn: CatalogueTab = "products";

export function openCatalogue(tab: CatalogueTab) {
  openOn = tab;
  useTillStore.getState().setScreen("products");
}

export function takeCatalogueTab(): CatalogueTab {
  const next = openOn;
  openOn = "products";
  return next;
}
