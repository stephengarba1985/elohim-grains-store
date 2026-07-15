import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Elohim Grains Store | Fresh Grains & Bulk Supply",
  description:
    "Shop rice, beans, maize, garri, flour, and wholesale grains with reliable delivery from Elohim Grains.",
};

export const dynamic = "force-dynamic";

const heroImage = "/grains/Rice.jpg";

const storeCategories = [
  { title: "Rice", image: "/grains/Rice.jpg", href: "#marketplace", note: "Local and premium bags" },
  { title: "Beans", image: "/grains/Beans.jpg", href: "#marketplace", note: "Oloyin, cowpea, kidney" },
  { title: "Maize", image: "/grains/Maize.jpg", href: "#marketplace", note: "Market and bulk supply" },
  { title: "Flours", image: "/grains/Yam-Flour(Amala).jpg", href: "#marketplace", note: "Yam and plantain flour" },
];

const storeHighlights = [
  { label: "Fresh grain categories", value: "12+" },
  { label: "Bulk order support", value: "10+ bags" },
  { label: "Delivery scheduling", value: "Flexible" },
  { label: "Secure checkout", value: "Wallet + card" },
];

const storeServices = [
  {
    title: "Retail grain shopping",
    text: "Buy everyday food staples in small or standard bag sizes with clear prices and stock visibility.",
  },
  {
    title: "Bulk supply requests",
    text: "Request wholesale quantities for homes, schools, churches, restaurants, and market resellers.",
  },
  {
    title: "Verified marketplace",
    text: "Shop from Elohim inventory and verified vendors with order tracking and invoice support.",
  },
];

const financeProducts = [
  {
    title: "Store Wallet",
    value: "Fast checkout",
    text: "Fund once and pay quickly for grain orders, delivery, refunds, and repeat purchases.",
    href: "/wallet",
  },
  {
    title: "Food Savings",
    value: "Plan ahead",
    text: "Save toward rice, beans, maize, and bulk food goals before prices move.",
    href: "/plans",
  },
  {
    title: "Pay Later",
    value: "BNPL",
    text: "Collect food staples now and repay with structured installments when eligible.",
    href: "/bnpl",
  },
  {
    title: "Smart Warehouse",
    value: "Buy & store",
    text: "Buy grains into storage, monitor market value, and request resale later.",
    href: "/warehouse",
  },
  {
    title: "Receipts",
    value: "Records",
    text: "Download receipts, statements, and tax invoices for household or business records.",
    href: "/receipts-statements",
  },
  {
    title: "Escrow",
    value: "Protected bulk",
    text: "Protect large orders by holding funds until delivery is confirmed.",
    href: "/cart",
  },
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

function CategoryTile({ category }) {
  return (
    <Link
      href={category.href}
      className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-36 bg-slate-100">
        <Image
          src={category.image}
          alt={category.title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <p className="font-black text-slate-950">{category.title}</p>
        <p className="mt-1 text-sm text-slate-500">{category.note}</p>
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
            className="object-cover opacity-60"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.9),rgba(15,23,42,0.68),rgba(15,23,42,0.24))]" />
        </div>

        <div className="relative mx-auto grid min-h-[590px] max-w-7xl items-center gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1fr_440px]">
          <div className="max-w-3xl text-white">
            <p className="text-sm font-bold uppercase tracking-wide text-green-200">
              Fresh grains, direct to your door
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
              Shop quality grains for home, business, and bulk supply.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
              Order rice, beans, maize, garri, wheat, flour, and other food
              staples with transparent prices, reliable fulfillment, and
              flexible delivery options.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#marketplace"
                className="rounded-lg bg-green-700 px-6 py-3 text-center font-bold text-white shadow-sm transition hover:bg-green-800"
              >
                Shop Grains
              </Link>
              <Link
                href="/bulk"
                className="rounded-lg bg-white px-6 py-3 text-center font-bold text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Request Bulk Supply
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {storeHighlights.map((metric) => (
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

          <div className="rounded-lg border border-white/15 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-green-700">
                  Featured supply
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Rice, beans, maize and flour
                </h2>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                In store
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {storeCategories.slice(0, 4).map((category) => (
                <div key={category.title} className="overflow-hidden rounded-lg bg-slate-100">
                  <div className="relative h-24">
                    <Image
                      src={category.image}
                      alt={category.title}
                      fill
                      sizes="220px"
                      className="object-cover"
                    />
                  </div>
                  <p className="bg-white px-3 py-2 text-sm font-black text-slate-950">
                    {category.title}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wide text-green-200">
                Store promise
              </p>
              <p className="mt-2 text-xl font-black">Clean staples. Clear pricing.</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Choose products, confirm quantity, pay securely, and track your order
                from checkout to delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:px-6 lg:grid-cols-3">
          {storeServices.map((service) => (
            <div key={service.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Shop by category
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Everyday food staples
            </h2>
          </div>
          <Link href="#marketplace" className="text-sm font-bold text-green-700 hover:text-green-800">
            View all products
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {storeCategories.map((category) => (
            <CategoryTile key={category.title} category={category} />
          ))}
        </div>
      </section>

      <section id="marketplace" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Store marketplace
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

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">
              Market timing
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Check prices before you buy
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use price insights to know when staples are rising, falling, or
              entering a better buying window.
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

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-700">
                Payment and store tools
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Helpful finance features, built around shopping
              </h2>
            </div>
            <Link href="/user/financial-analytics" className="text-sm font-bold text-green-700 hover:text-green-800">
              View analytics
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {financeProducts.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-green-200 hover:bg-green-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-slate-950">{item.title}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {item.value}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
