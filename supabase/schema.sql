-- Linkboard initial schema. Run in the Supabase SQL editor before signing up.
-- The public publishable/anon key is safe ONLY when these grants and RLS policies
-- are installed. Never expose the service-role key or the private schema.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

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

create or replace function private.linkboard_valid_links(value jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  item jsonb;
  seen text[] := array[]::text[];
begin
  if value is null or jsonb_typeof(value) <> 'array' then return false; end if;
  if jsonb_array_length(value) > 30 then return false; end if;
  for item in select jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'object'
      or not (item ?& array['id', 'title', 'url', 'platform', 'enabled'])
      or jsonb_typeof(item -> 'id') <> 'string'
      or jsonb_typeof(item -> 'title') <> 'string'
      or jsonb_typeof(item -> 'url') <> 'string'
      or jsonb_typeof(item -> 'platform') <> 'string'
      or jsonb_typeof(item -> 'enabled') <> 'boolean' then return false; end if;
    -- Reject extra fields so public JSON cannot carry accidentally private data.
    if (select count(*) from jsonb_object_keys(item)) <> 5 then return false; end if;
    if (item ->> 'id') !~ '^[a-zA-Z0-9_-]{1,64}$'
      or (item ->> 'id') = any(seen)
      or char_length(btrim(item ->> 'title')) < 1
      or char_length(item ->> 'title') > 80
      or not private.linkboard_safe_url(item ->> 'url')
      or (item ->> 'platform') not in ('website', 'instagram', 'youtube', 'twitter', 'tiktok', 'linkedin', 'github', 'spotify', 'mail', 'whatsapp') then return false; end if;
    seen := array_append(seen, item ->> 'id');
  end loop;
  return true;
end;
$$;

revoke all on function private.linkboard_safe_url(text, boolean) from public, anon, authenticated;
revoke all on function private.linkboard_valid_links(jsonb) from public, anon, authenticated;
grant execute on function private.linkboard_safe_url(text, boolean), private.linkboard_valid_links(jsonb) to authenticated;

-- Uploaded sources are stable references, never expiring signed URLs. The owner
-- folder is checked both when uploading and when saving a profile reference.
create or replace function private.linkboard_owned_image_path(value text, owner_id uuid)
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(
    split_part(value, '/', 1) = owner_id::text
    and value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$',
    false
  );
$$;

create or replace function private.linkboard_valid_image_source(value text, owner_id uuid)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case when left(value, 6) = 'media:'
    then private.linkboard_owned_image_path(substring(value from 7), owner_id)
    else private.linkboard_safe_url(value, true)
  end;
$$;

create or replace function private.linkboard_valid_appearance(value jsonb, owner_id uuid)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  field_name text;
  field_value jsonb;
  number_value numeric;
  number_bounds constant jsonb := '{
    "backgroundOverlay":[0,80], "backgroundGradientAngle":[0,360],
    "headingSize":[20,56], "bioSize":[12,24], "linkFontSize":[12,24],
    "avatarSize":[48,200], "avatarBorderWidth":[0,8],
    "linkRadius":[0,32], "linkBorderWidth":[0,4], "linkGap":[6,32],
    "linkPadding":[12,28], "contentWidth":[320,720], "contentPadding":[16,96]
  }'::jsonb;
  enum_values constant jsonb := '{
    "backgroundPosition":["top","center","bottom"],
    "avatarPosition":["top","center","bottom"],
    "backgroundFit":["cover","contain"],
    "fontFamily":["dm-sans","manrope","system","serif","mono"],
    "headingFontFamily":["dm-sans","manrope","system","serif","mono"],
    "headingWeight":[400,500,600,700,800],
    "avatarShape":["circle","rounded","square"],
    "textAlign":["left","center","right"],
    "linkAlign":["left","center","right"],
    "linkStyle":["filled","outline","glass"],
    "linkShadow":["none","soft","bold"]
  }'::jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  for field_name, field_value in select key, val from jsonb_each(value) as fields(key, val) loop
    if field_name = 'backgroundImageUrl' then
      if jsonb_typeof(field_value) <> 'string'
        or not private.linkboard_valid_image_source(value ->> field_name, owner_id) then return false; end if;
    elsif field_name = any(array[
      'textColor', 'headingColor', 'linkTextColor', 'linkBackgroundColor',
      'linkBorderColor', 'avatarBorderColor', 'backgroundGradientColor'
    ]) then
      if jsonb_typeof(field_value) <> 'string'
        or (value ->> field_name) !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
    elsif field_name = any(array[
      'dashboardBackground', 'showAvatar', 'showBranding', 'showQrCode',
      'showLinkIcons', 'showLinkArrows'
    ]) then
      if jsonb_typeof(field_value) <> 'boolean' then return false; end if;
    elsif number_bounds ? field_name then
      if jsonb_typeof(field_value) <> 'number' then return false; end if;
      number_value := (value ->> field_name)::numeric;
      if trunc(number_value) <> number_value
        or number_value < (number_bounds -> field_name ->> 0)::numeric
        or number_value > (number_bounds -> field_name ->> 1)::numeric then return false; end if;
    elsif enum_values ? field_name then
      if not exists (
        select 1 from jsonb_array_elements(enum_values -> field_name) as choices(choice)
        where choice = field_value
      ) then return false; end if;
    else
      -- Never publish unknown keys, raw CSS, or arbitrary font declarations.
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.linkboard_owned_image_path(text, uuid), private.linkboard_valid_image_source(text, uuid), private.linkboard_valid_appearance(jsonb, uuid) from public, anon, authenticated;
grant execute on function private.linkboard_owned_image_path(text, uuid), private.linkboard_valid_image_source(text, uuid), private.linkboard_valid_appearance(jsonb, uuid) to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null default 'Your name',
  bio text not null default '',
  avatar_url text not null default '',
  theme text not null default 'sand',
  background_color text not null default '#f5f1e9',
  appearance jsonb not null default '{}'::jsonb,
  links jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_valid check (
    char_length(username) between 3 and 30
    and username ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and username not in ('admin', 'login', 'signup', 'profile', 'api', 'auth', 'settings', 'analytics', 'share')
  ),
  constraint profiles_name_valid check (char_length(btrim(name)) >= 1 and char_length(name) <= 60),
  constraint profiles_bio_valid check (char_length(bio) <= 280),
  constraint profiles_avatar_valid check (private.linkboard_valid_image_source(avatar_url, id)),
  constraint profiles_appearance_valid check (private.linkboard_valid_appearance(appearance, id)),
  constraint profiles_theme_valid check (theme in ('sand', 'sage', 'rose', 'ink', 'custom')),
  constraint profiles_color_valid check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint profiles_links_valid check (private.linkboard_valid_links(links))
);

