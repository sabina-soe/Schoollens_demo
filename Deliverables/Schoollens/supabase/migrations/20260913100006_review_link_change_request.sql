CREATE OR REPLACE FUNCTION public.review_link_change_request(
  p_request_id uuid,
  p_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.link_change_requests%ROWTYPE;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'moderator' THEN
    RAISE EXCEPTION 'not a moderator';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO req
  FROM public.link_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
  IF req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  UPDATE public.link_change_requests
  SET
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    IF req.field = 'website' THEN
      UPDATE public.schools
      SET official_website_url = req.proposed_value
      WHERE id = req.school_id;
    ELSIF req.field = 'facebook' THEN
      UPDATE public.schools
      SET official_facebook_url = req.proposed_value
      WHERE id = req.school_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_link_change_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_link_change_request(uuid, text) TO authenticated;
