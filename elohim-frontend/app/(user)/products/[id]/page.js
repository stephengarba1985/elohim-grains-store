"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

const STATIC_GRAIN_ASSET_PATHS = {
  "abakaliki rice": "/grains/Abakaliki Rice.jpg",
  "ofada rice": "/grains/Ofada rice.jfif",
  "beans-(oloyin)": "/grains/beans-(oloyin).jpg",
  "beans": "/grains/beans.jpg",
  "chia-seeds": "/grains/chia-seeds.jpg",
  "cowpea": "/grains/cowpea.jpg",
  "garri": "/grains/garri.jpg",
  "groundnut": "/grains/groundnut.jpg",
  "kidney-beans": "/grains/kidney-beans.jpg",
  "local-rice": "/grains/local-rice.jpg",
  "maize": "/grains/maize.jpg",
  "millet": "/grains/millet.jpg",
  "ogbono": "/grains/ogbono.jpg",
  "pigeon pea": "/grains/Pigeon Pea.jpg",
  "pigeon-pea": "/grains/Pigeon Pea.jpg",
  "plantain-flour": "/grains/plantain-flour.jpg",
  "rice": "/grains/rice.jpg",
  "sorghum": "/grains/sorghum.jpg",
  "soybeans": "/grains/soybeans.jpg",
  "wheat": "/grains/wheat.jpg",
  "yam-flour(amala)": "/grains/yam-flour(amala).jpg",
  "flour": "/grains/Flour.jpg",
  "flours": "/grains/Flour.jpg",
  "oil": "/grains/Oil.png",
  "cooking oil": "/grains/Oil.png",
  "leaf spices": "/grains/Leaf spices.jpg",
  "leaf-spices": "/grains/Leaf spices.jpg",
  "berry fruits": "/grains/Berry.jpg",
  "berry-fruits": "/grains/Berry.jpg",
  "bark spices": "/grains/BerkSpices.jpg",
  "bark-spices": "/grains/BerkSpices.jpg",
  "root spices": "/grains/RootSpices.jpg",
  "root-spices": "/grains/RootSpices.jpg",
  "indigenous fruits": "/grains/IndigenousFruits.jpg",
  "indigenous-fruits": "/grains/IndigenousFruits.jpg",
  "melon fruits": "/grains/Melon.jpg",
  "melon-fruits": "/grains/Melon.jpg",
  "seed spices": "/grains/Seed Spices.jpg",
  "flower spices": "/grains/Flower Spices.jpg",
  "fruit spices": "/grains/Fruit Spices.jpg",
  "root and tuber": "/grains/Root & Tuber.jpg",
  "root-tuber": "/grains/Root & Tuber.jpg",
  "root tuber": "/grains/Root & Tuber.jpg",
  "bambara groundnuts": "/grains/bambara_groundnuts.png",
  "bambara-groundnuts": "/grains/bambara_groundnuts.png",
  "bambara_groundnuts": "/grains/bambara_groundnuts.png",
  "turmeric root": "/grains/Turmeric+Root.jpg",
  "turmeric-root": "/grains/Turmeric+Root.jpg",
  "turmeric_root": "/grains/Turmeric+Root.jpg",
  "stone fruits": "/grains/Stone Fruits.jpg",
  "stone-fruits": "/grains/Stone Fruits.jpg",
  "tropical fruits": "/grains/Tropical Fruits.jpg",
  "tropical-fruits": "/grains/Tropical Fruits.jpg",
  "leafy vegetables": "/grains/Leafy Vegetables.jpg",
  "leafy-vegetables": "/grains/Leafy Vegetables.jpg",
  "fruiting vegetables": "/grains/Fruiting Vegetables.jpg",
  "fruiting-vegetables": "/grains/Fruiting Vegetables.jpg",
  "nut crops": "/grains/Nut Crops.jpg",
  "nut-crops": "/grains/Nut Crops.jpg",
  "citrus fruits": "/grains/Ciprus.jpg",
  "citrus-fruits": "/grains/Ciprus.jpg",
  "citrus_fruits": "/grains/Ciprus.jpg",
};

