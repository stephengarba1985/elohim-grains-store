export default function sitemap() {
  const base = "https://www.elohimgrains.com";
  return ["", "/products", "/bulk", "/about", "/contact", "/services", "/vendors"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "/products" ? "daily" : "weekly", priority: path === "" ? 1 : path === "/products" ? 0.9 : 0.7 }));
}
