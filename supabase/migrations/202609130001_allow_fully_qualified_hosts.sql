-- Apply to existing Linkboard installations. Safe to run more than once.
-- Allows valid fully qualified hostnames without changing profile data or RLS.
begin;

create or replace function private.linkboard_safe_url(value text, image_only boolean default false)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if value is null or char_length(value) > 2048 or value ~ '[[:space:][:cntrl:]]' or position(chr(92) in value) > 0 then
    return false;
  end if;
  if image_only and value = '' then return true; end if;
  if value ~* '^https?://' and (not image_only or value ~* '^https://') then
    if value ~* '^https?://\[' then
      begin
        perform substring(value from '\[([^]]+)\]')::inet;
      exception when invalid_text_representation then return false;
      end;
    end if;
    -- A terminal DNS root dot is valid and is preserved by URL.href.
    -- No credentials, whitespace, percent-encoded hostnames or executable schemes.
    return value ~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?\.?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
      and coalesce(substring(lower(value) from '^https?://[^/?#]+:([0-9]{1,5})(?:[/?#]|$)')::integer, 0) <= 65535;
  end if;
  if not image_only and value ~* '^mailto:' then
    return char_length(substring(value from 8)) <= 254
      and substring(value from 8) !~ '[?&#%]'
      and substring(value from 8) ~ '^[A-Za-z0-9.!$''*+/=^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$';
  end if;
  return false;
end;
$$;

revoke all on function private.linkboard_safe_url(text, boolean) from public, anon, authenticated;
grant execute on function private.linkboard_safe_url(text, boolean) to authenticated;

commit;
