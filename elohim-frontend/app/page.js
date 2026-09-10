import Image from "next/image";
import Link from "next/link";
import HomeWalletCard from "@/components/HomeWalletCard";

export const metadata = {
  title: "Elohim Grains Store | Agro Fintech",
  description:
    "Shop grains, fund a wallet, save toward food goals, and pay securely with Elohim Grains.",
};

export const dynamic = "force-dynamic";

const heroImage = "/grains/rice.jpg";

const backendRootUrl = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://elohim-grains-store-production.up.railway.app/api"
).replace(/\/api\/?$/, "");

const getBackendRootUrl = () => backendRootUrl;

const trustMetrics = [
  { label: "Fintech services", value: "8+" },
  { label: "Staple categories", value: "6" },
  { label: "Payment channels", value: "5" },
  { label: "Bulk buying support", value: "24/7" },
];

const marketSignals = [
  { crop: "Rice", movement: "+4.2%", note: "Demand is rising before month end" },
  { crop: "Maize", movement: "-1.8%", note: "Better buying window this week" },
  { crop: "Beans", movement: "+2.6%", note: "Stock up before transport costs rise" },
];

const bulkOrderBenefits = [
  "Wholesale pricing for recurring buyers",
  "Shared delivery for groups and cooperatives",
  "Escrow option for large supply orders",
];

const quickActions = [
  { label: "Fund Wallet", href: "/wallet" },
  { label: "Start Savings", href: "/plans" },
  { label: "Use BNPL", href: "/bnpl" },
  { label: "Track Prices", href: "/price-insights" },
];

const shopByCategory = [
  {
    title: "Rice",
    description: "Staple meals, wedding catering, family pantry essentials.",
    image: "/grains/rice.jpg",
  },
  {
    title: "Beans & Legumes",
    description: "High-protein staples for households and bulk kitchens.",
    image: "/grains/beans.jpg",
  },
  {
    title: "Maize & Flour",
    description: "Breakfast, porridge, and everyday baking supplies.",
    image: "/grains/maize.jpg",
  },
  {
    title: "Oil & Seasoning",
    description: "Cooking essentials and pantry finishing ingredients.",
    image: "/grains/Oil.png",
  },
  {
    title: "Spices",
    description: "Flavour-rich ingredients for traditional and modern cooking.",
    image: "/grains/Seed Spices.jpg",
  },
  {
    title: "Fruit & Veg",
    description: "Fresh produce and value packs for healthier food planning.",
    image: "/grains/Leafy Vegetables.jpg",
  },
];

const savingsHighlights = [
  {
    title: "Food savings",
    text: "Set aside funds in advance for household staples and seasonal price spikes.",
    href: "/plans",
  },
  {
    title: "Wallet top-up",
    text: "Keep buying cashless and structured with wallet funding for routine restocking.",
    href: "/wallet",
  },
  {
    title: "Price AI",
    text: "Monitor crop trends and buy at the right time before costs rise.",
    href: "/price-insights",
  },
];

const subscriptionPlans = [
  {
    title: "Weekly Supply",
    text: "Automated staples delivered on your buying rhythm.",
    tag: "Popular",
  },
  {
    title: "Family Pantry",
    text: "Smart refills for rice, beans, oil, and essentials.",
    tag: "Flexible",
  },
  {
    title: "Business Restock",
    text: "Keep your shop or kitchen stocked with predictable delivery windows.",
    tag: "Best for teams",
  },
];

const whyChooseUs = [
  {
    title: "Verified supply",
    text: "Every purchase is backed by transparent pricing and reliable stock availability.",
  },
  {
    title: "Faster financing",
    text: "Buy now and extend cash flow with BNPL, savings, and wallet funding tools.",
  },
  {
    title: "Local-first logistics",
    text: "Route planning and bulk coordination are built around real delivery needs.",
  },
  {
    title: "Community trust",
    text: "Cooperatives, households, and merchants can buy together at stronger prices.",
  },
];

