-- Update readonly status for virtual attribute fields
UPDATE directus_fields 
SET readonly = false
WHERE collection = 'products' 
AND field LIKE 'attr_%';