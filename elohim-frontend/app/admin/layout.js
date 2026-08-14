"use client";

import { useRouter, usePathname } from "next/navigation";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    router.push("/login");
  };

  const navItem = (label, path, color = "hover:bg-gray-100") => (
    <button
      onClick={() => router.push(path)}
      className={`text-left px-3 py-2 rounded transition ${
        pathname === path ? "bg-green-200 font-semibold" : color
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-lg p-4">
        <h1 className="text-xl font-bold text-green-700 mb-6">
          Elohim Admin
        </h1>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 mt-2">OPERATIONS</p>

          {navItem("Dashboard", "/admin")}
          {navItem("Products", "/admin/products")}
          {navItem("Categories", "/admin/categories")}
          {navItem("Product Types", "/admin/product-types")}
          {navItem("Variants", "/admin/variants")}
          {navItem("Orders", "/admin/orders")}
          {navItem("Customers", "/admin/customers")}
          {navItem("Inventory", "/admin/inventory")}
          {navItem("Vendors", "/admin/vendors")}
          {navItem("Riders", "/admin/riders")}
          {navItem("Logistics", "/admin/logistics")}

          <p className="text-xs text-gray-400 mt-4">FINANCE</p>

          {navItem("Payments", "/admin/payments")}
          {navItem("Wallet", "/admin/wallet")}
          {navItem("Escrow", "/admin/escrow")}
          {navItem("BNPL", "/admin/bnpl")}
          {navItem("Inventory Finance", "/admin/inventory-finance")}

          <p className="text-xs text-gray-400 mt-4">AI & ANALYTICS</p>

          {navItem("Price AI", "/admin/price-insights")}
          {navItem("AI Assistant", "/admin/ai-assistant")}
          {navItem("Sales Analytics", "/admin/analytics")}

          <p className="text-xs text-gray-400 mt-4">SUPPLY CHAIN</p>

          {navItem("Warehouse", "/admin/warehouse")}
          {navItem("Bulk Requests", "/admin/bulk")}
          {navItem("Grain Plans", "/admin/plans")}
          {navItem("Cooperatives", "/admin/cooperatives")}

          <p className="text-xs text-gray-400 mt-4">SECURITY</p>

          {navItem("KYC Verification", "/admin/kyc")}
          {navItem("Mobile App", "/admin/mobile")}

          <button
            onClick={logout}
            className="text-left px-3 py-2 rounded bg-red-500 text-white mt-6"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
