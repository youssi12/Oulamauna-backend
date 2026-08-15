/*
  Warnings:

  - You are about to drop the column `scholar_id` on the `media` table. All the data in the column will be lost.
  - Added the required column `version_id` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `media` DROP FOREIGN KEY `media_ibfk_1`;

-- AlterTable
ALTER TABLE `media` DROP COLUMN `scholar_id`,
    ADD COLUMN `version_id` INTEGER NOT NULL,
    MODIFY `file_path` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `version_id` ON `media`(`version_id`);

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_ibfk_1` FOREIGN KEY (`version_id`) REFERENCES `scholar_versions`(`version_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
