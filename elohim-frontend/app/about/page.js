"use client";

import Link from "next/link";

const values = [
  {
    title: "Quality Sourcing",
    text: "We focus on clean, reliable grains selected for everyday homes and business kitchens.",
  },
  {
    title: "Clear Packaging",
    text: "Products are handled and packaged to make ordering easier, safer, and more predictable.",
  },
  {
    title: "Practical Value",
    text: "Retail, bulk, subscriptions, and savings plans give customers flexible ways to buy.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-green-700 px-5 py-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-50">
              About Us
            </p>
            <h1 className="text-3xl font-bold mt-1">About Elohim Grains</h1>
            <p className="text-green-50 mt-2 max-w-2xl">
              A trusted grain store helping Nigerian households and businesses buy
              quality food items with less market stress.
            </p>
          </div>

          <div className="p-5 grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4 text-slate-600 leading-7">
              <p>
                Elohim Grains provides clean, well-packaged grains and food staples
                delivered directly to customers. The goal is simple: make buying
                rice, beans, maize, millet, garri, flour, and other essentials more
                reliable.
              </p>
              <p>
                We support everyday shopping, recurring deliveries, grain savings
                plans, and bulk supply for restaurants, stores, and organizations.
                Each service is built around convenience, transparency, and dependable
                delivery.
              </p>
            </div>

            <div className="border border-green-200 bg-green-50 rounded-lg p-5">
              <p className="text-sm text-green-700">Our focus</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                Better grain buying for homes and businesses.
              </p>
              <Link
                href="/"
                className="inline-flex mt-5 bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm"
              >
                Browse Products
              </Link>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {values.map((value) => (
            <div
              key={value.title}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm"
            >
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Value
              </p>
              <h2 className="text-lg font-bold text-slate-950 mt-1">
                {value.title}
              </h2>
              <p className="text-slate-600 text-sm mt-3">{value.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
