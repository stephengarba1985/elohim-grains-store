import "./globals.css";
import ClientLayout from "./ClientLayout";
import PwaRegistration from "../components/PwaRegistration";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

export const metadata = {
  metadataBase: new URL("https://www.elohimgrains.com"),
  title: "Elohim Grains",
  description: "Fresh grains delivered to your doorstep",
  applicationName: "Elohim Grains",
  manifest: "/manifest.webmanifest",
  themeColor: "#15803d",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Elohim Grains" },
  icons: { apple: "/pwa-icon.svg", icon: "/pwa-icon.svg" },
  openGraph: { type: "website", siteName: "Elohim Grains", locale: "en_NG" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "LocalBusiness", name: "Elohim Grains", url: "https://www.elohimgrains.com", telephone: "+2348039688939", address: { "@type": "PostalAddress", addressLocality: "Abuja", addressCountry: "NG" }, areaServed: "Abuja, Nigeria" }) }} />
        <PwaRegistration />
        <ClientLayout>{children}</ClientLayout>
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
