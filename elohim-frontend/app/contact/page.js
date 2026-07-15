"use client";

const contactItems = [
  {
    label: "Location",
    value: "Abuja, Nigeria",
    detail: "Serving customers with grain delivery and support.",
  },
  {
    label: "Phone",
    value: "08039688939",
    detail: "Call for order support, delivery questions, or bulk enquiries.",
  },
  {
    label: "WhatsApp",
    value: "Chat Now",
    detail: "Get a faster response for order and account support.",
    href: "https://wa.me/2348039688939",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-green-700 px-5 py-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-50">
              Contact
            </p>
            <h1 className="text-3xl font-bold mt-1">Contact Elohim Grains</h1>
            <p className="text-green-50 mt-2 max-w-2xl">
              Reach us for order help, delivery questions, subscriptions, grain
              plans, or bulk supply enquiries.
            </p>
          </div>

          <div className="p-5 grid lg:grid-cols-3 gap-4">
            {contactItems.map((item) => (
              <div
                key={item.label}
                className="border border-slate-200 rounded-lg p-5 bg-slate-50"
              >
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  {item.label}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xl font-bold text-slate-950 hover:text-green-700 mt-1"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-xl font-bold text-slate-950 mt-1">
                    {item.value}
                  </p>
                )}
                <p className="text-sm text-slate-600 mt-3">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Support Hours
            </p>
            <h2 className="text-lg font-bold text-slate-950 mt-1">
              We are available for customer enquiries
            </h2>
            <p className="text-sm text-slate-600 mt-3">
              Send a WhatsApp message with your name, order reference if available,
              and the issue you need help with.
            </p>
          </div>

          <div className="bg-white border border-green-200 rounded-lg p-5 shadow-sm">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
              Bulk Enquiries
            </p>
            <h2 className="text-lg font-bold text-slate-950 mt-1">
              Need recurring or large supply?
            </h2>
            <p className="text-sm text-slate-600 mt-3">
              Contact us with product type, quantity, delivery location, and target
              timeline so we can advise on availability and pricing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
