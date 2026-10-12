import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@solana/web3.js",
    "@solana/spl-token",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-phantom",
    // "@metaplex-foundation/js" is removed
  ],
};

export default nextConfig;   