const customerReviews = [
  {
    name: "Ada M.",
    role: "Home manager",
    quote: "The ordering flow is simple and the pricing is consistent. I can restock without second-guessing.",
  },
  {
    name: "Tunde O.",
    role: "Restaurant owner",
    quote: "We buy in bulk from Elohim and the process is predictable. That alone helps our budget planning.",
  },
  {
    name: "Ruth A.",
    role: "Cooperative buyer",
    quote: "Our group saves more because we can plan purchases and track prices before buying in volume.",
  },
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

const isStaleUploadFilenameReference = (value) => {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!normalized) return false;

  const candidate = normalized.replace(/^\/+/, "");

  return (
    /(?:^|\/)[a-z0-9._-]+-\d{13,}\.(?:jpe?g|png|webp|jfif)$/i.test(candidate) ||
    /(?:^|\/)[a-z0-9._-]+\.(?:jpe?g|png|webp|jfif)\.(?:jpe?g|png|webp|jfif)$/i.test(candidate) ||
    /(?:^|\/)[a-z0-9._-]+-\d{13,}\.(?:jpe?g|png|webp|jfif)\.(?:jpe?g|png|webp|jfif)$/i.test(candidate)
  );
};

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

  const cleanValue = stripFileExtension(value);
  const staticMatch = getStaticGrainAssetMatch(cleanValue);
  if (!staticMatch) return [];

  const variants = buildImageNameVariants(cleanValue);
  const hasExtension = /\.(?:jpe?g|png|webp|jfif)$/i.test(String(value));
  const extensions = hasExtension ? [""] : [".jpg", ".jpeg", ".png", ".jfif", ".webp"];
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

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

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

  return Number(
    product?.price ||
      displayVariant?.price ||
      variants[0]?.price ||
      0
  );
};

