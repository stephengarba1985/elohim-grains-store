"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/products");
  }, [router]);

  return (
    <div className="p-6">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-2xl font-bold text-emerald-800">
          Redirecting to Products
        </h1>
        <p className="mt-2 text-sm text-emerald-700">
          Inventory and product management are now unified in the product catalog.
        </p>
      </div>
    </div>
  );
}
