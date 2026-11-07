-- A sync claims the rows it is about to write for a minute, so an overlapping sync cannot write them too.
-- Rows a claim creates have status 'pending'; a claim that is never acked simply expires.
ALTER TABLE deliveries ADD COLUMN claim TEXT;
ALTER TABLE deliveries ADD COLUMN claimed_until INTEGER;
ALTER TABLE answer_deliveries ADD COLUMN claim TEXT;
ALTER TABLE answer_deliveries ADD COLUMN claimed_until INTEGER;
ALTER TABLE tldr_deliveries ADD COLUMN claim TEXT;
ALTER TABLE tldr_deliveries ADD COLUMN claimed_until INTEGER;
