"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import API from "@/lib/api";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cartStore";

export default function CartPage() {
  const {
    cart,
    fetchCart,
    removeFromCart,
    clearCart,
    updateQuantity,
    setUser: setCartUser,
  } = useCartStore();

  const [user, setUser] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [provider, setProvider] = useState("paystack");
  const [channel, setChannel] = useState("card");
  const [paymentInstructions, setPaymentInstructions] = useState(null);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [checkoutDetails, setCheckoutDetails] = useState({
    fullName: "", phone: "", email: "", state: "", city: "", address: "", landmark: "", deliveryPhone: "", abujaZone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [walletBalance, setWalletBalance] = useState(null);
  const [bnplEligible, setBnplEligible] = useState(false);

  /* =========================
     INIT USER + LOAD CART
  ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      toast.error("Please login first");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setCartUser(parsedUser);
      const savedCheckout = localStorage.getItem("checkoutDetails");
      const savedDetails = savedCheckout ? JSON.parse(savedCheckout) : {};
      setCheckoutDetails((current) => ({
        ...current,
        ...savedDetails,
        fullName: savedDetails.fullName || parsedUser.name || "",
        phone: savedDetails.phone || parsedUser.phone || "",
        email: savedDetails.email || parsedUser.email || "",
        address: savedDetails.address || parsedUser.address || "",
        deliveryPhone: savedDetails.deliveryPhone || parsedUser.phone || "",
      }));
      fetchCart();
      Promise.allSettled([
        API.get(`/wallet/${parsedUser.id}`),
        API.get(`/bnpl/user/${parsedUser.id}`),
      ]).then(([walletResult, bnplResult]) => {
        if (walletResult.status === "fulfilled") setWalletBalance(Number(walletResult.value.data?.balance || 0));
        if (bnplResult.status === "fulfilled") setBnplEligible(Number(bnplResult.value.data?.credit_score || 0) >= 520);
      });
    } catch (err) {
      console.error("Invalid stored user payload:", err);
      toast.error("Please login again");
    }
  }, [fetchCart, setCartUser]);

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

  const handleQuantityChange = async (item, change) => {
    const nextQuantity = Number(item.quantity) + change;
    const availableStock = Number(item.stock || 0);

    if (nextQuantity < 1) return;
    if (availableStock > 0 && nextQuantity > availableStock) {
      toast.error("That is the maximum quantity available");
      return;
    }

    try {
      setUpdatingItemId(item.id);
      await updateQuantity(item.id, nextQuantity);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Could not update quantity");
    } finally {
      setUpdatingItemId(null);
    }
  };

  const updateCheckoutDetail = (field, value) => {
    setCheckoutDetails((current) => ({ ...current, [field]: value }));
  };

  const startCheckout = () => {
    const requiredFields = ["fullName", "phone", "email", "state", "city", "address", "deliveryPhone"];
    if (requiredFields.some((field) => !String(checkoutDetails[field] || "").trim())) {
      toast.error("Please complete your contact and delivery details");
      return;
    }
    localStorage.setItem("checkoutDetails", JSON.stringify(checkoutDetails));
    if (paymentMethod === "bnpl") {
      window.location.href = "/bnpl";
      return;
    }
    if (paymentMethod === "wallet") {
      toast("Wallet checkout is being prepared. Please choose Pay online for this order today.");
      return;
    }
    payWithPaystack();
  };

  /* =========================
     HELPERS
  ========================= */
  const formatPrice = (price) =>
    `₦${Number(price || 0).toLocaleString()}`;

  const total = cart.reduce((sum, item) => {
    const price = Number(item.price || 0);
    return sum + price * item.quantity;
  }, 0);

  const bulkSuggestionItem = cart.find((item) => {
    const quantity = Number(item.quantity || 0);
    return quantity >= 2 && quantity < 10;
  });
  const isBulkOrder = user?.role === "bulk" || cart.some((item) => Number(item.quantity || 0) >= 10);
  const deliveryFee = isBulkOrder ? null : 5000;
  const payableTotal = total + (deliveryFee || 0);

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
        delivery_fee: deliveryFee || 0,
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
        amount: payableTotal,
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

  const loadPaystackPopup = () =>
    new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Window is unavailable"));
        return;
      }

      if (window.PaystackPop) {
        resolve(window.PaystackPop);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://js.paystack.co/v2/inline.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.PaystackPop) {
            resolve(window.PaystackPop);
          } else {
            reject(new Error("Paystack script loaded but PaystackPop is unavailable"));
          }
        });
        existingScript.addEventListener("error", () => {
          reject(new Error("Failed to load Paystack script"));
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v2/inline.js";
      script.async = true;
      script.onload = () => {
        if (window.PaystackPop) {
          resolve(window.PaystackPop);
        } else {
          reject(new Error("Paystack script loaded but PaystackPop is unavailable"));
        }
      };
      script.onerror = () => {
        reject(new Error("Failed to load Paystack script"));
      };
      document.body.appendChild(script);
    });

  const verifyReferenceForCheckout = async (reference, userId) => {
    try {
      await API.post("/payment/verify", {
        reference,
        user_id: userId,
      });
      return;
    } catch (primaryErr) {
      console.warn(
        "Primary payment verify failed, trying gateway fallback:",
        primaryErr.response?.data || primaryErr.message
      );
    }

    await API.post("/payment-gateways/verify", {
      reference,
    });
  };

  const payWithPaystack = async () => {
    if (typeof window === "undefined") return;

    if (paymentLoading) return;

    if (!user) {
      toast.error("Please login");
      return;
    }

    if (!total || total <= 0) {
      toast.error("Your cart is empty");
      return;
    }

    setPaymentLoading(true);

    try {
      // Step 1: Initialize payment on backend
      const init = await API.post("/payment-gateways/initialize", {
        user_id: user.id,
        provider: "paystack",
        channel: "card",
        amount: payableTotal,
      });

      const paymentInfo = init.data.instructions;

      if (!paymentInfo?.reference) {
        throw new Error("Payment reference not returned");
      }

      // Step 2: Load Paystack SDK from the browser
      const PaystackPop = await loadPaystackPopup();

      const paystackKey =
        process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
        "pk_test_cb3837ca458c1f78520ead3c69b2cef9e228b41e";

      if (!paystackKey) {
        throw new Error("Paystack public key is missing");
      }

      const amountInKobo = Math.round(Number(payableTotal) * 100);

      if (!Number.isFinite(amountInKobo) || amountInKobo <= 0) {
        throw new Error("Invalid payment amount");
      }

      const popup = new PaystackPop();
      const allowedPaystackChannels = ["card", "bank_transfer", "ussd"];
      const selectedChannel = allowedPaystackChannels.includes(channel)
        ? channel
        : "card";

      // Step 3: Open popup
      const checkoutOptions = {
        key: paystackKey,
        email: user.email,
        amount: amountInKobo,
        currency: "NGN",
        channels: [selectedChannel],
        reference: String(paymentInfo.reference),
        metadata: {
          user_id: String(user.id),
          custom_fields: [
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: String(user.id),
            },
          ],
        },
        onSuccess: async (transaction) => {
          if (!transaction?.reference) {
            toast.error("Payment callback is missing a reference. Please retry.");
            return;
          }

          try {
            setPaymentLoading(true);
            await verifyReferenceForCheckout(transaction.reference, user.id);
            await createOrderFromReference(transaction.reference);
          } catch (err) {
            console.error(err.response?.data || err);
            toast.error(
              err.response?.data?.error ||
              "Payment verified but order creation failed."
            );
          } finally {
            setPaymentLoading(false);
          }
        },
        onCancel: () => {
          setPaymentLoading(false);
          toast("Payment cancelled");
        },
        onError: (err) => {
          console.error("Paystack error:", err);
          setPaymentLoading(false);
          toast.error(err?.message || "Paystack checkout failed");
        },
      };

      if (typeof popup.checkout === "function") {
        await popup.checkout(checkoutOptions);
      } else {
        popup.newTransaction(checkoutOptions);
      }
    } catch (err) {
      console.error(err.response?.data || err);

      toast.error(
        err.response?.data?.error ||
        err.message ||
        "Unable to start payment."
      );
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
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Elohim Grains</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Your Cart</h1>
        </div>
        <Link href="/products" className="font-bold text-emerald-700 hover:underline">Continue Shopping</Link>
      </div>

      {paymentNotice && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {paymentNotice}
        </div>
      )}

      {cart.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-bold text-slate-800">Your cart is empty.</p>
          <Link href="/products" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Start Shopping</Link>
        </div>
      )}

      {cart.map((item) => {
        const price = Number(item.price || 0);
        const weight = item.weight || item.variant?.weight || "Standard bag";
        const itemName = item.product?.name || item.name || "Product";
        const isUpdating = Number(updatingItemId) === Number(item.id);

        return (
          <div key={item.id} className="mb-3 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <h2 className="text-lg font-black text-slate-900">{itemName} <span className="font-semibold text-slate-500">{weight}</span></h2>
              <p className="mt-1 text-sm text-slate-500">{formatPrice(price)} each</p>
              <button onClick={() => handleRemove(item.id)} className="mt-2 text-sm font-semibold text-red-600 hover:underline">Remove</button>
            </div>
            <div className="inline-flex items-center justify-self-start rounded-xl border border-slate-300 bg-white">
              <button type="button" aria-label={`Decrease ${itemName} quantity`} onClick={() => handleQuantityChange(item, -1)} disabled={isUpdating || item.quantity <= 1} className="px-3 py-2 text-lg font-black text-slate-700 disabled:opacity-30">−</button>
              <span className="min-w-10 text-center font-black text-slate-900">{item.quantity}</span>
              <button type="button" aria-label={`Increase ${itemName} quantity`} onClick={() => handleQuantityChange(item, 1)} disabled={isUpdating || (Number(item.stock || 0) > 0 && item.quantity >= Number(item.stock || 0))} className="px-3 py-2 text-lg font-black text-slate-700 disabled:opacity-30">+</button>
            </div>
            <p className="text-xl font-black text-slate-950 sm:text-right">{formatPrice(price * item.quantity)}</p>
          </div>
        );
      })}

      {cart.length > 0 && (
        <>
          <section className="mt-6 rounded-2xl bg-slate-950 p-5 text-white shadow-lg">
            <div className="flex justify-between gap-4 text-slate-300"><span>Products</span><span>{formatPrice(total)}</span></div>
            <div className="mt-3 flex justify-between gap-4 text-slate-300"><span>Delivery</span><span>{isBulkOrder ? "Fee confirmed after order review" : formatPrice(deliveryFee)}</span></div>
            <div className="mt-4 flex justify-between gap-4 border-t border-slate-700 pt-4 text-xl font-black"><span>Total</span><span>{isBulkOrder ? formatPrice(total) : formatPrice(payableTotal)}</span></div>
            {isBulkOrder && <p className="mt-3 text-xs text-amber-200">Bulk delivery may require a truck or scheduled delivery. The delivery fee will be confirmed after review.</p>}
          </section>

          {bulkSuggestionItem && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Buying more?</p>
              <h2 className="mt-2 text-lg font-black text-slate-900">You may qualify for bulk pricing from 10 bags.</h2>
              <p className="mt-2 text-sm text-slate-600">
                Request a tailored price for {bulkSuggestionItem.product?.name || "this product"} and larger orders.
              </p>
              <Link
                href={`/bulk?product_id=${bulkSuggestionItem.product_id}&quantity=${bulkSuggestionItem.quantity}`}
                className="mt-4 inline-flex rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400"
              >
                REQUEST BULK PRICE
              </Link>
            </section>
          )}

          <section className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Step 1</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Contact information</h2>
              <p className="mt-1 text-sm text-slate-500">Your saved account details are filled in automatically.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1 block text-sm font-bold text-slate-700">Full name</span><input value={checkoutDetails.fullName} onChange={(event) => updateCheckoutDetail("fullName", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="name" /></label>
              <label><span className="mb-1 block text-sm font-bold text-slate-700">Phone number</span><input value={checkoutDetails.phone} onChange={(event) => updateCheckoutDetail("phone", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="tel" inputMode="tel" /></label>
              <label><span className="mb-1 block text-sm font-bold text-slate-700">Email</span><input type="email" value={checkoutDetails.email} onChange={(event) => updateCheckoutDetail("email", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="email" /></label>
            </div>
          </section>

          <section className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Step 2</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Delivery address</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="mb-1 block text-sm font-bold text-slate-700">State</span><input value={checkoutDetails.state} onChange={(event) => updateCheckoutDetail("state", event.target.value)} placeholder="e.g. FCT" className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="address-level1" /></label>
              <label><span className="mb-1 block text-sm font-bold text-slate-700">City</span><input value={checkoutDetails.city} onChange={(event) => updateCheckoutDetail("city", event.target.value)} placeholder="e.g. Abuja" className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="address-level2" /></label>
              {/(^fct$|abuja)/i.test(checkoutDetails.state) && (
                <label className="sm:col-span-2"><span className="mb-1 block text-sm font-bold text-slate-700">Abuja delivery zone</span><select value={checkoutDetails.abujaZone} onChange={(event) => updateCheckoutDetail("abujaZone", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"><option value="">Choose a zone</option><option>Central</option><option>Gwarinpa</option><option>Kubwa</option><option>Lugbe</option><option>Airport area</option><option>Other Abuja area</option></select></label>
              )}
              <label className="sm:col-span-2"><span className="mb-1 block text-sm font-bold text-slate-700">Address</span><input value={checkoutDetails.address} onChange={(event) => updateCheckoutDetail("address", event.target.value)} placeholder="House number, street and area" className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="street-address" /></label>
              <label><span className="mb-1 block text-sm font-bold text-slate-700">Landmark <span className="font-normal text-slate-400">(optional)</span></span><input value={checkoutDetails.landmark} onChange={(event) => updateCheckoutDetail("landmark", event.target.value)} placeholder="Closest landmark" className="w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
              <label><span className="mb-1 block text-sm font-bold text-slate-700">Delivery phone</span><input value={checkoutDetails.deliveryPhone} onChange={(event) => updateCheckoutDetail("deliveryPhone", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" autoComplete="tel" inputMode="tel" /></label>
            </div>
          </section>

          <div className="mt-5 border rounded-2xl p-5 bg-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Step 3</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Choose payment method</h3>
            <div className="mt-4 grid gap-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${paymentMethod === "online" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="payment-method" value="online" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} className="mt-1 accent-emerald-600" />
                <span><span className="block font-black text-slate-900">Pay online</span><span className="mt-1 block text-sm text-slate-600">Secure card, bank transfer, or USSD payment.</span></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${paymentMethod === "wallet" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="payment-method" value="wallet" checked={paymentMethod === "wallet"} onChange={() => setPaymentMethod("wallet")} className="mt-1 accent-emerald-600" />
                <span><span className="block font-black text-slate-900">Elohim Wallet</span><span className="mt-1 block text-sm text-slate-600">Available balance: <b>{walletBalance === null ? "Loading..." : formatPrice(walletBalance)}</b></span></span>
              </label>
              {bnplEligible && (
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${paymentMethod === "bnpl" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <input type="radio" name="payment-method" value="bnpl" checked={paymentMethod === "bnpl"} onChange={() => setPaymentMethod("bnpl")} className="mt-1 accent-emerald-600" />
                  <span><span className="block font-black text-slate-900">BNPL</span><span className="mt-1 block text-sm text-slate-600">You qualify for Buy Now, Pay Later. Continue to choose a repayment plan.</span></span>
                </label>
              )}
              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-bold text-slate-700">Other approved payment options</summary>
                <p className="mt-2 text-sm text-slate-600">Contact Elohim Grains for approved business or special-order payment arrangements.</p>
              </details>
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={handleClearCart}
              className="order-2 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 sm:order-1"
            >
              Clear Cart
            </button>

            <button
              onClick={startCheckout}
              disabled={paymentLoading}
              className="order-1 rounded-xl bg-emerald-600 px-4 py-3 font-black tracking-wide text-white hover:bg-emerald-700 disabled:bg-gray-400 sm:order-2"
            >
              {paymentLoading ? "OPENING..." : "CHECKOUT"}
            </button>

            {paymentInstructions && (
              <button
                onClick={verifyPayment}
                disabled={paymentLoading}
                className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:bg-gray-400"
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
