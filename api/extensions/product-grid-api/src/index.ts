import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint({
	id: 'product-grid',
	handler: (router, context) => {
		const { services, getSchema, logger, database } = context;
		const { ItemsService } = services;

		// Debug endpoint to check attribute values
		router.get('/products/debug-attribute', async (req, res) => {
			try {
				const schema = await getSchema();
				const accountability = req.accountability;
				const { attribute_code, limit = 10 } = req.query;

				if (!attribute_code) {
					return res.status(400).json({ error: 'attribute_code is required' });
				}

				// Get the attribute with all fields
				const attributesService = new ItemsService('attributes', { schema, accountability });
				const attributes = await attributesService.readByQuery({
					filter: { code: { _eq: attribute_code } },
					fields: ['*', 'type.*'],
					limit: 1,
				});

				if (!attributes || attributes.length === 0) {
					return res.json({ error: 'Attribute not found' });
				}

				const attribute = attributes[0];

				// Get sample values
				const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
				const samples = await productAttributesService.readByQuery({
					filter: { attribute_id: { _eq: attribute.id } },
					fields: ['product_id', 'value'],
					limit: Number(limit),
				});

				res.json({
					attribute: {
						id: attribute.id,
						code: attribute.code,
						label: attribute.label,
						usable_in_filter: attribute.usable_in_filter,
						usable_in_grid: attribute.usable_in_grid,
						usable_in_search: attribute.usable_in_search,
						type: attribute.type,
						reference_collection: attribute.reference_collection
					},
					samples: samples.map((s) => ({
						product_id: s.product_id,
						raw_value: s.value,
						parsed: (() => {
							try {
								return JSON.parse(s.value);
							} catch {
								return s.value;
							}
						})(),
					})),
				});
			} catch (error) {
				logger.error('Debug error:', error);
				res.status(500).json({ error: error.message });
			}
		});

		// Filter options endpoint - MUST BE BEFORE /products
		router.get('/products/filters', async (req, res) => {
			try {
				const schema = await getSchema();
				const accountability = req.accountability;
				const { attribute_code } = req.query;

				if (!attribute_code) {
					return res.status(400).json({ error: 'attribute_code is required' });
				}

				// Get the attribute
				const attributesService = new ItemsService('attributes', { schema, accountability });
				const attributes = await attributesService.readByQuery({
					filter: {
						code: { _eq: attribute_code },
						usable_in_filter: { _eq: true },
					},
					fields: ['id', 'code', 'label', 'type', 'reference_collection'],
					limit: 1,
				});

				if (!attributes || attributes.length === 0) {
					return res.json({ data: [] });
				}

				const attribute = attributes[0];

				// Get attribute type info
				const attributeTypesService = new ItemsService('attribute_types', { schema, accountability });
				const types = await attributeTypesService.readByQuery({
					filter: { id: { _eq: attribute.type } },
					fields: ['input_interface'],
					limit: 1,
				});

				const attributeType = types[0];
				const inputInterface = attributeType?.input_interface;

				// Check if this is a reference entity type
				if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple') {
					// For reference entities, we need to fetch the actual options from a reference collection
					// For now, we'll try common patterns like a collection named after the attribute code
					let referenceData = [];

					try {
						logger.info(`Fetching reference collection for ${attribute.code}: ${attribute.reference_collection}`);
						// Try to fetch from a collection with the attribute code name (e.g., "colors" for "color" attribute)
						let collectionName = attribute.reference_collection;

						if (!collectionName) {
							throw new Error(`No reference collection defined for attribute ${attribute.code}`);
						}

						const referenceService = new ItemsService(collectionName, { schema, accountability });

						referenceData = await referenceService.readByQuery({
							fields: ['*'],
							limit: -1,
						});

						console.log('referenceData', referenceData);
					} catch (error) {
						logger.warn(`Could not fetch reference collection for ${attribute.code}:`, error.message);

						referenceData = [];
					}

					// Sort reference data by label
					referenceData.sort((a, b) => {
						const labelA = a.label || a.code || a.id;
						const labelB = b.label || b.code || b.id;
						return String(labelA).localeCompare(String(labelB), undefined, { numeric: true, sensitivity: 'base' });
					});

					// Transform reference data to value/text format for consistency
					const transformedData = referenceData.map(item => ({
						value: item.code || item.id,
						text: item.label || item.code || item.id
					}));

					res.json({
						data: transformedData,
						attribute: {
							id: attribute.id,
							code: attribute.code,
							label: attribute.label,
							type: attribute.type,
							input_interface: inputInterface,
						},
					});
				} else if (inputInterface === 'simple_select' || inputInterface === 'multi_select') {
					// For select types, get the defined options from attribute_options table
					const optionsService = new ItemsService('attribute_options', { schema, accountability });
					const options = await optionsService.readByQuery({
						filter: { attribute_id: { _eq: attribute.id } },
						fields: ['code', 'label'],
						sort: ['sort', 'label'],
						limit: -1,
					});

					// Get unique values actually used in products
					const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
					const values = await productAttributesService.readByQuery({
						filter: { attribute_id: { _eq: attribute.id } },
						fields: ['value'],
						limit: -1,
					});

					// Extract unique used values
					const usedValues = new Set();
					values.forEach((v) => {
						if (v.value) {
							try {
								const parsed = JSON.parse(v.value);
								const actualValue = parsed?.value ?? parsed;
								if (actualValue !== null && actualValue !== '') {
									usedValues.add(actualValue);
								}
							} catch {
								if (v.value !== null && v.value !== '') {
									usedValues.add(v.value);
								}
							}
						}
					});

					// Filter options to only include those that are actually used
					// and format them with code and label
					const filteredOptions = options
						.filter(opt => usedValues.has(opt.code))
						.map(opt => ({
							value: opt.code,
							text: opt.label || opt.code
						}));

					res.json({
						data: filteredOptions,
						attribute: {
							id: attribute.id,
							code: attribute.code,
							label: attribute.label,
							type: attribute.type,
							input_interface: inputInterface,
						},
					});
				} else {
					// For other non-reference entity types, get unique values from products
					const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
					const values = await productAttributesService.readByQuery({
						filter: { attribute_id: { _eq: attribute.id } },
						fields: ['value'],
						limit: -1,
					});

					// Extract unique values
					const uniqueValues = new Set();
					values.forEach((v) => {
						if (v.value) {
							try {
								const parsed = JSON.parse(v.value);
								const actualValue = parsed?.value ?? parsed;
								if (actualValue !== null && actualValue !== '') {
									uniqueValues.add(actualValue);
								}
							} catch {
								if (v.value !== null && v.value !== '') {
									uniqueValues.add(v.value);
								}
							}
						}
					});

					// Sort values appropriately
					const sortedValues = Array.from(uniqueValues).sort((a, b) => {
						// Try numeric sort first
						const aNum = Number(a);
						const bNum = Number(b);
						if (!isNaN(aNum) && !isNaN(bNum)) {
							return aNum - bNum;
						}
						// Fall back to string sort
						return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
					});

					res.json({
						data: sortedValues,
						attribute: {
							id: attribute.id,
							code: attribute.code,
							label: attribute.label,
							type: attribute.type,
							input_interface: inputInterface,
						},
					});
				}
			} catch (error) {
				logger.error('Filter options error:', error);
				res.status(500).json({
					error: 'Failed to load filter options',
					message: error.message,
				});
			}
		});

		// Export endpoint
		router.get('/products/export', async (req, res) => {
			try {
				const schema = await getSchema();
				const accountability = req.accountability;
				const { format = 'csv', include_attributes = true } = req.query;

				// Get all products
				const productsService = new ItemsService('products', { schema, accountability });
				const products = await productsService.readByQuery({ limit: -1 });

				if (include_attributes === 'true') {
					// Get all grid-enabled attributes
					const attributesService = new ItemsService('attributes', { schema, accountability });
					const attributes = await attributesService.readByQuery({
						filter: { usable_in_grid: true },
						fields: ['id', 'code', 'label'],
						limit: -1,
					});

					// Get all attribute values
					const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
					const values = await productAttributesService.readByQuery({
						filter: {
							product_id: { _in: products.map((p) => p.id) },
							attribute_id: { _in: attributes.map((a) => a.id) },
						},
						fields: ['product_id', 'attribute_id', 'value'],
						limit: -1,
					});

					// Build value map
					const valueMap = new Map();
					values.forEach((v) => {
						const key = `${v.product_id}_${v.attribute_id}`;
						try {
							const parsed = JSON.parse(v.value);
							valueMap.set(key, parsed?.value ?? parsed);
						} catch {
							valueMap.set(key, v.value);
						}
					});

					// Add attribute values to products
					products.forEach((product) => {
						attributes.forEach((attr) => {
							const key = `${product.id}_${attr.id}`;
							product[`attr_${attr.code}`] = valueMap.get(key) ?? null;
						});
					});
				}

				if (format === 'csv') {
					// Convert to CSV
					const fields = Object.keys(products[0] || {});

					// Create header row with cleaned field names (remove attr_ prefix)
					const headerRow = fields
						.map((f) => {
							if (f.startsWith('attr_')) {
								return f.substring(5); // Remove 'attr_' prefix for display
							}
							return f;
						})
						.join(',');

					const csv = [
						headerRow,
						...products.map((p) =>
							fields
								.map((f) => {
									const val = p[f];
									if (val === null) return '';
									if (typeof val === 'string' && val.includes(',')) {
										return `"${val.replace(/"/g, '""')}"`;
									}
									return val;
								})
								.join(','),
						),
					].join('\n');

					res.setHeader('Content-Type', 'text/csv');
					res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
					res.send(csv);
				} else {
					res.json({ data: products });
				}
			} catch (error) {
				logger.error('Export error:', error);
				res.status(500).json({ error: 'Export failed' });
			}
		});

		// Import endpoint
		router.post('/products/import', async (req, res) => {
			try {
				const schema = await getSchema();
				const accountability = req.accountability;
				const { data, mapping } = req.body;

				if (!data || !Array.isArray(data)) {
					return res.status(400).json({ error: 'Invalid data format' });
				}

				// Get all attributes to map codes to IDs
				const attributesService = new ItemsService('attributes', { schema, accountability });
				const attributes = await attributesService.readByQuery({
					fields: ['id', 'code'],
					limit: -1,
				});

				const codeToAttrId = new Map(attributes.map((a) => [a.code, a.id]));

				// Process each row
				const productsService = new ItemsService('products', { schema, accountability });
				const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
				const results = [];

				for (const row of data) {
					try {
						// Separate product fields from attribute fields
						const productData = {};
						const attributeData = {};

						for (const [key, value] of Object.entries(row)) {
							// Check if this is an attribute field (either has attr_ prefix or is in attributes list)
							if (key.startsWith('attr_')) {
								const code = key.substring(5);
								if (codeToAttrId.has(code)) {
									attributeData[code] = value;
								}
							} else if (codeToAttrId.has(key)) {
								// Handle attribute fields without prefix (from cleaned CSV)
								attributeData[key] = value;
							} else {
								// Standard product field
								productData[key] = value;
							}
						}

						// Create or update product
						let productId;
						if (productData.id) {
							// Update existing product
							await productsService.updateOne(productData.id, productData);
							productId = productData.id;
						} else {
							// Create new product
							const created = await productsService.createOne(productData);
							productId = created.id;
						}

						// Update attribute values
						for (const [code, value] of Object.entries(attributeData)) {
							const attrId = codeToAttrId.get(code);
							if (!attrId) continue;

							// Check if attribute value exists
							const existing = await productAttributesService.readByQuery({
								filter: {
									product_id: { _eq: productId },
									attribute_id: { _eq: attrId },
								},
								limit: 1,
							});

							const attrValue = value !== null && value !== '' ? JSON.stringify({ value }) : null;

							if (existing && existing.length > 0) {
								// Update existing
								await productAttributesService.updateOne(existing[0].id, { value: attrValue });
							} else if (attrValue !== null) {
								// Create new
								await productAttributesService.createOne({
									product_id: productId,
									attribute_id: attrId,
									value: attrValue,
								});
							}
						}

						results.push({ success: true, id: productId });
					} catch (error) {
						results.push({ success: false, error: error.message });
					}
				}

				res.json({
					message: 'Import completed',
					total: data.length,
					successful: results.filter((r) => r.success).length,
					failed: results.filter((r) => !r.success).length,
					results,
				});
			} catch (error) {
				logger.error('Import error:', error);
				res.status(500).json({ error: 'Import failed', message: error.message });
			}
		});

		// Enhanced products endpoint with attribute filtering/sorting - MUST BE LAST
		router.get('/products', async (req, res) => {
			try {
				// Get schema for database operations
				const schema = await getSchema();
				const accountability = req.accountability;

				const { limit = 25, page = 1, sort, search, filter, attribute_filters } = req.query;

				logger.info('Product grid request:', {
					limit,
					page,
					sort,
					search,
					filter,
					attribute_filters,
				});

				// Calculate offset from page
				const offset = (Number(page) - 1) * Number(limit);

				// Parse filter if it's a string
				const parsedFilter = filter && typeof filter === 'string' ? JSON.parse(filter) : filter || {};

				// Parse attribute filters
				const parsedAttributeFilters =
					attribute_filters && typeof attribute_filters === 'string'
						? JSON.parse(attribute_filters)
						: attribute_filters || {};

				logger.info('Parsed filter (system fields):', JSON.stringify(parsedFilter));
				logger.info('Parsed attribute filters:', JSON.stringify(parsedAttributeFilters));

				// Create products service
				const productsService = new ItemsService('products', { schema, accountability });

				// Parse sort field
				let sortField = sort ? String(sort) : '-date_created';
				let sortDirection = sortField.startsWith('-') ? 'DESC' : 'ASC';
				if (sortField.startsWith('-')) {
					sortField = sortField.substring(1);
				}

				// Check if sorting by an attribute field
				const isAttributeSort = sortField.startsWith('attr_');
				const attributeCode = isAttributeSort ? sortField.substring(5) : null;

				// Apply attribute filters if any
				let finalFilter = { ...parsedFilter };
				if (Object.keys(parsedAttributeFilters).length > 0) {
					// Get filterable attributes
					const attributesService = new ItemsService('attributes', { schema, accountability });
					const filterableAttributes = await attributesService.readByQuery({
						filter: {
							usable_in_filter: { _eq: true }
						},
						fields: ['id', 'code', 'label', 'type'],
						limit: -1,
					});

					// Build attribute filter conditions
					const attributeFilterConditions = [];

					for (const [field, condition] of Object.entries(parsedAttributeFilters)) {
						// Handle both with and without attr_ prefix
						const attrCode = field.startsWith('attr_') ? field.substring(5) : field;
						logger.info(`Looking for attribute with code: ${attrCode}`);
						logger.info(`Available filterable attributes:`, filterableAttributes.map((a: any) => ({ id: a.id, code: a.code })));
						const attribute = filterableAttributes.find((a: any) => a.code === attrCode);

						if (attribute) {
							logger.info(
								`Processing filter for attribute ${attrCode} (ID: ${attribute.id}):`,
								JSON.stringify(condition),
							);

							// Get products that match this attribute filter
							const productIds = await getProductIdsByAttributeFilter(attribute.id, condition, {
								services,
								database,
								logger,
								schema,
								accountability,
							});

							logger.info(`Found ${productIds.length} products matching attribute filter for ${attrCode}`);

							if (productIds.length > 0) {
								attributeFilterConditions.push({
									id: { _in: productIds },
								});
							} else {
								// No products match this filter - return empty result
								attributeFilterConditions.push({
									id: { _in: [] },
								});
							}
						} else {
							logger.warn(`Attribute ${attrCode} not found in filterable attributes`);
						}
					}

					// Merge with existing filters using _and
					if (attributeFilterConditions.length > 0) {
						finalFilter = {
							_and: [...(finalFilter._and || []), finalFilter, ...attributeFilterConditions],
						};
						delete finalFilter._and[1]._and; // Clean up nested _and
					}
				}

				// Build query - always get all data if we need attribute sorting later
				let products;
				let total;
				let needsAttributeSort = isAttributeSort;

				const query = {
					limit: needsAttributeSort ? -1 : Number(limit),
					offset: needsAttributeSort ? 0 : offset,
					sort: needsAttributeSort ? ['-date_created'] : sort ? [sort] : ['-date_created'],
					filter: finalFilter,
					search: search ? String(search) : undefined,
					fields: ['*'],
				};

				logger.info('Products query:', JSON.stringify(query));

				// Get products
				products = await productsService.readByQuery(query);

				logger.info(`Products found: ${products.length}`);

				// Get total count
				if (needsAttributeSort) {
					// We'll count after filtering
					total = 0; // Will be set later
				} else {
					const aggregateResult = await productsService.readByQuery({
						aggregate: { count: ['*'] },
						filter: finalFilter,
						search: search ? String(search) : undefined,
					});

					total = aggregateResult?.[0]?.count || 0;
				}

				// Get product assets if products found
				if (products.length > 0) {
					try {
						// Create services for related data
						const productAssetsService = new ItemsService('product_assets', { schema, accountability });
						const assetsService = new ItemsService('assets', { schema, accountability });
						const filesService = new ItemsService('directus_files', { schema, accountability });

						// Get product assets for these products
						const productAssets = await productAssetsService.readByQuery({
							filter: {
								products_id: { _in: products.map((p) => p.id) },
							},
							fields: ['*', 'assets_id.*', 'assets_id.media_file'],
							sort: ['sort'],
							limit: -1,
						});

						logger.info(`Found product assets: ${productAssets.length}`);

						// Log structure of first asset to understand the data
						if (productAssets.length > 0) {
							logger.info('First asset structure:', JSON.stringify(productAssets[0], null, 2));
						}

						// Group assets by product
						const assetMap = new Map();
						productAssets.forEach((pa) => {
							if (!assetMap.has(pa.products_id)) {
								assetMap.set(pa.products_id, []);
							}
							assetMap.get(pa.products_id).push(pa);
						});

						// Add assets to products and set primary image directly
						products.forEach((product, index) => {
							const assets = assetMap.get(product.id) || [];
							product.product_assets = assets;

							// Find first asset with media file
							// The assets_id is already expanded and contains media_file as a string ID
							const imageAsset = assets.find((pa) => pa.assets_id?.media_file);

							if (imageAsset?.assets_id?.media_file) {
								// media_file is already the file ID we need
								product.primary_image = imageAsset.assets_id.media_file;
							} else {
								product.primary_image = null;
							}
						});

						// Get attributes that should be included in the grid
						const attributesService = new ItemsService('attributes', { schema, accountability });
						const attributes = await attributesService.readByQuery({
							filter: { 
								_or: [
									{ usable_in_search: { _eq: true } },
									{ usable_in_grid: { _eq: true } },
									{ usable_in_filter: { _eq: true } }
								]
							},
							fields: ['id', 'code', 'label'],
							limit: -1,
						});

						logger.info(`Found grid/search/filter attributes: ${attributes.length}`);

						if (attributes.length > 0) {
							// Get attribute values
							const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
							const attrValues = await productAttributesService.readByQuery({
								filter: {
									product_id: { _in: products.map((p) => p.id) },
									attribute_id: { _in: attributes.map((a) => a.id) },
								},
								fields: ['product_id', 'attribute_id', 'value'],
								limit: -1,
							});

							logger.info(`Found attribute values: ${attrValues.length}`);
							if (attrValues.length > 0 && attrValues.length < 10) {
								logger.info('Sample attribute value:', JSON.stringify(attrValues[0]));
							}

							// Build value map
							const valueMap = new Map();
							attrValues.forEach((v) => {
								const key = `${v.product_id}_${v.attribute_id}`;
								try {
									const parsed = JSON.parse(v.value);
									valueMap.set(key, parsed?.value ?? parsed);
								} catch {
									valueMap.set(key, v.value);
								}
							});

							// Add attribute values to products
							products.forEach((product, index) => {
								attributes.forEach((attr) => {
									const key = `${product.id}_${attr.id}`;
									const value = valueMap.get(key);
									product[`attr_${attr.code}`] = value ?? null;
								});

								// Debug product with SKU 10000132
								if (product[`attr_sku`] === 10000132 || product[`attr_sku`] === '10000132') {
									logger.info(`Found product SKU 10000132: ID=${product.id}, primary_image=${product.primary_image}`);
									if (product.product_assets && product.product_assets.length > 0) {
										logger.info(`SKU 10000132 assets: ${JSON.stringify(product.product_assets)}`);
									}
								}
							});
						}
					} catch (error) {
						logger.warn('Failed to load related data:', error);
						// Continue without assets
						products.forEach((product) => {
							product.product_assets = [];
							product.primary_image = null;
						});
					}
				}

				// Handle attribute sorting if needed
				if (needsAttributeSort && attributeCode) {
					logger.info(`Sorting by attribute: ${attributeCode} ${sortDirection}`);

					// Sort products by the specific attribute value
					products.sort((a, b) => {
						const aVal = a[`attr_${attributeCode}`];
						const bVal = b[`attr_${attributeCode}`];

						// Handle null/undefined values - put them last for ASC, first for DESC
						if (aVal === null || aVal === undefined) return sortDirection === 'ASC' ? 1 : -1;
						if (bVal === null || bVal === undefined) return sortDirection === 'ASC' ? -1 : 1;

						// Try to parse as numbers first (for SKUs like "10000101" or numeric values)
						const aNum = Number(aVal);
						const bNum = Number(bVal);

						if (!isNaN(aNum) && !isNaN(bNum)) {
							// Both are valid numbers
							return sortDirection === 'ASC' ? aNum - bNum : bNum - aNum;
						}

						// Fall back to string comparison
						const aStr = String(aVal).toLowerCase();
						const bStr = String(bVal).toLowerCase();

						// Use natural sort for alphanumeric strings (e.g., "M10000115" vs "10000101")
						return sortDirection === 'ASC'
							? aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' })
							: bStr.localeCompare(aStr, undefined, { numeric: true, sensitivity: 'base' });
					});

					// Get total after sorting (before pagination)
					total = products.length;

					// Apply pagination
					const start = (Number(page) - 1) * Number(limit);
					products = products.slice(start, start + Number(limit));

					logger.info(`Applied attribute sorting and pagination: showing ${products.length} of ${total} products`);
				}

				res.json({
					data: products,
					meta: {
						total_count: Number(total),
					},
				});
			} catch (error) {
				logger.error('Product grid error:', error);
				res.status(500).json({
					error: 'Failed to load products',
					message: error.message,
				});
			}
		});
	},
});

