ALTER TABLE `bookings` ADD `payoutStatus` enum('not_eligible','pending','paid','held') DEFAULT 'not_eligible' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payoutPaidAt` timestamp;