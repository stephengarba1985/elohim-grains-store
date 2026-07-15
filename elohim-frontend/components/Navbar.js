"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

const pageGroups = [
  {
    title: "Store",
    links: [
      { label: "Home", href: "/" },
      { label: "Vendor Marketplace", href: "/vendors" },
      { label: "Bulk Orders", href: "/bulk" },
      { label: "Subscriptions", href: "/subscriptions" },
      { label: "Cart", href: "/cart" },
    ],
  },
  {
    title: "Fintech",
    links: [
      { label: "Wallet", href: "/user/wallet" },
      { label: "Plans", href: "/user/plans" },
      { label: "BNPL", href: "/user/bnpl" },
      { label: "Inventory Finance", href: "/user/inventory-finance" },
      { label: "Smart Warehouse", href: "/user/warehouse" },
      { label: "Financial Analytics", href: "/user/financial-analytics" },
      { label: "Receipts & Statements", href: "/user/receipts-statements" },
      { label: "KYC Verification", href: "/user/kyc" },
      { label: "Cooperatives", href: "/user/cooperatives" },
      { label: "Price AI", href: "/user/price-insights" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export default function Navbar({ user: initialUser }) {
  const pathname = usePathname();
  const [user, setLocalUser] = useState(initialUser);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount, fetchCart, setUser: setCartUser } = useCartStore();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    if (href === "/user/plans") return pathname === "/user/plans" || pathname === "/plans";
    if (href === "/user/wallet") return pathname === "/user/wallet" || pathname === "/wallet";
    if (href === "/user/bnpl") return pathname === "/user/bnpl" || pathname === "/bnpl";
    if (href === "/user/inventory-finance") return pathname === "/user/inventory-finance" || pathname === "/inventory-finance";
    if (href === "/user/warehouse") return pathname === "/user/warehouse" || pathname === "/warehouse";
    if (href === "/user/financial-analytics") return pathname === "/user/financial-analytics" || pathname === "/financial-analytics";
    if (href === "/user/receipts-statements") return pathname === "/user/receipts-statements" || pathname === "/receipts-statements";
    if (href === "/user/kyc") return pathname === "/user/kyc" || pathname === "/kyc";
    if (href === "/user/cooperatives") return pathname === "/user/cooperatives" || pathname === "/cooperatives";
    if (href === "/user/price-insights") return pathname === "/user/price-insights" || pathname === "/price-insights";
    if (href === "/vendors") return pathname === "/vendors" || pathname === "/user/vendors";

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navClass = (href) =>
    `px-3 py-2 rounded-lg font-medium transition ${
      isActive(href)
        ? "bg-green-100 text-green-800"
        : "text-slate-700 hover:bg-slate-50 hover:text-green-700"
    }`;

  useEffect(() => {
    setLocalUser(initialUser);

    if (initialUser) {
      setCartUser(initialUser);
      fetchCart();
    }
  }, [fetchCart, initialUser, setCartUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setLocalUser(null);
    setCartUser(null);
    window.dispatchEvent(new Event("auth:changed"));
    toast.success("Logged out");
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" onClick={() => setMobileOpen(false)}>
          <h1 className="cursor-pointer text-xl font-black text-green-700">
            Elohim Grains
          </h1>
        </Link>

        <nav className="hidden items-center gap-2 text-sm lg:flex">
          <Link href="/" className={navClass("/")}>
            Home
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setPagesOpen(true)}
            onMouseLeave={() => setPagesOpen(false)}
          >
            <button
              onClick={() => setPagesOpen((open) => !open)}
              className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 hover:text-green-700"
            >
              Pages
            </button>

            {pagesOpen && (
              <div className="absolute left-0 top-full w-[560px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                <div className="grid grid-cols-3 gap-4">
                  {pageGroups.map((group) => (
                    <div key={group.title}>
                      <p className="px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {group.title}
                      </p>
                      <div className="mt-2 space-y-1">
                        {group.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={`block rounded-lg px-2 py-2 font-medium transition ${
                              isActive(link.href)
                                ? "bg-green-100 text-green-800"
                                : "text-slate-700 hover:bg-slate-50 hover:text-green-700"
                            }`}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/bulk" className={navClass("/bulk")}>
            Bulk Orders
          </Link>
          <Link href="/vendors" className={navClass("/vendors")}>
            Vendors
          </Link>
          <Link href="/user/wallet" className={navClass("/user/wallet")}>
            Wallet
          </Link>
          <Link href="/user/plans" className={navClass("/user/plans")}>
            Plans
          </Link>
          <Link href="/user/bnpl" className={navClass("/user/bnpl")}>
            BNPL
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/cart" className="relative hidden sm:block">
            <span
              className={`rounded-lg px-4 py-2 font-bold transition ${
                isActive("/cart")
                  ? "bg-green-800 text-white"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              Cart
            </span>

            {cartCount > 0 && (
              <span className="absolute -right-2 -top-3 rounded-full bg-red-500 px-2 py-1 text-xs text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {!user ? (
            <Link href="/login" className={`${navClass("/login")} hidden sm:block`}>
              Login
            </Link>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <Link href="/dashboard" className={navClass("/dashboard")}>
                Dashboard
              </Link>

              <span className="text-slate-600">
                Hi, <b>{user.name}</b>
              </span>

              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-500 px-3 py-2 font-semibold text-white hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          )}

          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-800 lg:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="space-y-5">
            {pageGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {group.title}
                </p>
                <div className="mt-2 grid gap-1">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-lg px-3 py-2 font-medium ${
                        isActive(link.href)
                          ? "bg-green-100 text-green-800"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid gap-2 border-t border-slate-200 pt-4">
              {!user ? (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-green-700 px-4 py-3 text-center font-bold text-white"
                >
                  Login
                </Link>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-green-700 px-4 py-3 text-center font-bold text-white"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg bg-red-500 px-4 py-3 font-bold text-white"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
