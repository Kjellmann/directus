-- Remove the problematic field entirely
DELETE FROM directus_relations WHERE one_collection = 'products' AND one_field = 'assets_collection';
DELETE FROM directus_fields WHERE collection = 'products' AND field = 'assets_collection';