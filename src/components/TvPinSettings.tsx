import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tv } from "lucide-react";

const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  const [d, t] = new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).split(", ");
  return `${d} às ${t?.slice(0, 5)}`;
};

export default function TvPinSettings() {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<{ configured: boolean; updated_at: string | null } | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).rpc("get_tv_pin_info");
    const row = Array.isArray(data) ? data[0] : data;
    setInfo(row ? { configured: !!row.configured, updated_at: row.updated_at } : { configured: false, updated_at: null });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!/^[0-9]{4}$/.test(pin)) return toast.error("O PIN deve ter exatamente 4 dígitos numéricos.");
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_tv_pin", { p_pin: pin });
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar o PIN.");
    setPin("");
    toast.success("PIN da TV atualizado.");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="h-5 w-5 text-primary" /> Acesso da TV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          PIN de 4 dígitos usado nas telas "Painel de Métricas" e "Métricas Sprint TV".{" "}
          {info?.configured ? `Última troca: ${fmt(info.updated_at)}.` : "Ainda não configurado."}
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label htmlFor="tv-pin">{info?.configured ? "Novo PIN" : "Definir PIN"}</Label>
            <Input
              id="tv-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-32 tracking-[0.5em] text-center"
              placeholder="••••"
            />
          </div>
          <Button onClick={save} disabled={saving || pin.length !== 4}>
            {saving ? "Salvando..." : "Salvar PIN"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