// Helper function for attribute filtering
async function getProductIdsByAttributeFilter(
	attributeId,
	condition,
	{ services, database, logger, schema, accountability },
) {
	try {
		logger.info(`getProductIdsByAttributeFilter called with:`, {
			attributeId,
			condition: JSON.stringify(condition),
		});

		const { ItemsService } = services;
		const productAttributesService = new ItemsService('product_attributes', { schema, accountability });

		// Get attribute info to understand the type
		const attributesService = new ItemsService('attributes', { schema, accountability });
		const attributes = await attributesService.readByQuery({
			filter: { id: { _eq: attributeId } },
			fields: ['id', 'code', 'type'],
			limit: 1,
		});

		const attribute = attributes[0];
		if (!attribute) {
			logger.warn(`Attribute ${attributeId} not found`);
			return [];
		}

		// Get attribute type info
		const attributeTypesService = new ItemsService('attribute_types', { schema, accountability });
		const types = await attributeTypesService.readByQuery({
			filter: { id: { _eq: attribute.type } },
			fields: ['input_interface'],
			limit: 1,
		});

		const attributeType = types[0];
		const inputInterface = attributeType?.input_interface;

		// Complex conditions with _and
		if (condition._and) {
			// Handle range filters (e.g., price between X and Y)
			const productIds = await handleComplexCondition(condition._and, attributeId, inputInterface, {
				productAttributesService,
				logger,
			});
			return productIds;
		}

		// Build filter for attribute values
		let valueFilter = { attribute_id: { _eq: attributeId } };

		// Handle different operators
		logger.info(`Processing condition for attribute ${attributeId}:`, JSON.stringify(condition));
		for (const [operator, value] of Object.entries(condition)) {
			logger.info(`Handling operator ${operator} with value:`, value);
			logger.info(`Value type: ${typeof value}, isArray: ${Array.isArray(value)}`);
			
			// For reference entities and select fields with simple operators, use raw SQL to avoid JSON field restrictions
			if ((inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple' ||
			     inputInterface === 'simple_select' || inputInterface === 'multi_select') &&
			    ['_eq', '_neq', '_in', '_nin'].includes(operator)) {
				logger.info(`Using raw SQL for ${inputInterface} filter`);
				const knex = database;
				let query = knex('product_attributes')
					.select('product_id')
					.where('attribute_id', attributeId);
				
				switch (operator) {
					case '_eq':
						// For JSON fields, we need to cast to text
						query = query.whereRaw('value::text = ?', [JSON.stringify(String(value))]);
						break;
					case '_neq':
						query = query.whereRaw('value::text != ?', [JSON.stringify(String(value))]);
						break;
					case '_in':
						const inValues = value.map((v: any) => JSON.stringify(String(v)));
						query = query.whereRaw('value::text IN (' + inValues.map(() => '?').join(',') + ')', inValues);
						break;
					case '_nin':
						const ninValues = value.map((v: any) => JSON.stringify(String(v)));
						query = query.whereRaw('value::text NOT IN (' + ninValues.map(() => '?').join(',') + ')', ninValues);
						break;
				}
				
				try {
					logger.info(`Executing query: ${query.toString()}`);
					const results = await query;
					logger.info(`Raw SQL query found ${results.length} matches`);
					if (results.length > 0) {
						logger.info(`Sample results:`, results.slice(0, 3));
					}
					return results.map((r: any) => r.product_id);
				} catch (sqlError) {
					logger.error(`SQL query error:`, JSON.stringify(sqlError, Object.getOwnPropertyNames(sqlError)));
					logger.error(`Query was: ${query.toString()}`);
					throw sqlError;
				}
			}
			
			switch (operator) {
			case '_eq':
				// Exact match - need to check JSON value
				if (typeof value === 'boolean') {
					// Boolean values
					valueFilter['_or'] = [{ value: { _eq: JSON.stringify({ value }) } }, { value: { _eq: String(value) } }];
				} else if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple' ||
				           inputInterface === 'simple_select' || inputInterface === 'multi_select') {
					// These are now handled by raw SQL above
					continue;
				} else {
					// For text values, we need to match the exact JSON structure
					valueFilter['_or'] = [
						{ value: { _eq: JSON.stringify({ value: value }) } }, // Exact JSON match {"value": "collection_3"}
						{ value: { _eq: JSON.stringify(value) } }, // JSON string
						{ value: { _eq: String(value) } }, // Plain text
					];
				}
				break;

			case '_neq':
				if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple' ||
				    inputInterface === 'simple_select' || inputInterface === 'multi_select') {
					// These are now handled by raw SQL above
					continue;
				} else {
					valueFilter['_and'] = [
						{ value: { _neq: JSON.stringify({ value }) } },
						{ value: { _neq: JSON.stringify(value) } },
						{ value: { _neq: String(value) } },
					];
				}
				break;

			case '_in':
				// Multiple values
				logger.info(`_in operator - inputInterface: ${inputInterface}, value: ${JSON.stringify(value)}`);
				if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple' ||
				    inputInterface === 'simple_select' || inputInterface === 'multi_select') {
					// These are now handled by raw SQL above
					continue;
				} else {
					// For regular fields, build similar structure
					const orConditions = value.map((v: any) => ({
						_and: [
							{ attribute_id: { _eq: attributeId } },
							{
								_or: [
									{ value: { _eq: JSON.stringify({ value: v }) } }, // Exact JSON match
									{ value: { _eq: JSON.stringify(v) } }, // Just the value as JSON
									{ value: { _eq: String(v) } }, // Plain string
								],
							},
						],
					}));
					valueFilter = { _or: orConditions };
				}
				break;

			case '_nin':
				// Not in list
				if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple' ||
				    inputInterface === 'simple_select' || inputInterface === 'multi_select') {
					// These are now handled by raw SQL above
					continue;
				} else {
					// For regular fields
					valueFilter = {
						attribute_id: { _eq: attributeId },
						value: { _nin: value.map((v: any) => String(v)) }
					};
				}
				break;

			case '_contains':
				// Text contains - for JSON fields we can't use contains operator
				// Instead, we'll need to fetch all values and filter in memory
				logger.warn('_contains operator on JSON field - falling back to in-memory filtering');
				return await handleTextSearch(attributeId, '_contains', value, { productAttributesService, logger });

			case '_ncontains':
				// Text does not contain - similar issue with JSON fields
				logger.warn('_ncontains operator on JSON field - falling back to in-memory filtering');
				return await handleTextSearch(attributeId, '_ncontains', value, { productAttributesService, logger });
				break;

			case '_starts_with':
				// For text that starts with - we need to handle JSON fields
				logger.warn('_starts_with operator on JSON field - falling back to in-memory filtering');
				return await handleTextSearch(attributeId, '_starts_with', value, { productAttributesService, logger });

			case '_ends_with':
				// For text that ends with - we need to handle JSON fields
				logger.warn('_ends_with operator on JSON field - falling back to in-memory filtering');
				return await handleTextSearch(attributeId, '_ends_with', value, { productAttributesService, logger });

			case '_empty':
				// Is empty
				valueFilter['_or'] = [
					{ value: { _null: true } },
					{ value: { _eq: '' } },
					{ value: { _eq: '{}' } },
					{ value: { _eq: 'null' } },
				];
				break;

			case '_nempty':
				// Is not empty
				valueFilter['_and'] = [
					{ value: { _nnull: true } },
					{ value: { _neq: '' } },
					{ value: { _neq: '{}' } },
					{ value: { _neq: 'null' } },
				];
				break;

			case '_gt':
			case '_gte':
			case '_lt':
			case '_lte':
				// For numeric comparisons, we need to fetch all values and filter in memory
				// This is because values are stored as JSON strings
				return await handleNumericComparison(attributeId, operator, value, { productAttributesService, logger });
			}
		}

		logger.info(`Attribute filter query for attribute ${attributeId}:`, JSON.stringify(valueFilter, null, 2));

		// Query matching product_attributes
		let matches = [];
		try {
			matches = await productAttributesService.readByQuery({
				filter: valueFilter,
				fields: ['product_id', 'value'], // Include value for debugging
				limit: -1,
			});
		} catch (queryError) {
			console.error('QUERY ERROR:', queryError);
			logger.error('Error querying product_attributes:', queryError);
			logger.error('Query error message:', queryError?.message || 'No message');
			logger.error('Query error code:', queryError?.code || 'No code');
			logger.error('Query error stack:', queryError?.stack || 'No stack');
			logger.error('Full error object:', JSON.stringify(queryError, Object.getOwnPropertyNames(queryError)));
			try {
				logger.error('Failed filter:', JSON.stringify(valueFilter));
			} catch (stringifyError) {
				logger.error('Could not stringify filter, keys:', Object.keys(valueFilter || {}));
			}
			throw queryError;
		}

		logger.info(`Attribute filter found ${matches.length} matching products for attribute ${attributeId}`);
		if (matches.length > 0 && matches.length < 10) {
			logger.info(
				`Sample values:`,
				matches.slice(0, 5).map((m: any) => m.value),
			);
		} else if (matches.length === 0) {
			// Let's see what values exist for this attribute
			const sampleValues = await productAttributesService.readByQuery({
				filter: { attribute_id: { _eq: attributeId } },
				fields: ['value'],
				limit: 10,
			});
			logger.info(
				`No matches found. Sample values for attribute ${attributeId}:`,
				sampleValues.map((s: any) => s.value)
			);
		}

		return [...new Set(matches.map((m: any) => m.product_id))]; // Unique product IDs
	} catch (error) {
		logger.error('Error in getProductIdsByAttributeFilter:', error);
		logger.error('Error message:', error?.message || 'No error message');
		logger.error('Error stack:', error?.stack || 'No stack trace');
		return [];
	}
}

