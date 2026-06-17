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

const updatePasswordWithToken = async (newPassword: string, accessToken?: string | null, inviteToken?: string | null) => {
  const { data, error } = await supabase.functions.invoke("set-client-password", {
    body: { password: newPassword, inviteToken },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) {
    let serverMessage: string | undefined;
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const payload = await ctx.json();
        serverMessage = payload?.error || payload?.message;
      }
    } catch {}
    throw new Error(serverMessage || error.message || "Erro ao definir senha");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
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

    const initializeRecoverySession = async () => {
      const tokens = getRecoveryTokensFromUrl();

      if (tokens.invite_token) {
        setInviteToken(tokens.invite_token.trim());
        finish(true);
        return;
      }

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
      const sessionResult = accessToken || inviteToken ? null : await withTimeout(supabase.auth.getSession(), 3000);
      const token = accessToken || getStoredAccessToken() || sessionResult?.data?.session?.access_token;

      if (!token && !inviteToken) {
        toast.error("Link expirado. Solicite um novo convite ao administrador.");
        setIsLoading(false);
        return;
      }

      await updatePasswordWithToken(password, token, inviteToken);

      toast.success("Senha definida com sucesso!");
      setIsLoading(false);
      navigate("/auth");
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
