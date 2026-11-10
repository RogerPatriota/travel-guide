import type { Metadata } from "next";
import { Suspense } from "react";
import { IdeasBoard } from "@/components/IdeasBoard";
import { getIdeasData } from "@/lib/ideas";

export const metadata: Metadata = { title: "Ideias · Buenos Aires 2027" };

export default function IdeiasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando ideias…</p>}>
      <IdeasWithData />
    </Suspense>
  );
}

async function IdeasWithData() {
  const data = await getIdeasData();
  return <IdeasBoard data={data} />;
}