// Helper function to handle reference entity searches for JSON fields
async function handleReferenceEntitySearch(attributeId, operator, searchValue, { productAttributesService, logger }) {
	try {
		// Fetch all values for this attribute
		const allValues = await productAttributesService.readByQuery({
			filter: { attribute_id: { _eq: attributeId } },
			fields: ['product_id', 'value'],
			limit: -1,
		});

		// Filter in memory based on reference entity matching
		const matchingProductIds = allValues
			.filter((item) => {
				if (!item.value) return false;

				// Try to parse the value
				let parsedValue;
				try {
					parsedValue = JSON.parse(item.value);
				} catch {
					// If not JSON, use as-is
					parsedValue = item.value;
				}

				// Check different formats
				if (typeof parsedValue === 'string') {
					// Plain string comparison
					switch (operator) {
						case '_eq':
							return parsedValue === searchValue;
						case '_neq':
							return parsedValue !== searchValue;
						default:
							return false;
					}
				} else if (typeof parsedValue === 'object' && parsedValue !== null) {
					// Object with code property
					const code = parsedValue.code || parsedValue.id || null;
					if (code) {
						switch (operator) {
							case '_eq':
								return code === searchValue;
							case '_neq':
								return code !== searchValue;
							default:
								return false;
						}
					}
				}

				return false;
			})
			.map((item) => item.product_id);

		// Remove duplicates
		return [...new Set(matchingProductIds)];
	} catch (error) {
		logger.error(`Error in handleReferenceEntitySearch for attribute ${attributeId}:`, error);
		return [];
	}
}

