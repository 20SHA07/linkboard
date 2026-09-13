-- Apply to an existing Linkboard Supabase project before deploying image uploads.
-- Preserves existing profile data. Safe to run repeatedly.
begin;

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

revoke all on function private.linkboard_valid_links(jsonb) from public, anon, authenticated;
grant execute on function private.linkboard_valid_links(jsonb) to authenticated;

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
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if exists (
    select 1 from jsonb_object_keys(value) as item(key)
    where item.key not in ('backgroundImageUrl', 'backgroundPosition', 'avatarPosition', 'backgroundOverlay', 'dashboardBackground')
  ) then return false; end if;
  if value ? 'backgroundImageUrl' and (
    jsonb_typeof(value -> 'backgroundImageUrl') <> 'string'
    or not private.linkboard_valid_image_source(value ->> 'backgroundImageUrl', owner_id)
  ) then return false; end if;
  if value ? 'backgroundPosition' and (
    jsonb_typeof(value -> 'backgroundPosition') <> 'string'
    or value ->> 'backgroundPosition' not in ('top', 'center', 'bottom')
  ) then return false; end if;
  if value ? 'avatarPosition' and (
    jsonb_typeof(value -> 'avatarPosition') <> 'string'
    or value ->> 'avatarPosition' not in ('top', 'center', 'bottom')
  ) then return false; end if;
  if value ? 'dashboardBackground' and jsonb_typeof(value -> 'dashboardBackground') <> 'boolean' then return false; end if;
  if value ? 'backgroundOverlay' then
    if jsonb_typeof(value -> 'backgroundOverlay') <> 'number' then return false; end if;
    if (value ->> 'backgroundOverlay')::numeric not between 0 and 80
      or trunc((value ->> 'backgroundOverlay')::numeric) <> (value ->> 'backgroundOverlay')::numeric then return false; end if;
  end if;
  return true;
end;
$$;

revoke all on function private.linkboard_owned_image_path(text, uuid), private.linkboard_valid_image_source(text, uuid), private.linkboard_valid_appearance(jsonb, uuid) from public, anon, authenticated;
grant execute on function private.linkboard_owned_image_path(text, uuid), private.linkboard_valid_image_source(text, uuid), private.linkboard_valid_appearance(jsonb, uuid) to authenticated;

-- Reapplying setup to an older installation preserves its existing profiles.
alter table public.profiles add column if not exists appearance jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_valid;
alter table public.profiles add constraint profiles_avatar_valid check (private.linkboard_valid_image_source(avatar_url, id));
alter table public.profiles drop constraint if exists profiles_appearance_valid;
alter table public.profiles add constraint profiles_appearance_valid check (private.linkboard_valid_appearance(appearance, id));

grant update (appearance) on public.profiles to authenticated;

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
