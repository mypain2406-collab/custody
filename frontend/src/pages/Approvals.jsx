import { useState } from "react";
import useSWR from "swr";
import api, { fetcher, fmtError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/pages/Dashboard";

export default function Approvals() {
  const { data: items, mutate, isLoading } = useSWR("/activities?status=submitted", fetcher, { refreshInterval: 15000 });
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async (a) => {
    setBusy(true);
    try {
      await api.post(`/activities/${a.id}/approve`, {});
      toast.success(`Aktivitas ${a.inmate_name} disetujui`);
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/activities/${rejecting.id}/reject`, { reason });
      toast.success("Aktivitas ditolak");
      setRejecting(null);
      setReason("");
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="approvals-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Alur Kerja Supervisor</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Persetujuan Aktivitas</h1>
      </div>

      {isLoading && <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>}

      {!isLoading && (items || []).length === 0 && (
        <div className="border border-border bg-card p-10 text-center text-muted-foreground text-sm" data-testid="approvals-empty">
          Tidak ada aktivitas yang menunggu persetujuan.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border border border-border" data-testid="approvals-grid">
        {(items || []).map((a) => (
          <div key={a.id} className="bg-card p-5" data-testid={`approval-card-${a.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold">{a.inmate_name}</div>
                <div className="font-mono2 text-xs text-muted-foreground">{a.inmate_reg}</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lokasi</div>
                <div>{a.scan_location || "-"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kategori</div>
                <div>{a.activity_category_label || "-"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Waktu</div>
                <div className="font-mono2 text-xs">{a.scan_timestamp ? new Date(a.scan_timestamp).toLocaleString("id-ID") : "-"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Operator</div>
                <div>{a.operator_name}</div>
              </div>
            </div>
            {a.description && <div className="mt-3 text-sm text-muted-foreground border-l-2 border-border pl-3">{a.description}</div>}
            {a.inmate_condition && a.inmate_condition !== "baik" && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 px-3 py-2">
                <TriangleAlert className="h-3.5 w-3.5" /> Kondisi: {a.inmate_condition === "sakit" ? "Sakit" : "Perlu Perhatian"}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Button
                className="rounded-none flex-1 font-bold uppercase tracking-widest text-xs bg-green-700 hover:bg-green-800 text-white"
                onClick={() => approve(a)}
                disabled={busy}
                data-testid={`approve-btn-${a.id}`}
              >
                <Check className="h-4 w-4 mr-1" /> Setujui
              </Button>
              <Button
                variant="outline"
                className="rounded-none flex-1 font-bold uppercase tracking-widest text-xs text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => { setRejecting(a); setReason(""); }}
                disabled={busy}
                data-testid={`reject-btn-${a.id}`}
              >
                <X className="h-4 w-4 mr-1" /> Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejecting} onOpenChange={() => setRejecting(null)}>
        <DialogContent className="rounded-none" data-testid="reject-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">Tolak Aktivitas</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Aktivitas <span className="font-semibold text-foreground">{rejecting?.inmate_name}</span> di {rejecting?.scan_location}
          </div>
          <Textarea
            className="rounded-none min-h-[100px]"
            placeholder="Tulis alasan penolakan..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="reject-reason-input"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setRejecting(null)} data-testid="reject-cancel-btn">Batal</Button>
            <Button className="rounded-none bg-red-700 hover:bg-red-800 text-white font-bold uppercase tracking-widest text-xs" onClick={reject} disabled={busy} data-testid="reject-confirm-btn">
              Tolak Aktivitas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
