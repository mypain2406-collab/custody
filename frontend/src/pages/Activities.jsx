import { useState } from "react";
import useSWR from "swr";
import api, { fetcher, fmtError, downloadUrl } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import { StatusBadge } from "@/pages/Dashboard";

export default function Activities() {
  const { data: settings } = useSWR("/settings", fetcher);
  const { data: locations } = useSWR("/locations", fetcher);
  const [filters, setFilters] = useState({ status: "all", category: "all", location_id: "all", date_from: "", date_to: "" });
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);

  const qs = Object.entries(filters)
    .filter(([, v]) => v && v !== "all")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const { data: items, isLoading } = useSWR(`/activities?${qs}`, fetcher, { refreshInterval: 20000 });

  const openDetail = async (a) => {
    setDetail(a);
    try {
      const h = await api.get(`/activities/${a.id}/history`);
      setHistory(h.data);
    } catch (e) {
      toast.error(fmtError(e));
    }
  };

  const F = (key, comp) => comp;
  const HIST_LABEL = { submitted: "Diajukan", approved: "Disetujui", rejected: "Ditolak", draft: "Draf" };

  return (
    <div className="space-y-6" data-testid="activities-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Rekaman Pemindaian</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Data Aktivitas</h1>
        </div>
        <a href={downloadUrl(`/activities/export?${qs}`)} data-testid="export-excel-btn">
          <Button className="rounded-none font-bold uppercase tracking-widest text-xs">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Ekspor ke Excel
          </Button>
        </a>
      </div>

      <div className="flex gap-3 flex-wrap" data-testid="activity-filters">
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-40 rounded-none" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="submitted">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="draft">Draf</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
          <SelectTrigger className="w-52 rounded-none" data-testid="filter-category"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Kategori</SelectItem>
            {(settings?.activity_categories || []).map((c) => (
              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.location_id} onValueChange={(v) => setFilters({ ...filters, location_id: v })}>
          <SelectTrigger className="w-48 rounded-none" data-testid="filter-location"><SelectValue placeholder="Lokasi" /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Lokasi</SelectItem>
            {(locations || []).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40 rounded-none" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} data-testid="filter-date-from" />
        <Input type="date" className="w-40 rounded-none" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} data-testid="filter-date-to" />
      </div>

      <div className="border border-border bg-card overflow-x-auto" data-testid="activities-table-wrap">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Waktu Scan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Warga Binaan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Lokasi</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Kategori</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Kondisi</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Operator</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!isLoading && (items || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="activities-empty">Belum ada aktivitas.</TableCell></TableRow>
            )}
            {(items || []).map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a)} data-testid={`activity-row-${a.id}`}>
                <TableCell className="font-mono2 text-xs whitespace-nowrap">
                  {a.scan_timestamp ? new Date(a.scan_timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-semibold">{a.inmate_name}</div>
                  <div className="font-mono2 text-[11px] text-muted-foreground">{a.inmate_reg}</div>
                </TableCell>
                <TableCell className="text-sm">{a.scan_location || "-"}</TableCell>
                <TableCell className="text-sm">{a.activity_category_label || a.activity_category || "-"}</TableCell>
                <TableCell className="text-sm capitalize">{a.inmate_condition === "perlu_perhatian" ? "Perlu Perhatian" : a.inmate_condition || "-"}</TableCell>
                <TableCell className="text-sm">{a.operator_name}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="rounded-none max-w-lg" data-testid="activity-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">Detail Aktivitas</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ["Warga Binaan", `${detail.inmate_name} (${detail.inmate_reg})`],
                  ["Waktu Scan", detail.scan_timestamp ? new Date(detail.scan_timestamp).toLocaleString("id-ID") : "-"],
                  ["Lokasi", detail.scan_location || "-"],
                  ["Kategori", detail.activity_category_label || "-"],
                  ["Durasi", detail.duration_minutes ? `${detail.duration_minutes} menit` : "-"],
                  ["Kondisi", detail.inmate_condition || "-"],
                  ["Operator", detail.operator_name],
                  ["Status", <StatusBadge key="s" status={detail.status} />],
                ].map(([k, v], i) => (
                  <div key={i}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {detail.description && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Catatan</div>
                  <div className="mt-1">{detail.description}</div>
                </div>
              )}
              {detail.rejection_reason && (
                <div className="border border-red-300 bg-red-50 px-3 py-2 text-red-800 text-xs" data-testid="detail-rejection-reason">
                  <span className="font-bold">Alasan Penolakan:</span> {detail.rejection_reason}
                </div>
              )}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Riwayat Status</div>
                <div className="border border-border divide-y divide-border" data-testid="status-history-list">
                  {history.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Belum ada riwayat.</div>}
                  {history.map((h) => (
                    <div key={h.id} className="px-3 py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold">{HIST_LABEL[h.new_status] || h.new_status}</span>
                        <span className="text-muted-foreground"> oleh {h.approved_by_name}</span>
                        {h.reason && <span className="text-muted-foreground"> — {h.reason}</span>}
                      </div>
                      <span className="font-mono2 text-[10px] text-muted-foreground">{new Date(h.timestamp).toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
