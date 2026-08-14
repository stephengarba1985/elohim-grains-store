"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function VariantsPage() {
  const [variants, setVariants] = useState([]);

  const fetchVariants = async () => {
    try {
      const res = await API.get("/products");
      const allProducts = Array.isArray(res.data) ? res.data : [];
      const flattened = [];

      allProducts.forEach((product) => {
        (product.types || []).forEach((type) => {
          (type.variants || []).forEach((variant) => {
            flattened.push({
              product: product.name,
              type: type.name,
              weight: variant.weight,
              price: variant.price,
              bulk_price: variant.bulk_price || variant.price,
              stock: variant.stock,
              sku: `${product.name?.slice(0, 3).toUpperCase() || "PRD"}-${type.name?.slice(0, 3).toUpperCase() || "TYP"}-${variant.weight || "STD"}`,
            });
          });
        });
      });

      setVariants(flattened);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load variants");
    }
  };

  useEffect(() => {
    fetchVariants();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Variants</h1>
          <p className="text-sm text-gray-500">Manage sizes, prices, stock, and SKUs.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Bulk Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={`${variant.product}-${variant.type}-${variant.weight}-${index}`} className="border-t">
                <td className="px-4 py-3">{variant.product}</td>
                <td className="px-4 py-3">{variant.type}</td>
                <td className="px-4 py-3">{variant.weight}</td>
                <td className="px-4 py-3">₦{Number(variant.price || 0).toLocaleString()}</td>
                <td className="px-4 py-3">₦{Number(variant.bulk_price || 0).toLocaleString()}</td>
                <td className="px-4 py-3">{variant.stock}</td>
                <td className="px-4 py-3">{variant.sku}</td>
                <td className="px-4 py-3 space-x-2">
                  <button className="bg-yellow-500 text-white px-3 py-1 rounded">Edit</button>
                  <button className="bg-red-500 text-white px-3 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
