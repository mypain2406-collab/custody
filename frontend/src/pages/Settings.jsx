import { useEffect, useState } from "react";
import useSWR from "swr";
import api, { fetcher, fmtError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";

function CategoryEditor({ title, description, items, onChange, testid }) {
  const update = (idx, field, value) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
    onChange(next);
  };
  return (
    <div className="border border-border bg-card" data-testid={testid}>
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-bold text-sm uppercase tracking-widest">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="divide-y divide-border">
        {items.map((it, idx) => (
          <div key={idx} className="px-5 py-3 flex items-center gap-3" data-testid={`${testid}-row-${idx}`}>
            <Input
              className="rounded-none font-mono2 text-xs w-40"
              value={it.key}
              onChange={(e) => update(idx, "key", e.target.value.replace(/\s+/g, "_").toLowerCase())}
              placeholder="kunci"
              data-testid={`${testid}-key-${idx}`}
            />
            <Input
              className="rounded-none flex-1"
              value={it.label}
              onChange={(e) => update(idx, "label", e.target.value)}
              placeholder="Judul yang ditampilkan"
              data-testid={`${testid}-label-${idx}`}
            />
            <Button
              variant="ghost"
              size="sm"
              className="rounded-none h-8 w-8 p-0 text-red-600"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              data-testid={`${testid}-delete-${idx}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="rounded-none text-xs font-bold uppercase tracking-wider"
          onClick={() => onChange([...items, { key: "", label: "" }])}
          data-testid={`${testid}-add`}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Kategori
        </Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: settings, mutate } = useSWR("/settings", fetcher);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) setForm(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  if (!form) return <div className="h-1 w-48 bg-muted"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>;

  const save = async () => {
    for (const c of [...form.activity_categories, ...form.location_types, ...form.inmate_conditions]) {
      if (!c.key || !c.label) {
        toast.error("Semua kategori harus memiliki kunci dan judul");
        return;
      }
    }
    setBusy(true);
    try {
      await api.put("/settings", {
        app_title: form.app_title,
        app_subtitle: form.app_subtitle,
        institution_name: form.institution_name,
        activity_categories: form.activity_categories,
        location_types: form.location_types,
        inmate_conditions: form.inmate_conditions,
      });
      toast.success("Pengaturan disimpan");
      mutate();
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Administrasi</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Pengaturan Kategori</h1>
          <p className="text-sm text-muted-foreground mt-2">Edit judul kategori yang tampil di seluruh aplikasi, termasuk halaman pemindaian operator.</p>
        </div>
        <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={save} disabled={busy} data-testid="settings-save-btn">
          <Save className="h-4 w-4 mr-2" /> {busy ? "Menyimpan..." : "Simpan Semua"}
        </Button>
      </div>

      <div className="border border-border bg-card" data-testid="general-settings">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-sm uppercase tracking-widest">Identitas Aplikasi</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Judul Aplikasi</Label>
            <Input className="mt-1.5 rounded-none" value={form.app_title} onChange={(e) => setForm({ ...form, app_title: e.target.value })} data-testid="settings-app-title" />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Subjudul</Label>
            <Input className="mt-1.5 rounded-none" value={form.app_subtitle} onChange={(e) => setForm({ ...form, app_subtitle: e.target.value })} data-testid="settings-app-subtitle" />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em]">Nama Institusi</Label>
            <Input className="mt-1.5 rounded-none" value={form.institution_name} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} data-testid="settings-institution" />
          </div>
        </div>
      </div>

      <CategoryEditor
        title="Kategori Aktivitas"
        description="Kategori yang dipilih operator saat memindai barcode warga binaan."
        items={form.activity_categories}
        onChange={(v) => setForm({ ...form, activity_categories: v })}
        testid="edit-activity-categories"
      />

      <CategoryEditor
        title="Tipe Lokasi"
        description="Tipe lokasi pembinaan dan keamanan untuk pengelompokan titik scan."
        items={form.location_types}
        onChange={(v) => setForm({ ...form, location_types: v })}
        testid="edit-location-types"
      />

      <CategoryEditor
        title="Kondisi Warga Binaan"
        description="Pilihan kondisi saat pencatatan aktivitas."
        items={form.inmate_conditions}
        onChange={(v) => setForm({ ...form, inmate_conditions: v })}
        testid="edit-inmate-conditions"
      />
    </div>
  );
}