-- Reapplying setup to an older installation preserves its existing profiles.
alter table public.profiles add column if not exists appearance jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_valid;
alter table public.profiles add constraint profiles_avatar_valid check (private.linkboard_valid_image_source(avatar_url, id));
alter table public.profiles drop constraint if exists profiles_appearance_valid;
alter table public.profiles add constraint profiles_appearance_valid check (private.linkboard_valid_appearance(appearance, id));

create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Links are an atomic JSON array. The RPC verifies membership at insertion.
  -- Keep historical counts after a link is removed; never repurpose a link ID.
  link_id text not null check (link_id ~ '^[a-zA-Z0-9_-]{1,64}$'),
  created_at timestamptz not null default now()
);
create index if not exists click_events_profile_time_idx on public.click_events(profile_id, created_at, id);

alter table public.profiles enable row level security;
alter table public.click_events enable row level security;
revoke all on table public.profiles, public.click_events from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username, name, bio, avatar_url, theme, background_color, appearance, links, published) on public.profiles to authenticated;
grant select on table public.click_events to authenticated;

drop policy if exists "Published profiles are public" on public.profiles;
drop policy if exists "Owners can read their drafts" on public.profiles;
create policy "Owners can read their drafts" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Owners can edit their profile" on public.profiles;
create policy "Owners can edit their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Owners can read their analytics" on public.click_events;
create policy "Owners can read their analytics" on public.click_events for select to authenticated using ((select auth.uid()) = profile_id);

create or replace function private.linkboard_profile_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.linkboard_profile_updated() from public, anon, authenticated;
drop trigger if exists linkboard_profile_updated on public.profiles;
create trigger linkboard_profile_updated before update on public.profiles for each row execute function private.linkboard_profile_updated();

create or replace function private.linkboard_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'member-' || substring(replace(new.id::text, '-', '') from 1 for 23));
  return new;
end;
$$;
revoke all on function private.linkboard_new_user() from public, anon, authenticated;
drop trigger if exists linkboard_auth_user_created on auth.users;
create trigger linkboard_auth_user_created after insert on auth.users for each row execute function private.linkboard_new_user();

-- Backfill accounts created before this setup, without changing existing data.
insert into public.profiles (id, username)
select id, 'member-' || substring(replace(id::text, '-', '') from 1 for 23) from auth.users
on conflict (id) do nothing;

