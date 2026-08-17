-- ---------------------------------------------------------------------------
-- Per-user interface language. English is the default for new installations.
-- ---------------------------------------------------------------------------

ALTER TABLE `users`
    ADD COLUMN `locale` CHAR(5) NOT NULL DEFAULT 'en' AFTER `role`;
