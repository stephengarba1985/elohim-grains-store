"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const buildWhatsAppOrderMessage = (product, quantity = 1, priceOverride = null) => {
  const productName = String(product?.name || "this product");
  const quantityValue = Number(quantity || 1);
  const unitPrice = Number(priceOverride ?? getProductPrice(product) ?? 0);
  const totalPrice = Number((unitPrice * quantityValue).toFixed(2));

  return `Hello Elohim Grains, I want to order ${productName} — ${formatPrice(totalPrice)}.`;
};

const getTieredPriceDisplay = (basePrice, wholesaleOverride) => {
  const retailPrice = Number(basePrice || 0);
  const wholesalePrice = Number(wholesaleOverride || 0);

  return {
    single: retailPrice,
    fiveBag: retailPrice > 0 ? Math.max(1, Math.round(retailPrice * 0.97)) : 0,
    wholesale: wholesalePrice > 0 ? wholesalePrice : retailPrice > 0 ? Math.round(retailPrice * 0.9) : 0,
    hasWholesale: wholesalePrice > 0 || retailPrice > 0,
  };
};

const getBackendAssetBase = () => {
  const configured = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://elohim-grains-store-production.up.railway.app/api"
  )
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

  return configured || "https://elohim-grains-store-production.up.railway.app";
};

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
    const assetPath = safeUploadPath.startsWith("/") ? safeUploadPath : `/${safeUploadPath}`;
    return `${getBackendAssetBase()}${assetPath}`;
  }

  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/grains/")) return normalized;
  if (normalized.startsWith("grains/")) return `/${normalized}`;
  if (normalized.startsWith("/images/")) return `/grains/${normalized.split("/images/").pop() || "rice.jpg"}`;
  if (normalized.startsWith("images/")) return `/grains/${normalized.replace(/^images\//i, "") || "rice.jpg"}`;
  if (normalized.startsWith("/")) return normalized;

  return `/grains/${normalized.replace(/^grains\//i, "")}`;
};

