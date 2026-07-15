"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

export default function CartPage() {
  const {
    cart,
    fetchCart,
    removeFromCart,
    clearCart
  } = useCartStore();

  const [user, setUser] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [provider, setProvider] = useState("paystack");
  const [channel, setChannel] = useState("card");
  const [paymentInstructions, setPaymentInstructions] = useState(null);

  /* =========================
     INIT USER + LOAD CART
  ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login first");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    fetchCart();
  }, []);

  /* =========================
     REMOVE ITEM
  ========================= */
  const handleRemove = async (id) => {
    try {
      await removeFromCart(id);
      toast.success("Item removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove item");
    }
  };

  /* =========================
     CLEAR CART
  ========================= */
  const handleClearCart = async () => {
    try {
      await clearCart();
      toast.success("Cart cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear cart");
    }
  };

  /* =========================
     HELPERS
  ========================= */
  const formatPrice = (price) =>
    `N${Number(price || 0).toLocaleString()}`;

  const total = cart.reduce((sum, item) => {
    const price = Number(item.price || 0);
    return sum + price * item.quantity;
  }, 0);

  const providerChannels = {
    paystack: ["card", "bank_transfer", "ussd"],
    flutterwave: ["card", "bank_transfer", "ussd"],
    monnify: ["virtual_account", "bank_transfer"],
    opay: ["opay_transfer", "bank_transfer"],
  };

  const channelLabels = {
    card: "Card",
    bank_transfer: "Bank Transfer",
    virtual_account: "Virtual Account",
    opay_transfer: "Opay Transfer",
    ussd: "USSD",
  };

  /* =========================
     PAYMENT SUCCESS
  ========================= */
  const createOrderFromReference = async (reference) => {
    try {
      setPaymentNotice("");

      const res = await API.post("/orders/create", {
        reference,
        user_id: user.id,
      });

      toast.success("Payment successful");
      window.location.href = `/order/${res.data.orderId}`;
    } catch (err) {
      console.error("ORDER ERROR:", err.response?.data || err.message);
      setPaymentNotice("Payment went through, but we could not finish creating the order. Please contact support.");
      toast.error("Order failed after payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  /* =========================
     MULTI GATEWAY PAYMENT
  ========================= */
  const initializePayment = async () => {
    if (paymentLoading) return;

    if (!user) {
      toast.error("User not loaded");
      return;
    }

    if (!user.email) {
      toast.error("User email missing");
      return;
    }

    if (!total || total <= 0) {
      toast.error("Cart is empty");
      return;
    }

    setPaymentNotice("");
    setPaymentLoading(true);

    try {
      const res = await API.post("/payment-gateways/initialize", {
        user_id: user.id,
        provider,
        channel,
        amount: total,
      });

      setPaymentInstructions(res.data.instructions);
      setPaymentNotice(res.data.instructions.message);

      if (channel === "card") {
        toast.success("Gateway initialized. Confirm payment to continue.");
      } else {
        toast.success("Payment instructions generated");
      }
    } catch (err) {
      setPaymentNotice(
        err.response?.data?.error || "Payment could not start because of a network issue."
      );
      toast.error(err.response?.data?.error || "Payment failed to start");
    } finally {
      setPaymentLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!paymentInstructions?.reference) {
      return toast.error("Initialize payment first");
    }

    try {
      setPaymentLoading(true);
      await API.post("/payment-gateways/verify", {
        reference: paymentInstructions.reference,
      });
      await createOrderFromReference(paymentInstructions.reference);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Payment verification failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Cart</h1>

      {paymentNotice && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {paymentNotice}
        </div>
      )}

      {cart.length === 0 && (
        <p className="text-gray-500">No items in cart</p>
      )}

      {cart.map((item) => {
        const price = Number(item.price || 0);
        const weight = item.weight || "N/A";

        return (
          <div key={item.id} className="border p-4 mb-3 rounded shadow-sm">
            <h2 className="font-bold">{item.name}</h2>

            <p className="text-sm text-gray-600">
              Weight: {weight}
            </p>

            <p className="text-gray-600">
              {formatPrice(price)} x {item.quantity}
            </p>

            <p className="font-semibold">
              Total: {formatPrice(price * item.quantity)}
            </p>

            <button
              onClick={() => handleRemove(item.id)}
              className="bg-red-500 text-white px-3 py-1 mt-2 rounded"
            >
              Remove
            </button>
          </div>
        );
      })}

      {cart.length > 0 && (
        <>
          <h2 className="text-xl font-bold mt-4">
            Total: {formatPrice(total)}
          </h2>

          <div className="mt-5 border rounded-lg p-4 bg-white">
            <h3 className="font-bold mb-3">Payment Method</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-gray-600">Gateway</span>
                <select
                  value={provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    setProvider(nextProvider);
                    setChannel(providerChannels[nextProvider][0]);
                    setPaymentInstructions(null);
                  }}
                  className="border rounded p-3 w-full mt-1 bg-white"
                >
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="monnify">Monnify</option>
                  <option value="opay">Opay Transfer</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-gray-600">Channel</span>
                <select
                  value={channel}
                  onChange={(event) => {
                    setChannel(event.target.value);
                    setPaymentInstructions(null);
                  }}
                  className="border rounded p-3 w-full mt-1 bg-white"
                >
                  {providerChannels[provider].map((item) => (
                    <option key={item} value={item}>
                      {channelLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {paymentInstructions && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                <p className="font-bold text-green-800">{paymentInstructions.title}</p>
                <p>Reference: <b>{paymentInstructions.reference}</b></p>
                <p>Amount: <b>{formatPrice(paymentInstructions.amount)}</b></p>
                {paymentInstructions.bank_name && (
                  <>
                    <p>Bank: <b>{paymentInstructions.bank_name}</b></p>
                    <p>Account Number: <b>{paymentInstructions.account_number}</b></p>
                    <p>Account Name: <b>{paymentInstructions.account_name}</b></p>
                  </>
                )}
                {paymentInstructions.ussd_code && (
                  <p>USSD Code: <b>{paymentInstructions.ussd_code}</b></p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleClearCart}
              className="bg-gray-700 text-white px-4 py-2 rounded"
            >
              Clear Cart
            </button>

            <button
              onClick={initializePayment}
              disabled={!user || paymentLoading}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {paymentLoading ? "Processing..." : "Initialize Payment"}
            </button>

            {paymentInstructions && (
              <button
                onClick={verifyPayment}
                disabled={paymentLoading}
                className="bg-slate-950 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                Verify & Create Order
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
