import { formatGbp } from "@tillpro/shared";
import { CategoryArt } from "./CategoryArt";
import { useTillStore } from "../store/useTillStore";

export function CategoryGrid() {
  const categories = useTillStore((state) => state.categories);
  const products = useTillStore((state) => state.products);
  const categoryId = useTillStore((state) => state.categoryId);
  const openCategory = useTillStore((state) => state.openCategory);
  const back = useTillStore((state) => state.backToCategories);
  const addProduct = useTillStore((state) => state.addProduct);
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    return (
      <div className="cat-wrap">
        {categories.length === 0 ? <p className="empty-catalogue">No categories yet. Add them in Extras.</p> : null}
        {categories.length > 0 ? <div className="cat-grid" data-testid="category-grid" aria-label="Categories">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tile"
              data-testid={`category-${item.id}`}
              onClick={() => openCategory(item.id)}
            >
              <span className="tile-art">
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <CategoryArt id={item.id} />}
              </span>
              <span className="tile-label" style={{ background: item.color }}>
                {item.name}
              </span>
            </button>
          ))}
        </div> : null}
      </div>
    );
  }

  const items = products.filter((product) => product.categoryId === category.id && product.active);

  return (
    <div className="cat-wrap">
      <button type="button" className="tp-btn tone-teal" onClick={back} data-testid="category-back">
        ← {category.name}
      </button>
      <div className="prod-grid" data-testid="product-grid" aria-label={category.name}>
        {items.map((product) => (
          <button
            key={product.id}
            type="button"
            className="tile product-tile"
            data-testid={`product-${product.id}`}
            onClick={() => addProduct(product.id)}
          >
            <span className="tile-art">
              {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <CategoryArt id={category.id} />}
            </span>
            <span className="tile-label" style={{ background: category.color }}>
              <span>{product.name}</span>
              <span className="price-tag">{formatGbp(product.pricePence)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
