"use client";

import Link from "next/link";

export default function OrderSuccess() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">

      <h1 className="text-3xl font-bold text-green-600 mb-4">
        Order Successful 🎉
      </h1>

      <p className="text-gray-600 mb-6">
        Your grains will be delivered shortly.
      </p>

      <Link
        href="/"
        className="bg-green-600 text-white px-6 py-3 rounded"
      >
        Continue Shopping
      </Link>

    </div>
  );
}