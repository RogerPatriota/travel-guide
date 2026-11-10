import type { Metadata } from "next";
import { Suspense } from "react";
import { RoteiroBoard } from "@/components/RoteiroBoard";
import { getRoteiroData } from "@/lib/roteiro";

export const metadata: Metadata = { title: "Roteiro · Buenos Aires 2027" };

export default function RoteiroPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando roteiro…</p>}>
      <RoteiroWithData />
    </Suspense>
  );
}

async function RoteiroWithData() {
  const data = await getRoteiroData();
  return <RoteiroBoard data={data} />;
}
