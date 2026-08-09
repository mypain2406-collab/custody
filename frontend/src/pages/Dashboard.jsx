import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { Users2, ScanLine, CheckSquare, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE = {
  draft: "bg-neutral-200 text-neutral-800",
  submitted: "bg-amber-100 text-amber-900 border-amber-300",
  approved: "bg-green-100 text-green-900 border-green-300",
  rejected: "bg-red-100 text-red-900 border-red-300",
};
const STATUS_LABEL = { draft: "Draf", submitted: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={`rounded-none text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[status] || ""}`} data-testid={`status-badge-${status}`}>
      {STATUS_LABEL[status] || status}
    </Badge>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useSWR("/dashboard/stats", fetcher, { refreshInterval: 15000 });

  if (isLoading || !data) {
    return <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>;
  }

  const cards = [
    { label: "Warga Binaan Aktif", value: data.active_inmates, sub: `dari ${data.total_inmates} total`, icon: Users2, testid: "stat-active-inmates" },
    { label: "Pemindaian Hari Ini", value: data.scans_today, sub: `${data.total_scans} total keseluruhan`, icon: ScanLine, testid: "stat-scans-today" },
    { label: "Menunggu Persetujuan", value: data.pending_approvals, sub: "aktivitas status menunggu", icon: CheckSquare, testid: "stat-pending" },
    { label: "Lokasi & Operator", value: data.locations, sub: `${data.operators} operator aktif`, icon: MapPin, testid: "stat-locations" },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Ringkasan</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Dasbor Monitoring</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border" data-testid="stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="bg-card p-6" data-testid={c.testid}>
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{c.label}</div>
              <c.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-4xl font-black tracking-tight mt-3">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-border bg-card" data-testid="recent-activities-panel">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-widest">Aktivitas Terbaru</h3>
            <a href="/activities" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors" data-testid="view-all-activities-link">Lihat Semua</a>
          </div>
          <div className="divide-y divide-border">
            {data.recent_activities.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</div>
            )}
            {data.recent_activities.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-4" data-testid={`recent-activity-${a.id}`}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{a.inmate_name} <span className="font-mono2 text-xs text-muted-foreground">({a.inmate_reg})</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.scan_location} — {a.activity_category_label || a.activity_category}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="font-mono2 text-[11px] text-muted-foreground hidden sm:block">
                    {a.scan_timestamp ? new Date(a.scan_timestamp).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-border bg-card" data-testid="category-today-panel">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-sm uppercase tracking-widest">Kategori Hari Ini</h3>
            </div>
            <div className="divide-y divide-border">
              {data.by_category_today.length === 0 && <div className="p-5 text-sm text-muted-foreground">Belum ada pemindaian hari ini.</div>}
              {data.by_category_today.map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm">{c.label}</span>
                  <span className="font-mono2 text-sm font-semibold">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-border bg-card" data-testid="location-today-panel">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-bold text-sm uppercase tracking-widest">Lokasi Hari Ini</h3>
            </div>
            <div className="divide-y divide-border">
              {data.by_location_today.length === 0 && <div className="p-5 text-sm text-muted-foreground">Belum ada pemindaian hari ini.</div>}
              {data.by_location_today.map((l, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm truncate">{l.label}</span>
                  <span className="font-mono2 text-sm font-semibold">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