const getBackendAssetBase = () => {
  const configured = (
    process.env.NEXT_PUBLIC_ASSET_URL ||
    process.env.PUBLIC_ASSET_URL ||
    process.env.S3_PROXY_BASE_URL ||
    process.env.ASSET_PROXY_BASE_URL ||
    process.env.CLOUDFRONT_URL ||
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

  if (
    isStaleUploadFilenameReference(normalized) ||
    /(?:\.(?:jpe?g|png|webp|jfif))\.(?:jpe?g|png|webp|jfif)$/i.test(normalized)
  ) {
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
    const assetPath = safeUploadPath.startsWith("/")
      ? safeUploadPath
      : `/${safeUploadPath}`;
    return `${getBackendAssetBase()}${assetPath}`;
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

  const rawName = String(productName || "").trim();
  if (rawName && isPathLikeImageReference(rawName)) {
    const normalized = normalizeImagePath(rawName);
    if (normalized && normalized !== "/grains/rice.jpg") {
      addCandidate(normalized);
    }
    addCandidate("/grains/rice.jpg");
    return candidates;
  }

  const stableOverride = getStableImageOverride(productName);
  if (stableOverride) addCandidate(stableOverride);

  const knownMatch = getStaticGrainAssetMatch(rawName);
  if (knownMatch) addCandidate(knownMatch);

  if (!knownMatch && !stableOverride) {
    addCandidate("/grains/rice.jpg");
    return candidates;
  }

  buildImageCandidatesFromName(rawName).forEach(addCandidate);

  const candidateSources = [
    productName,
    productName?.image_url,
    productName?.image,
  ].filter(Boolean);

  candidateSources.forEach((source) => {
    const normalized = normalizeImagePath(source);
    if (normalized && normalized !== "/grains/rice.jpg") {
      addCandidate(normalized);
    }
  });

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

const getProductImage = (product) => {
  const stableOverride = getStableImageOverride(product?.name);
  if (stableOverride) return stableOverride;

  const candidateSources = [
    product?.image_url,
    product?.image,
    product?.types?.[0]?.image,
    product?.types?.[0]?.image_url,
    product?.variants?.[0]?.image_url,
    product?.variants?.[0]?.image,
  ].filter(Boolean);

  for (const candidate of candidateSources) {
    const normalized = normalizeImagePath(candidate);
    if (normalized && normalized !== "/grains/rice.jpg") {
      return normalized;
    }
  }

  return getImageCandidateList(product?.name)[0] || "/grains/rice.jpg";
};

const getProductStock = (product) => {
  const variants = getProductVariants(product);
  const variantStock = variants.reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0
  );
  const productStock = Number(product?.stock_quantity || 0);

  return Math.max(productStock, variantStock);
};

async function getProducts() {
  try {
    const baseUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://elohim-grains-store-production.up.railway.app/api";

    const res = await fetch(`${baseUrl}/products`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `Failed to fetch products: ${res.status} ${res.statusText}`
      );
      return [];
    }

    const data = await res.json();

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch products on server:", err);
    return [];
  }
}

function ProductTile({ product }) {
  const stock = getProductStock(product);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative h-44 bg-slate-100">
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
          {stock > 0 ? `${stock} in stock` : "Check stock"}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 to-transparent p-3 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          Tap to view full product details
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">{product.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {getProductWeight(product)}
            </p>
          </div>
          <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
            Store
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-lg font-black text-green-700">
            {formatPrice(getProductPrice(product))}
          </p>
          <span className="text-sm font-semibold text-slate-700 group-hover:text-green-700">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function Home() {
  const products = await getProducts();
  const featuredProducts = products.slice(0, 4);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f0fdf4_0%,#f8fafc_40%,#f8fafc_100%)] text-slate-950">
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Bags of rice and grains"
            className="h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,6,23,0.98),rgba(15,23,42,0.88),rgba(20,83,45,0.62))]" />
          <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-green-400/20 blur-3xl" />
          <div className="absolute -right-10 bottom-10 h-52 w-52 rounded-full bg-amber-300/20 blur-3xl" />
        </div>

        <div className="relative mx-auto grid min-h-[32rem] max-w-7xl items-center gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1.2fr_420px]">
          <div className="max-w-3xl text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-green-200 backdrop-blur">
              ELOHIM GRAINS
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.55)] md:text-6xl">
              Fresh staples, smart buying, and better food planning.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
              Shop grain essentials, fund your wallet, save toward food security,
              and buy in bulk with confidence through one trusted platform.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="rounded-xl bg-green-700 px-6 py-3 text-center font-bold text-white shadow-sm transition hover:bg-green-800"
              >
                Shop Now
              </Link>
              <Link
                href="/bulk"
                className="rounded-xl bg-white px-6 py-3 text-center font-bold text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Buy in Bulk
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {quickActions.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur"
                >
                  <p className="text-2xl font-black text-white">{metric.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-200">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <HomeWalletCard marketSignals={marketSignals} />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-3 md:px-6">
          {marketSignals.map((signal) => (
            <div
              key={signal.crop}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {signal.crop} signal
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">{signal.movement}</p>
              <p className="mt-2 text-sm text-slate-600">{signal.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="shop-by-category" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Shop by category
            </p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">
              Everyday essentials for every kitchen
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shopByCategory.map((category) => (
            <Link
              key={category.title}
              href="#best-sellers"
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={normalizeImagePath(category.image)}
                  alt={category.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-xl font-black">{category.title}</h3>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm leading-6 text-slate-600">{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="best-sellers" className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                Best sellers
              </p>
              <h2 className="mt-1 text-3xl font-black text-slate-950">
                Top picks this week
              </h2>
            </div>
            <Link href="/products" className="text-sm font-semibold text-green-700 hover:text-green-800">
              View all products
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No products available yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductTile key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="buy-in-bulk" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-[2fr_1.1fr]">
          <div className="relative min-h-[18rem]">
            <Image
              src="/grains/maize.jpg"
              alt="Bulk grain order"
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-200">
                Buy in bulk
              </p>
              <h3 className="mt-2 max-w-xl text-3xl font-black text-white">
                Better pricing for institutions, shops, and kitchens.
              </h3>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Bulk buying support
            </p>
            <h4 className="mt-3 text-2xl font-black text-slate-950">
              Stock up with predictable supply.
            </h4>
            <div className="mt-5 space-y-3">
              {bulkOrderBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-green-600" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/bulk"
                className="rounded-xl bg-green-700 px-5 py-3 text-center font-bold text-white hover:bg-green-800"
              >
                Request Bulk Order
              </Link>
              <Link
                href="/cooperatives"
                className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-slate-800 hover:bg-slate-50"
              >
                Join a Cooperative
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="food-savings" className="bg-slate-50 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Food savings
            </p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">
              Plan smarter before price shifts hit
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {savingsHighlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-green-700">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                <Link href={item.href} className="mt-5 inline-flex text-sm font-bold text-green-700 hover:text-green-800">
                  Learn more
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="subscriptions" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Subscriptions
            </p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">
              Flexible plans for regular buyers
            </h2>
          </div>
          <Link href="/subscriptions" className="text-sm font-semibold text-green-700 hover:text-green-800">
            Explore plans
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {subscriptionPlans.map((plan) => (
            <div key={plan.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
                {plan.tag}
              </span>
              <h3 className="mt-4 text-xl font-black text-slate-950">{plan.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.text}</p>
              <Link href="/subscriptions" className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                Choose plan
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="market-watch" className="bg-slate-950 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-300">
                Market watch / Price AI
              </p>
              <h2 className="mt-1 text-3xl font-black text-white">
                See what is changing before you buy
              </h2>
            </div>
            <Link href="/price-insights" className="text-sm font-semibold text-green-300 hover:text-green-200">
              Open Price AI
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-3">
              {marketSignals.map((signal) => (
                <div key={signal.crop} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
                    {signal.crop}
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">{signal.movement}</p>
                  <p className="mt-3 text-sm text-slate-300">{signal.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-green-200">
                AI signals
              </p>
              <h3 className="mt-3 text-2xl font-black text-white">Smart purchasing support</h3>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Use crop trends and price forecasts to choose the right time to buy in bulk or restock for the next cycle.
              </p>
              <Link href="/price-insights" className="mt-5 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-100">
                View insights
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="why-elohim" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">
            Why Elohim
          </p>
          <h2 className="mt-1 text-3xl font-black text-slate-950">
            Built to make food access easier and more dependable
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {whyChooseUs.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 h-11 w-11 rounded-xl bg-green-100" />
              <h3 className="text-lg font-black text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="customer-reviews" className="bg-slate-50 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Customer reviews
            </p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">
              Trusted by households, kitchens, and community buyers
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {customerReviews.map((review) => (
              <div key={review.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-1 text-amber-400">★★★★★</div>
                <p className="mt-4 text-sm leading-7 text-slate-600">“{review.quote}”</p>
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="font-black text-slate-950">{review.name}</p>
                  <p className="text-sm text-slate-500">{review.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="whatsapp-support" className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-100">
                WhatsApp support
              </p>
              <h3 className="mt-2 text-3xl font-black">Need help choosing the right grain or bulk order?</h3>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="https://wa.me/2348000000000"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white px-5 py-3 text-center font-bold text-green-700 hover:bg-slate-100"
              >
                Chat on WhatsApp
              </a>
              <Link href="/bulk" className="rounded-xl border border-white/30 px-5 py-3 text-center font-bold text-white hover:bg-white/10">
                Start bulk request
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="final-shop-cta" className="bg-white pb-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-950 px-6 py-8 text-center text-white shadow-sm sm:px-10">
            <p className="text-sm font-bold uppercase tracking-wide text-green-200">
              ELOHIM GRAINS
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">
              Ready to stock up without the stress?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Shop fresh grain essentials, save for tomorrow, and buy with confidence on a platform built for real households and businesses.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/products" className="rounded-xl bg-green-700 px-6 py-3 font-bold text-white hover:bg-green-800">
                Shop Now
              </Link>
              <Link href="/bulk" className="rounded-xl border border-white/30 px-6 py-3 font-bold text-white hover:bg-white/10">
                Buy in Bulk
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}