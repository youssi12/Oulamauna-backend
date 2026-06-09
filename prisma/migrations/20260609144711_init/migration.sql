-- CreateTable
CREATE TABLE `bibliography` (
    `bibliography_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scholar_id` INTEGER NULL,
    `title` VARCHAR(255) NULL,
    `citation` TEXT NULL,
    `url` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `created_by`(`created_by`),
    INDEX `scholar_id`(`scholar_id`),
    PRIMARY KEY (`bibliography_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_comments` (
    `comment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NULL,
    `user_id` INTEGER NULL,
    `content` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `post_id`(`post_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blog_posts` (
    `post_id` INTEGER NOT NULL AUTO_INCREMENT,
    `author_id` INTEGER NULL,
    `title` VARCHAR(255) NULL,
    `content` TEXT NULL,
    `status` ENUM('draft', 'published') NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `author_id`(`author_id`),
    PRIMARY KEY (`post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `comment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scholar_id` INTEGER NULL,
    `user_id` INTEGER NULL,
    `content` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `edited_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `scholar_id`(`scholar_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discipline_translations` (
    `translation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `discipline_id` INTEGER NULL,
    `language_id` INTEGER NULL,
    `name` VARCHAR(255) NULL,

    INDEX `discipline_id`(`discipline_id`),
    INDEX `language_id`(`language_id`),
    PRIMARY KEY (`translation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disciplines` (
    `discipline_id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`discipline_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `internal_links` (
    `link_id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_version_id` INTEGER NULL,
    `target_scholar_id` INTEGER NULL,

    INDEX `source_version_id`(`source_version_id`),
    INDEX `target_scholar_id`(`target_scholar_id`),
    PRIMARY KEY (`link_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `languages` (
    `language_id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(255) NULL,
    `name` VARCHAR(255) NULL,

    PRIMARY KEY (`language_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media` (
    `media_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scholar_id` INTEGER NULL,
    `file_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(255) NULL,
    `file_type` ENUM('pdf', 'audio', 'video') NULL,
    `status` ENUM('pending', 'approved') NULL,
    `uploaded_by` INTEGER NULL,
    `uploaded_at` TIMESTAMP(0) NULL,
    `view_count` INTEGER NULL,
    `like_count` INTEGER NULL,

    INDEX `scholar_id`(`scholar_id`),
    INDEX `uploaded_by`(`uploaded_by`),
    PRIMARY KEY (`media_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `type` ENUM('NEW_SCHOLAR_SUBMISSION', 'EDIT_PROPOSAL', 'REPORT_SUBMITTED', 'COMMENT_ON_BLOG', 'COMMENT_ON_SCHOLAR', 'SCHOLAR_APPROVED', 'SCHOLAR_REJECTED') NULL,
    `message` TEXT NULL,
    `related_entity` VARCHAR(255) NULL,
    `is_read` BOOLEAN NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `token`(`token`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `report_id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporter_id` INTEGER NULL,
    `content_type` ENUM('scholar', 'comment', 'blog_post', 'blog_comment') NULL,
    `content_id` INTEGER NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `reporter_id`(`reporter_id`),
    PRIMARY KEY (`report_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revisions` (
    `revision_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NULL,
    `edited_by` INTEGER NULL,
    `field_changed` VARCHAR(255) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `edited_by`(`edited_by`),
    INDEX `version_id`(`version_id`),
    PRIMARY KEY (`revision_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(255) NULL,

    UNIQUE INDEX `role_name`(`role_name`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_aliases` (
    `alias_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NULL,
    `alias_name` VARCHAR(255) NULL,

    INDEX `version_id`(`version_id`),
    PRIMARY KEY (`alias_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_contributors` (
    `scholar_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`scholar_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_disciplines` (
    `scholar_id` INTEGER NOT NULL,
    `discipline_id` INTEGER NOT NULL,

    INDEX `discipline_id`(`discipline_id`),
    PRIMARY KEY (`scholar_id`, `discipline_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_relationships` (
    `relation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scholar_id` INTEGER NULL,
    `related_scholar_id` INTEGER NULL,
    `relation_type` ENUM('teacher', 'student') NULL,

    INDEX `related_scholar_id`(`related_scholar_id`),
    INDEX `scholar_id`(`scholar_id`),
    PRIMARY KEY (`relation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_versions` (
    `version_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scholar_id` INTEGER NULL,
    `language_id` INTEGER NULL,
    `canonical_name` VARCHAR(255) NULL,
    `region` VARCHAR(255) NULL,
    `birth_date_gerogean` VARCHAR(50) NULL,
    `birth_date_hijri` VARCHAR(50) NULL,
    `death_date_gerogean` VARCHAR(50) NULL,
    `death_date_hijri` VARCHAR(50) NULL,
    `century_hijri` VARCHAR(255) NULL,
    `century_gregorian` VARCHAR(255) NULL,
    `biography` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NULL,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `created_by`(`created_by`),
    INDEX `language_id`(`language_id`),
    INDEX `scholar_id`(`scholar_id`),
    PRIMARY KEY (`version_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholars` (
    `scholar_id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `created_by`(`created_by`),
    PRIMARY KEY (`scholar_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `password_hash` VARCHAR(255) NULL,
    `role_id` INTEGER NULL DEFAULT 3,
    `is_banned` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `username`(`username`),
    UNIQUE INDEX `email`(`email`),
    INDEX `role_id`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bibliography` ADD CONSTRAINT `bibliography_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `bibliography` ADD CONSTRAINT `bibliography_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `blog_comments` ADD CONSTRAINT `blog_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`post_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `blog_comments` ADD CONSTRAINT `blog_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `blog_posts` ADD CONSTRAINT `blog_posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `discipline_translations` ADD CONSTRAINT `discipline_translations_ibfk_1` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`discipline_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `discipline_translations` ADD CONSTRAINT `discipline_translations_ibfk_2` FOREIGN KEY (`language_id`) REFERENCES `languages`(`language_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_verifications` ADD CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `internal_links` ADD CONSTRAINT `internal_links_ibfk_1` FOREIGN KEY (`source_version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `internal_links` ADD CONSTRAINT `internal_links_ibfk_2` FOREIGN KEY (`target_scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_ibfk_1` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_ibfk_2` FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_aliases` ADD CONSTRAINT `scholar_aliases_ibfk_1` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_contributors` ADD CONSTRAINT `scholar_contributors_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_contributors` ADD CONSTRAINT `scholar_contributors_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_disciplines` ADD CONSTRAINT `scholar_disciplines_ibfk_1` FOREIGN KEY (`discipline_id`) REFERENCES `disciplines`(`discipline_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_disciplines` ADD CONSTRAINT `scholar_disciplines_ibfk_2` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_relationships` ADD CONSTRAINT `scholar_relationships_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_relationships` ADD CONSTRAINT `scholar_relationships_ibfk_2` FOREIGN KEY (`related_scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_versions` ADD CONSTRAINT `scholar_versions_ibfk_1` FOREIGN KEY (`scholar_id`) REFERENCES `scholars`(`scholar_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_versions` ADD CONSTRAINT `scholar_versions_ibfk_2` FOREIGN KEY (`language_id`) REFERENCES `languages`(`language_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_versions` ADD CONSTRAINT `scholar_versions_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholars` ADD CONSTRAINT `scholars_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
