export default function robots() {
  return { rules: { userAgent: "*", allow: ["/", "/products", "/bulk", "/about", "/contact"] }, sitemap: "https://www.elohimgrains.com/sitemap.xml" };
}
