import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, roleHome } from "@/context/AuthContext";
import { fmtError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine } from "lucide-react";

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
      <div
        className="hidden md:block relative bg-cover bg-center"
        style={{ backgroundImage: "url(https://images.unsplash.com/photo-1479839672679-a46483c0e7c8)" }}
      >
        <div className="absolute inset-0 bg-neutral-950/70" />
        <div className="relative z-10 h-full flex flex-col justify-end p-12 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-white text-neutral-950 flex items-center justify-center">
              <ScanLine className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Lembaga Pemasyarakatan</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            KAWAN PAS
          </h1>
          <p className="mt-3 text-sm text-white/70 max-w-md leading-relaxed">
            Sistem Monitoring Aktivitas Warga Binaan berbasis pemindaian barcode di titik lokasi pembinaan dan keamanan.
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
