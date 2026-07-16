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
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // 🚨 FIX: prevent wrong full URL usage
      if (config.url.startsWith("http")) {
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
      console.error("API ERROR: No response from server");
    } else {
      console.error("API ERROR:", error.message);
    }

    return Promise.reject(error);
  }
);

export default API;
