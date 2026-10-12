import type { Metadata } from "next";
import "./globals.css";
import Wrapper from "./wrapper";

export const metadata: Metadata = {
  title: "Solana Token Creator",
  description: "Create and deploy your Solana token",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="antialiased">
        <Wrapper>{children}</Wrapper>
      </body>
    </html>
  );
}   