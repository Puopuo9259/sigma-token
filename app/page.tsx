"use client";

import { useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
// @ts-expect-error This package stylesheet does not provide TypeScript declarations.
import "@solana/wallet-adapter-react-ui/styles.css";
function TokenForm() {
  const { publicKey, signTransaction } = useWallet();
  const connection = new Connection(clusterApiUrl("mainnet-beta"));
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [decimals, setDecimals] = useState("9");
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);
  const [logo, setLogo] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [balance, setBalance] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (publicKey) {
      connection
        .getBalance(publicKey)
        .then((lamports) => setBalance((lamports / 1e9).toFixed(4)))
        .catch(() => {});
    }
  }, [publicKey, connection]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function createToken() {
    if (!publicKey) return alert("Connect your wallet first!");
    if (!signTransaction) return alert("Wallet not ready!");
    setStatus("Creating...");

    try {
      const mint = Keypair.generate();
      const ata = await getAssociatedTokenAddress(mint.publicKey, publicKey);
      const rent = await getMinimumBalanceForRentExemptMint(connection);

      const msg = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [
          SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports: rent,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMintInstruction(
            mint.publicKey,
            parseInt(decimals),
            publicKey,
            publicKey
          ),
          createAssociatedTokenAccountInstruction(
            publicKey, ata, publicKey, mint.publicKey
          ),
          createMintToInstruction(
            mint.publicKey,
            ata,
            publicKey,
            BigInt(supply) * BigInt(10) ** BigInt(decimals)
          ),
        ],
      }).compileToV0Message();

      const tx = new VersionedTransaction(msg);
      tx.sign([mint]);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      setMintAddress(mint.publicKey.toBase58());
      setStatus(`✅ Done! Tx: https://solscan.io/tx/${sig}`);
    } catch (err: any) {
      setStatus(`❌ Error: ${err.message || "Transaction failed"}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <span className="text-lg font-bold">SolanaLaunch</span>
        </div>
        {mounted && (
          <div className="flex items-center gap-4">
            {publicKey && (
              <span className="text-sm text-gray-400">
                {balance} SOL
              </span>
            )}
            <WalletMultiButton />
          </div>
        )}
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-2">
          Create Your Token
        </h1>
        <p className="text-gray-400 text-center mb-10">
          Launch your Solana token in seconds — no coding required
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              Token Logo
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                dragOver
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              {logo ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={logo}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <button
                    onClick={() => setLogo("")}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500 text-sm mb-2">
                    Drag & Drop logo image inside dashed region
                  </p>
                  <p className="text-gray-600 text-xs mb-3">
                    or click to select image
                  </p>
                  <label className="inline-block px-4 py-2 bg-gray-800 rounded-lg text-sm cursor-pointer hover:bg-gray-700 transition">
                    Choose Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Token Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DogeCoin"
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Token Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. DOGE (max 8 characters)"
              maxLength={8}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Token Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your token..."
              rows={3}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Decimals (Standard value recommended)
            </label>
            <select
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            >
              <option value="9">9 (Standard)</option>
              <option value="6">6</option>
              <option value="0">0</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Total Supply (Common supply is 1 billion)
            </label>
            <input
              value={supply}
              onChange={(e) => setSupply(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          <button
            onClick={createToken}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl text-lg hover:opacity-90 transition"
          >
            🚀 Create Token
          </button>

          {status && (
            <p
              className={`text-sm break-all ${
                status.startsWith("✅")
                  ? "text-green-400"
                  : status.startsWith("❌")
                  ? "text-red-400"
                  : "text-yellow-400"
              }`}
            >
              {status}
            </p>
          )}

          {mintAddress && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm text-gray-400 mb-3">
                Token created! Now add liquidity:
              </p>
              <a
                href={`https://app.raydium.io/pools/swap/create?inputMint=${mintAddress}&outputMint=So11111111111111111111111111111111111111112`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3 rounded-xl text-center hover:opacity-90 transition"
              >
                💧 Add Liquidity on Raydium
              </a>
              <p className="text-xs text-gray-500 mt-2 break-all">
                Mint: {mintAddress}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ConnectionProvider endpoint={clusterApiUrl("mainnet-beta")}>
      <WalletProvider
        wallets={[new PhantomWalletAdapter()]}
        autoConnect
      >
        <WalletModalProvider>
          <TokenForm />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}   