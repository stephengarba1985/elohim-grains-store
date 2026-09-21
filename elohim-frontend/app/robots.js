export default function robots() {
  return { rules: { userAgent: "*", allow: ["/", "/products", "/category", "/bulk", "/business-food-supply-abuja", "/food-delivery-abuja", "/about", "/contact", "/services", "/journal"], disallow: ["/admin", "/cart", "/checkout", "/wallet", "/plans", "/bnpl", "/orders", "/order", "/rider", "/vendor", "/user", "/payment"] }, sitemap: "https://www.elohimgrains.com/sitemap.xml" };
}
