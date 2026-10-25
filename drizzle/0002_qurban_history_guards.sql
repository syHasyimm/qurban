-- Financial records retain their original amount, owner and receipt.
-- A clerical mistake is voided once, then replaced with a new transaction.
CREATE FUNCTION public.protect_qurban_cash_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cash transactions cannot be deleted; void the record instead'
      USING ERRCODE = '23000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'A new cash transaction cannot already be voided'
        USING ERRCODE = '23000';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'A voided cash transaction cannot be changed or restored'
      USING ERRCODE = '23000';
  END IF;

  IF (to_jsonb(NEW) - ARRAY['voided_at', 'voided_by', 'void_reason'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['voided_at', 'voided_by', 'void_reason']) THEN
    RAISE EXCEPTION 'Cash transaction details are immutable; void and replace the record'
      USING ERRCODE = '23000';
  END IF;

  IF NEW.voided_at IS NULL OR NEW.voided_at < OLD.created_at THEN
    RAISE EXCEPTION 'Only a valid void operation is permitted on a cash transaction'
      USING ERRCODE = '23000';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cash_transactions_preserve_history
BEFORE INSERT OR UPDATE OR DELETE ON public.cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.protect_qurban_cash_history();
--> statement-breakpoint
CREATE FUNCTION public.protect_qurban_audit_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only'
    USING ERRCODE = '23000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_preserve_history
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.protect_qurban_audit_history();