const STABLE_GRAIN_IMAGE_SLUGS = new Set(Object.keys(STATIC_GRAIN_ASSET_PATHS));

const normalizeGrainNameKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isPathLikeImageReference = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  return (
    normalized.startsWith("data:") ||
    /^https?:\/\//i.test(normalized) ||
    normalized.startsWith("/uploads/") ||
    normalized.startsWith("uploads/") ||
    normalized.startsWith("/images/") ||
    normalized.startsWith("images/") ||
    normalized.includes("/") ||
    normalized.includes("\\")
  );
};

const buildImageNameVariants = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const normalized = normalizeGrainNameKey(raw);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const title = tokens
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const variants = [
    raw,
    raw.replace(/[_]+/g, " "),
    raw.replace(/[-]+/g, " "),
    raw.replace(/[()]/g, " "),
    normalized,
    normalized.replace(/\s+/g, "-"),
    normalized.replace(/\s+/g, "_"),
    normalized.replace(/\s+/g, ""),
    title,
    title.replace(/\s+/g, "-"),
    title.replace(/\s+/g, "_"),
    title.replace(/\s+/g, ""),
    tokens.join(""),
    tokens.join("-"),
    tokens.join("_"),
  ];

  return Array.from(new Set(variants)).filter(Boolean);
};

const buildImageCandidatesFromName = (value) => {
  if (!value || isPathLikeImageReference(value)) return [];

  const staticMatch = getStaticGrainAssetMatch(value);
  if (!staticMatch) return [];

  const variants = buildImageNameVariants(value);
  const extensions = [".jpg", ".jpeg", ".png", ".jfif", ".webp"];
  const candidates = [];

  variants.forEach((variant) => {
    const withSpaces = String(variant).trim();
    const withDashes = withSpaces.replace(/\s+/g, "-");
    const withUnderscore = withSpaces.replace(/\s+/g, "_");
    const compact = withSpaces.replace(/\s+/g, "");

    [withSpaces, withDashes, withUnderscore, compact].forEach((name) => {
      if (!name) return;
      extensions.forEach((ext) => {
        candidates.push(`/grains/${name}${ext}`);
      });
    });
  });

  return Array.from(new Set(candidates));
};

