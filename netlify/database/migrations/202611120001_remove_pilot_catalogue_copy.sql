-- Replace wording from the pre-launch catalogue in existing tool records.
UPDATE toolshare_catalogue
SET description = REPLACE(description, 'Hall-owned pilot equipment.', 'Hall-owned equipment.')
WHERE description LIKE '%Hall-owned pilot equipment.%';
