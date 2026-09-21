-- Apply after 202609130002_profile_images.sql, before deploying customization.
-- Expands the existing appearance contract without rewriting profiles, grants,
-- or storage policies. Existing clients and saved appearances remain valid.
-- Safe to run repeatedly.
begin;

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

commit;
