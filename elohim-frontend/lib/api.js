import axios from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

const isDev = process.env.NODE_ENV === "development";

/* =========================
   REQUEST INTERCEPTOR
========================= */
API.interceptors.request.use(
  (config) => {
    try {
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        const offlineError = new Error("You are offline. Check your internet connection and try again.");
        offlineError.isOffline = true;
        return Promise.reject(offlineError);
      }

      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // 🚨 FIX: prevent wrong full URL usage
      if (config.url && config.url.startsWith("http")) {
        console.warn("⚠️ FULL URL detected, auto-fixing...");
        config.url = config.url.replace(BASE_URL, "");
      }

      if (isDev) {
        console.debug(`API ${config.method?.toUpperCase() || "GET"} ${config.url}`);
      }

    } catch (err) {
      console.error("❌ TOKEN ERROR:", err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================
   RESPONSE INTERCEPTOR
========================= */
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const log = status >= 500 ? console.error : console.warn;
      log("API ERROR:", status, error.response.data);
    } else if (error.request) {
      const offline = typeof window !== "undefined" && !window.navigator.onLine;
      if (offline) {
        error.isOffline = true;
        error.userMessage = "You are offline. Reconnect to the internet and try again.";
        console.warn("API ERROR: Internet connection lost");
      } else {
        error.userMessage = "No response from server. Please try again.";
        console.error("API ERROR: No response from server");
      }
    } else {
      console.error("API ERROR:", error.message);
    }

    return Promise.reject(error);
  }
);

export default API;
