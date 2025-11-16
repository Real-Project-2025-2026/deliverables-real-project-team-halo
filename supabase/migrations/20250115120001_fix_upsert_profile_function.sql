-- Update the upsert_profile function to handle the case where user doesn't exist yet
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_profile JSON;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    -- User doesn't exist yet - return error
    RAISE EXCEPTION 'User does not exist in auth.users yet. Please wait a moment and try again.';
  END IF;
  
  -- Ensure profile exists (should be created by trigger, but create if not)
  INSERT INTO public.profiles (id, created_at, updated_at)
  VALUES (p_user_id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Now update the profile with the provided values
  UPDATE public.profiles
  SET
    username = COALESCE(NULLIF(p_username, ''), username),
    full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
    updated_at = NOW()
  WHERE id = p_user_id
    AND (p_username IS NOT NULL OR p_full_name IS NOT NULL);
  
  -- Return the updated profile
  SELECT row_to_json(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

