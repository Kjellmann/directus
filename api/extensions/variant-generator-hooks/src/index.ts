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


	// Hook: Generate variants when product variant selections are created/updated/deleted
	action('product_variant_selections.items.create', async ({ payload, key, accountability }) => {
		try {
			if (!payload.product_id) {
				logger.warn('Product variant selection created without product_id');
				return;
			}

			logger.info(`Product variant selection created for product ${payload.product_id}, regenerating variants...`);
			const variantService = await getVariantService(accountability);
			await variantService.generateVariantsForProduct(payload.product_id);
		} catch (error) {
			logger.error('Error in product_variant_selections.create hook:', error);
		}
	});

	action('product_variant_selections.items.update', async ({ payload, keys, accountability }) => {
		try {
			// Get the affected product IDs
			const selections = await database('product_variant_selections')
				.whereIn('id', keys)
				.select('product_id');

			const uniqueProductIds = [...new Set(selections.map(s => s.product_id))];

			for (const productId of uniqueProductIds) {
				logger.info(`Product variant selection updated for product ${productId}, regenerating variants...`);
				const variantService = await getVariantService(accountability);
				await variantService.generateVariantsForProduct(productId);
			}
		} catch (error) {
			logger.error('Error in product_variant_selections.update hook:', error);
		}
	});

	action('product_variant_selections.items.delete', async ({ keys, accountability }) => {
		try {
			// Get product IDs before deletion
			const selections = await database('product_variant_selections')
				.whereIn('id', keys)
				.select('product_id');

			const uniqueProductIds = [...new Set(selections.map(s => s.product_id))];

			// Delay regeneration to ensure deletion is complete
			setTimeout(async () => {
				for (const productId of uniqueProductIds) {
					logger.info(`Product variant selection deleted for product ${productId}, regenerating variants...`);
					const variantService = await getVariantService(accountability);
					await variantService.generateVariantsForProduct(productId);
				}
			}, 100);
		} catch (error) {
			logger.error('Error in product_variant_selections.delete hook:', error);
		}
	});

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
				
				// Delete product variant selections if table exists
				try {
					const deletedSelections = await database('product_variant_selections')
						.where('product_id', productId)
						.delete();
					
					if (deletedSelections > 0) {
						logger.info(`Deleted ${deletedSelections} variant selections for product ${productId}`);
					}
				} catch (error) {
					logger.debug('product_variant_selections table might not exist');
				}
			}
			
			logger.info(`Cleanup completed for ${keys.length} products`);
		} catch (error) {
			logger.error('Error cleaning up related data before product deletion:', error);
			throw error; // Re-throw to prevent deletion if cleanup fails
		}
		
		return keys;
	});

	// Hook: Handle attribute option changes that might affect variants
	action('attribute_options.items.create', async ({ payload, accountability }) => {
		try {
			if (!payload.attribute_id) return;

			// Find products that use this attribute in their variant selections
			const affectedSelections = await database('product_variant_selections')
				.where('attribute_id', payload.attribute_id)
				.select('product_id')
				.distinct();

			if (affectedSelections.length > 0) {
				logger.info(`New attribute option created, checking variant regeneration for ${affectedSelections.length} products...`);
				const variantService = await getVariantService(accountability);
				
				for (const selection of affectedSelections) {
					await variantService.generateVariantsForProduct(selection.product_id);
				}
			}
		} catch (error) {
			logger.error('Error in attribute_options.create hook:', error);
		}
	});

	action('attribute_options.items.update', async ({ keys, accountability }) => {
		try {
			// Get attribute IDs for updated options
			const options = await database('attribute_options')
				.whereIn('id', keys)
				.select('attribute_id');
			
			const uniqueAttributeIds = [...new Set(options.map(o => o.attribute_id))];
			
			// Find affected products
			const affectedSelections = await database('product_variant_selections')
				.whereIn('attribute_id', uniqueAttributeIds)
				.select('product_id')
				.distinct();
			
			if (affectedSelections.length > 0) {
				logger.info(`Attribute options updated, regenerating variants for affected products...`);
				const variantService = await getVariantService(accountability);
				
				for (const selection of affectedSelections) {
					await variantService.generateVariantsForProduct(selection.product_id);
				}
			}
		} catch (error) {
			logger.error('Error in attribute_options.update hook:', error);
		}
	});

	action('attribute_options.items.delete', async ({ keys, accountability }) => {
		try {
			// Get the attribute IDs before deletion
			const options = await database('attribute_options')
				.whereIn('id', keys)
				.select('attribute_id');
			
			const uniqueAttributeIds = [...new Set(options.map(o => o.attribute_id))];
			
			// Find affected products
			const affectedSelections = await database('product_variant_selections')
				.whereIn('attribute_id', uniqueAttributeIds)
				.select('product_id')
				.distinct();
			
			if (affectedSelections.length > 0) {
				logger.info(`Attribute options deleted, regenerating variants for affected products...`);
				
				// Delay regeneration to ensure deletion is complete
				setTimeout(async () => {
					const variantService = await getVariantService(accountability);
					
					for (const selection of affectedSelections) {
						await variantService.generateVariantsForProduct(selection.product_id);
					}
				}, 100);
			}
		} catch (error) {
			logger.error('Error in attribute_options.delete hook:', error);
		}
	});
};

export default registerHook;