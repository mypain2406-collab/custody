import { useState } from "react";
import useSWR from "swr";
import { fetcher, downloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search, IdCard } from "lucide-react";

export default function BarcodeCenter() {
  const { data: inmates, isLoading: li } = useSWR("/inmates?status=active", fetcher);
  const { data: locations, isLoading: ll } = useSWR("/locations", fetcher);
  const [search, setSearch] = useState("");

  const filtered = (inmates || []).filter((i) =>
    !search || i.full_name.toLowerCase().includes(search.toLowerCase()) || i.registration_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="barcode-center-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Pusat Unduhan</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Unduh Barcode</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Unduh barcode QR warga binaan untuk dicetak sebagai kartu identitas, dan barcode lokasi untuk ditempel di titik perangkat pemindaian.
          </p>
        </div>
        <a href={downloadUrl("/inmates/cards/batch")} data-testid="print-all-cards-btn">
          <Button className="rounded-none font-bold uppercase tracking-widest text-xs">
            <IdCard className="h-4 w-4 mr-2" /> Cetak Semua Kartu (PDF)
          </Button>
        </a>
      </div>

      <Tabs defaultValue="inmates">
        <TabsList className="rounded-none">
          <TabsTrigger value="inmates" className="rounded-none font-bold uppercase tracking-widest text-xs" data-testid="tab-inmate-barcodes">Warga Binaan</TabsTrigger>
          <TabsTrigger value="locations" className="rounded-none font-bold uppercase tracking-widest text-xs" data-testid="tab-location-barcodes">Lokasi</TabsTrigger>
        </TabsList>

        <TabsContent value="inmates" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="rounded-none pl-9" placeholder="Cari warga binaan..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="barcode-search-input" />
          </div>
          {li && <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border border border-border" data-testid="inmate-barcodes-grid">
            {filtered.map((i) => (
              <div key={i.id} className="bg-card p-4 flex flex-col items-center text-center" data-testid={`barcode-card-${i.registration_number}`}>
                <img src={downloadUrl(`/inmates/${i.id}/barcode`)} alt={`QR ${i.full_name}`} className="h-28 w-28 border border-border" />
                <div className="font-bold text-sm mt-3 leading-tight">{i.full_name}</div>
                <div className="font-mono2 text-[11px] text-muted-foreground mt-1">{i.registration_number}</div>
                <div className="text-[10px] text-muted-foreground">Blok {i.cell_block || "-"}</div>
                <a href={downloadUrl(`/inmates/${i.id}/barcode?download=1`)} className="w-full mt-3" data-testid={`barcode-dl-${i.registration_number}`}>
                  <Button variant="outline" size="sm" className="rounded-none w-full text-[10px] font-bold uppercase tracking-wider">
                    <Download className="h-3 w-3 mr-1" /> Unduh QR
                  </Button>
                </a>
                <a href={downloadUrl(`/inmates/${i.id}/card`)} className="w-full mt-1.5" data-testid={`card-dl-${i.registration_number}`}>
                  <Button size="sm" className="rounded-none w-full text-[10px] font-bold uppercase tracking-wider">
                    <IdCard className="h-3 w-3 mr-1" /> Cetak Kartu (PDF)
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          {ll && <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border border border-border" data-testid="location-barcodes-grid">
            {(locations || []).map((l) => (
              <div key={l.id} className="bg-card p-5 flex flex-col items-center text-center" data-testid={`loc-barcode-card-${l.id}`}>
                <img src={downloadUrl(`/locations/${l.id}/barcode`)} alt={`QR ${l.location_name}`} className="h-32 w-32 border border-border" />
                <div className="font-bold text-sm mt-3">{l.location_name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Tempel di titik perangkat scan</div>
                <a href={downloadUrl(`/locations/${l.id}/barcode?download=1`)} className="w-full mt-3" data-testid={`loc-barcode-dl-${l.id}`}>
                  <Button variant="outline" size="sm" className="rounded-none w-full text-[10px] font-bold uppercase tracking-wider">
                    <Download className="h-3 w-3 mr-1" /> Unduh
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
