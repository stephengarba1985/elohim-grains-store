"use client";

import Link from "next/link";

const storeLinks = [
  { label: "Marketplace", href: "/" },
  { label: "Vendor Marketplace", href: "/vendors" },
  { label: "Bulk Orders", href: "/bulk" },
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Cart", href: "/cart" },
];

const fintechLinks = [
  { label: "Wallet", href: "/wallet" },
  { label: "Smart Plans", href: "/plans" },
  { label: "BNPL", href: "/bnpl" },
  { label: "Inventory Finance", href: "/inventory-finance" },
  { label: "Smart Warehouse", href: "/warehouse" },
  { label: "KYC Verification", href: "/kyc" },
  { label: "Cooperatives", href: "/cooperatives" },
  { label: "Price AI", href: "/price-insights" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
  { label: "Login", href: "/login" },
];

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
        {title}
      </h3>
      <div className="mt-4 space-y-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block text-sm text-slate-400 transition hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[1.35fr_0.8fr_0.9fr_0.8fr]">
        <div>
          <Link href="/" className="text-2xl font-black text-white">
            Elohim Grains
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            A modern grains store with wallet payments, smart savings, BNPL,
            escrow protection, cooperative buying, and price intelligence.
          </p>

          <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-400">Support</p>
              <p className="mt-1 text-sm font-bold text-white">WhatsApp ready</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-400">Payments</p>
              <p className="mt-1 text-sm font-bold text-white">Secure checkout</p>
            </div>
          </div>
        </div>

        <FooterColumn title="Store" links={storeLinks} />
        <FooterColumn title="Fintech" links={fintechLinks} />
        <FooterColumn title="Company" links={companyLinks} />
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
          <p>Copyright {year} Elohim Grains Store. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/contact" className="hover:text-slate-300">
              Support
            </Link>
            <Link href="/order-success" className="hover:text-slate-300">
              Orders
            </Link>
            <a
              href="https://wa.me/2348039688939"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
