/*
  Warnings:

  - You are about to drop the column `birth_date_gerogean` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `birth_date_hijri` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `century_gregorian` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `century_hijri` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `death_date_gerogean` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `death_date_hijri` on the `scholar_versions` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `scholar_versions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('NEW_SCHOLAR_SUBMISSION', 'EDIT_PROPOSAL', 'REPORT_SUBMITTED', 'COMMENT_ON_BLOG', 'COMMENT_ON_SCHOLAR', 'SCHOLAR_APPROVED', 'SCHOLAR_REJECTED', 'MEDIA_APPROVED', 'MEDIA_REJECTED', 'NEW_DISCIPLINE_SUBMISSION', 'NEW_REGION_SUBMISSION') NULL;

-- AlterTable
ALTER TABLE `scholar_versions` DROP COLUMN `birth_date_gerogean`,
    DROP COLUMN `birth_date_hijri`,
    DROP COLUMN `century_gregorian`,
    DROP COLUMN `century_hijri`,
    DROP COLUMN `death_date_gerogean`,
    DROP COLUMN `death_date_hijri`,
    DROP COLUMN `region`,
    ADD COLUMN `century_gregorian_end` INTEGER NULL,
    ADD COLUMN `century_gregorian_start` INTEGER NULL,
    ADD COLUMN `century_hijri_end` INTEGER NULL,
    ADD COLUMN `century_hijri_start` INTEGER NULL,
    ADD COLUMN `region_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `regions` (
    `region_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`region_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholar_dates` (
    `date_id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NOT NULL,
    `date_type` ENUM('birth', 'death') NOT NULL,
    `calendar` ENUM('hijri', 'gregorian') NOT NULL,
    `year` INTEGER NULL,
    `is_approximate` BOOLEAN NOT NULL DEFAULT false,
    `raw_text` VARCHAR(100) NULL,

    INDEX `scholar_dates_version_id_idx`(`version_id`),
    UNIQUE INDEX `scholar_dates_version_id_date_type_calendar_key`(`version_id`, `date_type`, `calendar`),
    PRIMARY KEY (`date_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `region_id` ON `scholar_versions`(`region_id`);

-- AddForeignKey
ALTER TABLE `scholar_versions` ADD CONSTRAINT `scholar_versions_ibfk_4` FOREIGN KEY (`region_id`) REFERENCES `regions`(`region_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scholar_dates` ADD CONSTRAINT `scholar_dates_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE CASCADE ON UPDATE CASCADE;
