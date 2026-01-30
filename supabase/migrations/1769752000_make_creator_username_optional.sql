-- Make username optional
ALTER TABLE twitter_creators ALTER COLUMN username DROP NOT NULL;
