-- Function to safely create or update a profile
-- Uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile when user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to safely upsert profile with username and full_name
-- This can be called from the app to update profile data
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_profile JSON;
BEGIN
  INSERT INTO public.profiles (id, username, full_name, updated_at)
  VALUES (p_user_id, p_username, p_full_name, NOW())
  ON CONFLICT (id) 
  DO UPDATE SET
    username = COALESCE(p_username, profiles.username),
    full_name = COALESCE(p_full_name, profiles.full_name),
    updated_at = NOW()
  WHERE (p_username IS NOT NULL OR p_full_name IS NOT NULL);
  
  SELECT row_to_json(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_profile(UUID, TEXT, TEXT) TO authenticated;

