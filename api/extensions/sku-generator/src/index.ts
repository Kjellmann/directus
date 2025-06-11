import type { HookConfig } from '@directus/extensions';
import type { Knex } from 'knex';

interface SkuGenerator {
	id: number;
	name: string;
	delimiter?: string;
	use_delimiter: boolean;
	text_transformation?: 'uppercase' | 'lowercase';
}

interface SkuGeneratorCondition {
	id: number;
	generator_id: number;
	attribute_code: string;
	operator: 'equals' | 'in' | 'not_equals' | 'exists';
	value: any;
	sort: number;
}

interface SkuGeneratorProperty {
	id: number;
	generator_id: number;
	property: 'free_text' | 'attribute_value' | 'auto_number';
	attribute_id?: number;
	static_value?: string;
	format_type?: 'first_chars' | 'nomenclature' | 'full';
	char_count?: number;
	auto_number_start?: number;
	auto_number_padding?: boolean;
	auto_number_digits?: number;
	sort: number;
}

interface Attribute {
	id: number;
	code: string;
	type: number;
}

interface ProductData {
	id?: number;
	product_type?: string;
	family?: number;
	family_variant?: number;
	enabled?: boolean;
	status?: string;
	attributes?: Array<{
		attribute_id: number;
		value: any;
	}>;
	[key: string]: any;
}

