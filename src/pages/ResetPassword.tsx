import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import logoZ3us from "@/assets/logo-z3us.png";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-client-password`;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

const getRecoveryTokensFromUrl = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get("invite_token") || searchParams.get("inviteToken") || hashParams.get("invite_token") || hashParams.get("inviteToken");
  return {
    access_token: hashParams.get("access_token"),
    refresh_token: hashParams.get("refresh_token"),
    type: hashParams.get("type"),
    invite_token: inviteToken,
  };
};

const getStoredAccessToken = () => {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const value = localStorage.getItem(key);
      if (!value) continue;
      const parsed = JSON.parse(value);
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) return token as string;
    }
  } catch {
    return null;
  }
  return null;
};

const getEmailFromInviteToken = (token?: string | null) => {
  if (!token) return undefined;
  try {
    const payload = token.split(".")[0];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded))?.email as string | undefined;
  } catch {
    return undefined;
  }
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const updatePasswordWithToken = async (newPassword: string, accessToken?: string | null, inviteToken?: string | null) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ password: newPassword, inviteToken }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || "Erro ao definir senha");
    }

    return {
      email: payload?.email as string | undefined,
      session: payload?.session as { access_token?: string; refresh_token?: string } | undefined,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("timeout");
      timeoutError.name = "PasswordUpdateTimeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let mounted = true;
    const finish = (valid: boolean) => {
      if (!mounted) return;
      setHasSession(valid);
      setChecking(false);
    };

    const tokens = getRecoveryTokensFromUrl();

    if (tokens.invite_token) {
      setInviteToken(tokens.invite_token.trim());
      finish(true);
      return () => {
        mounted = false;
      };
    }

    const initializeRecoverySession = async () => {
      if (tokens.access_token && tokens.refresh_token) {
        setAccessToken(tokens.access_token);
        finish(true);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        void supabase.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        return;
      }

      const storedToken = getStoredAccessToken();
      if (storedToken) {
        setAccessToken(storedToken);
        finish(true);
        return;
      }

      const result = await withTimeout(supabase.auth.getSession(), 8000);
      setAccessToken(result?.data?.session?.access_token ?? null);
      finish(Boolean(result?.data?.session));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (!session && (event === "INITIAL_SESSION" || inviteToken)) return;
        if (session?.access_token) setAccessToken(session.access_token);
        finish(Boolean(session));
      }
    });

    initializeRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setIsLoading(true);
    try {
      const token = accessToken || getStoredAccessToken();
      if (!token && !inviteToken) {
        toast.error("Link expirado. Solicite um novo convite ao administrador.");
        setIsLoading(false);
        return;
      }

      const { session } = await updatePasswordWithToken(password, token, inviteToken);

      if (!session?.access_token || !session?.refresh_token) {
        throw new Error("Não foi possível criar a sessão. Solicite um novo convite.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (sessionError) throw sessionError;

      toast.success("Acesso liberado com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao definir senha");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 tech-grid opacity-30" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center mb-8">
            <img src={logoZ3us} alt="Z3US" className="h-24 w-24 object-contain" />
          </div>

          <Card className="border-primary/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Definir senha</CardTitle>
              <CardDescription className="text-center">
                Crie uma senha para acessar o portal Z3US
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checking ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hasSession ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Este link expirou ou já foi utilizado. Solicite um novo convite ao administrador.
                  </p>
                  <Button variant="outline" onClick={() => navigate("/auth")}>Ir para login</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repita a senha"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                    ) : (
                      <><KeyRound className="mr-2 h-4 w-4" />Definir senha e entrar</>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