const normalizeWeightLabel = (value, fallback = "Standard bag") => {
  if (value === null || value === undefined) return fallback;

  const raw = String(value).trim();
  if (!raw) return fallback;

  const cleaned = raw
    .replace(/\b(?:bags?|packs?|units?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;

  const numericMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) {
    const nonNumeric = cleaned.replace(/^(?:kg|kilogram|kilograms)\b/gi, "").trim();
    return nonNumeric || fallback;
  }

  const numericValue = numericMatch[1];
  const hasKgUnit = /kg|kilogram|kilograms|kilo/i.test(cleaned);

  if (hasKgUnit) {
    return cleaned.replace(/\s+/g, "").replace(/kgs?$/i, "kg");
  }

  return `${numericValue}kg`;
};

const getProductVariants = (product) => {
  const directVariants = Array.isArray(product?.variants) ? product.variants : [];
  const nestedVariants = (Array.isArray(product?.types) ? product.types : []).flatMap(
    (type) => (Array.isArray(type?.variants) ? type.variants : [])
  );

  const uniqueVariants = new Map();

  [...nestedVariants, ...directVariants].forEach((variant) => {
    if (!variant) return;

    const label = normalizeWeightLabel(
      variant.weight ?? variant.name ?? variant.variant_name ?? variant.label ?? "",
      "standard"
    );
    const key = String(
      variant.id ??
        `${label}-${Number(variant.price || product?.price || 0)}-${Number(variant.stock || 0)}`
    );

    if (!uniqueVariants.has(key)) {
      uniqueVariants.set(key, variant);
    }
  });

  return [...uniqueVariants.values()];
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
  const variantLabels = [...new Set(
    getProductVariants(product)
      .map((variant) => normalizeWeightLabel(
        variant?.weight ?? variant?.name ?? variant?.variant_name ?? variant?.label ?? "",
        ""
      ))
      .filter(Boolean)
  )];

  if (variantLabels.length > 0) {
    return variantLabels.length > 1 ? variantLabels.join(", ") : variantLabels[0];
  }

  const fallbackWeight = normalizeWeightLabel(product?.weight ?? "", "");
  if (fallbackWeight) return fallbackWeight;

  const displayVariant = getDisplayVariant(product);
  if (displayVariant?.weight) return normalizeWeightLabel(displayVariant.weight, "Standard bag");

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

const getProductVariantOptions = (product) => {
  const variants = getProductVariants(product);

  if (!variants.length) {
    return [
      {
        id: "standard",
        label: "Standard bag",
        price: Number(product?.price || 0),
        bulkPrice: Number(product?.bulk_price || 0),
      },
    ];
  }

  const seenOptions = new Set();

  return variants
    .filter((variant) => variant && (variant.id || variant.weight || variant.name || variant.variant_name))
    .map((variant) => {
      const key = String(variant.id ?? normalizeWeightLabel(
        variant.weight ?? variant.name ?? variant.variant_name ?? variant.label ?? "",
        "standard"
      ));

      if (seenOptions.has(key)) return null;
      seenOptions.add(key);

      return {
        id: variant.id ?? key,
        label: normalizeWeightLabel(
          variant.weight ?? variant.name ?? variant.variant_name ?? variant.label ?? "Standard bag",
          "Standard bag"
        ),
        price: Number(variant.price || product?.price || 0),
        bulkPrice: Number(variant.bulk_price || product?.bulk_price || 0),
        stock: Number(variant.stock || 0),
      };
    })
    .filter(Boolean);
};

const getProductImage = (product) => {
  const directMatch = getStaticGrainAssetMatch(product?.name || "") ||
    getStaticGrainAssetMatch(product?.category || "") ||
    getStaticGrainAssetMatch(product?.product_type || "");

  if (directMatch) return directMatch;

  const normalizedProductName = normalizeGrainNameKey(product?.name || "");
  if (normalizedProductName && STABLE_GRAIN_IMAGE_SLUGS.has(normalizedProductName)) {
    return STATIC_GRAIN_ASSET_PATHS[normalizedProductName];
  }

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

const stripFileExtension = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  return raw.replace(/\.[a-z0-9]{2,5}$/i, "");
};

const normalizeGrainNameKey = (value) =>
  String(stripFileExtension(value) || "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getStaticGrainAssetMatch = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const normalized = normalizeGrainNameKey(rawValue);
  if (!normalized) return null;

  const exactMatch = STATIC_GRAIN_ASSET_PATHS[normalized];
  if (exactMatch) return exactMatch;

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

const getProductRating = (product) => {
  const value = Number(product?.rating ?? product?.average_rating ?? 4.8);
  return Number.isFinite(value) ? value : 4.8;
};

const categoryTabs = [
  { id: "all", label: "All Products", icon: "🧺" },
  { id: "grains", label: "Grains", icon: "🌾" },
  { id: "flours", label: "Flours", icon: "🥣" },
  { id: "seeds-nuts", label: "Seeds & Nuts", icon: "🥜" },
  { id: "spices", label: "Spices", icon: "🌶️" },
  { id: "cooking-essentials", label: "Cooking Essentials", icon: "🛢️" },
  { id: "fruits-vegetables", label: "Fruits & Vegetables", icon: "🍎" },
  { id: "meat-poultry", label: "Meat & Poultry", icon: "🥩" },
];

const categoryFilterOptions = [
  { id: "grains", label: "Grains" },
  { id: "flours", label: "Flour" },
  { id: "seeds-nuts", label: "Seeds" },
  { id: "cooking-essentials", label: "Food Essentials" },
];

const weightFilterOptions = [
  { id: "1-5kg", label: "1–5kg" },
  { id: "10-25kg", label: "10–25kg" },
  { id: "50kg-plus", label: "50kg+" },
];

const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "price-low-high", label: "Price low → high" },
  { id: "price-high-low", label: "Price high → low" },
];

const estimateDeliveryFee = (location, quantity = 1) => {
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
  const total = baseFee + Math.max(0, quantity - 1) * perBagFee;

  return {
    available: true,
    estimate: total,
    summary: `Estimated delivery: ${formatPrice(total)}`,
  };
};

const searchAliases = {
  rice: ["rice", "ofada rice", "abakaliki rice", "local rice", "rice grains"],
  beans: ["beans", "bean", "cowpea", "bambara groundnut", "bambara groundnuts", "kidney beans", "pigeon pea"],
  maize: ["maize", "corn"],
  flour: ["flour", "plantain flour", "yam flour", "cassava flour", "wheat flour"],
  oil: ["oil", "palm oil", "vegetable oil", "cooking oil"],
  spices: ["spices", "pepper", "ginger", "turmeric", "curry", "seasoning"],
  groundnut: ["groundnut", "groundnuts", "peanut", "peanuts"],
};

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSearchAliasSet = (keyword) => {
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) return [];

  const matches = Object.entries(searchAliases).flatMap(([key, aliases]) => {
    if (key === normalizedKeyword) return aliases;

    return aliases.some(
      (alias) =>
        normalizeSearchText(alias) === normalizedKeyword ||
        normalizedKeyword.includes(normalizeSearchText(alias)) ||
        normalizeSearchText(alias).includes(normalizedKeyword)
    )
      ? aliases
      : [];
  });

  const uniqueMatches = [...new Set(matches.map((item) => normalizeSearchText(item)))];
  return uniqueMatches.length ? uniqueMatches : [normalizedKeyword];
};

