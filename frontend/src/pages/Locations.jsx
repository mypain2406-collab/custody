import { useState } from "react";
import useSWR from "swr";
import api, { fetcher, fmtError, downloadUrl } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, MapPin, Download } from "lucide-react";

const EMPTY = { location_name: "", location_type: "other", gps_coordinates: "", description: "" };

export default function Locations() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const { data: locations, mutate, isLoading } = useSWR("/locations", fetcher);
  const { data: settings } = useSWR("/settings", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const typeLabel = (k) => (settings?.location_types || []).find((t) => t.key === k)?.label || k;

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, gps_coordinates: form.gps_coordinates || null, description: form.description || null };
      if (editing) {
        await api.put(`/locations/${editing.id}`, payload);
        toast.success("Lokasi diperbarui");
      } else {
        await api.post("/locations", payload);
        toast.success("Lokasi ditambahkan");
      }
      setOpen(false);
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l) => {
    if (!window.confirm(`Hapus lokasi ${l.location_name}?`)) return;
    try {
      await api.delete(`/locations/${l.id}`);
      toast.success("Lokasi dihapus");
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="locations-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Titik Pemindaian</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Lokasi Pembinaan & Keamanan</h1>
        </div>
        {isAdmin && (
          <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="add-location-btn">
            <Plus className="h-4 w-4 mr-2" /> Tambah Lokasi
          </Button>
        )}
      </div>

      {isLoading && <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border" data-testid="locations-grid">
        {(locations || []).map((l) => (
          <div key={l.id} className="bg-card p-5 flex flex-col" data-testid={`location-card-${l.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{l.location_name}</div>
                <Badge variant="outline" className="rounded-none text-[10px] font-bold uppercase tracking-wider mt-2">{typeLabel(l.location_type)}</Badge>
              </div>
              <a href={downloadUrl(`/locations/${l.id}/barcode`)}>
                <img src={downloadUrl(`/locations/${l.id}/barcode`)} alt="QR Lokasi" className="h-14 w-14 border border-border hover:border-foreground transition-colors" data-testid={`location-qr-${l.id}`} />
              </a>
            </div>
            {l.gps_coordinates && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground font-mono2" data-testid={`location-gps-${l.id}`}>
                <MapPin className="h-3 w-3" /> {l.gps_coordinates}
              </div>
            )}
            {l.description && <div className="mt-2 text-xs text-muted-foreground">{l.description}</div>}
            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <a href={downloadUrl(`/locations/${l.id}/barcode?download=1`)} className="flex-1" data-testid={`location-barcode-dl-${l.id}`}>
                <Button variant="outline" size="sm" className="rounded-none w-full text-xs font-bold uppercase tracking-wider">
                  <Download className="h-3.5 w-3.5 mr-1" /> Barcode
                </Button>
              </a>
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" className="rounded-none" onClick={() => { setEditing(l); setForm({ ...EMPTY, ...l, gps_coordinates: l.gps_coordinates || "", description: l.description || "" }); setOpen(true); }} data-testid={`edit-location-${l.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-none text-red-600" onClick={() => remove(l)} data-testid={`delete-location-${l.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none" data-testid="location-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">{editing ? "Edit Lokasi" : "Tambah Lokasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Nama Lokasi</Label>
              <Input className="mt-1.5 rounded-none" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} data-testid="location-form-name" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Tipe Lokasi</Label>
              <Select value={form.location_type} onValueChange={(v) => setForm({ ...form, location_type: v })}>
                <SelectTrigger className="mt-1.5 rounded-none" data-testid="location-form-type"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {(settings?.location_types || []).map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Koordinat GPS (tag lokasi)</Label>
              <Input className="mt-1.5 rounded-none font-mono2" placeholder="-6.914744, 107.609810" value={form.gps_coordinates} onChange={(e) => setForm({ ...form, gps_coordinates: e.target.value })} data-testid="location-form-gps" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Deskripsi</Label>
              <Input className="mt-1.5 rounded-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="location-form-desc" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)} data-testid="location-form-cancel">Batal</Button>
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={save} disabled={busy || !form.location_name} data-testid="location-form-save">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
