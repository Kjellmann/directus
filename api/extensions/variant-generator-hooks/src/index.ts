import type { HookConfig } from '@directus/extensions';
import { VariantGeneratorService } from './variant-generator-service';

const registerHook: HookConfig = ({ action, filter }, { services, getSchema, database, logger }) => {
	// Helper function to get variant generator service
	const getVariantService = async (accountability: Record<string, any> | null) => {
		const schema = await getSchema({ database });
		return new VariantGeneratorService({
			knex: database,
			accountability: accountability as any,
			schema,
			services,
			logger,
		});
	};



	// Hook: Generate variants when family variant axes are created/updated
	action('family_variant_axes.items.create', async ({ key, accountability }) => {
		try {
			logger.info('Family variant axis created, generating variants...');
			const variantService = await getVariantService(accountability);
			
			// Get the family variant ID from the created axis
			const axis = await database('family_variant_axes')
				.where('id', key)
				.first();
			
			if (axis) {
				await variantService.generateVariantsForFamilyVariant(axis.family_variants_id);
			}
		} catch (error) {
			logger.error('Error in family_variant_axes.create hook:', error);
		}
	});

	action('family_variant_axes.items.update', async ({ keys, accountability }) => {
		try {
			logger.info('Family variant axis updated, regenerating variants...');
			const variantService = await getVariantService(accountability);
			
			// Get unique family variant IDs from updated axes
			const axes = await database('family_variant_axes')
				.whereIn('id', keys)
				.select('family_variants_id');
			
			const uniqueFamilyVariantIds = [...new Set(axes.map(a => a.family_variants_id))];
			
			// Regenerate variants for each affected family variant
			for (const familyVariantId of uniqueFamilyVariantIds) {
				await variantService.generateVariantsForFamilyVariant(familyVariantId);
			}
		} catch (error) {
			logger.error('Error in family_variant_axes.update hook:', error);
		}
	});

	action('family_variant_axes.items.delete', async ({ keys, accountability }) => {
		try {
			logger.info('Family variant axis deleted, regenerating variants...');
			const variantService = await getVariantService(accountability);
			
			// Get family variant IDs before deletion
			const axes = await database('family_variant_axes')
				.whereIn('id', keys)
				.select('family_variants_id');
			
			const uniqueFamilyVariantIds = [...new Set(axes.map(a => a.family_variants_id))];
			
			// After deletion, regenerate variants
			setTimeout(async () => {
				for (const familyVariantId of uniqueFamilyVariantIds) {
					await variantService.generateVariantsForFamilyVariant(familyVariantId);
				}
			}, 100);
		} catch (error) {
			logger.error('Error in family_variant_axes.delete hook:', error);
		}
	});

	// Hook: Generate variants when a model product is created with a family variant
	action('products.items.create', async ({ payload, key, accountability }) => {
		try {
			// Check if this is a model product with a family variant
			if (payload.product_type === 'model' && payload.family_variant) {
				logger.info(`Model product ${key} created with family variant ${payload.family_variant}, generating variants...`);
				const variantService = await getVariantService(accountability);
				await variantService.generateVariantsForProduct(key);
			}
		} catch (error) {
			logger.error('Error in products.create hook:', error);
		}
	});

	// Hook: Handle updates to model products
	action('products.items.update', async ({ payload, keys, accountability }) => {
		try {
			const variantService = await getVariantService(accountability);
			
			// Check each updated product
			for (const productId of keys) {
				const product = await database('products')
					.where('id', productId)
					.first();
				
				if (product && product.product_type === 'model') {
					// Check if family_variant was changed
					if (payload.family_variant !== undefined) {
						logger.info(`Model product ${productId} family variant changed, regenerating variants...`);
						
						// Delete old variants if family variant was removed
						if (!payload.family_variant && product.family_variant) {
							const oldVariants = await database('products')
								.where('parent_product_id', productId)
								.where('product_type', 'simple')
								.select('id');
							
							if (oldVariants.length > 0) {
								const { ItemsService } = services;
								const productsService = new ItemsService('products', { 
									accountability,
									schema: await getSchema({ database })
								});
								await productsService.deleteMany(oldVariants.map(v => v.id));
							}
						}
						
						// Generate new variants if family variant is set
						if (payload.family_variant) {
							await variantService.generateVariantsForProduct(productId);
						}
					}
					
					// Check if variant_configuration was changed
					if (payload.variant_configuration !== undefined && product.family_variant) {
						logger.info(`Variant configuration updated for product ${productId}, regenerating variants...`);
						await variantService.generateVariantsForProduct(productId);
					}
				}
			}
		} catch (error) {
			logger.error('Error in products.update hook:', error);
		}
	});

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