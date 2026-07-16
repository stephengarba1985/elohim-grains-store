import Image from "next/image";
import Link from "next/link";
import HomeWalletCard from "@/components/HomeWalletCard";

export const metadata = {
  title: "Elohim Grains Store | Agro Fintech",
  description:
    "Shop grains, fund a wallet, save toward food goals, and pay securely with Elohim Grains.",
};

export const dynamic = "force-dynamic";

const heroImage = "/grains/Rice.jpg";

const financeProducts = [
  {
    title: "Wallet",
    value: "Instant top up",
    text: "Fund, withdraw, transfer, and receive refunds directly in your Elohim wallet.",
    href: "/wallet",
  },
  {
    title: "Smart Savings",
    value: "Goal plans",
    text: "Save daily, weekly, or monthly toward rice, beans, maize, and bulk supply goals.",
    href: "/plans",
  },
  {
    title: "BNPL",
    value: "Pay small-small",
    text: "Collect grains now and repay with structured installments and reminders.",
    href: "/bnpl",
  },
  {
    title: "Inventory Finance",
    value: "Grain collateral",
    text: "Use stored grains as collateral to access short-term working capital.",
    href: "/inventory-finance",
  },
  {
    title: "Smart Warehouse",
    value: "Store and resell",
    text: "Buy grains into warehouse storage, track market value, and sell later when prices rise.",
    href: "/warehouse",
  },
  {
    title: "Receipts",
    value: "PDF records",
    text: "Generate receipts, monthly statements, savings history, and tax invoices for your account.",
    href: "/receipts-statements",
  },
  {
    title: "Escrow",
    value: "Protected orders",
    text: "Hold funds safely until delivery is confirmed for large and interstate orders.",
    href: "/cart",
  },
  {
    title: "KYC Verification",
    value: "Trust checks",
    text: "Verify BVN, NIN, phone, and email to unlock stronger trust across finance features.",
    href: "/kyc",
  },
];

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

const formatPrice = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const getProductPrice = (product) => {
  const variantPrice = product?.variants?.[0]?.price;
  return Number(product?.price || variantPrice || 0);
};

const normalizeImagePath = (imageUrl) => {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;

  const cleaned = imageUrl.replace(/^grains[\\/]/i, "");
  const hasExtension = /\.[a-z0-9]+$/i.test(cleaned);

  return `/grains/${hasExtension ? cleaned : `${cleaned}.jpg`}`;
};

const getProductImage = (product) => {
  if (product?.image_url) return normalizeImagePath(product.image_url);

  const fileName = String(product?.name || "Rice")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w().-]/g, "");

  return `/grains/${fileName}.jpg`;
};

const getProductStock = (product) => {
  const variantStock = (product?.variants || []).reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0
  );
  const productStock = Number(product?.stock_quantity || 0);

  return Math.max(productStock, variantStock);
};

async function getProducts() {
  try {
    const res = await fetch("http://localhost:5000/api/products", {
      cache: "no-store",
    });

    if (!res.ok) return [];

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
      className="group block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-44 bg-slate-100">
        <Image
          src={getProductImage(product)}
          alt={product.name}
          fill
          unoptimized
          sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
          {stock > 0 ? `${stock} in stock` : "Check stock"}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">{product.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {product.weight || product?.variants?.[0]?.name || "Standard bag"}
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt="Bags of rice and grains"
            fill
            priority
            className="object-cover opacity-55"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.92),rgba(15,23,42,0.72),rgba(15,23,42,0.35))]" />
        </div>

        <div className="relative mx-auto grid min-h-[560px] max-w-6xl items-center gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1fr_420px]">
          <div className="max-w-3xl text-white">
            <p className="text-sm font-bold uppercase tracking-wide text-green-200">
              Elohim Grains Store
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
              Buy grains, save for food goals, and pay with confidence.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
              A modern grain marketplace with wallet funding, smart savings,
              BNPL, escrow protection, cooperative buying, and payment gateway
              options built into one store.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#marketplace"
                className="rounded-lg bg-green-700 px-6 py-3 text-center font-bold text-white shadow-sm transition hover:bg-green-800"
              >
                Shop Grains
              </Link>
              <Link
                href="/wallet"
                className="rounded-lg bg-white px-6 py-3 text-center font-bold text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Open Wallet
              </Link>
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

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 md:px-6 lg:grid-cols-8">
          {financeProducts.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-green-200 hover:bg-green-50"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black text-slate-950">{item.title}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {item.value}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="marketplace" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Marketplace
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Fresh grains ready for checkout
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-500">
            {products.length} product(s) available
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-lg font-bold text-slate-950">
              No products found
            </p>
            <p className="mt-2 text-slate-500">
              Start the backend server to load store products.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Smart buying
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Plan supply before prices move
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use AI price insights, cooperative savings, and escrow to manage
              large orders with better timing and stronger trust.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link
                href="/price-insights"
                className="rounded-lg bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
              >
                View Price AI
              </Link>
              <Link
                href="/cooperatives"
                className="rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Create Cooperative
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Vendor marketplace
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Sell grains through Elohim
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Verified sellers can list grain products, receive ratings, manage
              delivery, and sell through a commission-based marketplace.
            </p>
            <Link
              href="/vendors"
              className="mt-5 flex justify-center rounded-lg bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800"
            >
              Open Vendor Marketplace
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-[260px_1fr]">
              <div className="relative min-h-44">
                <Image
                  src="/grains/Maize.jpg"
                  alt="Maize grains"
                  fill
                  sizes="(min-width: 1024px) 260px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-green-200">
                    Business supply
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">
                    Bulk grain orders
                  </h3>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  Bulk orders for churches, schools, markets, and distributors.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-green-700">Order size</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      10+ bags
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Delivery</p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      Scheduled
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {bulkOrderBenefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/bulk"
                  className="mt-5 flex w-full justify-center rounded-lg bg-green-700 px-4 py-3 text-sm font-bold text-white hover:bg-green-800"
                >
                  Request Bulk Order
                </Link>
              </div>
            </div>
        </div>
      </section>
    </main>
  );
}