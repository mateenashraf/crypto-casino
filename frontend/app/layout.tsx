// @ts-nocheck
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NeonDraw Production",
  description: "Production frontend for on-chain draws and backend-indexed results",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
