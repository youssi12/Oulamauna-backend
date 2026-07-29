/*
  Warnings:

  - Made the column `view_count` on table `media` required. This step will fail if there are existing NULL values in that column.
  - Made the column `like_count` on table `media` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `media` ADD COLUMN `media_url` VARCHAR(500) NULL,
    ADD COLUMN `source_type` ENUM('upload', 'external') NOT NULL DEFAULT 'upload',
    MODIFY `view_count` INTEGER NOT NULL DEFAULT 0,
    MODIFY `like_count` INTEGER NOT NULL DEFAULT 0;
