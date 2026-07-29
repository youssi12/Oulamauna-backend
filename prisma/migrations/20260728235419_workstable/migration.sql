-- CreateTable
CREATE TABLE `scholar_works` (
    `work_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `year` INTEGER NULL,
    `format` ENUM('BOOK', 'ARTICLE', 'TREATISE', 'MANUSCRIPT', 'LECTURE', 'SERMON', 'FATWA', 'POEM', 'LETTER', 'COMMENTARY', 'TRANSLATION', 'RESEARCH', 'COURSE', 'DEVICE', 'INVENTION', 'SOFTWARE', 'MAP', 'OTHER') NOT NULL,
    `description` TEXT NULL,
    `media_url` VARCHAR(500) NULL,
    `file_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(500) NULL,
    `source_type` ENUM('upload', 'external') NULL,

    INDEX `scholar_works_version_id_idx`(`version_id`),
    PRIMARY KEY (`work_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scholar_works` ADD CONSTRAINT `scholar_works_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE CASCADE ON UPDATE CASCADE;
