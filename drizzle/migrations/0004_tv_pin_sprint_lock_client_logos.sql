CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.tv_access_settings (
  id text PRIMARY KEY DEFAULT 'main' CHECK (id = 'main'),
  pin_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.tv_access_settings TO service_role;
ALTER TABLE public.tv_access_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tv_pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tv_pin_attempts TO service_role;
ALTER TABLE public.tv_pin_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX tv_pin_attempts_ip_created_idx ON public.tv_pin_attempts (ip, created_at);
CREATE INDEX tv_pin_attempts_created_idx ON public.tv_pin_attempts (created_at);

CREATE OR REPLACE FUNCTION public.set_tv_pin(p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'O PIN deve ter exatamente 4 dígitos numéricos'; END IF;
  INSERT INTO public.tv_access_settings (id, pin_hash, updated_at, updated_by)
  VALUES ('main', extensions.crypt(p_pin, extensions.gen_salt('bf')), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now(), updated_by = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_tv_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tv_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tv_pin_info()
RETURNS TABLE(configured boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  RETURN QUERY SELECT (s.pin_hash IS NOT NULL), s.updated_at FROM public.tv_access_settings s WHERE s.id = 'main';
END $$;
REVOKE ALL ON FUNCTION public.get_tv_pin_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tv_pin_info() TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_tv_pin(p_pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  SELECT pin_hash INTO h FROM public.tv_access_settings WHERE id = 'main';
  IF h IS NULL THEN RAISE EXCEPTION 'pin_nao_configurado'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  RETURN extensions.crypt(p_pin, h) = h;
END $$;
REVOKE ALL ON FUNCTION public.verify_tv_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_tv_pin(text) TO service_role;

DROP POLICY IF EXISTS "Authenticated can update sprint board" ON public.sprint_board;
DROP POLICY IF EXISTS "Authenticated can insert sprint board" ON public.sprint_board;
DROP POLICY IF EXISTS "Admins can update sprint board" ON public.sprint_board;
DROP POLICY IF EXISTS "Admins can create sprint board" ON public.sprint_board;
CREATE POLICY "Admins can update sprint board" ON public.sprint_board FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create sprint board" ON public.sprint_board FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Authenticated can view sprint board" ON public.sprint_board;
CREATE POLICY "Authenticated can view sprint board" ON public.sprint_board FOR SELECT TO authenticated USING (true);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "Authenticated can read client logos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'client-logos');
CREATE POLICY "Admins can upload client logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update client logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete client logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos' AND public.has_role(auth.uid(), 'admin'));