create or replace function private.linkboard_public_profile(p_username text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'name', p.name, 'bio', p.bio,
    'avatar_url', p.avatar_url, 'theme', p.theme, 'background_color', p.background_color,
    'appearance', p.appearance,
    'published', true,
    'links', coalesce((
      select jsonb_agg(items.link order by items.ordinality)
      from jsonb_array_elements(p.links) with ordinality as items(link, ordinality)
      where items.link ->> 'enabled' = 'true'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.username = p_username and p.published = true
    and char_length(p_username) between 3 and 30;
$$;
revoke all on function private.linkboard_public_profile(text) from public, anon, authenticated;
grant execute on function private.linkboard_public_profile(text) to anon, authenticated;

-- Public visitors cannot read the underlying table, even for published rows.
-- This lookup deliberately omits disabled links, timestamps and auth metadata.
create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select private.linkboard_public_profile(p_username); $$;
revoke all on function public.get_public_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;

create or replace function private.linkboard_record_click(p_profile_id uuid, p_link_id text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_profile_id is null or p_link_id is null or p_link_id !~ '^[a-zA-Z0-9_-]{1,64}$' then return; end if;
  -- No visitor-provided timestamps, ownership, counts, or arbitrary inserts.
  -- One insert statement makes publication/link validation and recording atomic.
  insert into public.click_events (profile_id, link_id)
  select p.id, p_link_id
  from public.profiles p
  where p.id = p_profile_id and p.published = true
    and exists (
      select 1 from jsonb_array_elements(p.links) as link
      where link ->> 'id' = p_link_id and link ->> 'enabled' = 'true'
    );
end;
$$;
revoke all on function private.linkboard_record_click(uuid, text) from public, anon, authenticated;
grant execute on function private.linkboard_record_click(uuid, text) to anon, authenticated;

-- Expose only an invoker wrapper through the Data API. The privileged function
-- lives in the unexposed private schema and accepts only the two checked IDs.
create or replace function public.track_link_click(p_profile_id uuid, p_link_id text)
returns void
language sql security invoker
set search_path = ''
as $$ select private.linkboard_record_click(p_profile_id, p_link_id); $$;
revoke all on function public.track_link_click(uuid, text) from public, anon, authenticated;
grant execute on function public.track_link_click(uuid, text) to anon, authenticated;

-- Supabase Storage owns these tables. A private bucket is essential: public
-- buckets bypass read policies and would expose images on unpublished profiles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('linkboard-images', 'linkboard-images', false, 2097152, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];

create or replace function private.linkboard_image_is_published(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.published = true
      and private.linkboard_owned_image_path(object_name, p.id)
      and (p.avatar_url = 'media:' || object_name or p.appearance ->> 'backgroundImageUrl' = 'media:' || object_name)
  );
$$;
revoke all on function private.linkboard_image_is_published(text) from public, anon, authenticated;
grant execute on function private.linkboard_image_is_published(text) to anon, authenticated;

drop policy if exists "Owners can upload their images" on storage.objects;
create policy "Owners can upload their images" on storage.objects for insert to authenticated with check (
  bucket_id = 'linkboard-images'
  and private.linkboard_owned_image_path(name, (select auth.uid()))
);

drop policy if exists "Owners can read their images" on storage.objects;
create policy "Owners can read their images" on storage.objects for select to authenticated using (
  bucket_id = 'linkboard-images'
  and private.linkboard_owned_image_path(name, (select auth.uid()))
);

-- Only downloads and signed URL creation are public. Listing the bucket must
-- not enumerate other accounts' images, even when those profiles are published.
drop policy if exists "Published profile images can be downloaded" on storage.objects;
create policy "Published profile images can be downloaded" on storage.objects for select to anon, authenticated using (
  bucket_id = 'linkboard-images'
  and storage.allow_any_operation(array['object.get_authenticated', 'object.get_authenticated_info', 'object.sign', 'object.sign_many'])
  and private.linkboard_image_is_published(name)
);

-- No UPDATE policy: uploads use new random names with upsert:false. Owners may
-- remove an unused upload, but cannot delete an image still saved on a profile.
drop policy if exists "Owners can delete unused images" on storage.objects;
create policy "Owners can delete unused images" on storage.objects for delete to authenticated using (
  bucket_id = 'linkboard-images'
  and private.linkboard_owned_image_path(name, (select auth.uid()))
  and not exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and (p.avatar_url = 'media:' || storage.objects.name or p.appearance ->> 'backgroundImageUrl' = 'media:' || storage.objects.name)
  )
);

commit;
