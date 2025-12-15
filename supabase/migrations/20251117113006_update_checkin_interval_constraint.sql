-- Update the check constraint to allow values from 1 to 60 minutes
-- Previously it only allowed 3-10 minutes, but now users can select custom values from 1-60

ALTER TABLE trips
DROP CONSTRAINT IF EXISTS trips_checkin_interval_minutes_check;

ALTER TABLE trips
ADD CONSTRAINT trips_checkin_interval_minutes_check
CHECK (checkin_interval_minutes >= 1 AND checkin_interval_minutes <= 60);











