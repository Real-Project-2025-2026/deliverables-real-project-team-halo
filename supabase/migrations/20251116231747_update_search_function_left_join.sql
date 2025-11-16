-- Migration: Update search_users_by_username_or_email to use LEFT JOIN
-- Description: Changes the function to start from auth.users and use LEFT JOIN
-- This allows finding users by email even if they don't have a profile yet

-- Update the search_users_by_username_or_email function to use LEFT JOIN
-- This allows finding users by email even if they don't have a profile yet
create or replace function public.search_users_by_username_or_email(search_query text)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
begin
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Search in auth.users by email (case-insensitive partial match)
  -- Use LEFT JOIN to find users even if they don't have a profile yet
  -- Exclude the current user
  -- Cast VARCHAR columns to text to match return type
  return query
  select distinct
    u.id,
    coalesce(p.username::text, null) as username,
    coalesce(p.full_name::text, null) as full_name,
    coalesce(p.avatar_url::text, null) as avatar_url
  from auth.users u
  left join public.profiles p on p.id = u.id
  where (
    -- Search by username (if username exists and matches)
    (p.username is not null and lower(p.username::text) like '%' || lower(search_query) || '%')
    or
    -- Search by email (case-insensitive partial match)
    lower(u.email) like '%' || lower(search_query) || '%'
  )
  -- Exclude current user
  and (current_user_id is null or u.id != current_user_id)
  -- Only return confirmed users (email_confirmed_at is not null)
  and u.email_confirmed_at is not null
  -- Limit results
  limit 20;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.search_users_by_username_or_email(text) to authenticated;

-- Add comment
comment on function public.search_users_by_username_or_email(text) is 'Searches for users by username (in profiles) or email (in auth.users). Returns public profile information.';

