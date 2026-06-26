/*
  Warnings:

  - You are about to drop the `revisions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `revisions` DROP FOREIGN KEY `revisions_ibfk_1`;

-- DropForeignKey
ALTER TABLE `revisions` DROP FOREIGN KEY `revisions_ibfk_2`;

-- AlterTable
ALTER TABLE `media` MODIFY `status` ENUM('pending', 'approved', 'rejected') NULL;

-- AlterTable
ALTER TABLE `scholar_versions` ADD COLUMN `version_type` ENUM('creation', 'edition') NOT NULL DEFAULT 'creation';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `allowed_to_contribute` BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE `revisions`;
