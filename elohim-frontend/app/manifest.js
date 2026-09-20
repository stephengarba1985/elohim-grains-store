export default function manifest() {
  return {
    name: "Elohim Grains",
    short_name: "Elohim Grains",
    description: "Fresh food and staples delivered to you.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#15803d",
    orientation: "portrait-primary",
    categories: ["shopping", "food"],
    icons: [
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
      { src: "/logo.png", sizes: "4000x2574", type: "image/png", purpose: "any" },
    ],
  };
}
