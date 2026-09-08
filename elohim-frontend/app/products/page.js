"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const normalizeImagePath = (imageUrl) => {
  if (!imageUrl) return "/grains/rice.jpg";

  const normalized = String(imageUrl)
    .replace(/\\/g, "/")
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!normalized || normalized === "/") return "/grains/rice.jpg";

  const uploadPath = normalized.replace(/^https?:\/\/[^/]+/i, "");

  if (
    uploadPath.startsWith("/uploads/") ||
    uploadPath.startsWith("uploads/") ||
    uploadPath.startsWith("/grains/uploads/") ||
    uploadPath.startsWith("grains/uploads/")
  ) {
    const safeUploadPath = uploadPath.replace(/^\/?grains\//i, "/");
    return safeUploadPath.startsWith("/") ? safeUploadPath : `/${safeUploadPath}`;
  }

  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/grains/")) return normalized;
  if (normalized.startsWith("grains/")) return `/${normalized}`;
  if (normalized.startsWith("/images/")) return `/grains/${normalized.split("/images/").pop() || "rice.jpg"}`;
  if (normalized.startsWith("images/")) return `/grains/${normalized.replace(/^images\//i, "") || "rice.jpg"}`;
  if (normalized.startsWith("/")) return normalized;

  return `/grains/${normalized.replace(/^grains\//i, "")}`;
};

const getProductVariants = (product) => {
  const directVariants = Array.isArray(product?.variants) ? product.variants : [];
  const nestedVariants = (Array.isArray(product?.types) ? product.types : []).flatMap(
    (type) => (Array.isArray(type?.variants) ? type.variants : [])
  );

  return [...nestedVariants, ...directVariants];
};

const getDisplayVariant = (product) => {
  const variants = getProductVariants(product);
  if (!variants.length) return null;

  const prioritized = [...variants].sort(
    (a, b) => Number(b.stock || 0) - Number(a.stock || 0)
  );

  return prioritized.find((variant) => Number(variant.stock || 0) > 0) || prioritized[0];
};

const getProductWeight = (product) => {
  if (product?.weight) return product.weight;

  const displayVariant = getDisplayVariant(product);
  if (displayVariant?.weight) return displayVariant.weight;

  const firstType = Array.isArray(product?.types) ? product.types[0] : null;
  if (firstType?.name) return firstType.name;

  return "Standard bag";
};

const getProductPrice = (product) => {
  const variants = getProductVariants(product);
  const displayVariant = getDisplayVariant(product);

  return Number(product?.price || displayVariant?.price || variants[0]?.price || 0);
};

const getProductStock = (product) => {
  const variants = getProductVariants(product);
  const variantStock = variants.reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0
  );

  return Math.max(Number(product?.stock_quantity || 0), variantStock);
};

const getProductImage = (product) => {
  const imageList = [
    product?.image_url,
    product?.image,
    product?.types?.[0]?.image,
    product?.types?.[0]?.image_url,
    product?.variants?.[0]?.image_url,
    product?.variants?.[0]?.image,
  ].filter(Boolean);

  for (const source of imageList) {
    const normalized = normalizeImagePath(source);
    if (normalized && normalized !== "/grains/rice.jpg") return normalized;
  }

  return "/grains/rice.jpg";
};

const searchSuggestions = [
  "rice",
  "beans",
  "maize",
  "flour",
  "soybeans",
  "oil",
  "garri",
  "groundnut",
  "yam flour",
  "spices",
];

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

        const res = await fetch(`${baseUrl}/products`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to load products");

        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Shop fetch error:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => {
      const name = String(product?.name || "").toLowerCase();
      const category = String(product?.category || "").toLowerCase();
      const weight = String(getProductWeight(product) || "").toLowerCase();

      return (
        name.includes(keyword) ||
        category.includes(keyword) ||
        weight.includes(keyword)
      );
    });
  }, [products, query]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-[radial-gradient(circle_at_top,#14532d_0%,#0f172a_38%,#020617_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="max-w-4xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-200">
              ELOHIM GRAINS
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
              🛒 Shop Food & Grains
            </h1>
            <p className="mt-4 text-lg text-slate-200 md:text-xl">
              Quality food products delivered to your doorstep.
            </p>
          </div>

          <div className="mt-8 max-w-5xl rounded-2xl border border-white/15 bg-white/8 p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-slate-700 shadow-inner">
              <span className="text-2xl">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for rice, beans, maize, flour..."
                className="w-full border-0 bg-transparent text-base font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-green-100 transition hover:bg-white/20"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Catalogue
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              {query ? `Results for “${query}”` : "Fresh picks for your kitchen"}
            </h2>
          </div>
          <p className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h3 className="text-xl font-black text-slate-950">No products found</h3>
            <p className="mt-2 text-slate-600">
              Try a different keyword like rice, beans, maize, flour, or oil.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-52 overflow-hidden bg-slate-100">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-green-800 shadow-sm">
                    {getProductStock(product) > 0 ? `${getProductStock(product)} in stock` : "Check stock"}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{product.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{getProductWeight(product)}</p>
                    </div>
                    <span className="rounded-md bg-green-50 px-2 py-1 text-[10px] font-bold uppercase text-green-700">
                      Store
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xl font-black text-green-700">
                      {formatPrice(getProductPrice(product))}
                    </p>
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-green-700">
                      View
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
