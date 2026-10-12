"use client";

import { ConnectionProvider } from "@solana/wallet-adapter-react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint="https://solana-rpc.publicnode.com">
      {children}
    </ConnectionProvider>
  );
}   