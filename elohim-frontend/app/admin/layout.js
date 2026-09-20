"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const rolePaths = {
  super_admin: ["*"], operations_manager: ["/admin/dashboard","/admin/orders","/admin/products","/admin/inventory","/admin/customers","/admin/logistics","/admin/bulk","/admin/subscriptions"],
  finance: ["/admin/dashboard","/admin/payments","/admin/money","/admin/ledger","/admin/bnpl","/admin/analytics","/admin/profit"],
  warehouse: ["/admin/orders","/admin/products","/admin/inventory","/admin/suppliers"], delivery_manager: ["/admin/orders","/admin/logistics"], customer_support: ["/admin/orders","/admin/customers"], vendor_manager: ["/admin/products","/admin/vendors"],
};

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staffRole, setStaffRole] = useState("");

  useEffect(() => {
    try {
      setStaffRole(JSON.parse(localStorage.getItem("user") || "{}").staff_role || "");
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setStaffRole("");
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    router.push("/login");
  };

  const navItem = (label, path, color = "hover:bg-gray-100") => {
    const paths = rolePaths[staffRole] || [];
    if (!paths.includes("*") && !paths.includes(path)) return null;
    return (
    <button
      onClick={() => router.push(path)}
      className={`text-left px-3 py-2 rounded transition ${
        pathname === path ? "bg-green-200 font-semibold" : color
      }`}
    >
      {label}
    </button>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <aside className="h-screen w-64 shrink-0 overflow-y-auto bg-white p-4 shadow-lg overscroll-contain">
        <h1 className="text-xl font-bold text-green-700 mb-6">
          Elohim Admin
        </h1>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 mt-2">DAILY OPERATIONS</p>
          {navItem("Dashboard", "/admin/dashboard")}
          {navItem("Orders", "/admin/orders")}
          {navItem("Products", "/admin/products")}
          {navItem("Inventory", "/admin/inventory")}
          {navItem("Customers", "/admin/customers")}
          {navItem("Deliveries", "/admin/logistics")}
          {navItem("Bulk Orders", "/admin/bulk")}
          {navItem("Subscriptions", "/admin/subscriptions")}

          <p className="text-xs text-gray-400 mt-4">MONEY</p>
          {navItem("Payments", "/admin/payments")}
          {navItem("Wallet & Savings", "/admin/money")}
          {navItem("Transaction Ledger", "/admin/ledger")}
          {navItem("BNPL", "/admin/bnpl")}

          <p className="text-xs text-gray-400 mt-4">BUSINESS NETWORK</p>
          {navItem("Vendors", "/admin/vendors")}
          {navItem("Suppliers", "/admin/suppliers")}
          {navItem("Cooperatives", "/admin/cooperatives")}
          {navItem("Price Intelligence", "/admin/price-insights")}
          {navItem("Reports", "/admin/analytics")}
          {navItem("Profit Analytics", "/admin/profit")}

          <p className="text-xs text-gray-400 mt-4">ADMINISTRATION</p>
          {navItem("Settings", "/admin/settings")}

          <button
            onClick={logout}
            className="text-left px-3 py-2 rounded bg-red-500 text-white mt-6"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