const getStaticGrainAssetMatch = (value) => {
  const raw = String(value || "").trim();
  if (!raw || isPathLikeImageReference(raw)) return null;

  const normalized = normalizeGrainNameKey(raw);
  if (!normalized) return null;

  const lookupMap = new Map(
    Object.entries(STATIC_GRAIN_ASSET_PATHS).map(([key, path]) => [
      normalizeGrainNameKey(key),
      path,
    ])
  );

  const candidates = Array.from(
    new Set([
      ...buildImageNameVariants(raw),
      ...buildImageNameVariants(normalized),
      normalized,
      normalized.replace(/\s+/g, "-"),
      normalized.replace(/\s+/g, "_"),
      normalized.replace(/\s+/g, ""),
    ])
  );

  for (const candidate of candidates) {
    const key = normalizeGrainNameKey(candidate);
    if (lookupMap.has(key)) return lookupMap.get(key);
    if (lookupMap.has(key.replace(/\s+/g, "-"))) {
      return lookupMap.get(key.replace(/\s+/g, "-"));
    }
    if (lookupMap.has(key.replace(/\s+/g, "_"))) {
      return lookupMap.get(key.replace(/\s+/g, "_"));
    }
  }

  const tokens = normalized.split(" ").filter(Boolean);
  for (const [key, path] of Object.entries(STATIC_GRAIN_ASSET_PATHS)) {
    const staticTokens = normalizeGrainNameKey(key).split(" ").filter(Boolean);
    if (
      tokens.length > 0 &&
      staticTokens.length > 0 &&
      tokens.every((token) => staticTokens.includes(token))
    ) {
      return path;
    }
  }

  return null;
};

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
  const [deliveryLocation, setDeliveryLocation] = useState("");

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

  const buildWhatsAppOrderMessage = (productItem, quantityValue = 1, priceOverride = null) => {
    const productName = String(productItem?.name || "this product");
    const totalPrice = Number((Number(priceOverride ?? productItem?.price ?? 0) * Number(quantityValue || 1)).toFixed(2));
    return `Hello Elohim Grains, I want to order ${productName} — ${formatPrice(totalPrice)}.`;
  };

  const getTieredPricing = (basePrice, wholesaleOverride) => {
    const retailPrice = Number(basePrice || 0);
    const wholesalePrice = Number(wholesaleOverride || 0);

    return {
      single: retailPrice,
      fiveBag: retailPrice > 0 ? Math.max(1, Math.round(retailPrice * 0.97)) : 0,
      wholesale: wholesalePrice > 0 ? wholesalePrice : retailPrice > 0 ? Math.round(retailPrice * 0.9) : 0,
    };
  };

  const estimateDeliveryFee = (location, quantityValue = 1) => {
    const cleanedLocation = String(location || "").trim();

    if (!cleanedLocation) {
      return {
        available: true,
        estimate: null,
        summary: "Enter location to estimate delivery cost.",
      };
    }

    const normalizedLocation = cleanedLocation.toLowerCase();
    const cityMultiplier = /lagos|ikeja|lekki|surulere|victoria island|ajah|abuja|ibadan|kano|enugu|port harcourt|owerri|asaba|benin|warri|akure|ilorin|jos|kaduna|abeokuta/.test(normalizedLocation)
      ? 1
      : 1.35;

    const baseFee = Math.round(1800 * cityMultiplier);
    const perBagFee = Math.round(350 * cityMultiplier);
    const total = baseFee + Math.max(0, quantityValue - 1) * perBagFee;

    return {
      available: true,
      estimate: total,
      summary: `Estimated delivery: ${formatPrice(total)}`,
    };
  };

  const quantityPricing = getTieredPricing(regularPrice, bulkPrice);
  const savingsTarget = Number((price || regularPrice || 0) * (quantity || 1));

  const isStaleUploadFilenameReference = (value) => {
    const normalized = String(value || "")
      .replace(/\\/g, "/")
      .split("?")[0]
      .split("#")[0]
      .trim();

    if (!normalized) return false;

    const candidate = normalized.replace(/^\/+/, "");

    return /(?:^|\/)[a-z0-9._-]+-\d{13,}\.(?:jpe?g|png|webp|jfif)$/i.test(candidate);
  };

  const normalizeImagePath = (imageUrl) => {
    if (!imageUrl) {
      return "/grains/rice.jpg";
    }

    const normalized = String(imageUrl)
      .replace(/\\/g, "/")
      .split("?")[0]
      .split("#")[0]
      .trim();

    if (!normalized || normalized === "/") {
      return "/grains/rice.jpg";
    }

    if (isStaleUploadFilenameReference(normalized)) {
      return "/grains/rice.jpg";
    }

const uploadPath = normalized.replace(/^https?:\/\/[^/]+/i, "");

    if (
      uploadPath.startsWith("/uploads/") ||
      uploadPath.startsWith("uploads/") ||
      uploadPath.startsWith("/grains/uploads/") ||
      uploadPath.startsWith("grains/uploads/")
    ) {
      const safeUploadPath = uploadPath.replace(/^\/?grains\//i, "/");
      return safeUploadPath.startsWith("/")
        ? safeUploadPath
        : `/${safeUploadPath}`;
    }

    // Full external URL
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
  }

  // Existing frontend grain images
    if (normalized.startsWith("/grains/")) {
      return normalized;
    }

    if (normalized.startsWith("grains/")) {
      return `/${normalized}`;
    }

    // Legacy /images/... paths
    if (normalized.startsWith("/images/")) {
      return `/grains/${
        normalized.split("/images/").pop() ||
        "rice.jpg"
      }`;
    }

    if (normalized.startsWith("images/")) {
      return `/grains/${
        normalized.replace(/^images\//i, "") ||
        "rice.jpg"
      }`;
    }

    // Other absolute frontend paths
    if (normalized.startsWith("/")) {
      return normalized;
    }

    return `/grains/${normalized.replace(
      /^grains\//i,
      ""
    )}`;
  };

  const getStableImageOverride = (productName) => {
    const normalized = String(productName || "").trim();
    if (!normalized) return null;

    const direct = getStaticGrainAssetMatch(normalized);
    if (direct) return direct;

    const slug = normalizeGrainNameKey(normalized).replace(/\s+/g, "-");

    if (STABLE_GRAIN_IMAGE_SLUGS.has(slug)) return STATIC_GRAIN_ASSET_PATHS[slug];

    return null;
  };

  const getImageCandidateList = (productName) => {
    const candidates = [];
    const addCandidate = (candidate) => {
      const value = String(candidate || "").trim();
      if (!value || candidates.includes(value)) return;
      candidates.push(value);
    };

    const stableOverride = getStableImageOverride(productName);
    if (stableOverride) addCandidate(stableOverride);

    buildImageCandidatesFromName(productName).forEach(addCandidate);
    addCandidate("/grains/rice.jpg");

    return candidates;
  };

  const getNextImageCandidate = (productName, currentSrc) => {
    const candidates = getImageCandidateList(productName);
    const current = String(currentSrc || "").trim();

    if (!candidates.length) return "/grains/rice.jpg";
    if (!current) return candidates[0];

    const index = candidates.indexOf(current);
    if (index >= 0) return candidates[index + 1] || candidates[0];

    return candidates[0];
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
      selectedType?.image,
      selectedType?.image_url,
    ].filter(Boolean);

    for (const candidate of candidateSources) {
      const normalized = normalizeImagePath(candidate);
      if (normalized && normalized !== "/grains/rice.jpg") {
        return normalized;
      }
    }

    return getImageCandidateList(item?.name)[0] || "/grains/rice.jpg";
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
            const current = e.currentTarget.getAttribute("src");
            const next = getNextImageCandidate(product?.name, current);

            if (next && next !== current) {
              e.currentTarget.onerror = null;
              e.currentTarget.src = next;
              return;
            }

            e.currentTarget.onerror = null;
            e.currentTarget.src = "/grains/rice.jpg";
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

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-800">
              <span>🚚</span>
              <span>Delivery available</span>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Enter location
              </span>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(event) => setDeliveryLocation(event.target.value)}
                placeholder="e.g. Lekki, Lagos"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-400 focus:outline-none"
              />
            </label>

            <p className="mt-2 text-xs text-slate-600">
              {estimateDeliveryFee(deliveryLocation, quantity).summary}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
              Buy More, Save More
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>1 bag</span>
                <span className="font-bold text-slate-900">{formatPrice(quantityPricing.single)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>5 bags</span>
                <span className="font-bold text-slate-900">{formatPrice(quantityPricing.fiveBag)}/bag</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>10+ bags</span>
                <span className="font-bold text-amber-700">
                  {quantityPricing.wholesale > 0 ? "Wholesale price" : "Contact us"}
                </span>
              </div>
            </div>
          </div>

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

            <a
              href={`https://wa.me/2348039688939?text=${encodeURIComponent(
                buildWhatsAppOrderMessage(product, quantity, price)
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center px-4 py-3 rounded-xl bg-emerald-700 text-white"
            >
              Buy on WhatsApp
            </a>

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
              {bulkLoading ? "Sending..." : "Request Bulk Price"}
            </button>

          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-lime-50 p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
          Can&apos;t afford the full amount today?
        </p>

        <h3 className="mt-3 text-2xl font-black text-slate-900">
          🌱 Save toward this product
        </h3>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Target
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {formatPrice(savingsTarget)}
            </p>
          </div>

          <Link
            href={`/user/plans?product_id=${product.id}&quantity=${quantity}&payment_frequency=weekly&duration=3`}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-emerald-700"
          >
            Start Food Savings
          </Link>
        </div>
      </div>
    </div>
  );
}