const getProductSearchScore = (product, keyword) => {
  const query = normalizeSearchText(keyword);
  if (!query) return 0;

  const haystack = normalizeSearchText(
    [
      product?.name,
      product?.category,
      product?.type,
      product?.product_type,
      getProductWeight(product),
      product?.description,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!haystack) return 0;

  let score = 0;
  const aliases = getSearchAliasSet(query);

  if (haystack.includes(query)) score += 90;

  for (const alias of aliases) {
    if (haystack.includes(alias)) score += 120;
  }

  const queryTokens = query.split(" ").filter(Boolean);
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 15;
  }

  return score;
};

const badgeStyles = {
  "best-seller": "bg-orange-100 text-orange-700 border-orange-200",
  popular: "bg-blue-100 text-blue-700 border-blue-200",
  new: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "best-value": "bg-violet-100 text-violet-700 border-violet-200",
  "bulk-available": "bg-amber-100 text-amber-700 border-amber-200",
};

const featureBadges = [
  { id: "best-seller", label: "BEST SELLER", icon: "🔥", match: /rice|beans|maize|garri|oil|soybeans|groundnut/i },
  { id: "popular", label: "POPULAR", icon: "⭐", match: /rice|beans|maize|flour|oil|spices|soybeans/i },
  { id: "new", label: "NEW", icon: "🆕", match: /new|fresh|seasonal|premium|special/i },
  { id: "best-value", label: "BEST VALUE", icon: "💰", match: /flour|beans|rice|local|bulk|value/i },
  { id: "bulk-available", label: "BULK AVAILABLE", icon: "📦", match: /rice|beans|maize|garri|oil|flour|bulk/i },
];

const getProductBadges = (product) => {
  const productName = String(product?.name || "");
  const productCategory = String(product?.category || "");
  const haystack = `${productName} ${productCategory}`.trim();

  return featureBadges
    .filter((badge) => badge.match.test(haystack))
    .slice(0, 2)
    .map((badge) => ({
      id: badge.id,
      label: badge.label,
      icon: badge.icon,
      className: badgeStyles[badge.id] || badgeStyles.popular,
    }));
};

const normalizeCategorySlug = (product) => {
  const haystack = [
    product?.category,
    product?.type,
    product?.product_type,
    product?.name,
    product?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) return "all";

  if (/grain|rice|maize|beans|cassava|yam|cereal|millet|sorghum/.test(haystack)) {
    return "grains";
  }

  if (/flour|powder|meal|semolina|yam flour/.test(haystack)) {
    return "flours";
  }

  if (/seed|nut|groundnut|soy|melon|cashew|peanut|sesame/.test(haystack)) {
    return "seeds-nuts";
  }

  if (/spice|pepper|ginger|turmeric|curry|seasoning|bay leaf/.test(haystack)) {
    return "spices";
  }

  if (/oil|cooking|palm|vegetable|sauce|condiment|stock|broth/.test(haystack)) {
    return "cooking-essentials";
  }

  if (/fruit|vegetable|leafy|tomato|onion|carrot|cabbage|okra|plantain/.test(haystack)) {
    return "fruits-vegetables";
  }

  if (/meat|poultry|chicken|beef|fish|turkey|goat|animal/.test(haystack)) {
    return "meat-poultry";
  }

  return "all";
};

