export default function sitemap() {
  const base = "https://www.elohimgrains.com";
  return ["", "/products", "/bulk", "/about", "/contact", "/services", "/vendors", "/food-delivery-abuja", "/business-food-supply-abuja", "/category/rice", "/category/beans", "/category/maize-flour", "/category/cooking-oil", "/category/spices", "/category/fruit-vegetables"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "/products" ? "daily" : "weekly", priority: path === "" ? 1 : path === "/products" ? 0.9 : 0.7 }));
}
