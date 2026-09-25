import { create } from "zustand";
import { persist } from "zustand/middleware";
import API from "@/lib/api";

const isRetryableNetworkError = (error) => Boolean(error?.isOffline || (!error?.response && error?.request));

const replayAction = async (action) => {
  const { type, payload } = action;
  if (type === "add") return API.post("/cart", payload);
  if (type === "update") return API.patch(`/cart/${payload.cartId}/${payload.userId}`, { quantity: payload.quantity });
  if (type === "remove") return API.delete(`/cart/${payload.cartId}/${payload.userId}`);
  if (type === "clear") return API.delete(`/cart/clear/${payload.userId}`);
};

export const useCartStore = create(
  persist(
    (set, get) => ({
      cart: [], cartCount: 0, cartUserId: null, pendingCartActions: [], user: null,
      setUser: (user) => {
        const nextUserId = user?.id ? String(user.id) : null;
        const { cartUserId } = get();
        if (nextUserId && cartUserId && cartUserId !== nextUserId) {
          set({ user, cart: [], cartCount: 0, cartUserId: nextUserId, pendingCartActions: [] });
          return;
        }
        set({ user, cartUserId: nextUserId || cartUserId });
      },
      syncPendingCartActions: async () => {
        const pending = [...get().pendingCartActions];
        if (!pending.length) return true;
        let completed = 0;
        try {
          for (const action of pending) { await replayAction(action); completed += 1; }
          set({ pendingCartActions: [] });
          return true;
        } catch {
          set({ pendingCartActions: pending.slice(completed) });
          return false;
        }
      },
      fetchCart: async () => {
        const { user } = get();
        if (!user) return;
        await get().syncPendingCartActions();
        try {
          const res = await API.get(`/cart/${user.id}`);
          const cart = Array.isArray(res.data) ? res.data : [];
          set({ cart, cartCount: cart.length, cartUserId: String(user.id) });
        } catch {
          // Keep the last known cart visible while a connection is unavailable.
          console.warn("Cart refresh deferred until connection returns");
        }
      },
      addToCart: async (productId, quantity = 1, variantId = null) => {
        const { user } = get();
        if (!user) throw new Error("No user");
        const payload = { product_id: productId, quantity, user_id: user.id, variant_id: variantId, is_bulk: user.role === "bulk" };
        try {
          await API.post("/cart", payload);
          await get().fetchCart();
        } catch (error) {
          if (!isRetryableNetworkError(error)) throw error;
          set((state) => ({ pendingCartActions: [...state.pendingCartActions, { type: "add", payload }], cartCount: state.cartCount + 1, cartUserId: String(user.id) }));
        }
      },
      updateQuantity: async (cartId, quantity) => {
        const { user } = get();
        if (!user) throw new Error("No user");
        const payload = { cartId, quantity, userId: user.id };
        set((state) => ({ cart: state.cart.map((item) => Number(item.id) === Number(cartId) ? { ...item, quantity } : item) }));
        try { await replayAction({ type: "update", payload }); }
        catch (error) { if (isRetryableNetworkError(error)) set((state) => ({ pendingCartActions: [...state.pendingCartActions, { type: "update", payload }] })); else { await get().fetchCart(); throw error; } }
      },
      removeFromCart: async (cartId) => {
        const { user } = get();
        if (!user) return;
        const payload = { cartId, userId: user.id };
        set((state) => ({ cart: state.cart.filter((item) => Number(item.id) !== Number(cartId)), cartCount: Math.max(0, state.cartCount - 1) }));
        try { await replayAction({ type: "remove", payload }); }
        catch (error) { if (isRetryableNetworkError(error)) set((state) => ({ pendingCartActions: [...state.pendingCartActions, { type: "remove", payload }] })); else { await get().fetchCart(); throw error; } }
      },
      clearCart: async () => {
        const { user } = get();
        if (!user) return;
        const payload = { userId: user.id };
        set({ cart: [], cartCount: 0 });
        try { await replayAction({ type: "clear", payload }); }
        catch (error) { if (isRetryableNetworkError(error)) set((state) => ({ pendingCartActions: [...state.pendingCartActions, { type: "clear", payload }] })); else { await get().fetchCart(); throw error; } }
      },
    }),
    { name: "elohim-cart-cache", partialize: (state) => ({ cart: state.cart, cartCount: state.cartCount, cartUserId: state.cartUserId, pendingCartActions: state.pendingCartActions }) }
  )
);
