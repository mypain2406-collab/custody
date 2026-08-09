import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import api, { fetcher, fmtError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanLine, MapPin, LogOut, Camera, Keyboard, TriangleAlert, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ScanPage() {
  const { user, logout } = useAuth();
  const { data: settings } = useSWR("/settings", fetcher);
  const { data: locations } = useSWR("/locations", fetcher);

  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("");
  const [step, setStep] = useState("setup");
  const [manualCode, setManualCode] = useState("");
  const [inmate, setInmate] = useState(null);
  const [duration, setDuration] = useState("");
  const [condition, setCondition] = useState("baik");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const scannerRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (user?.assigned_location) setLocationId(user.assigned_location);
  }, [user]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && runningRef.current) {
      try { await scannerRef.current.stop(); } catch (e) { /* noop */ }
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (step !== "scan") return;
    let cancelled = false;
    const el = document.getElementById("qr-reader");
    if (!el) return;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => { if (!cancelled) handleCode(text); },
        () => {}
      )
      .then(() => { runningRef.current = true; })
      .catch(() => setCameraError("Kamera tidak tersedia. Gunakan input manual."));
    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleCode = async (code) => {
    const text = (code || "").trim();
    if (!text) return;
    if (text.startsWith("LOC:")) {
      const locId = text.slice(4);
      const loc = (locations || []).find((l) => l.id === locId);
      if (loc) {
        setLocationId(loc.id);
        toast.success(`Lokasi diubah ke ${loc.location_name}`);
      } else {
        toast.error("Lokasi dari barcode tidak ditemukan");
      }
      return;
    }
    setBusy(true);
    try {
      const r = await api.get(`/inmates/lookup/${encodeURIComponent(text)}`);
      await stopScanner();
      setInmate(r.data);
      setStep("confirm");
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitScan = async () => {
    setBusy(true);
    try {
      const payload = {
        inmate_id: inmate.id,
        location_id: locationId || undefined,
        activity_category: category || undefined,
        duration_minutes: duration ? parseInt(duration, 10) : undefined,
        inmate_condition: condition,
        description: description || undefined,
        scan_timestamp: new Date().toISOString(),
        status: "submitted",
      };
      const r = await api.post("/activities", payload);
      setLastScan(r.data);
      toast.success(`${inmate.full_name} tercatat di ${r.data.scan_location || "lokasi"}`);
      setInmate(null);
      setManualCode("");
      setDuration("");
      setDescription("");
      setCondition("baik");
      setStep("scan");
    } catch (e) {
      toast.error(fmtError(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedLocation = (locations || []).find((l) => l.id === locationId);
  const categories = settings?.activity_categories || [];
  const conditions = settings?.inmate_conditions || [];

  return (
    <div className="min-h-screen bg-neutral-950 text-white" data-testid="scan-page">
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between sticky top-0 bg-neutral-950 z-20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-white text-neutral-950 flex items-center justify-center">
            <ScanLine className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <div className="font-heading font-black text-sm leading-none">{settings?.app_title || "SIMAPAN"}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-0.5">Mode Pemindaian</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold" data-testid="scan-operator-name">{user.full_name}</div>
            <div className="text-[10px] text-neutral-400">{user.device_name || "Perangkat"}</div>
          </div>
          <Button variant="outline" size="sm" className="rounded-none border-neutral-700 bg-transparent text-white hover:bg-neutral-800 hover:text-white" onClick={logout} data-testid="scan-logout-btn">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24">
        {step === "setup" && (
          <div className="space-y-6 pt-4" data-testid="scan-setup-step">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Langkah 1</div>
              <h1 className="text-3xl font-black tracking-tight mt-1">Pilih Lokasi & Kategori</h1>
            </div>
            <div className="space-y-5">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Lokasi Pemindaian</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="mt-2 rounded-none h-12 bg-neutral-900 border-neutral-700 text-white" data-testid="scan-location-select">
                    <SelectValue placeholder="Pilih lokasi" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {(locations || []).map((l) => (
                      <SelectItem key={l.id} value={l.id} data-testid={`scan-location-option-${l.id}`}>{l.location_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {user.assigned_location && selectedLocation && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400">
                    <MapPin className="h-3 w-3" /> Lokasi tugas Anda: {selectedLocation.location_name}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Kategori Aktivitas</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-2 rounded-none h-12 bg-neutral-900 border-neutral-700 text-white" data-testid="scan-category-select">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {categories.map((c) => (
                      <SelectItem key={c.key} value={c.key} data-testid={`scan-category-option-${c.key}`}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full rounded-none h-14 font-bold uppercase tracking-widest text-sm bg-white text-neutral-950 hover:bg-neutral-200"
                disabled={!locationId || !category}
                onClick={() => setStep("scan")}
                data-testid="scan-start-btn"
              >
                <Camera className="h-5 w-5 mr-2" /> Mulai Memindai
              </Button>
            </div>
          </div>
        )}

        {step === "scan" && (
          <div className="space-y-5 pt-4" data-testid="scan-camera-step">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Langkah 2</div>
                <h1 className="text-2xl font-black tracking-tight mt-1">Pindai Barcode Warga Binaan</h1>
              </div>
              <Button variant="outline" size="sm" className="rounded-none border-neutral-700 bg-transparent text-white hover:bg-neutral-800 hover:text-white" onClick={() => setStep("setup")} data-testid="scan-back-setup-btn">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Ubah
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-300 border border-neutral-800 px-3 py-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate" data-testid="scan-active-location">{selectedLocation?.location_name}</span>
              <span className="text-neutral-600">|</span>
              <span className="truncate">{categories.find((c) => c.key === category)?.label}</span>
            </div>

            <div className="border-2 border-white bg-black aspect-square relative overflow-hidden" data-testid="qr-viewfinder">
              <div id="qr-reader" className="w-full h-full [&_video]:object-cover [&_video]:h-full [&_video]:w-full" />
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-400" data-testid="camera-error-msg">
                  {cameraError}
                </div>
              )}
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 flex items-center gap-2">
                <Keyboard className="h-3.5 w-3.5" /> Atau masukkan kode manual
              </Label>
              <form
                className="flex gap-2 mt-2"
                onSubmit={(e) => { e.preventDefault(); handleCode(manualCode); }}
              >
                <Input
                  className="rounded-none h-12 bg-neutral-900 border-neutral-700 text-white font-mono2"
                  placeholder="WB-2024-0001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  data-testid="scan-manual-code-input"
                />
                <Button type="submit" className="rounded-none h-12 bg-white text-neutral-950 hover:bg-neutral-200 font-bold" disabled={busy || !manualCode.trim()} data-testid="scan-manual-submit-btn">
                  Cari
                </Button>
              </form>
            </div>

            {lastScan && (
              <div className="border border-green-700 bg-green-950/40 px-4 py-3 flex items-start gap-3" data-testid="last-scan-success">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold">{lastScan.inmate_name} tercatat</div>
                  <div className="text-neutral-400 text-xs mt-0.5">{lastScan.scan_location} — menunggu persetujuan supervisor</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "confirm" && inmate && (
          <div className="space-y-5 pt-4" data-testid="scan-confirm-step">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Langkah 3</div>
            <h1 className="text-2xl font-black tracking-tight">Konfirmasi Data</h1>

            <div className="border border-neutral-700 bg-neutral-900 p-5" data-testid="scanned-inmate-card">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                  {inmate.photo_url ? (
                    <img src={inmate.photo_url} alt={inmate.full_name} className="h-full w-full object-cover grayscale" />
                  ) : (
                    <span className="font-heading font-black text-xl text-neutral-500">{inmate.full_name?.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-lg truncate" data-testid="scanned-inmate-name">{inmate.full_name}</div>
                  <div className="font-mono2 text-xs text-neutral-400" data-testid="scanned-inmate-reg">{inmate.registration_number}</div>
                  <div className="text-xs text-neutral-400 mt-1">Blok {inmate.cell_block || "-"} — {inmate.crime_category || "-"}</div>
                </div>
              </div>
              {inmate.medical_alert && (
                <div className="mt-4 border border-red-700 bg-red-950/50 px-3 py-2 flex items-start gap-2" data-testid="medical-alert-box">
                  <TriangleAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-200"><span className="font-bold">Peringatan Medis:</span> {inmate.medical_alert}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Durasi (menit)</Label>
                <Input
                  type="number"
                  min="0"
                  className="mt-2 rounded-none h-12 bg-neutral-900 border-neutral-700 text-white"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  data-testid="scan-duration-input"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Kondisi</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="mt-2 rounded-none h-12 bg-neutral-900 border-neutral-700 text-white" data-testid="scan-condition-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {conditions.map((c) => (
                      <SelectItem key={c.key} value={c.key} data-testid={`scan-condition-option-${c.key}`}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Catatan (opsional)</Label>
              <Textarea
                className="mt-2 rounded-none bg-neutral-900 border-neutral-700 text-white min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="scan-description-input"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-none h-14 flex-1 border-neutral-700 bg-transparent text-white hover:bg-neutral-800 hover:text-white"
                onClick={() => { setInmate(null); setStep("scan"); }}
                data-testid="scan-cancel-btn"
              >
                Batal
              </Button>
              <Button
                className="rounded-none h-14 flex-[2] bg-white text-neutral-950 hover:bg-neutral-200 font-bold uppercase tracking-widest text-xs"
                onClick={submitScan}
                disabled={busy}
                data-testid="scan-submit-btn"
              >
                {busy ? "Menyimpan..." : "Catat Aktivitas"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
