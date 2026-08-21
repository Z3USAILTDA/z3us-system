CREATE TABLE public.sprint_board (
  id text NOT NULL PRIMARY KEY DEFAULT 'main',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.sprint_board TO authenticated;
GRANT ALL ON public.sprint_board TO service_role;

ALTER TABLE public.sprint_board ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sprint board"
  ON public.sprint_board FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create sprint board"
  ON public.sprint_board FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sprint board"
  ON public.sprint_board FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_sprint_board
  BEFORE UPDATE ON public.sprint_board
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.sprint_board (id, data)
VALUES ('main', '{"clientes":[],"projetos":[],"sprints":[],"tarefas":[],"seqSprint":1}'::jsonb);

ALTER TABLE public.sprint_board REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sprint_board;