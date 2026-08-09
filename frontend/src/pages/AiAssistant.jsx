import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import api, { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Plus, FileText, Copy } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function streamSSE(path, body, onDelta) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta = {};
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const obj = JSON.parse(line.slice(5));
        if (obj.text) onDelta(obj.text);
        if (obj.error) throw new Error(obj.error);
        if (obj.done) meta = obj;
      } catch (e) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }
  return meta;
}

function Chat() {
  const { data: sessions, mutate: mutateSessions } = useSWR("/ai/sessions", fetcher);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sid) => {
    setSessionId(sid);
    try {
      const msgs = await api.get(`/ai/sessions/${sid}/messages`);
      setMessages(msgs.data);
    } catch (e) {
      toast.error("Gagal memuat riwayat chat");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    try {
      const meta = await streamSSE("/ai/chat", { message: text, session_id: sessionId }, (delta) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      });
      if (meta.session_id && meta.session_id !== sessionId) setSessionId(meta.session_id);
      mutateSessions();
    } catch (e) {
      toast.error(e.message);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 240px)" }} data-testid="ai-chat-panel">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="rounded-none text-xs font-bold uppercase tracking-wider" onClick={() => { setSessionId(null); setMessages([]); }} data-testid="ai-new-chat-btn">
          <Plus className="h-3.5 w-3.5 mr-1" /> Chat Baru
        </Button>
        {(sessions || []).map((s) => (
          <Button
            key={s.session_id}
            variant={s.session_id === sessionId ? "default" : "ghost"}
            size="sm"
            className="rounded-none text-xs max-w-[200px] truncate"
            onClick={() => loadSession(s.session_id)}
            data-testid={`ai-session-${s.session_id.slice(0, 8)}`}
          >
            {s.title || "Chat"}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="ai-chat-messages">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-3" strokeWidth={1.5} />
            <div className="text-sm font-semibold">Tanyakan sesuatu tentang data KAWAN PAS</div>
            <div className="text-xs mt-2 max-w-sm leading-relaxed">
              Contoh: "Berapa pemindaian hari ini per lokasi?", "Siapa saja warga binaan dengan peringatan medis?", "Ringkas aktivitas yang menunggu persetujuan."
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
              }`}
              data-testid={`ai-msg-${m.role}-${i}`}
            >
              {m.content || (busy && i === messages.length - 1 ? <span className="animate-pulse">Mengetik...</span> : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-border p-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <Input
          className="rounded-none h-11"
          placeholder="Ketik pertanyaan..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          data-testid="ai-chat-input"
        />
        <Button type="submit" className="rounded-none h-11 px-5" disabled={busy || !input.trim()} data-testid="ai-chat-send-btn">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function Report() {
  const [period, setPeriod] = useState("today");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setOutput("");
    setBusy(true);
    try {
      await streamSSE("/ai/report", { period }, (delta) => setOutput((o) => o + delta));
      toast.success("Laporan selesai dibuat");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="ai-report-panel">
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-56 rounded-none" data-testid="ai-report-period-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="week">7 Hari Terakhir</SelectItem>
          </SelectContent>
        </Select>
        <Button className="rounded-none font-bold uppercase tracking-widest text-xs" onClick={generate} disabled={busy} data-testid="ai-report-generate-btn">
          <FileText className="h-4 w-4 mr-2" /> {busy ? "Menyusun Laporan..." : "Buat Laporan"}
        </Button>
        {output && (
          <Button
            variant="outline"
            className="rounded-none text-xs font-bold uppercase tracking-wider"
            onClick={() => { navigator.clipboard.writeText(output); toast.success("Laporan disalin"); }}
            data-testid="ai-report-copy-btn"
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Salin
          </Button>
        )}
      </div>
      <div className="border border-border bg-card p-6 min-h-[300px]" data-testid="ai-report-output">
        {output ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed max-w-3xl">{output}</div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {busy ? <span className="animate-pulse">Claude sedang menyusun laporan...</span> : "Pilih periode lalu klik Buat Laporan. Claude akan menyusun laporan naratif resmi dari data aktivitas."}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  return (
    <div className="space-y-6" data-testid="ai-page">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Claude AI</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">Asisten AI</h1>
        <p className="text-sm text-muted-foreground mt-2">Tanya-jawab data sistem dan penyusunan laporan otomatis oleh Claude.</p>
      </div>
      <Tabs defaultValue="chat">
        <TabsList className="rounded-none">
          <TabsTrigger value="chat" className="rounded-none font-bold uppercase tracking-widest text-xs" data-testid="ai-tab-chat">Asisten Chat</TabsTrigger>
          <TabsTrigger value="report" className="rounded-none font-bold uppercase tracking-widest text-xs" data-testid="ai-tab-report">Laporan Otomatis</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4"><Chat /></TabsContent>
        <TabsContent value="report" className="mt-4"><Report /></TabsContent>
      </Tabs>
    </div>
  );
}
