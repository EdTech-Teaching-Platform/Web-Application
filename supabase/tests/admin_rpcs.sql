-- Contract smoke tests for the admin RPCs.
-- Run with `supabase db reset` followed by `psql ... -f supabase/tests/admin_rpcs.sql`.
-- The transaction is deliberately rolled back so this file is safe against a
-- development database containing real seed data.
begin;

do $$
declare
  required text[] := array[
    'create_discount(text,text,discount_offer_type,numeric,numeric,numeric,integer,integer,timestamp with time zone,timestamp with time zone,discount_scope,uuid[],text,boolean)',
    'validate_coupon(text,uuid,numeric)',
    'redeem_coupon(text,uuid,uuid,numeric,uuid)',
    'request_refund(uuid,refund_reason,text,numeric)',
    'approve_refund(uuid,text)',
    'publish_test_series(uuid)',
    'set_educator_verification(uuid,educator_verification,text)'
  ];
  signature text;
begin
  foreach signature in array required loop
    if to_regprocedure(signature) is null then
      raise exception 'Missing required admin RPC: %', signature;
    end if;
  end loop;
end
$$;

-- These guards exercise the validation paths without requiring an authenticated
-- fixture user or mutating any application row.
do $$
begin
  begin
    perform publish_test_series('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'publish_test_series accepted a missing series';
  exception when others then
    if sqlerrm = 'publish_test_series accepted a missing series' then raise; end if;
  end;

  begin
    perform request_refund('00000000-0000-0000-0000-000000000000'::uuid);
    raise exception 'request_refund accepted a missing payment';
  exception when others then
    if sqlerrm = 'request_refund accepted a missing payment' then raise; end if;
  end;
end
$$;

rollback;
