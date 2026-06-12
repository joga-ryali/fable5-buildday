import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fable 5 Build Day — Research with Receipts",
  description: "Build-day skeleton. Pipeline is wired; real app ships Saturday.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
