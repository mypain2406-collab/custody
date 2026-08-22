import { useState } from "react";
import useSWR from "swr";
import { fetcher, downloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Printer, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const DIR_STYLE = {
  masuk: "bg-blue-100 text-blue-900 border-blue-300",
  keluar: "bg-amber-100 text-amber-900 border-amber-300",
};

export default function KeamananLaluLintas() {
  const { data: locations } = useSWR("/locations", fetcher);
  const [filters, setFilters] = useState({ location_id: "all", direction: "all", date_from: "", date_to: "" });
  const [detail, setDetail] = useState(null);

  const qs = Object.entries(filters)
    .filter(([, v]) => v && v !== "all")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const { data: items, isLoading } = useSWR(`/security/crossings?${qs}`, fetcher, { refreshInterval: 20000 });

  const securityLocations = (locations || []).filter((l) => l.location_type === "security" || true);

  return (
    <div className="space-y-6" data-testid="keamanan-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Modul Keamanan</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Lalu Lintas Warga Binaan</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Pencatatan pergerakan warga binaan masuk/keluar di titik-titik keamanan, dapat dicetak sebagai bon per pergerakan atau laporan rekap.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={downloadUrl(`/security/crossings/export?${qs}`)} data-testid="export-crossings-excel-btn">
            <Button variant="outline" className="rounded-none font-bold uppercase tracking-widest text-xs">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Ekspor Excel
            </Button>
          </a>
          <a href={downloadUrl(`/security/crossings/report?${qs}`)} data-testid="print-crossings-report-btn">
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs">
              <Printer className="h-4 w-4 mr-2" /> Cetak Laporan
            </Button>
          </a>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap" data-testid="crossing-filters">
        <Select value={filters.direction} onValueChange={(v) => setFilters({ ...filters, direction: v })}>
          <SelectTrigger className="w-40 rounded-none" data-testid="filter-direction"><SelectValue placeholder="Arah" /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Arah</SelectItem>
            <SelectItem value="masuk">Masuk</SelectItem>
            <SelectItem value="keluar">Keluar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.location_id} onValueChange={(v) => setFilters({ ...filters, location_id: v })}>
          <SelectTrigger className="w-56 rounded-none" data-testid="filter-location"><SelectValue placeholder="Titik Keamanan" /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Lokasi</SelectItem>
            {securityLocations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40 rounded-none" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} data-testid="filter-date-from" />
        <Input type="date" className="w-40 rounded-none" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} data-testid="filter-date-to" />
      </div>

      <div className="border border-border bg-card overflow-x-auto" data-testid="crossings-table-wrap">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Waktu</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Warga Binaan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Blok</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Titik Keamanan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Arah</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Tujuan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Operator</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!isLoading && (items || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="crossings-empty">Belum ada catatan lalu lintas.</TableCell></TableRow>
            )}
            {(items || []).map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetail(a)} data-testid={`crossing-row-${a.id}`}>
                <TableCell className="font-mono2 text-xs whitespace-nowrap">
                  {a.scan_timestamp ? new Date(a.scan_timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-semibold">{a.inmate_name}</div>
                  <div className="font-mono2 text-[11px] text-muted-foreground">{a.inmate_reg}</div>
                </TableCell>
                <TableCell className="text-sm">{a.cell_block || "-"}</TableCell>
                <TableCell className="text-sm">{a.checkpoint_location || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none text-[10px] font-bold uppercase tracking-wider ${DIR_STYLE[a.direction] || ""}`}>
                    {a.direction === "masuk" ? <ArrowDownToLine className="h-3 w-3 mr-1" /> : <ArrowUpFromLine className="h-3 w-3 mr-1" />}
                    {a.direction_label || a.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-[220px] truncate">{a.purpose || "-"}</TableCell>
                <TableCell className="text-sm">{a.operator_name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="rounded-none max-w-lg" data-testid="crossing-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">Detail Lalu Lintas</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ["Warga Binaan", `${detail.inmate_name} (${detail.inmate_reg})`],
                  ["Blok", detail.cell_block || "-"],
                  ["Waktu", detail.scan_timestamp ? new Date(detail.scan_timestamp).toLocaleString("id-ID") : "-"],
                  ["Titik Keamanan", detail.checkpoint_location || "-"],
                  ["Arah", detail.direction_label || detail.direction],
                  ["Petugas Pengawal", detail.escort_officer || "-"],
                  ["Operator", detail.operator_name],
                ].map(([k, v], i) => (
                  <div key={i}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {detail.purpose && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tujuan / Keperluan</div>
                  <div className="mt-1">{detail.purpose}</div>
                </div>
              )}
              {detail.notes && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Catatan</div>
                  <div className="mt-1">{detail.notes}</div>
                </div>
              )}
              <a href={downloadUrl(`/security/crossings/${detail.id}/bon`)} className="block" data-testid="crossing-print-bon-btn">
                <Button className="w-full rounded-none font-bold uppercase tracking-widest text-xs">
                  <Printer className="h-4 w-4 mr-2" /> Cetak Bon
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
