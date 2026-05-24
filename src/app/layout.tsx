import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Sedori AI",
  description: "Multi-platform sourcing, inventory, and accounting workflow."
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
