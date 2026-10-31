-- Freemium: 7 day Pro trial from sign up, then the free plan unless upgraded.
ALTER TABLE users ADD COLUMN trial_ends_at INTEGER;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN pro_interest_at INTEGER;
UPDATE users SET trial_ends_at = created_at + 7 * 86400000 WHERE trial_ends_at IS NULL;
