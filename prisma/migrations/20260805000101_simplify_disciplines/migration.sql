/*
  Warnings:

  - You are about to drop the `discipline_translations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `disciplines` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `discipline_translations` DROP FOREIGN KEY `discipline_translations_ibfk_1`;

-- DropForeignKey
ALTER TABLE `discipline_translations` DROP FOREIGN KEY `discipline_translations_ibfk_2`;

-- AlterTable
ALTER TABLE `disciplines` ADD COLUMN `name` VARCHAR(255) NOT NULL;

-- DropTable
DROP TABLE `discipline_translations`;
