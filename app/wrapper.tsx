"use client";

import dynamic from "next/dynamic";

const Providers = dynamic(() => import("./providers"), { ssr: false });

export default function Wrapper({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}   