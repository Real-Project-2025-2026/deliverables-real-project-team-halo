-- Migration: Add username to profiles table
-- Description: Adds a unique username field to the profiles table for Guardian system

-- Add username column (nullable initially for existing users)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS username VARCHAR(20);

-- Add unique constraint (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx 
ON profiles (LOWER(username))
WHERE username IS NOT NULL;

-- Add check constraint for username format (3-20 chars, alphanumeric + underscore)
ALTER TABLE profiles
ADD CONSTRAINT username_format_check 
CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND 
    LENGTH(username) <= 20 AND 
    username ~ '^[a-zA-Z0-9_]+$'
  )
);

-- Add comment
COMMENT ON COLUMN profiles.username IS 'Unique username for Guardian system (3-20 chars, alphanumeric + underscore)';

