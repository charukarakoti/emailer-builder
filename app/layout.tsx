import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email Builder",
  description: "Drag-and-drop email template builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
