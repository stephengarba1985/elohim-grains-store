import "./globals.css";
import ClientLayout from "./ClientLayout";
import PwaRegistration from "../components/PwaRegistration";

export const metadata = {
  title: "Elohim Grains",
  description: "Fresh grains delivered to your doorstep",
  applicationName: "Elohim Grains",
  manifest: "/manifest.webmanifest",
  themeColor: "#15803d",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Elohim Grains" },
  icons: { apple: "/pwa-icon.svg", icon: "/pwa-icon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegistration />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
