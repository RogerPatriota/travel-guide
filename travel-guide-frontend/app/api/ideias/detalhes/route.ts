import { NextResponse } from "next/server";
import { getPlaceExtras, type PlaceExtras } from "@/lib/place-extras";
import { createClient } from "@/lib/supabase/server";

// Rota (e não server action) porque actions rodam em fila: buscar detalhes
// travaria o voto e a troca de ideia enquanto as fontes externas respondem.
// O id vem em ?id= (caminho fixo, sem segmento dinâmico).

const noStore = { "Cache-Control": "private, no-store" };

/** Horário, contato, Wikipedia e vídeos do lugar de uma ideia */
export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ideia inválida." }, { status: 400, headers: noStore });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401, headers: noStore });
  }

  // RLS: só o casal enxerga a sugestão
  const { data, error } = await supabase
    .from("suggestions")
    .select("moment, place:places!inner(name, category, lat, lng, osm_ref)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("detalhes da ideia", error.code, error.message);
    return NextResponse.json({ error: "Não deu pra carregar." }, { status: 500, headers: noStore });
  }
  if (!data) return NextResponse.json({ error: "Ideia não encontrada." }, { status: 404, headers: noStore });

  const { place, moment } = data;

  // A hospedagem nunca sai do banco para serviços de terceiros
  if (place.category === "hospedagem") {
    const empty: PlaceExtras = {
      osm: { state: "vazio" },
      wiki: null,
      videos: { state: "pulado" },
      youtubeSearchUrl: "https://www.youtube.com/",
    };
    return NextResponse.json(empty, { headers: noStore });
  }

  const extras = await getPlaceExtras({
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    osmRef: place.osm_ref,
    skipVideos: moment === "mercado",
  });
  return NextResponse.json(extras, { headers: noStore });
}