export default function ShopPage() {
  const { addToCart } = useCartStore();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [selectedPriceCap, setSelectedPriceCap] = useState(100000);
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sortBy, setSortBy] = useState("popular");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [deliveryLocations, setDeliveryLocations] = useState({});
  const [selectedVariants, setSelectedVariants] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          process.env.PUBLIC_BACKEND_URL ||
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          "https://elohim-grains-store-production.up.railway.app/api";

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

  const categoryFilteredProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter(
      (product) => normalizeCategorySlug(product) === activeCategory
    );
  }, [products, activeCategory]);

  const getProductWeightValues = (product) => {
    const labels = getProductVariants(product)
      .map((variant) =>
        normalizeWeightLabel(
          variant?.weight ?? variant?.name ?? variant?.variant_name ?? variant?.label ?? "",
          ""
        )
      )
      .filter(Boolean);

    const fallbackWeight = normalizeWeightLabel(product?.weight ?? "", "");
    if (fallbackWeight) labels.push(fallbackWeight);

    return [...new Set(
      labels.flatMap((label) => {
        const match = String(label).match(/(\d+(?:\.\d+)?)/);
        return match ? [Number(match[1])] : [];
      })
    )].filter((value) => Number.isFinite(value) && value > 0);
  };

  const getProductWeightKg = (product) => {
    const values = getProductWeightValues(product);
    return values.length ? Math.max(...values) : 0;
  };

  const matchesSelectedWeight = (product, selectedWeightId) => {
    const values = getProductWeightValues(product);

    switch (selectedWeightId) {
      case "1-5kg":
        return values.some((value) => value >= 1 && value <= 5);
      case "10-25kg":
        return values.some((value) => value >= 10 && value <= 25);
      case "50kg-plus":
        return values.some((value) => value >= 50);
      default:
        return true;
    }
  };

  const filteredProducts = useMemo(() => {
    let result = [...categoryFilteredProducts];

    result = result.filter(
      (product) => getProductPrice(product) <= selectedPriceCap
    );

    if (selectedWeights.length > 0) {
      result = result.filter((product) =>
        selectedWeights.some((weightId) => matchesSelectedWeight(product, weightId))
      );
    }

    if (inStockOnly) {
      result = result.filter((product) => getProductStock(product) > 0);
    }

    const keyword = query.trim();
    if (keyword) {
      result = result
        .map((product) => ({
          product,
          score: getProductSearchScore(product, keyword),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return getProductPrice(a.product) - getProductPrice(b.product);
        })
        .map(({ product }) => product);
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
        break;
      case "price-low-high":
        result.sort((a, b) => getProductPrice(a) - getProductPrice(b));
        break;
      case "price-high-low":
        result.sort((a, b) => getProductPrice(b) - getProductPrice(a));
        break;
      case "popular":
      default:
        result.sort(
          (a, b) =>
            getProductRating(b) - getProductRating(a) ||
            getProductPrice(a) - getProductPrice(b)
        );
        break;
    }

    return result;
  }, [categoryFilteredProducts, query, selectedPriceCap, selectedWeights, inStockOnly, sortBy]);

  const activeCategoryLabel =
    categoryTabs.find((category) => category.id === activeCategory)?.label ||
    "Products";

  const updateQuantity = (productId, delta) => {
    setQuantities((prev) => {
      const current = Number(prev[String(productId)] ?? 1);
      const next = Math.max(1, current + delta);
      return { ...prev, [String(productId)]: next };
    });
  };

  const handleAddToCart = async (product) => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login first");
      return;
    }

    try {
      const productQuantity = Number(quantities[String(product.id)] ?? 1);
      const selectedVariantId = selectedVariants[String(product.id)] ?? null;
      await addToCart(product.id, productQuantity, selectedVariantId);
      toast.success(`${productQuantity} item(s) added to cart`);
    } catch (error) {
      console.error("Add to cart error:", error);
      toast.error("Unable to add item to cart");
    }
  };

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

            <div className="mt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-green-100">
                Shop by category
              </p>
              <div className="flex flex-wrap gap-2">
                {categoryTabs.map((category) => {
                  const isActive = activeCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveCategory(category.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "border-green-400 bg-green-500 text-white shadow-md"
                          : "border-white/20 bg-white/8 text-green-50 hover:bg-white/15"
                      }`}
                    >
                      <span>{category.icon}</span>
                      {category.label}
                    </button>
                  );
                })}
              </div>
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
              {query
                ? `Results for “${query}”`
                : activeCategory === "all"
                  ? "Fresh picks for your kitchen"
                  : `${activeCategoryLabel} picks`}
            </h2>
          </div>
          <p className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mb-5 flex gap-2 md:hidden">
          <button
            type="button"
            onClick={() => {
              setMobileFilterOpen((value) => !value);
              setMobileSortOpen(false);
            }}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-wide text-white"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileSortOpen((value) => !value);
              setMobileFilterOpen(false);
            }}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-800"
          >
            Sort
          </button>
        </div>

        {(mobileFilterOpen || mobileSortOpen) && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
            {mobileFilterOpen && (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Category
                  </p>
                  <div className="space-y-2">
                    {categoryFilterOptions.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={activeCategory === category.id}
                          onChange={() => {
                            setActiveCategory((current) =>
                              current === category.id ? "all" : category.id
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        {category.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Price
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="500"
                    value={selectedPriceCap}
                    onChange={(event) => setSelectedPriceCap(Number(event.target.value))}
                    className="w-full accent-green-600"
                  />
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    ₦0 — ₦{selectedPriceCap.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Weight
                  </p>
                  <div className="space-y-2">
                    {weightFilterOptions.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedWeights.includes(option.id)}
                          onChange={() => {
                            setSelectedWeights((current) =>
                              current.includes(option.id)
                                ? current.filter((item) => item !== option.id)
                                : [...current, option.id]
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={() => setInStockOnly((value) => !value)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  In stock
                </label>
              </div>
            )}

            {mobileSortOpen && (
              <div className="space-y-2 pt-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSortBy(option.id);
                      setMobileSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                      sortBy === option.id
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {option.label}
                    {sortBy === option.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="hidden w-full max-w-[280px] shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:block">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Filter by
            </h3>

            <div className="mt-5 space-y-6">
              <div>
                <p className="mb-3 text-sm font-bold text-slate-700">Category</p>
                <div className="space-y-2">
                  {categoryFilterOptions.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={activeCategory === category.id}
                        onChange={() => {
                          setActiveCategory((current) =>
                            current === category.id ? "all" : category.id
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      {category.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-slate-700">Price</p>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="500"
                  value={selectedPriceCap}
                  onChange={(event) => setSelectedPriceCap(Number(event.target.value))}
                  className="w-full accent-green-600"
                />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  ₦0 — ₦{selectedPriceCap.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-slate-700">Weight</p>
                <div className="space-y-2">
                  {weightFilterOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedWeights.includes(option.id)}
                        onChange={() => {
                          setSelectedWeights((current) =>
                            current.includes(option.id)
                              ? current.filter((item) => item !== option.id)
                              : [...current, option.id]
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-slate-700">Availability</p>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={() => setInStockOnly((value) => !value)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  In stock
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-slate-700">Sort</p>
                <div className="space-y-2">
                  {sortOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="radio"
                        name="product-sort"
                        checked={sortBy === option.id}
                        onChange={() => setSortBy(option.id)}
                        className="h-4 w-4 border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h3 className="text-xl font-black text-slate-950">No products found</h3>
                <p className="mt-2 text-slate-600">
                  Try a different keyword or clear one of the active filters.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const productStock = getProductStock(product);
                  const inStock = productStock > 0;
                  const currentQuantity = Number(quantities[String(product.id)] ?? 1);
                  const rating = getProductRating(product);
                  const badges = getProductBadges(product);
                  const variantOptions = getProductVariantOptions(product);
                  const selectedVariantId = selectedVariants[String(product.id)] ?? variantOptions[0]?.id ?? "standard";
                  const selectedVariant = variantOptions.find(
                    (option) => String(option.id) === String(selectedVariantId)
                  ) || variantOptions[0] || null;
                  const cardPrice = Number(selectedVariant?.price || getProductPrice(product) || 0);
                  const deliveryLocation = deliveryLocations[String(product.id)] || "";
                  const deliveryInfo = estimateDeliveryFee(deliveryLocation, currentQuantity);

                  return (
                    <div
                      key={product.id}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative h-52 overflow-hidden bg-slate-100">
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                        />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          {badges.length > 0
                            ? badges.map((badge) => (
                                <span
                                  key={badge.id}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide shadow-sm ${badge.className}`}
                                >
                                  <span>{badge.icon}</span>
                                  {badge.label}
                                </span>
                              ))
                            : null}
                        </div>
                        <div className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-green-800 shadow-sm">
                          {inStock ? `${productStock} available` : "Out of stock"}
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-slate-950">{product.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{getProductWeight(product)}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-sm font-medium text-slate-500">
                          <div className="flex items-center gap-1 text-amber-500">
                            <span>⭐</span>
                            <span>{rating.toFixed(1)}</span>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${inStock ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {inStock ? "In Stock" : "Out of stock"}
                          </span>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Choose
                            </span>
                            <span className="text-lg font-black text-green-700">
                              {formatPrice(cardPrice)}
                            </span>
                          </div>

                          <select
                            value={selectedVariantId}
                            onChange={(event) =>
                              setSelectedVariants((prev) => ({
                                ...prev,
                                [String(product.id)]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 focus:border-green-400 focus:outline-none"
                          >
                            {variantOptions.map((option) => (
                              <option key={String(option.id)} value={String(option.id)}>
                                {option.label} {option.stock ? `• ${option.stock} in stock` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-sm font-semibold text-slate-500">Qty</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(product.id, -1)}
                              disabled={!inStock}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:border-green-400 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Decrease quantity for ${product.name}`}
                            >
                              −
                            </button>
                            <span className="min-w-8 text-center text-base font-black text-slate-900">
                              {currentQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(product.id, 1)}
                              disabled={!inStock}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold text-slate-700 transition hover:border-green-400 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Increase quantity for ${product.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer list-none text-sm font-bold text-slate-700">
                            More options
                          </summary>

                          <div className="mt-3 space-y-3 text-xs text-slate-600">
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                Volume savings
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2 text-slate-700">
                                <span>1 bag</span>
                                <span className="font-bold text-slate-900">{formatPrice(cardPrice)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-slate-700">
                                <span>5 bags</span>
                                <span className="font-bold text-slate-900">{formatPrice(Math.max(1, Math.round(cardPrice * 0.97)))}/bag</span>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                                <span>🚚</span>
                                <span>Delivery available</span>
                              </div>

                              <label className="mt-2 block">
                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                  Enter location
                                </span>
                                <input
                                  type="text"
                                  value={deliveryLocation}
                                  onChange={(event) =>
                                    setDeliveryLocations((prev) => ({
                                      ...prev,
                                      [String(product.id)]: event.target.value,
                                    }))
                                  }
                                  placeholder="Lekki, Lagos"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-green-400 focus:outline-none"
                                />
                              </label>

                              <p className="mt-2 text-[11px] text-slate-600">
                                {deliveryInfo.estimate ? deliveryInfo.summary : "Enter location to estimate delivery cost."}
                              </p>
                            </div>
                          </div>
                        </details>

                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product)}
                            disabled={!inStock}
                            className="w-full rounded-xl bg-green-600 px-3 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Add to Cart
                          </button>

                          <a
                            href={`https://wa.me/2348039688939?text=${encodeURIComponent(
                              buildWhatsAppOrderMessage(product, currentQuantity, cardPrice)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-center text-sm font-black uppercase tracking-wide text-white transition hover:bg-emerald-800"
                          >
                            Buy on WhatsApp
                          </a>
                        </div>

                        <Link
                          href={`/products/${product.id}`}
                          className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-sm font-black uppercase tracking-wide text-amber-700 transition hover:bg-amber-100"
                        >
                          Request Bulk Price
                        </Link>

                        <Link
                          href={`/products/${product.id}`}
                          className="mt-2 block text-center text-sm font-semibold text-slate-600 transition hover:text-green-700"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
