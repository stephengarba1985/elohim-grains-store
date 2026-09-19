"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomeProductSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/products?search=${encodeURIComponent(value)}` : "/products");
  };

  return (
    <form onSubmit={submit} className="mt-3 flex items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
      <span aria-hidden="true" className="mr-2 text-lg">⌕</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search products" placeholder="Search rice, beans, garri..." className="min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
      <button type="submit" className="text-sm font-bold text-green-700">Search</button>
    </form>
  );
}