// Helper function to handle text searches for JSON fields
async function handleTextSearch(attributeId, operator, searchValue, { productAttributesService, logger }) {
	try {
		// Fetch all values for this attribute
		const allValues = await productAttributesService.readByQuery({
			filter: { attribute_id: { _eq: attributeId } },
			fields: ['product_id', 'value'],
			limit: -1,
		});

		// Filter in memory based on text search
		const matchingProductIds = allValues
			.filter((item) => {
				if (!item.value) return false;

				let textValue;
				try {
					const parsed = JSON.parse(item.value);
					textValue = parsed?.value ?? parsed;
				} catch {
					textValue = item.value;
				}

				if (textValue === null || textValue === undefined) return false;
				const text = String(textValue).toLowerCase();
				const search = String(searchValue).toLowerCase();

				switch (operator) {
					case '_contains':
						return text.includes(search);
					case '_ncontains':
						return !text.includes(search);
					case '_starts_with':
						return text.startsWith(search);
					case '_ends_with':
						return text.endsWith(search);
					default:
						return false;
				}
			})
			.map((item) => item.product_id);

		// Remove duplicates
		return [...new Set(matchingProductIds)];
	} catch (error) {
		logger.error(`Error in handleTextSearch for attribute ${attributeId}:`, error);
		return [];
	}
}

