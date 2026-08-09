import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import api, { fetcher, fmtError, downloadUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, QrCode, TriangleAlert, Search } from "lucide-react";

const STATUS_LABEL = { active: "Aktif", leave: "Izin", released: "Bebas", transferred: "Dipindahkan" };
const STATUS_STYLE = {
  active: "bg-green-100 text-green-900 border-green-300",
  leave: "bg-amber-100 text-amber-900 border-amber-300",
  released: "bg-neutral-200 text-neutral-700",
  transferred: "bg-blue-100 text-blue-900 border-blue-300",
};

const EMPTY = {
  full_name: "", age: "", cell_block: "", religion: "", registration_number: "",
  crime_category: "", estimated_release_date: "", mp_1_3: "", mp_1_2: "", mp_2_3: "",
  medical_alert: "", program_notes: "",
};

const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"];

export default function Inmates() {
  const { user } = useAuth();
  const canEdit = ["admin", "supervisor"].includes(user.role);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: inmates, mutate, isLoading } = useSWR(
    `/inmates?${search ? `search=${encodeURIComponent(search)}&` : ""}${status !== "all" ? `status=${status}` : ""}`,
    fetcher
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (i) => { setEditing(i); setForm({ ...EMPTY, ...i }); setOpen(true); };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {};
      Object.keys(EMPTY).forEach((k) => {
        payload[k] = form[k] === "" || form[k] === undefined || form[k] === null ? null : form[k];
      });
      payload.age = form.age ? parseInt(form.age, 10) : null;
      if (editing) {
        await api.put(`/inmates/${editing.id}`, payload);
        toast.success("Data warga binaan diperbarui");
      } else {
        await api.post("/inmates", payload);
        toast.success("Warga binaan ditambahkan");
      }
      setOpen(false);
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (i) => {
    if (!window.confirm(`Hapus ${i.full_name}?`)) return;
    try {
      await api.delete(`/inmates/${i.id}`);
      toast.success("Data dihapus");
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    }
  };

  const F = (key, label, opts = {}) => (
    <div className={opts.full ? "col-span-2" : ""}>
      <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</Label>
      <Input
        className="mt-1.5 rounded-none"
        type={opts.type || "text"}
        value={form[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={opts.placeholder}
        data-testid={`inmate-form-${key}`}
      />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="inmates-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Data Induk</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Warga Binaan</h1>
        </div>
        {canEdit && (
          <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={openCreate} data-testid="add-inmate-btn">
            <Plus className="h-4 w-4 mr-2" /> Tambah Warga Binaan
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-none pl-9"
            placeholder="Cari nama / no. registrasi / NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="inmate-search-input"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 rounded-none" data-testid="inmate-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card overflow-x-auto" data-testid="inmates-table-wrap">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Warga Binaan</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">No. Registrasi</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Blok</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Kategori Kasus</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Barcode</TableHead>
              {canEdit && <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {!isLoading && (inmates || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="inmates-empty">Tidak ada data.</TableCell></TableRow>
            )}
            {(inmates || []).map((i) => (
              <TableRow key={i.id} data-testid={`inmate-row-${i.registration_number}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {i.photo_url ? (
                        <img src={i.photo_url} alt="" className="h-full w-full object-cover grayscale" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">{i.full_name?.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{i.full_name}</div>
                      {i.medical_alert && (
                        <div className="flex items-center gap-1 text-[10px] text-red-700 font-semibold mt-0.5">
                          <TriangleAlert className="h-3 w-3" /> Peringatan Medis
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono2 text-xs">{i.registration_number}</TableCell>
                <TableCell className="text-sm">Blok {i.cell_block || "-"}</TableCell>
                <TableCell className="text-sm">{i.crime_category || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[i.status] || ""}`}>
                    {STATUS_LABEL[i.status] || i.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <a href={downloadUrl(`/inmates/${i.id}/barcode?download=1`)} data-testid={`inmate-barcode-dl-${i.registration_number}`}>
                    <img
                      src={downloadUrl(`/inmates/${i.id}/barcode`)}
                      alt="QR"
                      className="h-10 w-10 border border-border hover:border-foreground transition-colors"
                    />
                  </a>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0" onClick={() => openEdit(i)} data-testid={`edit-inmate-${i.registration_number}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {user.role === "admin" && (
                        <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => remove(i)} data-testid={`delete-inmate-${i.registration_number}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="inmate-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">{editing ? "Edit Warga Binaan" : "Tambah Warga Binaan"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {F("full_name", "Nama", { full: true })}
            {F("age", "Umur", { type: "number" })}
            {F("cell_block", "Blok")}
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Agama</Label>
              <Select value={form.religion} onValueChange={(v) => setForm({ ...form, religion: v })}>
                <SelectTrigger className="mt-1.5 rounded-none" data-testid="inmate-form-religion">
                  <SelectValue placeholder="Pilih agama" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {RELIGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {F("registration_number", "Nomor Register", { placeholder: "Kosongkan untuk otomatis" })}
            {F("crime_category", "Perkara/Pidana")}
            {F("estimated_release_date", "Tanggal Bebas", { type: "date" })}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              {F("mp_1_3", "1/3 MP", { type: "date" })}
              {F("mp_1_2", "1/2 MP", { type: "date" })}
              {F("mp_2_3", "2/3 MP", { type: "date" })}
            </div>
            {F("medical_alert", "Peringatan Medis", { full: true, placeholder: "Kosongkan jika tidak ada" })}
            <div className="col-span-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Keterangan / Program Pembinaan</Label>
              <Textarea
                className="mt-1.5 rounded-none min-h-[80px]"
                value={form.program_notes || ""}
                onChange={(e) => setForm({ ...form, program_notes: e.target.value })}
                data-testid="inmate-form-program_notes"
              />
            </div>
          </div>
          {editing && (
            <div className="flex items-center gap-3 border border-border p-3">
              <img src={downloadUrl(`/inmates/${editing.id}/barcode`)} alt="QR" className="h-16 w-16 border border-border" />
              <div className="text-xs text-muted-foreground">
                Pratinjau barcode. Konten: <span className="font-mono2">{form.barcode_data || form.registration_number}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)} data-testid="inmate-form-cancel">Batal</Button>
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={save} disabled={busy || !form.full_name} data-testid="inmate-form-save">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
