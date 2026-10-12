"use client";

import { useState, useRef, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
} from "@solana/spl-token";

const FEE_RECIPIENT = "Hvv64sRrMSnYbDqkQLfyyyp5qvjmSCmC4Fs5mSBXWNWY";
const BASE_FEE = 0.05;
const ADDON_FEE = 0.05;
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

type FormState = {
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  description: string;
  logo: string | null;
  creatorEnabled: boolean;
  creatorName: string;
  creatorAddress: string;
  socialEnabled: boolean;
  socialTwitter: string;
  socialTelegram: string;
  socialDiscord: string;
  revokeFreeze: boolean;
  revokeMint: boolean;
  revokeUpdate: boolean;
};

export default function TokenCreatorPage() {
  const { connection } = useConnection();
  const fileRef = useRef<HTMLInputElement>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    symbol: "",
    decimals: 9,
    supply: 1000000000,
    description: "",
    logo: null,
    creatorEnabled: false,
    creatorName: "",
    creatorAddress: "",
    socialEnabled: false,
    socialTwitter: "",
    socialTelegram: "",
    socialDiscord: "",
    revokeFreeze: false,
    revokeMint: false,
    revokeUpdate: false,
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState("");

  // Check if already connected on page load
  useEffect(() => {
    const solana = (window as any).solana;
    if (solana?.isPhantom && solana?.publicKey) {
      setWalletAddress(solana.publicKey.toBase58());
    }
  }, []);

  const totalFee =
    BASE_FEE +
    (form.creatorEnabled ? ADDON_FEE : 0) +
    (form.socialEnabled ? ADDON_FEE : 0) +
    (form.revokeFreeze ? ADDON_FEE : 0) +
    (form.revokeMint ? ADDON_FEE : 0) +
    (form.revokeUpdate ? ADDON_FEE : 0);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm((f) => ({ ...f, logo: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const connectWallet = async () => {
    const solana = (window as any).solana;
    if (!solana?.isPhantom) {
      alert("Phantom not found. Install it at phantom.app");
      window.open("https://phantom.app/download", "_blank");
      return;
    }
    try {
      const resp = await solana.connect();
      if (resp.publicKey) {
        setWalletAddress(resp.publicKey.toBase58());
      }
    } catch (e) {
      alert("Connection rejected.");
    }
  };

  const disconnectWallet = async () => {
    const solana = (window as any).solana;
    if (solana?.disconnect) {
      await solana.disconnect();
    }
    setWalletAddress(null);
  };

  const createToken = async () => {
    const solana = (window as any).solana;
    if (!solana?.isPhantom || !solana?.publicKey) {
      setError("Connect your Phantom wallet first.");
      return;
    }
    if (!form.name || !form.symbol) {
      setError("Token name and symbol are required.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const userPublicKey = solana.publicKey;

      // Step 1: Create mint
      setStep("Creating mint...");
      const { Keypair, SystemProgram: SysProg } = await import("@solana/web3.js");
      const mintKeypair = Keypair.generate();

      const createMintTx = new Transaction().add(
        SysProg.createAccount({
          fromPubkey: userPublicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
          space: MINT_SIZE,
          programId: (await import("@solana/spl-token")).TOKEN_PROGRAM_ID,
        }),
        (await import("@solana/spl-token")).createInitializeMint2Instruction(
          mintKeypair.publicKey,
          form.decimals,
          form.revokeMint ? null : userPublicKey,
          form.revokeFreeze ? null : userPublicKey,
          (await import("@solana/spl-token")).TOKEN_PROGRAM_ID
        )
      );

      const createMintSig = await sendAndConfirmTransaction(
        connection,
        createMintTx,
        [userPublicKey, mintKeypair]
      );
      await connection.confirmTransaction(createMintSig);
      const mint = mintKeypair.publicKey;

      // Step 2: Mint supply
      setStep("Minting supply...");
      const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const ata = getAssociatedTokenAddressSync(mint, userPublicKey);

      const createAtaTx = new Transaction().add(
        (await import("@solana/spl-token")).createAssociatedTokenAccountIdempotentInstruction(
          userPublicKey,
          ata,
          userPublicKey,
          mint
        )
      );
      await sendAndConfirmTransaction(connection, createAtaTx, [userPublicKey]);

      const mintTx = new Transaction().add(
        (await import("@solana/spl-token")).createMintToInstruction(
          mint,
          ata,
          userPublicKey,
          form.supply
        )
      );
      await sendAndConfirmTransaction(connection, mintTx, [userPublicKey]);

      // Step 3: Create Metaplex metadata
      setStep("Creating metadata...");
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const metadataUri = buildMetadataUri();

      const creators = form.creatorEnabled && form.creatorAddress
        ? [
            {
              address: new PublicKey(form.creatorAddress),
              share: 100,
              verified: false,
            },
          ]
        : [
            {
              address: userPublicKey,
              share: 100,
              verified: false,
            },
          ];

      const metadataIx = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint: mint,
          mintAuthority: userPublicKey,
          payer: userPublicKey,
          updateAuthority: userPublicKey,
        },
        {
          createMetadataAccountArgsV3: {
            collectionDetails: null,
            data: {
              name: form.name,
              symbol: form.symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: creators,
              collection: null,
              uses: null,
            },
            isMutable: true,
          },
        }
      );

      const metadataTx = new Transaction().add(metadataIx);
      await sendAndConfirmTransaction(connection, metadataTx, [userPublicKey]);

      // Step 4: Send fee
      setStep("Sending fee...");
      const feeTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: userPublicKey,
          toPubkey: new PublicKey(FEE_RECIPIENT),
          lamports: Math.floor(totalFee * LAMPORTS_PER_SOL),
        })
      );
      await sendAndConfirmTransaction(connection, feeTx, [userPublicKey]);

      setStep("Done!");
      setSuccess(mint.toBase58());
    } catch (e: any) {
      setError(e.message || "Transaction failed.");
    } finally {
      setCreating(false);
      setStep("");
    }
  };

  const buildMetadataUri = () => {
    const metadata: any = {
      name: form.name,
      symbol: form.symbol,
      description: form.description,
      image: form.logo || "",
      seller_fee_basis_points: 0,
      attributes: [],
    };

    if (form.socialEnabled) {
      const socials: any[] = [];
      if (form.socialTwitter) socials.push({ type: "twitter", value: form.socialTwitter });
      if (form.socialTelegram) socials.push({ type: "telegram", value: form.socialTelegram });
      if (form.socialDiscord) socials.push({ type: "discord", value: form.socialDiscord });
      if (socials.length > 0) metadata.socials = { external_links: socials };
    }

    const json = JSON.stringify(metadata);
    return "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
          <span className="font-bold text-lg">
            Solana Token Creator
            <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
              MAINNET
            </span>
          </span>
          <button
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-green-500 text-sm font-medium hover:opacity-90 transition"
            onClick={walletAddress ? disconnectWallet : connectWallet}
          >
            {walletAddress
              ? walletAddress.slice(0, 4) + "..." + walletAddress.slice(-4)
              : "Connect Wallet"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Create Your Token</h1>
        <p className="text-gray-400 mb-8">Deploy your Solana token in seconds.</p>

        <div className="space-y-6">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Token Name *</label>
              <input
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="Ex: Sigma Coin"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={32}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Symbol *</label>
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Ex: SIG"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Decimals</label>
                <input
                  type="number"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  value={form.decimals}
                  onChange={(e) => setForm({ ...form, decimals: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Supply *</label>
              <input
                type="number"
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="1000000000"
                value={form.supply}
                onChange={(e) => setForm({ ...form, supply: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                rows={3}
                placeholder="Describe your token..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Logo</label>
              <div
                className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500 transition"
                onClick={() => fileRef.current?.click()}
              >
                {form.logo ? (
                  <img src={form.logo} alt="Logo" className="w-20 h-20 rounded-full mx-auto object-cover" />
                ) : (
                  <div className="text-gray-500 text-sm">
                    <p>Click to upload logo</p>
                    <p className="text-xs mt-1">.png, .jpg</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Add-ons</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Creator Info</p>
                <p className="text-xs text-gray-500">Add creator to metadata</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">+{ADDON_FEE} SOL</span>
                <button
                  className={`w-11 h-6 rounded-full transition relative ${form.creatorEnabled ? "bg-purple-600" : "bg-white/10"}`}
                  onClick={() => setForm({ ...form, creatorEnabled: !form.creatorEnabled })}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${form.creatorEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>
            {form.creatorEnabled && (
              <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-purple-500/30">
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Creator name"
                  value={form.creatorName}
                  onChange={(e) => setForm({ ...form, creatorName: e.target.value })}
                />
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Creator wallet address"
                  value={form.creatorAddress}
                  onChange={(e) => setForm({ ...form, creatorAddress: e.target.value })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Social Links</p>
                <p className="text-xs text-gray-500">Add to token metadata</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">+{ADDON_FEE} SOL</span>
                <button
                  className={`w-11 h-6 rounded-full transition relative ${form.socialEnabled ? "bg-purple-600" : "bg-white/10"}`}
                  onClick={() => setForm({ ...form, socialEnabled: !form.socialEnabled })}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${form.socialEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            </div>
            {form.socialEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-purple-500/30">
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Twitter/X URL"
                  value={form.socialTwitter}
                  onChange={(e) => setForm({ ...form, socialTwitter: e.target.value })}
                />
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Telegram URL"
                  value={form.socialTelegram}
                  onChange={(e) => setForm({ ...form, socialTelegram: e.target.value })}
                />
                <input
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Discord invite"
                  value={form.socialDiscord}
                  onChange={(e) => setForm({ ...form, socialDiscord: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Revoke Authorities</h2>
            <p className="text-xs text-gray-500">Each is +{ADDON_FEE} SOL</p>

            {[
              { key: "revokeFreeze" as const, label: "Revoke Freeze", desc: "No one can freeze token accounts" },
              { key: "revokeMint" as const, label: "Revoke Mint", desc: "No one can create more tokens" },
              { key: "revokeUpdate" as const, label: "Revoke Update", desc: "No one can modify metadata" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">+{ADDON_FEE}</span>
                  <button
                    className={`w-11 h-6 rounded-full transition relative ${form[item.key] ? "bg-purple-600" : "bg-white/10"}`}
                    onClick={() => setForm({ ...form, [item.key]: !form[item.key] })}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${form[item.key] ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-purple-600/10 to-green-500/10 rounded-2xl border border-purple-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400">Total Fee</p>
                <p className="text-3xl font-bold text-green-400">{totalFee.toFixed(2)} SOL</p>
              </div>
              <button
                onClick={createToken}
                disabled={!walletAddress || creating}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-green-500 font-bold text-base hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? step || "Creating..." : "Launch Token"}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
            )}
          </div>
        </div>

        {success && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Token Created!</h2>
              <p className="text-gray-400 text-sm mb-6">Your token is live on Solana mainnet.</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-500 mb-1">Mint Address</p>
                <p className="font-mono text-sm text-green-400 break-all">{success}</p>
              </div>
              <div className="flex gap-3">
                <a
                  href={`https://solscan.io/token/${success}`}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 px-4 py-3 rounded-xl border border-purple-500 text-purple-400 text-sm font-medium hover:bg-purple-500/10 transition"
                >
                  View on Solscan ↗
                </a>
                <button
                  onClick={() => {
                    setSuccess(null);
                    setForm({
                      name: "", symbol: "", decimals: 9, supply: 1000000000,
                      description: "", logo: null, creatorEnabled: false,
                      creatorName: "", creatorAddress: "", socialEnabled: false,
                      socialTwitter: "", socialTelegram: "", socialDiscord: "",
                      revokeFreeze: false, revokeMint: false, revokeUpdate: false,
                    });
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition"
                >
                  Create Another
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}   