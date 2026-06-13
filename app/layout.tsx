import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citation Faithfulness Verification",
  description:
    "Verifies whether claims in AI research reports faithfully represent their cited SEC sources.",
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
