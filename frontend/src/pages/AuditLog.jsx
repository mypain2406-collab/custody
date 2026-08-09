import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_LABEL = { create: "Tambah", read: "Lihat", update: "Ubah", delete: "Hapus", export: "Ekspor", approve: "Setujui", rejected: "Tolak", login: "Masuk", submitted: "Ajukan" };
const ENTITY_LABEL = { inmates: "Warga Binaan", activities: "Aktivitas", users: "Pengguna", locations: "Lokasi", settings: "Pengaturan" };

export default function AuditLog() {
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const qs = [entity !== "all" ? `entity_type=${entity}` : "", action !== "all" ? `action=${action}` : ""].filter(Boolean).join("&");
  const { data: logs, isLoading } = useSWR(`/audit-logs?${qs}`, fetcher, { refreshInterval: 30000 });

  return (
    <div className="space-y-6" data-testid="audit-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Jejak Sistem</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Log Audit</h1>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-48 rounded-none" data-testid="audit-filter-entity"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Entitas</SelectItem>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-44 rounded-none" data-testid="audit-filter-action"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Aksi</SelectItem>
            {Object.entries(ACTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card overflow-x-auto" data-testid="audit-table-wrap">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Waktu</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Pengguna</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Entitas</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Aksi</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">ID Entitas</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!isLoading && (logs || []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="audit-empty">Belum ada log.</TableCell></TableRow>
            )}
            {(logs || []).map((l) => (
              <TableRow key={l.id} data-testid={`audit-row-${l.id}`}>
                <TableCell className="font-mono2 text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-sm font-medium">@{l.username}</TableCell>
                <TableCell className="text-sm">{ENTITY_LABEL[l.entity_type] || l.entity_type}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none text-[10px] font-bold uppercase tracking-wider">
                    {ACTION_LABEL[l.action] || l.action}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono2 text-[11px] text-muted-foreground max-w-[160px] truncate">{l.entity_id}</TableCell>
                <TableCell className="font-mono2 text-xs text-muted-foreground">{l.ip_address || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
