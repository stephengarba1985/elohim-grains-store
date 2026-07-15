"use client";

import Link from "next/link";

const services = [
  {
    title: "Retail Grain Sales",
    text: "Shop everyday grains and food staples in convenient quantities for home use.",
    href: "/",
    action: "Shop Products",
  },
  {
    title: "Bulk Supply",
    text: "Request target pricing and manage larger supply needs for shops, restaurants, and teams.",
    href: "/bulk",
    action: "Request Bulk Order",
  },
  {
    title: "Subscriptions",
    text: "Set weekly or monthly grain deliveries and control your schedule from your account.",
    href: "/subscriptions",
    action: "Manage Subscriptions",
  },
  {
    title: "Grain Savings Plans",
    text: "Build flexible grain plans, track payments, and save toward future food purchases.",
    href: "/user/plans",
    action: "Open Plans",
  },
  {
    title: "Home Delivery",
    text: "Receive confirmed orders at your doorstep with order and delivery tracking support.",
    href: "/contact",
    action: "Contact Support",
  },
  {
    title: "Business Support",
    text: "Coordinate repeat supply for businesses that need dependable grain procurement.",
    href: "/contact",
    action: "Talk To Us",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Services
            </p>
            <h1 className="text-3xl font-bold text-slate-950 mt-1">
              Grain services for homes and businesses
            </h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Choose how you want to buy: retail shopping, bulk requests,
              subscriptions, delivery, or structured grain plans.
            </p>
          </div>

          <Link
            href="/contact"
            className="bg-green-700 hover:bg-green-800 text-white px-5 py-3 rounded-lg font-semibold shadow-sm text-center"
          >
            Contact Us
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col"
            >
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Service
              </p>
              <h2 className="text-lg font-bold text-slate-950 mt-1">
                {service.title}
              </h2>
              <p className="text-sm text-slate-600 mt-3 flex-1">{service.text}</p>
              <Link
                href={service.href}
                className="mt-5 border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-3 rounded-lg font-semibold text-center"
              >
                {service.action}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
