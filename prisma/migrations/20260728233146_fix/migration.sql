/*
  Warnings:

  - You are about to drop the column `author` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `publisher` on the `media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `media` DROP COLUMN `author`,
    DROP COLUMN `format`,
    DROP COLUMN `publisher`;
