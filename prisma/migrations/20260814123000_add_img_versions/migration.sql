-- AlterTable
ALTER TABLE `scholar_versions` ADD COLUMN `image_uploaded_by` INTEGER NULL;

-- CreateTable
CREATE TABLE `img_versions` (
    `img_version_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'superseded') NOT NULL DEFAULT 'pending',
    `uploaded_by` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    INDEX `img_versions_version_id_idx`(`version_id`),
    INDEX `img_versions_uploaded_by_idx`(`uploaded_by`),
    INDEX `img_versions_status_idx`(`status`),
    PRIMARY KEY (`img_version_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `img_versions` ADD CONSTRAINT `img_versions_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `img_versions` ADD CONSTRAINT `img_versions_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
