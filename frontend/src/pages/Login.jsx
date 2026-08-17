import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, roleHome } from "@/context/AuthContext";
import { fmtError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEMENIMIPAS_LOGO_URL =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_Kementrian_Imigrasi_dan_Pemasyarakatan_(2024).png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

const submit = async (e) => {
  e.preventDefault();
  setBusy(true);
  try {
    const user = await login(username, password);
    toast.success(`Selamat datang, ${user.full_name}`);
    navigate(roleHome(user.role), { replace: true });
  } catch (err) {
    toast.error(fmtError(err));
  } finally {
    setBusy(false);
  }
};

return (
  <div className="min-h-screen grid md:grid-cols-2" data-testid="login-page">
  <div className="hidden md:flex relative flex-col justify-between bg-neutral-950 p-12 text-white overflow-hidden">
  <div
    className="pointer-events-none absolute inset-0 opacity-[0.06] bg-center bg-no-repeat bg-contain"
    style={{ backgroundImage: `url(${KEMENIMIPAS_LOGO_URL})` }}
    />
  <div className="relative z-10 flex items-center gap-3">
  <div className="h-10 w-10 bg-white flex items-center justify-center overflow-hidden">
  <img
    src={`${KEMENIMIPAS_LOGO_URL}?width=80`}
    alt="Logo Kementerian Imigrasi dan Pemasyarakatan"
    className="h-full w-full object-contain"
    />
  </div>
  <span className="text-xs font-bold uppercase tracking-[0.3em]">Ditjen Pemasyarakatan</span>
  </div>
  
  <div className="relative z-10 flex-1 flex items-center justify-center py-8">
  <img
    src={`${KEMENIMIPAS_LOGO_URL}?width=420`}
    alt="Logo Kementerian Imigrasi dan Pemasyarakatan"
    className="h-56 w-56 md:h-64 md:w-64 object-contain drop-shadow-2xl"
    />
  </div>
  
  <div className="relative z-10">
  <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight">
  KAWAN PAS
  </h1>
  <p className="mt-3 text-sm text-white/70 max-w-md leading-relaxed">
  Sistem Monitoring Aktivitas Warga Binaan berbasis pemindaian barcode di titik lokasi pembinaan dan keamanan.
  </p>
  <p className="mt-4 text-[11px] text-white/40 uppercase tracking-[0.2em]">
  Kementerian Imigrasi dan Pemasyarakatan Republik Indonesia
  </p>
  </div>
  </div>
  
  <div className="flex items-center justify-center p-8 bg-background">
  <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
  <div className="mb-8">
  <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-2">Akses Sistem</div>
  <h2 className="text-3xl font-black tracking-tight">Masuk</h2>
  <p className="text-sm text-muted-foreground mt-2">Gunakan akun yang diberikan oleh administrator.</p>
  </div>
  <div className="space-y-5">
  <div>
  <Label htmlFor="username" className="text-xs font-bold uppercase tracking-[0.15em]">Username</Label>
  <Input
    id="username"
    data-testid="login-username-input"
    className="mt-2 rounded-none h-11"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    autoComplete="username"
    required
    />
  </div>
  <div>
  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.15em]">Password</Label>
  <Input
    id="password"
    type="password"
    data-testid="login-password-input"
    className="mt-2 rounded-none h-11"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    autoComplete="current-password"
    required
    />
  </div>
  <Button
    type="submit"
    className="w-full rounded-none h-11 font-bold uppercase tracking-widest text-xs"
    disabled={busy}
    data-testid="login-submit-btn"
    >
    {busy ? "Memproses..." : "Masuk"}
  </Button>
  </div>
  </form>
  </div>
  </div>
  );
}
