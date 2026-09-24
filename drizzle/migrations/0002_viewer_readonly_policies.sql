CREATE POLICY "Viewers can read projects" ON public.projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewers can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewers can read clients" ON public.clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewers can read client_projects" ON public.client_projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Authenticated can create sprint board" ON public.sprint_board;
DROP POLICY IF EXISTS "Authenticated can update sprint board" ON public.sprint_board;
DROP POLICY IF EXISTS "Authenticated can view sprint board" ON public.sprint_board;
CREATE POLICY "Admins can create sprint board" ON public.sprint_board FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sprint board" ON public.sprint_board FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins and viewers can view sprint board" ON public.sprint_board FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));