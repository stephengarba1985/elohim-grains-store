export default function OrderTimeline({ status }) {
  // ✅ Normalize backend status
  const normalizeStatus = (status) => {
    if (!status) return 0;

    const s = status.toLowerCase();

    if (s === "pending") return 0;
    if (s === "processing") return 1;
    if (s === "out for delivery") return 2;
    if (s === "delivered") return 3;

    return 0;
  };

  const currentStep = normalizeStatus(status);

  const steps = [
    "Order Placed",
    "Processing",
    "Out for Delivery",
    "Delivered",
  ];

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="font-semibold mb-3">Order Status</h2>

      <ul className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={index}
            className={`${
              index <= currentStep
                ? "text-green-600 font-semibold"
                : "text-gray-400"
            }`}
          >
            • {step}
          </li>
        ))}
      </ul>
    </div>
  );
}