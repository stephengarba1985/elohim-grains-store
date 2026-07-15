import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata = {
  title: "Elohim Grains",
  description: "Fresh grains delivered to your doorstep",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
