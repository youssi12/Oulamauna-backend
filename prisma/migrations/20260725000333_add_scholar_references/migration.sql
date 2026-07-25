-- CreateTable
CREATE TABLE `scholar_references` (
    `reference_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NULL,
    `citation` TEXT NULL,
    `url` VARCHAR(500) NULL,

    INDEX `scholar_references_version_id_idx`(`version_id`),
    PRIMARY KEY (`reference_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scholar_references` ADD CONSTRAINT `scholar_references_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE CASCADE ON UPDATE CASCADE;
