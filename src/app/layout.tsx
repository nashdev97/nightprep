import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NightPrep",
  description: "Tonight's prep sheet for an independent food truck.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
