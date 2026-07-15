import { create } from "zustand";
import API from "@/lib/api";

export const useCartStore = create((set, get) => ({
  cart: [],
  cartCount: 0,
  user: null,

  /* ================= USER ================= */
  setUser: (user) => set({ user }),

  /* ================= FETCH CART ================= */
  fetchCart: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const res = await API.get(`/cart/${user.id}`);

      set({
        cart: res.data,
        cartCount: res.data.length,
      });
    } catch (err) {
      console.error("Cart fetch error:", err);
    }
  },

  /* ================= ADD TO CART ================= */
  addToCart: async (productId, quantity = 1, variantId = null) => {
    const { user } = get();
    if (!user) throw new Error("No user");

    await API.post("/cart", {
      product_id: productId,
      quantity,
      user_id: user.id,
      variant_id: variantId,
      is_bulk: user.role === "bulk",
    });

    // ✅ INSTANT UI UPDATE (THIS IS THE FIX)
    set((state) => ({
      cartCount: state.cartCount + 1,
    }));
  },

  /* ================= REMOVE ================= */
  removeFromCart: async (cartId) => {
    const { user } = get();
    if (!user) return;

    await API.delete(`/cart/${cartId}/${user.id}`);

    set((state) => ({
      cartCount: Math.max(0, state.cartCount - 1),
    }));
  },

  /* ================= CLEAR ================= */
  clearCart: async () => {
    const { user } = get();
    if (!user) return;

    await API.delete(`/cart/clear/${user.id}`);

    set({
      cart: [],
      cartCount: 0,
    });
  },
}));
