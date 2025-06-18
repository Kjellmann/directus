import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ filter, action }, { database, logger }) => {
	logger.info('[product-attributes-dynamic-fields] Extension loaded');

	// Register ALL attributes as fields on products collection
	const registerAllAttributeFields = async () => {
		try {
			// Get ALL attributes (not just grid-enabled)
			const attributes = await database('attributes')
				.select('id', 'code', 'label', 'type', 'group', 'sort', 'usable_in_grid')
				.orderBy('sort');
			
			logger.info(`[product-attributes-dynamic-fields] Found ${attributes.length} total attributes`);

			// Get existing fields
			const existingFields = await database('directus_fields')
				.where({ collection: 'products' })
				.andWhere('field', 'like', 'attr_%')
				.select('field');
			
			const existingFieldNames = new Set(existingFields.map(f => f.field));

			// Register ALL attributes as fields
			for (const attr of attributes) {
				const fieldName = `attr_${attr.code}`;
				
				if (!existingFieldNames.has(fieldName)) {
					try {
						// Get attribute type details
						const typeInfo = await database('attribute_types')
							.where({ id: attr.type })
							.first();
						
						await database('directus_fields').insert({
							collection: 'products',
							field: fieldName,
							special: 'alias,no-data,attribute-field', // Custom special flag
							interface: mapTypeToInterface(typeInfo?.input_interface),
							display: mapTypeToDisplay(typeInfo?.input_interface),
							display_options: '{}',
							readonly: false,
							hidden: !attr.usable_in_grid, // Hide by default if not grid-enabled
							sort: 2000 + attr.sort,
							width: 'full',
							translations: JSON.stringify([{
								language: 'en-US',
								translation: attr.label
							}]),
							note: `Attribute: ${attr.label}`,
							conditions: JSON.stringify([{
								// This is the key: Show field only when product's family includes this attribute
								rule: {
									_and: [{
										family: {
											attributes: {
												attributes_id: {
													_eq: attr.id
												}
											}
										}
									}]
								},
								hidden: false
							}]),
							required: false,
							group: attr.group ? `attr_group_${attr.group}` : null,
							validation: null,
							validation_message: null,
							options: '{}'
						});
						
						logger.info(`[product-attributes-dynamic-fields] Registered field: ${fieldName}`);
					} catch (error) {
						logger.warn(`[product-attributes-dynamic-fields] Failed to register field ${fieldName}:`, error);
					}
				}
			}

			// Register attribute groups as field groups
			const groups = await database('attribute_groups')
				.select('id', 'code', 'label', 'sort');
			
			for (const group of groups) {
				const groupName = `attr_group_${group.id}`;
				
				// Check if group exists
				const existingGroup = await database('directus_fields')
					.where({ 
						collection: 'products',
						field: groupName,
						special: 'group'
					})
					.first();
				
				if (!existingGroup) {
					await database('directus_fields').insert({
						collection: 'products',
						field: groupName,
						special: 'group',
						interface: 'group',
						hidden: false,
						sort: 1500 + group.sort,
						width: 'full',
						translations: JSON.stringify([{
							language: 'en-US',
							translation: group.label
						}]),
						note: `Attribute Group: ${group.label}`,
						options: JSON.stringify({
							showHeader: true,
							accordion: 'allow'
						})
					});
					
					logger.info(`[product-attributes-dynamic-fields] Registered group: ${groupName}`);
				}
			}
		} catch (error) {
			logger.error('[product-attributes-dynamic-fields] Error registering fields:', error);
		}
	};

	// Initialize on startup
	setTimeout(registerAllAttributeFields, 3000);

	// Re-register when attributes change
	action('items.create', async (meta) => {
		if (meta.collection === 'attributes' || meta.collection === 'attribute_groups') {
			await registerAllAttributeFields();
		}
	});

	action('items.update', async (meta) => {
		if (meta.collection === 'attributes' || meta.collection === 'attribute_groups') {
			await registerAllAttributeFields();
		}
	});

	action('items.delete', async (meta) => {
		if (meta.collection === 'attributes' || meta.collection === 'attribute_groups') {
			await registerAllAttributeFields();
		}
	});

	// Hook to inject values from product_attributes table
	filter('items.read', async (payload, meta) => {
		if (meta.collection !== 'products' || !payload) {
			return payload;
		}

		try {
			const requestedFields = meta.query?.fields || [];
			const attributeFields = requestedFields.filter(field => 
				typeof field === 'string' && field.startsWith('attr_')
			);

			if (attributeFields.length === 0 && requestedFields.length > 0) {
				return payload;
			}

			// Handle both single item and array
			const isArray = Array.isArray(payload);
			const items = isArray ? payload : [payload];
			
			if (items.length === 0) return payload;

			// Get product IDs
			const productIds = items.map(item => item.id).filter(Boolean);
			if (productIds.length === 0) return payload;

			// Get attribute codes from field names
			const codes = attributeFields.map(f => f.replace('attr_', ''));
			
			// Get attributes
			const attributes = codes.length > 0 
				? await database('attributes').whereIn('code', codes).select('id', 'code')
				: await database('attributes').select('id', 'code');
			
			const codeToId = new Map(attributes.map(a => [a.code, a.id]));

			// Get values
			const values = await database('product_attributes')
				.select('product_id', 'attribute_id', 'value')
				.whereIn('product_id', productIds)
				.whereIn('attribute_id', Array.from(codeToId.values()));

			// Build value map
			const valueMap = new Map();
			for (const row of values) {
				const key = `${row.product_id}_${row.attribute_id}`;
				try {
					const parsed = JSON.parse(row.value);
					valueMap.set(key, parsed?.value ?? parsed);
				} catch {
					valueMap.set(key, row.value);
				}
			}

			// Inject values
			for (const item of items) {
				for (const [code, attrId] of codeToId) {
					const fieldName = `attr_${code}`;
					const key = `${item.id}_${attrId}`;
					item[fieldName] = valueMap.get(key) ?? null;
				}
			}

			logger.debug(`[product-attributes-dynamic-fields] Injected ${attributeFields.length} attribute values`);
		} catch (error) {
			logger.error('[product-attributes-dynamic-fields] Error injecting values:', error);
		}

		return payload;
	});

	// Hook to sync values back to product_attributes when saving
	action('items.update', async (meta, context) => {
		if (meta.collection !== 'products') return;
		
		const payload = meta.payload;

		try {
			// Extract attribute fields from payload
			const attributeFields = Object.keys(payload).filter(key => key.startsWith('attr_'));
			if (attributeFields.length === 0) return;

			// Get attribute mappings
			const codes = attributeFields.map(f => f.replace('attr_', ''));
			const attributes = await database('attributes')
				.whereIn('code', codes)
				.select('id', 'code');
			
			const codeToId = new Map(attributes.map(a => [a.code, a.id]));

			// Sync each attribute value
			for (const field of attributeFields) {
				const code = field.replace('attr_', '');
				const attrId = codeToId.get(code);
				if (!attrId) continue;

				const value = payload[field];
				
				// Check if record exists
				const existing = await database('product_attributes')
					.where({ 
						product_id: meta.keys[0],
						attribute_id: attrId 
					})
					.first();

				if (existing) {
					// Update
					await database('product_attributes')
						.where({ id: existing.id })
						.update({ 
							value: value !== null ? JSON.stringify({ value }) : null 
						});
				} else if (value !== null) {
					// Insert
					await database('product_attributes').insert({
						product_id: meta.keys[0],
						attribute_id: attrId,
						value: JSON.stringify({ value })
					});
				}
			}

			logger.debug(`[product-attributes-dynamic-fields] Synced ${attributeFields.length} attribute values`);
		} catch (error) {
			logger.error('[product-attributes-dynamic-fields] Error syncing values:', error);
		}
	});

	// Helper functions
	function mapTypeToInterface(inputInterface?: string): string {
		const map: Record<string, string> = {
			'text': 'input',
			'text_area': 'input-multiline',
			'number': 'input',
			'price': 'input',
			'yes_no': 'boolean',
			'identifier': 'input',
			'measurement': 'input',
			'simple_select': 'select-dropdown',
			'multi_select': 'select-multiple',
			'date': 'datetime',
			'image': 'file-image',
			'file': 'file'
		};
		return map[inputInterface || ''] || 'input';
	}

	function mapTypeToDisplay(inputInterface?: string): string {
		const map: Record<string, string> = {
			'text': 'formatted-value',
			'number': 'formatted-value',
			'price': 'formatted-value',
			'yes_no': 'boolean',
			'simple_select': 'labels',
			'multi_select': 'labels',
			'date': 'datetime',
			'image': 'image',
			'file': 'file'
		};
		return map[inputInterface || ''] || 'raw';
	}
});