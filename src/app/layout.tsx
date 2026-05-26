import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Sedori AI",
  description: "Multi-platform sourcing, inventory, and accounting workflow.",
  // Internal business intelligence; do not let search engines crawl or archive any page.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true }
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
