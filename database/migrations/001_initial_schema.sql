-- ---------------------------------------------------------------------------
-- MDcabinet – základná schéma
-- Hierarchia: User → Cabinet → Tray → Folder (rekurzívne) → Document (Markdown)
-- ---------------------------------------------------------------------------

CREATE TABLE `users` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email`         VARCHAR(190) NOT NULL,
    `name`          VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role`          ENUM('admin','user') NOT NULL DEFAULT 'user',
    `avatar_color`  CHAR(7)      NOT NULL DEFAULT '#6366f1',
    `last_login_at` DATETIME     NULL DEFAULT NULL,
    `created_at`    DATETIME     NOT NULL,
    `updated_at`    DATETIME     NOT NULL,
    `deleted_at`    DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cabinet = najvyššia úroveň, patrí jednému používateľovi.
CREATE TABLE `cabinets` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_id`    INT UNSIGNED NOT NULL,
    `name`        VARCHAR(190) NOT NULL,
    `slug`        VARCHAR(140) NOT NULL,
    `description` TEXT         NULL DEFAULT NULL,
    `color`       CHAR(7)      NOT NULL DEFAULT '#6366f1',
    `icon`        VARCHAR(48)  NULL DEFAULT NULL,
    `position`    INT          NOT NULL DEFAULT 0,
    `created_at`  DATETIME     NOT NULL,
    `updated_at`  DATETIME     NOT NULL,
    `deleted_at`  DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_cabinets_owner_slug` (`owner_id`, `slug`),
    KEY `ix_cabinets_owner_position` (`owner_id`, `position`),
    CONSTRAINT `fk_cabinets_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tray = "šuplík" v skrini.
CREATE TABLE `trays` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cabinet_id`  INT UNSIGNED NOT NULL,
    `name`        VARCHAR(190) NOT NULL,
    `slug`        VARCHAR(140) NOT NULL,
    `description` TEXT         NULL DEFAULT NULL,
    `icon`        VARCHAR(48)  NULL DEFAULT NULL,
    `position`    INT          NOT NULL DEFAULT 0,
    `created_at`  DATETIME     NOT NULL,
    `updated_at`  DATETIME     NOT NULL,
    `deleted_at`  DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_trays_cabinet_slug` (`cabinet_id`, `slug`),
    KEY `ix_trays_cabinet_position` (`cabinet_id`, `position`),
    CONSTRAINT `fk_trays_cabinet` FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zložky sa môžu vnárať (parent_id), koreňové majú parent_id = NULL.
CREATE TABLE `folders` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tray_id`    INT UNSIGNED NOT NULL,
    `parent_id`  INT UNSIGNED NULL DEFAULT NULL,
    `name`       VARCHAR(190) NOT NULL,
    `slug`       VARCHAR(140) NOT NULL,
    `position`   INT          NOT NULL DEFAULT 0,
    `created_at` DATETIME     NOT NULL,
    `updated_at` DATETIME     NOT NULL,
    `deleted_at` DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `ix_folders_tray_parent` (`tray_id`, `parent_id`, `position`),
    CONSTRAINT `fk_folders_tray` FOREIGN KEY (`tray_id`) REFERENCES `trays` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_folders_parent` FOREIGN KEY (`parent_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Samotný Markdown dokument.
CREATE TABLE `documents` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tray_id`    INT UNSIGNED NOT NULL,
    `folder_id`  INT UNSIGNED NULL DEFAULT NULL,
    `title`      VARCHAR(200) NOT NULL,
    `slug`       VARCHAR(160) NOT NULL,
    `content`    MEDIUMTEXT   NOT NULL,
    `excerpt`    VARCHAR(500) NOT NULL DEFAULT '',
    `word_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `is_pinned`  TINYINT(1)   NOT NULL DEFAULT 0,
    `position`   INT          NOT NULL DEFAULT 0,
    `created_by` INT UNSIGNED NULL DEFAULT NULL,
    `updated_by` INT UNSIGNED NULL DEFAULT NULL,
    `created_at` DATETIME     NOT NULL,
    `updated_at` DATETIME     NOT NULL,
    `deleted_at` DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_documents_tray_slug` (`tray_id`, `slug`),
    KEY `ix_documents_folder` (`folder_id`, `position`),
    KEY `ix_documents_updated` (`updated_at`),
    FULLTEXT KEY `ft_documents` (`title`, `content`),
    CONSTRAINT `fk_documents_tray` FOREIGN KEY (`tray_id`) REFERENCES `trays` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_documents_folder` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_documents_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_documents_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- História: každé uloženie zapíše novú revíziu.
CREATE TABLE `document_revisions` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `document_id` INT UNSIGNED NOT NULL,
    `revision_no` INT UNSIGNED NOT NULL,
    `user_id`     INT UNSIGNED NULL DEFAULT NULL,
    `title`       VARCHAR(200) NOT NULL,
    `content`     MEDIUMTEXT   NOT NULL,
    `summary`     VARCHAR(255) NULL DEFAULT NULL,
    `change_type` ENUM('create','update','revert') NOT NULL DEFAULT 'update',
    `created_at`  DATETIME     NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_revisions_document_no` (`document_id`, `revision_no`),
    CONSTRAINT `fk_revisions_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_revisions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nahraté obrázky a prílohy (fyzicky v storage/uploads, servuje ich PHP).
CREATE TABLE `attachments` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`       INT UNSIGNED NULL DEFAULT NULL,
    `document_id`   INT UNSIGNED NULL DEFAULT NULL,
    `disk_path`     VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime`          VARCHAR(120) NOT NULL,
    `size`          INT UNSIGNED NOT NULL DEFAULT 0,
    `width`         INT UNSIGNED NULL DEFAULT NULL,
    `height`        INT UNSIGNED NULL DEFAULT NULL,
    `created_at`    DATETIME     NOT NULL,
    PRIMARY KEY (`id`),
    KEY `ix_attachments_document` (`document_id`),
    KEY `ix_attachments_user` (`user_id`),
    CONSTRAINT `fk_attachments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_attachments_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verejné read-only odkazy na cabinet / tray / folder / dokument.
CREATE TABLE `share_links` (
    `token`          CHAR(40)     NOT NULL,
    `target_type`    ENUM('cabinet','tray','folder','document') NOT NULL,
    `target_id`      INT UNSIGNED NOT NULL,
    `created_by`     INT UNSIGNED NOT NULL,
    `password_hash`  VARCHAR(255) NULL DEFAULT NULL,
    `expires_at`     DATETIME     NULL DEFAULT NULL,
    `views`          INT UNSIGNED NOT NULL DEFAULT 0,
    `last_viewed_at` DATETIME     NULL DEFAULT NULL,
    `created_at`     DATETIME     NOT NULL,
    PRIMARY KEY (`token`),
    KEY `ix_shares_target` (`target_type`, `target_id`),
    KEY `ix_shares_creator` (`created_by`),
    CONSTRAINT `fk_shares_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nastavenia inštancie (kľúč/hodnota).
CREATE TABLE `settings` (
    `key`        VARCHAR(100) NOT NULL,
    `value`      TEXT         NULL DEFAULT NULL,
    `updated_at` DATETIME     NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