const registerHook: HookConfig = ({ filter }, { database, logger }) => {
	const knex = database as Knex;

	// Helper function to find applicable generators
	async function findApplicableGenerators(productData: ProductData): Promise<SkuGenerator[]> {
		try {
			console.log('SKU Generator: Finding applicable generators...');
			logger.info('SKU Generator: Finding applicable generators...');
			logger.info(`SKU Generator: Product data for evaluation: ${JSON.stringify(productData)}`);

			// Get all enabled generators
			const generators = await knex('sku_generators').where('is_enabled', true).orderBy('sort', 'asc');
			logger.info(`SKU Generator: Found ${generators.length} enabled generators`);

			const applicableGenerators: SkuGenerator[] = [];

			for (const generator of generators) {
				logger.info(`SKU Generator: Evaluating generator "${generator.name}" (ID: ${generator.id})`);

				// Get conditions for this generator
				const conditions = await knex('sku_generator_conditions')
					.where('generator_id', generator.id)
					.orderBy('sort', 'asc');

				logger.info(`SKU Generator: Generator has ${conditions.length} conditions`);

				// If no conditions, generator always applies
				if (conditions.length === 0) {
					logger.info(`SKU Generator: No conditions - generator "${generator.name}" applies to all products`);
					applicableGenerators.push(generator);
					continue;
				}

				// Check if all conditions match
				logger.info(`SKU Generator: Evaluating ${conditions.length} conditions for generator "${generator.name}"`);
				const allConditionsMatch = await evaluateConditions(conditions, productData);

				if (allConditionsMatch) {
					logger.info(`SKU Generator: All conditions match - generator "${generator.name}" is applicable`);
					applicableGenerators.push(generator);
				} else {
					logger.info(`SKU Generator: Conditions do not match - generator "${generator.name}" is not applicable`);
				}
			}

			logger.info(`SKU Generator: Total applicable generators: ${applicableGenerators.length}`);
			return applicableGenerators;
		} catch (error) {
			logger.error('SKU Generator: Error finding applicable generators:', error);
			logger.error(`SKU Generator: Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
			return [];
		}
	}

	// Helper function to evaluate conditions
	async function evaluateConditions(conditions: SkuGeneratorCondition[], productData: ProductData): Promise<boolean> {
		for (const condition of conditions) {
			let attributeValue: any;

			// Check if this is a direct product field condition
			const directProductFields = ['product_type', 'family', 'family_variant', 'enabled', 'status'];

			if (typeof condition.attribute_code === 'string' && directProductFields.includes(condition.attribute_code)) {
				// Direct product field - get value directly from product data
				attributeValue = productData[condition.attribute_code];
			} else {
				// Dynamic attribute - get from attributes system
				const attribute = await knex('attributes').where('code', condition.attribute_code).first();

				if (!attribute) {
					logger.warn(`Attribute ${condition.attribute_code} not found in conditions`);
					return false;
				}

				// Check if this is a special product field (by attribute code)
				if (directProductFields.includes(attribute.code)) {
					// Get value directly from product data
					attributeValue = productData[attribute.code];
				} else {
					// Get value from attributes system
					attributeValue = await getAttributeValue(productData.id, condition.attribute_code);
				}
			}

			let conditionValue = condition.value;
			
			// Only try to parse JSON if the string looks like JSON (starts with { or [)
			if (typeof condition.value === 'string') {
				const trimmed = condition.value.trim();
				if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
					(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
					try {
						conditionValue = JSON.parse(condition.value);
					} catch (error) {
						// If JSON parsing fails, keep the original string value
						logger.warn(`Failed to parse condition value as JSON, using as string: ${condition.value}`);
						conditionValue = condition.value;
					}
				}
				// Otherwise, keep it as a string
			}

			switch (condition.operator) {
				case 'equals':
					if (attributeValue !== conditionValue) return false;
					break;
				case 'in':
					if (!Array.isArray(conditionValue) || !conditionValue.includes(attributeValue)) return false;
					break;
				case 'not_equals':
					if (attributeValue === conditionValue) return false;
					break;
				case 'exists':
					if (!attributeValue && attributeValue !== false && attributeValue !== 0) return false;
					break;
				default:
					logger.warn(`Unknown condition operator: ${condition.operator}`);
					return false;
			}
		}
		return true;
	}

	// Helper function to get attribute value from product
	async function getAttributeValue(productId: number | string | undefined, attributeCode: string): Promise<any> {
		if (!productId) return null;

		try {
			// First, get the attribute details to know its type
			const attribute = await knex('attributes').where('code', attributeCode).first();

			if (!attribute) {
				logger.warn(`Attribute with code ${attributeCode} not found`);
				return null;
			}

			// Get the attribute value from product_attributes table
			const result = await knex('product_attributes')
				.where('product_id', productId)
				.where('attribute_id', attribute.id)
				.first();

			if (!result) return null;

			// The value field in product_attributes is JSON, so we need to parse it
			// If it's already parsed by knex, use it directly, otherwise parse it
			let value = result.value;
			if (typeof value === 'string') {
				try {
					value = JSON.parse(value);
				} catch (error) {
					// If it fails to parse, it might be a plain string
					return value;
				}
			}

			return value;
		} catch (error) {
			logger.error(`Error getting attribute value for product ${productId}, attribute ${attributeCode}:`, error);
			return null;
		}
	}

	// Helper function to build SKU from generator properties
	async function buildSKU(generator: SkuGenerator, productData: ProductData): Promise<string> {
		try {
			// Get properties for this generator
			const properties = await knex('sku_generator_properties')
				.where('generator_id', generator.id)
				.orderBy('sort', 'asc');

			logger.info(`Found ${properties.length} properties for generator ${generator.id}`);

			const skuParts: string[] = [];

			for (const property of properties) {
				let part = '';
				logger.info(`Processing property: ${property.property} (sort: ${property.sort})`);

				switch (property.property) {
					case 'free_text':
						part = property.static_value || '';
						break;

					case 'attribute_value':
						// Get attribute details
						const attribute = await knex('attributes').where('id', property.attribute_id).first();

						let value: any;
						if (attribute) {
							// Check if this is a special product field
							const specialFields = ['product_type', 'family', 'family_variant', 'enabled', 'status'];
							if (specialFields.includes(attribute.code)) {
								// Get value directly from product data
								value = productData[attribute.code];

								// For relations like family, get the name/label
								if (attribute.code === 'family' && value) {
									const family = await knex('families').where('id', value).first();
									value = family ? family.name : value;
								} else if (attribute.code === 'family_variant' && value) {
									const variant = await knex('family_variants').where('id', value).first();
									value = variant ? variant.name : value;
								}
							} else {
								// Get value from attributes system
								value = await getAttributeValue(productData.id, attribute.code);
							}

							if (value) {
								part = await formatAttributeValue(value, property);
							}
						}
						break;

					case 'auto_number':
						part = await getNextAutoNumber(generator.id, property, productData);
						break;

					default:
						logger.warn(`Unknown property type: ${property.property}`);
				}

				logger.info(`Generated part: "${part}"`);
				if (part) {
					skuParts.push(part);
				}
			}

			logger.info(`SKU parts: [${skuParts.join(', ')}]`);

			// Join parts with delimiter if enabled
			let sku = generator.use_delimiter ? skuParts.join(generator.delimiter || '-') : skuParts.join('');

			// Apply text transformation
			switch (generator.text_transformation) {
				case 'uppercase':
					sku = sku.toUpperCase();
					break;
				case 'lowercase':
					sku = sku.toLowerCase();
					break;
			}

			return sku;
		} catch (error) {
			logger.error('Error building SKU:', error);
			throw error;
		}
	}

	// Helper function to format attribute value
	async function formatAttributeValue(value: any, property: SkuGeneratorProperty): Promise<string> {
		let formattedValue = String(value);

		switch (property.format_type) {
			case 'first_chars':
				if (property.char_count && property.char_count > 0) {
					formattedValue = formattedValue.substring(0, property.char_count);
				}
				break;

			case 'nomenclature':
				// First try exact match
				let nomenclature = await knex('sku_nomenclature')
					.where('attribute_id', property.attribute_id)
					.where('source_value', value)
					.where('operator', 'equal_to')
					.first();

				if (!nomenclature && property.char_count) {
					// If no exact match, look for char_count based rules
					const charCountRules = await knex('sku_nomenclature')
						.where('attribute_id', property.attribute_id)
						.where('char_count', '<=', property.char_count)
						.where('operator', 'less_than_equal')
						.orderBy('char_count', 'desc')
						.first();

					if (charCountRules) {
						nomenclature = charCountRules;
					}
				}

				if (nomenclature) {
					formattedValue = nomenclature.abbreviation;
				} else if (property.char_count && property.char_count > 0) {
					// Fallback to first chars if no nomenclature found
					formattedValue = formattedValue.substring(0, property.char_count);
				}
				break;

			case 'full':
			default:
				// Use full value
				break;
		}

		return formattedValue;
	}

	// Helper function to get and increment auto number
	async function getNextAutoNumber(
		generatorId: number,
		property: SkuGeneratorProperty,
		_productData: ProductData,
	): Promise<string> {
		// Use a transaction to ensure atomicity
		return await knex.transaction(async (trx) => {
			try {
				// Find the identifier attribute to scan existing SKUs
				const identifierAttribute = await findIdentifierAttribute(trx);

				// Lock the row for update
				let autoNumber = await trx('sku_auto_numbers')
					.where('generator_id', generatorId)
					.where('prefix', null)
					.forUpdate()
					.first();

				let currentNumber: number;
				const startNumber = property.auto_number_start || 1;

				// Check existing SKUs to find the highest number
				if (identifierAttribute) {
					try {
						const existingSkus = await trx('product_attributes')
							.where('attribute_id', identifierAttribute.id)
							.whereNotNull('value');

						let maxNumber = startNumber - 1;

						for (const record of existingSkus) {
							try {
								// Parse the JSON value to get the SKU
								let skuValue = record.value;
								if (typeof skuValue === 'string') {
									skuValue = JSON.parse(skuValue);
								}

								// Extract number from SKU (assuming it's just a number or ends with a number)
								const numberMatch = String(skuValue).match(/\d+$/);
								if (numberMatch) {
									const extractedNumber = parseInt(numberMatch[0], 10);
									if (extractedNumber > maxNumber) {
										maxNumber = extractedNumber;
									}
								}
							} catch (parseError) {
								// Skip invalid records
							}
						}

						// Use the higher of: stored counter or max existing number + 1
						const calculatedNext = maxNumber + 1;
						logger.info(`Max existing SKU number: ${maxNumber}, calculated next: ${calculatedNext}`);

						if (!autoNumber) {
							currentNumber = Math.max(startNumber, calculatedNext);
							await trx('sku_auto_numbers').insert({
								generator_id: generatorId,
								current_number: currentNumber + 1,
								prefix: null,
							});
						} else {
							const storedNext = autoNumber.current_number;
							currentNumber = Math.max(storedNext, calculatedNext);

							// Update the counter with the new highest number
							await trx('sku_auto_numbers')
								.where('id', autoNumber.id)
								.update({ current_number: currentNumber + 1 });
						}
					} catch (scanError) {
						logger.warn('Error scanning existing SKUs, using stored counter:', scanError);
						// Fallback to original logic
						if (!autoNumber) {
							currentNumber = startNumber;
							await trx('sku_auto_numbers').insert({
								generator_id: generatorId,
								current_number: currentNumber + 1,
								prefix: null,
							});
						} else {
							currentNumber = autoNumber.current_number;
							await trx('sku_auto_numbers')
								.where('id', autoNumber.id)
								.update({ current_number: currentNumber + 1 });
						}
					}
				} else {
					// Fallback if no identifier attribute found
					if (!autoNumber) {
						currentNumber = startNumber;
						await trx('sku_auto_numbers').insert({
							generator_id: generatorId,
							current_number: currentNumber + 1,
							prefix: null,
						});
					} else {
						currentNumber = autoNumber.current_number;
						await trx('sku_auto_numbers')
							.where('id', autoNumber.id)
							.update({ current_number: currentNumber + 1 });
					}
				}

				logger.info(`Using auto number: ${currentNumber}`);

				// Format the number
				let formattedNumber = String(currentNumber);
				if (property.auto_number_padding && property.auto_number_digits) {
					formattedNumber = formattedNumber.padStart(property.auto_number_digits, '0');
				}

				return formattedNumber;
			} catch (error) {
				logger.error('Error getting next auto number:', error);
				throw error;
			}
		});
	}

	// Helper function to find where to store the generated SKU
	// This looks for attributes with the identifier type (like your "sku" attribute)
	async function findIdentifierAttribute(trx?: Knex.Transaction): Promise<Attribute | null> {
		const db = trx || knex;
		try {
			// Find the attribute type with input_interface = 'identifier'
			const identifierType = await db('attribute_types').where('input_interface', 'identifier').first();

			if (!identifierType) {
				logger.warn('No identifier attribute type found');
				return null;
			}

			// Find attributes that use this type
			// In your case, this would find the "sku" attribute
			const identifierAttribute = await db('attributes').where('type', identifierType.id).first();

			if (identifierAttribute) {
				logger.info(`Using identifier attribute: ${identifierAttribute.code} (ID: ${identifierAttribute.id})`);
			}

			return identifierAttribute;
		} catch (error) {
			logger.error('Error finding identifier attribute:', error);
			return null;
		}
	}

	// Register the hook for product creation
	filter('items.create', async (payload: any, { collection }) => {
		logger.info('SKU Generator: Hook triggered for items.create');
		logger.info(`SKU Generator: Collection: ${collection}`);
		logger.info(`SKU Generator: Payload keys: ${Object.keys(payload || {}).join(', ')}`);

		if (collection !== 'products') return payload;

		try {
			logger.info('SKU Generator: Processing product creation');
			logger.info(`SKU Generator: Product payload: ${JSON.stringify(payload)}`);

			const productData = payload as ProductData;

			// Find the identifier attribute (SKU field)
			const identifierAttribute = await findIdentifierAttribute();

			if (!identifierAttribute) {
				logger.warn('SKU Generator: No identifier attribute configured');
				return payload;
			}

			logger.info(
				`SKU Generator: Found identifier attribute - ID: ${identifierAttribute.id}, Code: ${identifierAttribute.code}`,
			);

			// Check if SKU is already set in the dynamic attributes
			// The identifier might be in the attributes payload
			if (productData.attributes) {
				logger.info(`SKU Generator: Checking ${productData.attributes.length} existing attributes`);
				const existingSku = productData.attributes.find(
					(attr: any) => attr.attribute_id === identifierAttribute.id && attr.value,
				);
				if (existingSku) {
					logger.info(`SKU Generator: SKU already provided (${existingSku.value}), skipping generation`);
					return payload;
				}
			} else {
				logger.info('SKU Generator: No attributes in payload');
			}

			// Find applicable generators
			logger.info('SKU Generator: Looking for applicable generators...');
			const generators = await findApplicableGenerators(productData);
			logger.info(`SKU Generator: Found ${generators.length} applicable generators`);

			if (generators.length === 0) {
				logger.info('SKU Generator: No applicable SKU generators found for product');
				return payload;
			}

			// Use the first matching generator (highest priority)
			const generator = generators[0];
			logger.info(`SKU Generator: Using generator: ${generator.name} (ID: ${generator.id})`);
			logger.info(
				`SKU Generator: Generator settings - delimiter: ${generator.delimiter}, use_delimiter: ${generator.use_delimiter}, text_transformation: ${generator.text_transformation}`,
			);

			// Build the SKU
			logger.info('SKU Generator: Building SKU...');
			const sku = await buildSKU(generator, productData);
			logger.info(`SKU Generator: Built SKU: "${sku}" (length: ${sku?.length})`);

			if (!sku || sku.length === 0) {
				logger.warn('SKU Generator: Generated SKU is empty, skipping');
				return payload;
			}

			// Add SKU to the attributes array
			if (!productData.attributes) {
				productData.attributes = [];
				logger.info('SKU Generator: Created empty attributes array');
			}

			// Add or update the identifier attribute value
			const skuIndex = productData.attributes.findIndex((attr: any) => attr.attribute_id === identifierAttribute.id);

			// Since the value column is JSON, we need to ensure the SKU is properly formatted
			// For identifier/string attributes, it should be stored as a JSON string
			const skuValue = JSON.stringify(sku);

			if (skuIndex >= 0) {
				logger.info(`SKU Generator: Updating existing SKU attribute at index ${skuIndex}`);
				productData.attributes[skuIndex].value = skuValue;
			} else {
				logger.info('SKU Generator: Adding new SKU attribute to payload');
				productData.attributes.push({
					attribute_id: identifierAttribute.id,
					value: skuValue,
				});
			}

			logger.info(
				`SKU Generator: Successfully generated SKU: ${sku} for new product using generator: ${generator.name}`,
			);
			logger.info(`SKU Generator: Final attributes count: ${productData.attributes.length}`);
		} catch (error) {
			logger.error('SKU Generator: Error generating SKU:', error);
			logger.error(`SKU Generator: Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
			// Don't block product creation if SKU generation fails
		}

		return payload;
	});

	// Register the hook for product updates
	filter('items.update', async (payload: any, { collection, keys }) => {
		if (collection !== 'products') return payload;

		try {
			const productPayload = payload as Partial<ProductData>;

			// Find the identifier attribute (SKU field)
			const identifierAttribute = await findIdentifierAttribute();

			if (!identifierAttribute) {
				logger.warn('No identifier attribute configured');
				return payload;
			}

			// Check if we're explicitly clearing the SKU in attributes
			let clearingSku = false;
			let explicitSkuUpdate = false;
			if (productPayload.attributes) {
				const skuUpdate = productPayload.attributes.find((attr: any) => attr.attribute_id === identifierAttribute.id);
				if (skuUpdate) {
					explicitSkuUpdate = true;
					if (skuUpdate.value === '' || skuUpdate.value === null || skuUpdate.value === '""') {
						clearingSku = true;
					} else if (skuUpdate.value) {
						// SKU is being manually set, don't generate
						return payload;
					}
				}
			}

			// If no explicit SKU update in the payload, don't interfere with existing SKU
			if (!explicitSkuUpdate) {
				return payload;
			}

			// Get current SKU value from product_attributes
			const currentSkuValue = await knex('product_attributes')
				.where('product_id', keys[0])
				.where('attribute_id', identifierAttribute.id)
				.first();

			// If SKU exists and we're not explicitly clearing it, skip
			// Parse the JSON value to check if it contains a valid SKU
			let existingSku = null;
			if (currentSkuValue && currentSkuValue.value) {
				try {
					existingSku =
						typeof currentSkuValue.value === 'string' ? JSON.parse(currentSkuValue.value) : currentSkuValue.value;
				} catch (error) {
					existingSku = currentSkuValue.value;
				}
			}

			if (existingSku && !clearingSku) {
				return payload;
			}

			// Get the current product data
			const currentProduct = await knex('products').where('id', keys[0]).first();

			if (!currentProduct) {
				logger.warn(`Product ${keys[0]} not found for SKU generation`);
				return payload;
			}

			// Merge current data with update payload for condition evaluation
			const productData: ProductData = { ...currentProduct, ...productPayload, id: keys[0] };

			// Find applicable generators
			const generators = await findApplicableGenerators(productData);

			if (generators.length === 0) {
				logger.info('No applicable SKU generators found for product update');
				return payload;
			}

			// Use the first matching generator (highest priority)
			const generator = generators[0];

			// Build the SKU
			const sku = await buildSKU(generator, productData);

			// Add SKU to the attributes array
			if (!productPayload.attributes) {
				productPayload.attributes = [];
			}

			// Add or update the identifier attribute value
			const skuIndex = productPayload.attributes.findIndex((attr: any) => attr.attribute_id === identifierAttribute.id);

			// Since the value column is JSON, we need to ensure the SKU is properly formatted
			// For identifier/string attributes, it should be stored as a JSON string
			const skuValue = JSON.stringify(sku);

			if (skuIndex >= 0) {
				productPayload.attributes[skuIndex].value = skuValue;
			} else {
				productPayload.attributes.push({
					attribute_id: identifierAttribute.id,
					value: skuValue,
				});
			}

			logger.info(`Generated SKU: ${sku} for product ${keys[0]} using generator: ${generator.name}`);
		} catch (error) {
			logger.error('Error generating SKU on update:', error);
			// Don't block product update if SKU generation fails
		}

		return payload;
	});
};

export default registerHook;
