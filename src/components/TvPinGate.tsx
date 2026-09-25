import { useCallback, useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage, storeAuthSession } from "@/lib/authSession";

export const TV_SESSION_KEY = "metricsTvLoginAt";
export const TV_SESSION_MS = 24 * 60 * 60 * 1000;

export const isTvSessionFresh = () => {
  const loginAt = parseInt(localStorage.getItem(TV_SESSION_KEY) || "0", 10);
  return !!loginAt && Date.now() - loginAt <= TV_SESSION_MS;
};

interface Props {
  title: string;
  onSuccess: () => void;
}

export default function TvPinGate({ title, onSuccess }: Props) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (pin: string) => {
      setBusy(true);
      setError("");
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("tv-pin-login", { body: { pin } });
        let payload: any = data;
        if (fnErr) {
          const ctx = (fnErr as any).context;
          payload = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => ({})) : {};
        }
        if (payload?.error === "pin_incorreto") return setError("PIN incorreto");
        if (payload?.error === "muitas_tentativas")
          return setError(`Muitas tentativas. Tente novamente em ${payload.minutos ?? 15} min`);
        if (payload?.error === "pin_nao_configurado")
          return setError("Acesso da TV não configurado. Um administrador precisa definir o PIN.");
        if (!payload?.hashed_token) return setError("Falha ao acessar o painel. Tente novamente.");

        clearAuthStorage();
        const { data: otp, error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: payload.hashed_token,
          type: "magiclink",
        });
        if (otpErr || !otp.session) return setError("Falha ao acessar o painel. Tente novamente.");
        storeAuthSession(otp.session as any);
        localStorage.setItem(TV_SESSION_KEY, Date.now().toString());
        onSuccess();
      } catch {
        setError("Falha ao acessar o painel. Tente novamente.");
      } finally {
        setBusy(false);
        setDigits("");
      }
    },
    [onSuccess]
  );

  const press = useCallback(
    (d: string) => {
      if (busy) return;
      setError("");
      setDigits((cur) => {
        if (cur.length >= 4) return cur;
        const next = cur + d;
        if (next.length === 4) void submit(next);
        return next;
      });
    },
    [busy, submit]
  );

  const backspace = useCallback(() => !busy && setDigits((c) => c.slice(0, -1)), [busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace" || e.key === "Delete") backspace();
      else if (e.key === "Escape") setDigits("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="rounded-2xl bg-primary/15 p-4">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-center">{title}</h1>
          <p className="text-lg text-muted-foreground">Digite o PIN de acesso</p>
        </div>

        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-20 w-16 rounded-2xl border-2 grid place-items-center text-4xl font-bold ${
                digits.length === i && !busy ? "border-primary" : "border-border"
              } bg-background text-foreground`}
            >
              {digits[i] ? "•" : ""}
            </div>
          ))}
        </div>

        <div className="min-h-[2rem] mb-4 text-center text-lg font-medium text-destructive" role="alert">
          {busy ? <span className="text-muted-foreground">Verificando...</span> : error}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={busy}
              className="h-20 rounded-2xl bg-secondary text-secondary-foreground text-3xl font-semibold hover:bg-primary/20 focus:outline-none focus:ring-4 focus:ring-primary disabled:opacity-50"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDigits("")}
            disabled={busy}
            className="h-20 rounded-2xl bg-muted text-muted-foreground text-lg font-medium focus:outline-none focus:ring-4 focus:ring-primary disabled:opacity-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            disabled={busy}
            className="h-20 rounded-2xl bg-secondary text-secondary-foreground text-3xl font-semibold hover:bg-primary/20 focus:outline-none focus:ring-4 focus:ring-primary disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            disabled={busy}
            aria-label="Apagar"
            className="h-20 rounded-2xl bg-muted text-muted-foreground grid place-items-center focus:outline-none focus:ring-4 focus:ring-primary disabled:opacity-50"
          >
            <Delete className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
