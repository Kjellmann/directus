import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint((router, { services, database, getSchema }) => {
	const { ItemsService } = services;

	// Get asset usage statistics
	router.get('/assets/:id/usage', async (req, res) => {
		try {
			const { id } = req.params;
			const schema = await getSchema();

			// Get linked products for this asset
			const productAssetsService = new ItemsService('product_assets', { 
				schema, 
				accountability: req.accountability 
			});

			const linkedProducts = await productAssetsService.readByQuery({
				filter: {
					assets_id: id
				},
				fields: ['products_id', 'collection_attribute', 'role', 'enabled'],
				deep: {
					products_id: {
						_fields: ['id', 'uuid', 'enabled']
					}
				}
			});

			// Get asset details
			const assetsService = new ItemsService('assets', { 
				schema, 
				accountability: req.accountability 
			});

			const asset = await assetsService.readOne(id, {
				fields: ['id', 'code', 'label', 'completeness_percentage', 'enabled'],
				deep: {
					asset_family_id: {
						_fields: ['id', 'name', 'code']
					}
				}
			});

			// Organize usage by collection type
			const usageByCollection: Record<string, any[]> = {};
			let totalLinkedProducts = 0;
			let enabledLinkedProducts = 0;

			for (const link of linkedProducts) {
				const collectionAttr = link.collection_attribute;
				if (!usageByCollection[collectionAttr]) {
					usageByCollection[collectionAttr] = [];
				}
				
				usageByCollection[collectionAttr].push({
					product_id: link.products_id?.id,
					product_uuid: link.products_id?.uuid,
					product_enabled: link.products_id?.enabled,
					role: link.role,
					link_enabled: link.enabled
				});
				
				totalLinkedProducts++;
				if (link.enabled && link.products_id?.enabled) {
					enabledLinkedProducts++;
				}
			}

			res.json({
				asset,
				usage: {
					total_linked_products: totalLinkedProducts,
					enabled_linked_products: enabledLinkedProducts,
					usage_by_collection: usageByCollection,
					linked_products: linkedProducts
				}
			});
		} catch (error) {
			console.error('Error getting asset usage:', error);
			res.status(500).json({ error: 'Failed to get asset usage' });
		}
	});

	// Bulk update asset completeness
	router.post('/assets/recalculate-completeness', async (req, res) => {
		try {
			const { asset_family_id } = req.body;
			const schema = await getSchema();

			let filter: any = {};
			if (asset_family_id) {
				filter.asset_family_id = asset_family_id;
			}

			const assetsService = new ItemsService('assets', { 
				schema, 
				accountability: req.accountability 
			});

			const assets = await assetsService.readByQuery({
				filter,
				fields: ['id']
			});

			// Trigger completeness recalculation for each asset
			// This will trigger our database trigger
			let updated = 0;
			for (const asset of assets) {
				await assetsService.updateOne(asset.id, {
					date_updated: new Date().toISOString()
				});
				updated++;
			}

			res.json({
				message: `Recalculated completeness for ${updated} assets`,
				updated_count: updated
			});
		} catch (error) {
			console.error('Error recalculating completeness:', error);
			res.status(500).json({ error: 'Failed to recalculate completeness' });
		}
	});

	// Execute product linking rules
	router.post('/assets/:id/execute-linking-rules', async (req, res) => {
		try {
			const { id } = req.params;
			const schema = await getSchema();

			// Get the asset
			const assetsService = new ItemsService('assets', { 
				schema, 
				accountability: req.accountability 
			});

			const asset = await assetsService.readOne(id, {
				fields: ['id', 'code', 'asset_family_id'],
				deep: {
					main_media: {
						_fields: ['filename_download']
					}
				}
			});

			if (!asset || !asset.asset_family_id) {
				return res.status(400).json({ error: 'Asset or asset family not found' });
			}

			// Get linking rules for this asset family
			const rulesService = new ItemsService('product_link_rules', { 
				schema, 
				accountability: req.accountability 
			});

			const rules = await rulesService.readByQuery({
				filter: {
					asset_family_id: asset.asset_family_id,
					enabled: true
				},
				sort: ['priority']
			});

			let linkedProducts = 0;
			const results = [];

			for (const rule of rules) {
				try {
					const regex = new RegExp(rule.regex_pattern, 'i');
					const testStrings = [asset.code];
					
					if (asset.main_media?.filename_download) {
						testStrings.push(asset.main_media.filename_download);
					}

					const matches = testStrings.some(str => regex.test(str));

					if (matches) {
						// Find matching products
						const productsService = new ItemsService('products', { 
							schema, 
							accountability: req.accountability 
						});

						let productFilter: any = {};
						if (rule.conditions) {
							productFilter = { ...rule.conditions };
						}

						// For demonstration, match products with similar codes
						if (rule.target_attribute === 'uuid') {
							// Extract pattern from asset code for matching
							const match = asset.code.match(/(\d+)/);
							if (match) {
								productFilter.uuid = { _icontains: match[1] };
							}
						}

						const matchingProducts = await productsService.readByQuery({
							filter: productFilter,
							fields: ['id', 'uuid'],
							limit: 10
						});

						// Create relationships
						const productAssetsService = new ItemsService('product_assets', { 
							schema, 
							accountability: req.accountability 
						});

						for (const product of matchingProducts) {
							// Check if relationship already exists
							const existing = await productAssetsService.readByQuery({
								filter: {
									products_id: product.id,
									assets_id: id
								},
								limit: 1
							});

							if (existing.length === 0) {
								// Determine collection attribute
								let collectionAttribute = 'images';
								if (rule.regex_pattern.includes('VID')) {
									collectionAttribute = 'videos';
								} else if (rule.regex_pattern.includes('DOC|SPEC|MANUAL')) {
									collectionAttribute = 'documents';
								}

								await productAssetsService.createOne({
									products_id: product.id,
									assets_id: id,
									collection_attribute: collectionAttribute,
									sort: 0,
									enabled: true
								});

								linkedProducts++;
							}
						}

						results.push({
							rule_name: rule.name,
							pattern: rule.regex_pattern,
							matched: matches,
							products_found: matchingProducts.length,
							new_links_created: matchingProducts.length - linkedProducts
						});
					}
				} catch (ruleError) {
					results.push({
						rule_name: rule.name,
						pattern: rule.regex_pattern,
						error: ruleError.message
					});
				}
			}

			res.json({
				message: `Executed linking rules for asset ${asset.code}`,
				asset_id: id,
				rules_processed: rules.length,
				total_links_created: linkedProducts,
				results
			});
		} catch (error) {
			console.error('Error executing linking rules:', error);
			res.status(500).json({ error: 'Failed to execute linking rules' });
		}
	});

	// Get asset family statistics
	router.get('/asset-families/:id/stats', async (req, res) => {
		try {
			const { id } = req.params;
			const schema = await getSchema();

			// Get family details
			const familiesService = new ItemsService('asset_families', { 
				schema, 
				accountability: req.accountability 
			});

			const family = await familiesService.readOne(id, {
				fields: ['id', 'code', 'name', 'description']
			});

			// Get asset count by completeness
			const result = await database.raw(`
				SELECT 
					COUNT(*) as total_assets,
					COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_assets,
					COUNT(CASE WHEN completeness_percentage >= 80 THEN 1 END) as complete_assets,
					COUNT(CASE WHEN completeness_percentage >= 50 AND completeness_percentage < 80 THEN 1 END) as partial_assets,
					COUNT(CASE WHEN completeness_percentage < 50 THEN 1 END) as incomplete_assets,
					AVG(completeness_percentage) as avg_completeness
				FROM assets 
				WHERE asset_family_id = ?
			`, [id]);

			// Get attribute count
			const attributesService = new ItemsService('asset_family_attributes', { 
				schema, 
				accountability: req.accountability 
			});

			const attributes = await attributesService.readByQuery({
				filter: {
					asset_family_id: id
				},
				fields: ['id', 'attribute_code', 'required']
			});

			const stats = result.rows[0];
			
			res.json({
				family,
				statistics: {
					total_assets: parseInt(stats.total_assets),
					enabled_assets: parseInt(stats.enabled_assets),
					complete_assets: parseInt(stats.complete_assets),
					partial_assets: parseInt(stats.partial_assets),
					incomplete_assets: parseInt(stats.incomplete_assets),
					average_completeness: parseFloat(stats.avg_completeness) || 0,
					total_attributes: attributes.length,
					required_attributes: attributes.filter((attr: any) => attr.required).length
				},
				attributes
			});
		} catch (error) {
			console.error('Error getting family stats:', error);
			res.status(500).json({ error: 'Failed to get family statistics' });
		}
	});
});