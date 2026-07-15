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
          <p className="text-xs text-gray-400 mt-2">MANAGEMENT</p>

          {navItem("Dashboard", "/admin")}
          {navItem("Inventory", "/admin/inventory")}
          {navItem("Orders", "/admin/orders")}
          {navItem("Vendors", "/admin/vendors")}
          {navItem("Payments", "/admin/payments")}
          {navItem("Escrow", "/admin/escrow")}
          {navItem("Price AI", "/admin/price-insights")}
          {navItem("AI Assistant", "/admin/ai-assistant")}
          {navItem("Mobile App", "/admin/mobile")}
          {navItem("Wallet", "/admin/wallet")}
          {navItem("BNPL", "/admin/bnpl")}
          {navItem("Inventory Finance", "/admin/inventory-finance")}
          {navItem("Smart Warehouse", "/admin/warehouse")}
          {navItem("KYC Verification", "/admin/kyc")}
          {navItem("Cooperatives", "/admin/cooperatives")}
          {navItem("Grain Plans", "/admin/plans")}
          {navItem("Bulk Requests", "/admin/bulk")}
          {navItem("Logistics", "/admin/logistics")}
          {navItem("Riders", "/admin/riders")}

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
