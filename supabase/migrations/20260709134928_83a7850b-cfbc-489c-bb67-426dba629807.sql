DROP POLICY IF EXISTS "Members can mark own card render ready" ON public.member_card_renders;
CREATE POLICY "Members can mark own card render ready" ON public.member_card_renders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_card_renders.member_id
        AND m.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Members can update own card render status" ON public.member_card_renders;
CREATE POLICY "Members can update own card render status" ON public.member_card_renders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_card_renders.member_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_card_renders.member_id
        AND m.user_id = auth.uid()
    )
  );