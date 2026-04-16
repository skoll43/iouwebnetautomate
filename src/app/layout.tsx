import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetAutoGen — Cisco Config Generator",
  description: "Abstract YAML topology → Cisco IOS device configurations via Jinja2/Nunjucks templates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
