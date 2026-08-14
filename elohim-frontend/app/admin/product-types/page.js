"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";

export default function ProductTypesPage() {
  const [types, setTypes] = useState([]);

  const fetchTypes = async () => {
    try {
      const res = await API.get("/product-types");
      setTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product types");
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Types</h1>
          <p className="text-sm text-gray-500">Manage product families like Local Rice, Honey Beans, etc.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Origin</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Variants</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id} className="border-t">
                <td className="px-4 py-3 font-medium">{type.product_name || "Unknown"}</td>
                <td className="px-4 py-3">{type.name}</td>
                <td className="px-4 py-3">{type.origin || "-"}</td>
                <td className="px-4 py-3">{type.brand || "-"}</td>
                <td className="px-4 py-3">{Number(type.variant_count || 0)} Variants</td>
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
