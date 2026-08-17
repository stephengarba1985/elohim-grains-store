"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

const STABLE_GRAIN_IMAGE_SLUGS = new Set([
  "beans-(oloyin)",
  "beans",
  "chia-seeds",
  "cowpea",
  "garri",
  "groundnut",
  "kidney-beans",
  "local-rice",
  "maize",
  "millet",
  "ogbono",
  "plantain-flour",
  "rice",
  "sorghum",
  "soybeans",
  "wheat",
  "yam-flour(amala)",
]);

export default function ProductDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCartStore();

  const [user, setUser] = useState(null);
  const [product, setProduct] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const getBackendRootUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return apiUrl.replace(/\/api\/?$/, "");
  };

  /* =========================
     INIT USER
  ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  /* =========================
     FETCH PRODUCT
  ========================= */
  useEffect(() => {
    const fetchProductAndVariants = async () => {
      try {
        setLoading(true);
        const productRes = await API.get(`/products/${id}`);
        const found = productRes.data;

        setProduct(found);
        setProductTypes(Array.isArray(found?.types) ? found.types : []);

        const legacyVariants = Array.isArray(found?.variants) ? found.variants : [];
        const typeVariants = (Array.isArray(found?.types) ? found.types : []).flatMap(
          (type) => Array.isArray(type.variants) ? type.variants : []
        );
        const allVariants = [...typeVariants, ...legacyVariants];

        setVariants(allVariants);

        if (allVariants.length > 0) {
          const highestStockVariant = [...allVariants].sort(
            (a, b) => Number(b.stock || 0) - Number(a.stock || 0)
          )[0];

          setSelectedVariant(highestStockVariant);

          if (found?.types?.length > 0) {
            const preferredType = found.types.find((type) =>
              (type.variants || []).some((variant) => variant.id === highestStockVariant.id)
            );

            const defaultType = preferredType || found.types[0];

            if (defaultType) {
              setSelectedTypeId(Number(defaultType.id));

              const defaultVariant =
                (defaultType.variants || []).find(
                  (variant) => variant.id === highestStockVariant.id
                ) || defaultType.variants?.[0] || highestStockVariant;

              setSelectedVariant(defaultVariant);
            }
          }
        } else {
          setSelectedVariant(null);
          setSelectedTypeId(null);
        }
      } catch (err) {
        console.error("PRODUCT FETCH ERROR:", err);
        toast.error("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProductAndVariants();
  }, [id]);

  /* =========================
     QUANTITY CONTROL
  ========================= */
  const increase = () => setQuantity((prev) => prev + 1);

  const decrease = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  /* =========================
     ADD TO CART
  ========================= */
  const handleAddToCart = async () => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return toast.error("Please login first");
    }

    try {
      setLoading(true);

      await addToCart(
        product.id,
        quantity,
        selectedVariant?.id || null
      );

      toast.success(`${quantity} item(s) added to cart`);

    } catch (err) {
      console.error("❌ ADD TO CART ERROR:", err);
      toast.error("Failed to add to cart");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     SUBSCRIPTION FUNCTION
  ========================= */
  const subscribe = async (plan) => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return toast.error("Login required");
    }

    const parsedUser = JSON.parse(storedUser);

    try {
      await API.post("/subscriptions", {
        user_id: parsedUser.id,
        product_id: product.id,
        quantity,
        plan,
      });

      toast.success(
        plan === "weekly"
          ? "Weekly subscription created"
          : "Monthly subscription created"
      );

      setTimeout(() => {
        router.push("/subscriptions");
      }, 800);

    } catch (err) {
      console.error("❌ SUBSCRIPTION ERROR:", err);
      toast.error("Failed to subscribe");
    }
  };

  /* =========================
     🔥 BULK REQUEST FUNCTION (PRO MAX FIXED)
  ========================= */
  const requestBulk = async () => {
    if (bulkLoading) return;

    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      return toast.error("Login required");
    }

    const parsedUser = JSON.parse(storedUser);

    if (!product) {
      return toast.error("Product not ready");
    }

    if (!price || price <= 0) {
      return toast.error("Invalid price");
    }

    try {
      setBulkLoading(true);

      /* 🔥 PREVENT DUPLICATES */
      const existing = await API.get("/bulk");

      const alreadyExists = existing.data.find(
        (r) =>
          Number(r.user_id) === Number(parsedUser.id) &&
          Number(r.product_id) === Number(product.id) &&
          r.status === "pending"
      );

      if (alreadyExists) {
        toast("You already have a pending request for this product");
        return;
      }

      await API.post("/bulk", {
        user_id: parsedUser.id,
        product_id: product.id,
        quantity,
        requested_price: price,
      });

      toast.success(
        "Bulk request sent 🎯. Admin will respond soon."
      );

      setTimeout(() => {
        router.push("/bulk");
      }, 800);

    } catch (err) {
      console.error("BULK ERROR:", err.response?.data || err.message);

      toast.error(
        err.response?.data?.error || "Failed to send request"
      );

    } finally {
      setBulkLoading(false);
    }
  };

  /* =========================
     HELPERS
  ========================= */
  const selectedType =
    productTypes.find((type) => String(type.id) === String(selectedTypeId)) ||
    productTypes[0] ||
    null;

  const typeVariants = selectedType?.variants || [];

  const price =
    user?.role === "bulk"
      ? selectedVariant?.bulk_price ||
        product?.bulk_price ||
        selectedVariant?.price ||
        product?.price
      : selectedVariant?.price || product?.price || 0;

  const regularPrice =
    selectedVariant?.price || product?.price || 0;

  const bulkPrice =
    selectedVariant?.bulk_price || product?.bulk_price || 0;

  const variantStock =
    (selectedType?.variants || []).reduce(
      (total, variant) => total + Number(variant.stock || 0),
      0
    ) ||
    variants.reduce(
      (total, variant) => total + Number(variant.stock || 0),
      0
    );
  const productStock = Number(product?.stock_quantity || 0);
  const selectedStock =
    selectedVariant?.stock != null ? Number(selectedVariant.stock) : null;
  const totalStock = Math.max(productStock, variantStock);
  const stock = totalStock;
  const selectedVariantStock = selectedStock ?? totalStock;

  const formatPrice = (value) =>
    `₦${Number(value || 0).toLocaleString()}`;

  const normalizeImagePath = (imageUrl) => {
    if (!imageUrl) return "";

    const normalized = String(imageUrl)
      .replace(/\\/g, "/")
      .split("?")[0]
      .split("#")[0]
      .trim();

    if (!normalized || normalized === "/") return "/grains/rice.jpg";
    if (normalized.startsWith("http")) return normalized;
    if (normalized.startsWith("/uploads/")) return `${getBackendRootUrl()}${normalized}`;
    if (normalized.startsWith("uploads/")) return `${getBackendRootUrl()}/${normalized}`;
    if (normalized.startsWith("/images/")) return `/grains/${normalized.split("/images/").pop() || "rice.jpg"}`;
    if (normalized.startsWith("images/")) return `/grains/${normalized.replace(/^images\//i, "") || "rice.jpg"}`;

    const withoutLeadingSlash = normalized.replace(/^\/+/, "");
    const withoutAdminPrefix = withoutLeadingSlash.replace(/^admin\//i, "");
    const withoutGrainsPrefix = withoutAdminPrefix.replace(/^grains\//i, "");
    const cleaned = withoutGrainsPrefix.replace(/^\/+/, "");
    const leaf = cleaned.split("/").pop();
    const fileName = leaf || "rice.jpg";

    return `/grains/${fileName}`;
  };

  const getStableImageOverride = (productName) => {
    const slug = String(productName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    if (STABLE_GRAIN_IMAGE_SLUGS.has(slug)) return `/grains/${slug}.jpg`;

    return null;
  };

  const getProductImage = (item) => {
    const stableOverride = getStableImageOverride(item?.name);
    if (stableOverride) return stableOverride;

    const candidateSources = [
      item?.image_url,
      item?.image,
      selectedVariant?.image_url,
      selectedVariant?.image,
      product?.image_url,
      product?.image,
    ].filter(Boolean);

    for (const candidate of candidateSources) {
      const normalized = normalizeImagePath(candidate);
      if (normalized && normalized !== "/placeholder.jpg") {
        return normalized;
      }
    }

    const fallbackName = String(item?.name || "rice")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w().-]/g, "")
      .toLowerCase();

    return `/grains/${fallbackName}.jpg`;
  };

  if (!product) {
    return <div className="p-6">Loading product...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6">

        {/* IMAGE */}
        <img
          src={getProductImage(product)}
          alt={product.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src =
              getStableImageOverride(product?.name) || "/grains/rice.jpg";
          }}
          className="h-64 w-full object-cover rounded-xl shadow"
        />

        <div>
          <h2 className="font-bold text-2xl">{product.name}</h2>

          {productTypes.length > 0 && (
            <div className="mt-3 space-y-2">
              <select
                className="border p-2 rounded w-full"
                value={selectedType?.id ?? ""}
                onChange={(e) => {
                  const nextType = productTypes.find(
                    (type) => String(type.id) === e.target.value
                  );

                  setSelectedTypeId(nextType ? Number(nextType.id) : null);

                  if (nextType?.variants?.length) {
                    const firstVariant = [...nextType.variants].sort(
                      (a, b) => Number(b.stock || 0) - Number(a.stock || 0)
                    )[0];
                    setSelectedVariant(firstVariant);
                  }
                }}
              >
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>

              {typeVariants.length > 0 && (
                <select
                  className="border p-2 rounded w-full"
                  value={selectedVariant?.id ?? ""}
                  onChange={(e) => {
                    const nextVariant = typeVariants.find(
                      (variant) => Number(variant.id) === Number(e.target.value)
                    );
                    setSelectedVariant(nextVariant || null);
                  }}
                >
                  {typeVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.weight} - {Number(variant.stock || 0)} in stock
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {productTypes.length === 0 && variants.length > 0 && (
            <select
              className="border p-2 rounded mt-3 w-full"
              value={selectedVariant?.id ?? ""}
              onChange={(e) => {
                const v = variants.find(
                  (x) => x.id === Number(e.target.value)
                );
                setSelectedVariant(v || null);
              }}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.weight} - {Number(v.stock || 0)} in stock
                </option>
              ))}
            </select>
          )}

          {/* PRICE */}
          {user?.role === "bulk" && bulkPrice > 0 ? (
            <div className="mt-3">
              <p className="text-sm text-gray-500 line-through">
                {formatPrice(regularPrice)}
              </p>
              <p className="text-green-700 font-bold text-xl">
                {formatPrice(bulkPrice)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-2xl font-bold text-green-700">
              {formatPrice(price)}
            </p>
          )}

          {user?.role === "bulk" && (
            <span className="bg-blue-100 text-blue-600 px-2 py-1 text-xs rounded">
              Bulk Price Applied
            </span>
          )}

          {/* STOCK */}
          <div className="mt-2 text-sm">
            <span
              className={`px-2 py-1 rounded text-xs ${
                stock === 0
                  ? "bg-red-100 text-red-600"
                  : stock < 10
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {stock === 0
                ? "Out of stock"
                : stock < 10
                ? `Low stock (${stock})`
                : `In stock (${stock})`}
            </span>
            {variants.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                Selected size: {selectedVariantStock} in stock
              </span>
            )}
          </div>

          <p className="text-gray-600 my-4">
            High-quality grains sourced directly from trusted farmers.
          </p>

          {/* QUANTITY */}
          <div className="flex items-center gap-4 mb-4">
            <button onClick={decrease} className="bg-gray-300 px-3 py-1 rounded">-</button>
            <span className="text-lg font-bold">{quantity}</span>
            <button onClick={increase} className="bg-gray-300 px-3 py-1 rounded">+</button>
          </div>

          <p className="mb-4 font-semibold text-lg">
            Total: {formatPrice(price * quantity)}
          </p>

          {/* BUTTONS */}
          <div className="flex flex-col gap-3">

            <button
              onClick={handleAddToCart}
              disabled={stock === 0 || loading}
              className={`w-full px-6 py-3 rounded-xl text-white ${
                stock === 0
                  ? "bg-gray-400"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {loading ? "Adding..." : "Add to Cart"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => subscribe("weekly")} className="bg-blue-600 text-white px-4 py-2 rounded-xl">
                Subscribe Weekly
              </button>

              <button onClick={() => subscribe("monthly")} className="bg-purple-600 text-white px-4 py-2 rounded-xl">
                Subscribe Monthly
              </button>
            </div>

            <button
              onClick={requestBulk}
              disabled={bulkLoading}
              className="bg-orange-600 text-white px-4 py-2 rounded"
            >
              {bulkLoading ? "Sending..." : "Request Bulk Price 💰"}
            </button>

            <a
              href={`https://wa.me/2348039688939?text=Hello,%20I%20want%20to%20order%20${product.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center px-4 py-3 rounded-xl bg-green-500 text-white"
            >
              WhatsApp
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}
