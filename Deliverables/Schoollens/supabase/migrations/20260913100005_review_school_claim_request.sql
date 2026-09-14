CREATE OR REPLACE FUNCTION public.review_school_claim_request(
  p_request_id uuid,
  p_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.school_claim_requests%ROWTYPE;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'moderator' THEN
    RAISE EXCEPTION 'not a moderator';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO req
  FROM public.school_claim_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
  IF req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'request is not pending';
  END IF;

  UPDATE public.school_claim_requests
  SET
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE public.users
    SET role = 'school_admin'
    WHERE id = req.requested_by;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_school_claim_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_school_claim_request(uuid, text) TO authenticated;
