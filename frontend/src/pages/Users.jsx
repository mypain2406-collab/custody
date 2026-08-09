import { useState } from "react";
import useSWR from "swr";
import api, { fetcher, fmtError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

const ROLE_LABEL = { admin: "Admin", supervisor: "Supervisor", operator: "Operator", read_only: "Lihat Saja" };
const EMPTY = {
  username: "", full_name: "", email: "", phone: "", position: "",
  assigned_location: "", device_name: "", role: "operator", password: "",
  status: "active", start_date: "", end_date: "",
};

export default function Users() {
  const { data: users, mutate, isLoading } = useSWR("/users", fetcher);
  const { data: locations } = useSWR("/locations", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const locName = (id) => (locations || []).find((l) => l.id === id)?.location_name || "-";

  const openEdit = (u) => {
    setEditing(u);
    setForm({ ...EMPTY, ...u, password: "", assigned_location: u.assigned_location || "", email: u.email || "", phone: u.phone || "", position: u.position || "", device_name: u.device_name || "", start_date: u.start_date || "", end_date: u.end_date || "" });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      payload.assigned_location = payload.assigned_location || null;
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success("Pengguna diperbarui");
      } else {
        await api.post("/users", payload);
        toast.success("Pengguna ditambahkan");
      }
      setOpen(false);
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Hapus akun ${u.username}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Pengguna dihapus");
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Manajemen Akun</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Pengguna & Perangkat</h1>
        </div>
        <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="add-user-btn">
          <Plus className="h-4 w-4 mr-2" /> Tambah Akun
        </Button>
      </div>

      <div className="border border-border bg-card overflow-x-auto" data-testid="users-table-wrap">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Pengguna</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Peran</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Lokasi Tugas</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Perangkat</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Login Terakhir</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>}
            {(users || []).map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                <TableCell>
                  <div className="font-semibold text-sm">{u.full_name}</div>
                  <div className="font-mono2 text-xs text-muted-foreground">@{u.username}{u.position ? ` — ${u.position}` : ""}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none text-[10px] font-bold uppercase tracking-wider">{ROLE_LABEL[u.role] || u.role}</Badge>
                </TableCell>
                <TableCell className="text-sm">{u.assigned_location ? locName(u.assigned_location) : "-"}</TableCell>
                <TableCell className="text-sm">{u.device_name || "-"}</TableCell>
                <TableCell className="font-mono2 text-xs text-muted-foreground">
                  {u.last_login ? new Date(u.last_login).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Belum pernah"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none text-[10px] font-bold uppercase tracking-wider ${u.status === "active" ? "bg-green-100 text-green-900 border-green-300" : "bg-neutral-200 text-neutral-600"}`}>
                    {u.status === "active" ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0" onClick={() => openEdit(u)} data-testid={`edit-user-${u.username}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-none h-8 w-8 p-0 text-red-600" onClick={() => remove(u)} data-testid={`delete-user-${u.username}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="user-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">{editing ? `Edit @${editing.username}` : "Tambah Akun"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Username</Label>
              <Input className="mt-1.5 rounded-none font-mono2" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} data-testid="user-form-username" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Nama Lengkap</Label>
              <Input className="mt-1.5 rounded-none" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} data-testid="user-form-fullname" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1.5 rounded-none" data-testid="user-form-role"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">{editing ? "Password Baru (opsional)" : "Password"}</Label>
              <Input type="password" className="mt-1.5 rounded-none" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-form-password" />
            </div>
            {form.role === "operator" && (
              <>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Lokasi Tugas (titik scan)</Label>
                  <Select value={form.assigned_location} onValueChange={(v) => setForm({ ...form, assigned_location: v })}>
                    <SelectTrigger className="mt-1.5 rounded-none" data-testid="user-form-location"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      {(locations || []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Nama Perangkat</Label>
                  <Input className="mt-1.5 rounded-none" placeholder="Tablet Pos Masjid" value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} data-testid="user-form-device" />
                </div>
              </>
            )}
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Email</Label>
              <Input className="mt-1.5 rounded-none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-form-email" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Telepon</Label>
              <Input className="mt-1.5 rounded-none" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="user-form-phone" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Jabatan</Label>
              <Input className="mt-1.5 rounded-none" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="user-form-position" />
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1.5 rounded-none" data-testid="user-form-status"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)} data-testid="user-form-cancel">Batal</Button>
            <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={save} disabled={busy || !form.username || !form.full_name || (!editing && !form.password)} data-testid="user-form-save">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
