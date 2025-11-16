-- Simplify upsert_profile - just try to insert/update, let trigger handle profile creation
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_profile JSON;
BEGIN
  -- Try to insert profile if it doesn't exist (trigger should create it, but just in case)
  INSERT INTO public.profiles (id, username, full_name, created_at, updated_at)
  VALUES (
    p_user_id,
    NULLIF(p_username, ''),
    NULLIF(p_full_name, ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(NULLIF(p_username, ''), profiles.username),
    full_name = COALESCE(NULLIF(p_full_name, ''), profiles.full_name),
    updated_at = NOW();
  
  -- Return the updated profile
  SELECT row_to_json(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  RETURN v_profile;
EXCEPTION
  WHEN foreign_key_violation THEN
    -- User doesn't exist yet - wait a moment and the trigger will create profile
    -- Return null, let app retry
    RETURN NULL;
  WHEN OTHERS THEN
    -- Re-raise other errors
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

