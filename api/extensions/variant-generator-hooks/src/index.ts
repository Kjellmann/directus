import type { HookConfig } from '@directus/extensions';

const registerHook: HookConfig = ({ filter }, { database, logger }) => {
	// Hook: Clean up related data and variants before deleting products  
	filter('products.items.delete', async (keys) => {
		try {
			logger.info(`Starting cleanup for ${keys.length} products before deletion`);
			
			// First, find and add child variants to deletion list
			const variants = await database('products')
				.whereIn('parent_product_id', keys)
				.where('product_type', 'simple')
				.select('id');
			
			if (variants.length > 0) {
				logger.info(`Adding ${variants.length} child variants to deletion list for parent products`);
				keys.push(...variants.map(v => v.id));
			}
			
			// Then clean up related data for all products being deleted (including variants)
			for (const productId of keys) {
				logger.info(`Cleaning product ${productId}...`);
				
				// Delete product attributes (this is the main table storing attribute values)
				try {
					const deletedAttributes = await database('product_attributes')
						.where('product_id', productId)
						.delete();
					
					if (deletedAttributes > 0) {
						logger.info(`Deleted ${deletedAttributes} product attributes for product ${productId}`);
					}
				} catch (error) {
					logger.debug('Error deleting product_attributes:', error);
				}
				
				// Delete product images via junction table
				try {
					// First get the product_images IDs to delete
					const junctionRecords = await database('products_product_images')
						.where('products_id', productId)
						.select('product_images_id');
					
					if (junctionRecords.length > 0) {
						const imageIds = junctionRecords.map(r => r.product_images_id);
						
						// Delete junction records
						await database('products_product_images')
							.where('products_id', productId)
							.delete();
						
						// Delete product_images records
						const deletedImages = await database('product_images')
							.whereIn('id', imageIds)
							.delete();
						
						if (deletedImages > 0) {
							logger.info(`Deleted ${deletedImages} product images for product ${productId}`);
						}
					}
				} catch (error) {
					logger.debug('Error deleting product images:', error);
				}
				
				// Delete product attribute values if table exists
				try {
					const deletedAttributeValues = await database('product_attribute_values')
						.where('product_id', productId)
						.delete();
					
					if (deletedAttributeValues > 0) {
						logger.info(`Deleted ${deletedAttributeValues} attribute values for product ${productId}`);
					}
				} catch (error) {
					logger.debug('product_attribute_values table might not exist');
				}
			}
			
			logger.info(`Cleanup completed for ${keys.length} products`);
		} catch (error) {
			logger.error('Error cleaning up related data before product deletion:', error);
			throw error; // Re-throw to prevent deletion if cleanup fails
		}
		
		return keys;
	});
};

export default registerHook;