import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ filter, action }, { services, database, getSchema }) => {
	const { ItemsService } = services;

	// Hook to process assets after creation or update
	action('assets.items.create', async ({ item, key }, { schema, accountability }) => {
		await processAssetLinking(key, schema, accountability);
	});

	action('assets.items.update', async ({ keys }, { schema, accountability }) => {
		for (const key of keys) {
			await processAssetLinking(key, schema, accountability);
		}
	});

	async function processAssetLinking(assetId: string, schema: any, accountability: any) {
		try {
			// Get the asset with its family
			const assetsService = new ItemsService('assets', { schema, accountability });
			const asset = await assetsService.readOne(assetId, {
				fields: ['id', 'code', 'asset_family_id', 'main_media.filename_download']
			});

			if (!asset || !asset.asset_family_id) {
				return; // Skip if no asset family
			}

			// Get product link rules for this asset family
			const rulesService = new ItemsService('product_link_rules', { schema, accountability });
			const rules = await rulesService.readByQuery({
				filter: {
					asset_family_id: asset.asset_family_id,
					enabled: true
				},
				sort: ['priority']
			});

			if (!rules || rules.length === 0) {
				return; // No rules to process
			}

			// Get products to match against
			const productsService = new ItemsService('products', { schema, accountability });
			
			for (const rule of rules) {
				try {
					// Create regex pattern
					const regex = new RegExp(rule.regex_pattern, 'i');
					
					// Test against asset code and filename
					const testStrings = [asset.code];
					if (asset.main_media?.filename_download) {
						testStrings.push(asset.main_media.filename_download);
					}

					const matches = testStrings.some(str => regex.test(str));
					
					if (matches) {
						// Find products to link to
						let productFilter: any = {};
						
						// Apply additional conditions if specified
						if (rule.conditions && typeof rule.conditions === 'object') {
							productFilter = { ...rule.conditions };
						}

						// If target_attribute is specified, add pattern matching
						if (rule.target_attribute) {
							// This would need to be adapted based on your product attribute structure
							// For now, just match against product UUID or other identifier
							if (rule.target_attribute === 'uuid') {
								productFilter.uuid = { _icontains: asset.code };
							}
						}

						const matchingProducts = await productsService.readByQuery({
							filter: productFilter,
							fields: ['id'],
							limit: 100 // Reasonable limit to prevent performance issues
						});

						// Create product-asset relationships
						const productAssetsService = new ItemsService('product_assets', { schema, accountability });
						
						for (const product of matchingProducts) {
							// Check if relationship already exists
							const existing = await productAssetsService.readByQuery({
								filter: {
									products_id: product.id,
									assets_id: assetId
								},
								limit: 1
							});

							if (existing.length === 0) {
								// Determine collection_attribute based on asset family
								let collectionAttribute = 'images'; // default
								
								// Map asset family to collection attribute
								// This would be based on your asset family codes
								const familyMap: Record<string, string> = {
									'product_images': 'images',
									'product_videos': 'videos',
									'product_documents': 'documents'
								};

								// You'd need to get the asset family code here
								// For now, using a simple mapping
								collectionAttribute = familyMap[asset.asset_family_id] || 'images';

								// Create the relationship
								await productAssetsService.createOne({
									products_id: product.id,
									assets_id: assetId,
									collection_attribute: collectionAttribute,
									sort: 0,
									enabled: true
								});
							}
						}

						// Stop processing rules after first match (optional)
						break;
					}
				} catch (ruleError) {
					console.error(`Error processing rule ${rule.id}:`, ruleError);
					// Continue to next rule
				}
			}
		} catch (error) {
			console.error('Error in asset linking hook:', error);
			// Don't throw to avoid breaking the asset creation/update
		}
	}

	// Hook to update asset completeness after family attribute changes
	action('asset_family_attributes.items.create', async ({ item }, { schema, accountability }) => {
		await recalculateCompletenessForFamily(item.asset_family_id, schema, accountability);
	});

	action('asset_family_attributes.items.update', async ({ keys }, { schema, accountability }) => {
		// Get family IDs for the updated attributes
		const attributesService = new ItemsService('asset_family_attributes', { schema, accountability });
		const attributes = await attributesService.readMany(keys, {
			fields: ['asset_family_id']
		});

		const familyIds = [...new Set(attributes.map((attr: any) => attr.asset_family_id))];
		
		for (const familyId of familyIds) {
			await recalculateCompletenessForFamily(familyId, schema, accountability);
		}
	});

	action('asset_family_attributes.items.delete', async ({ keys }, { schema, accountability }) => {
		// Note: keys here are the deleted attribute IDs, we can't get family IDs
		// In a real implementation, you'd want to trigger recalculation for all families
		// or store the family ID before deletion
	});

	async function recalculateCompletenessForFamily(familyId: string, schema: any, accountability: any) {
		try {
			// Get all assets for this family
			const assetsService = new ItemsService('assets', { schema, accountability });
			const assets = await assetsService.readByQuery({
				filter: {
					asset_family_id: familyId
				},
				fields: ['id']
			});

			// Trigger completeness recalculation by updating each asset
			// This will trigger the database trigger we created
			for (const asset of assets) {
				await assetsService.updateOne(asset.id, {
					date_updated: new Date().toISOString()
				});
			}
		} catch (error) {
			console.error('Error recalculating completeness:', error);
		}
	}
});