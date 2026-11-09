import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { getHomeData } from "@/lib/data";

export default function Home() {
  // O esqueleto (mapa, dias, contagem) sai na hora; os dados do banco chegam
  // por streaming porque dependem da sessão.
  return (
    <Suspense fallback={<Dashboard data={null} />}>
      <HomeWithData />
    </Suspense>
  );
}

async function HomeWithData() {
  const data = await getHomeData();
  return <Dashboard data={data} />;
}
