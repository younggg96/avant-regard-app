-- Add the increment_banner_click RPC used by store_merchant_service.increment_banner_click().
-- The store_banners table (created in 008_store_merchant.sql) has a click_count column,
-- but the RPC that the service calls was never defined; clicks were silently dropped with
-- "Could not find the function public.increment_banner_click(banner_id) in the schema cache".
--
-- The parameter name MUST match the keyword passed by Supabase RPC at the Python layer
-- (see store_merchant_service.increment_banner_click → rpc("increment_banner_click", {"banner_id": ...})),
-- otherwise PostgREST won't bind the argument and the call still fails.

CREATE OR REPLACE FUNCTION increment_banner_click(banner_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE store_banners
    SET click_count = click_count + 1,
        updated_at = NOW()
    WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql;