// Helper function to handle numeric comparisons
async function handleNumericComparison(attributeId, operator, compareValue, { productAttributesService, logger }) {
	try {
		// Fetch all values for this attribute
		const allValues = await productAttributesService.readByQuery({
			filter: { attribute_id: { _eq: attributeId } },
			fields: ['product_id', 'value'],
			limit: -1,
		});

		// Filter in memory based on numeric comparison
		const matchingProductIds = allValues
			.filter((item) => {
				if (!item.value) return false;

				let numValue;
				try {
					const parsed = JSON.parse(item.value);
					numValue = Number(parsed?.value ?? parsed);
				} catch {
					numValue = Number(item.value);
				}

				if (isNaN(numValue)) return false;

				const compareNum = Number(compareValue);

				switch (operator) {
					case '_gt':
						return numValue > compareNum;
					case '_gte':
						return numValue >= compareNum;
					case '_lt':
						return numValue < compareNum;
					case '_lte':
						return numValue <= compareNum;
					default:
						return false;
				}
			})
			.map((item) => item.product_id);

		return [...new Set(matchingProductIds)];
	} catch (error) {
		logger.error('Error in handleNumericComparison:', error);
		return [];
	}
}

// Helper function to handle complex conditions (e.g., ranges)
async function handleComplexCondition(conditions, attributeId, inputInterface, { productAttributesService, logger }) {
	try {
		// For range conditions, we need to fetch all values and filter
		const allValues = await productAttributesService.readByQuery({
			filter: { attribute_id: { _eq: attributeId } },
			fields: ['product_id', 'value'],
			limit: -1,
		});

		// Process each condition
		const matchingProductIds = allValues
			.filter((item) => {
				if (!item.value) return false;

				let value;
				try {
					const parsed = JSON.parse(item.value);
					value = parsed?.value ?? parsed;
				} catch {
					value = item.value;
				}

				// Check all conditions
				return conditions.every((cond) => {
					const [operator, compareValue] = Object.entries(cond)[0];

					if (inputInterface === 'price' || inputInterface === 'number' || inputInterface === 'measurement') {
						const numValue = Number(value);
						const compareNum = Number(compareValue);

						if (isNaN(numValue)) return false;

						switch (operator) {
							case '_gte':
								return numValue >= compareNum;
							case '_lte':
								return numValue <= compareNum;
							case '_gt':
								return numValue > compareNum;
							case '_lt':
								return numValue < compareNum;
							default:
								return true;
						}
					} else if (inputInterface === 'date') {
						const dateValue = new Date(value);
						const compareDate = new Date(compareValue);

						switch (operator) {
							case '_gte':
								return dateValue >= compareDate;
							case '_lte':
								return dateValue <= compareDate;
							case '_gt':
								return dateValue > compareDate;
							case '_lt':
								return dateValue < compareDate;
							default:
								return true;
						}
					}

					return true;
				});
			})
			.map((item) => item.product_id);

		return [...new Set(matchingProductIds)];
	} catch (error) {
		logger.error('Error in handleComplexCondition:', error);
		return [];
	}
}
