import type { Knex } from 'knex';
import type { Accountability, SchemaOverview } from '@directus/types';
import { randomUUID } from 'crypto';

interface VariantAxis {
	id: number;
	attribute_id: number;
	attribute_code: string;
	sort: number;
}

interface AttributeOption {
	id: number;
	value: any;
	label: string;
	code: string;
	attribute_id: number;
}

interface VariantCombination {
	[attributeCode: string]: {
		id: number;
		value: any;
		label: string;
		code: string;
		attribute_id: number;
	};
}

interface GenerationResult {
	created: number;
	updated: number;
	deleted: number;
	errors: string[];
}

export class VariantGeneratorService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;
	services: Record<string, any>;
	logger: Record<string, any>;

	constructor(options: {
		knex: Knex;
		accountability: Accountability | null;
		schema: SchemaOverview;
		services: Record<string, any>;
		logger: Record<string, any>;
	}) {
		this.knex = options.knex;
		this.accountability = options.accountability;
		this.schema = options.schema;
		this.services = options.services;
		this.logger = options.logger;
	}

	/**
	 * Generate variants for a specific family variant
	 */
	async generateVariantsForFamilyVariant(familyVariantId: number): Promise<GenerationResult> {
		const result: GenerationResult = {
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		try {
			// Get all model products using this family variant
			const modelProducts = await this.knex('products')
				.where('family_variant', familyVariantId)
				.where('product_type', 'product_model')
				.select('id', 'family', 'family_variant');

			this.logger.info(
				`Generating variants for ${modelProducts.length} model products with family variant ${familyVariantId}`,
			);

			// Generate variants for each model product
			for (const modelProduct of modelProducts) {
				const productResult = await this.generateVariantsForProduct(modelProduct.id);
				result.created += productResult.created;
				result.updated += productResult.updated;
				result.deleted += productResult.deleted;
				result.errors.push(...productResult.errors);
			}

			// Log generation results
			await this.logGeneration(familyVariantId, null, 'generate', result);

			return result;
		} catch (error) {
			this.logger.error(`Error generating variants for family variant ${familyVariantId}:`, error);
			result.errors.push(error instanceof Error ? error.message : String(error));
			return result;
		}
	}

	/**
	 * Generate variants for a product with prepared variant data using differential updates
	 */
	async generateVariantsFromPrepared(productId: number, preparedVariants: any[]): Promise<GenerationResult> {
		const result: GenerationResult = {
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		try {
			// Get the model product details
			const modelProduct = await this.knex('products').where('id', productId).first();

			if (!modelProduct) {
				throw new Error(`Product ${productId} not found`);
			}

			if (modelProduct.product_type !== 'product_model') {
				throw new Error(`Product ${productId} is not a model type`);
			}

			this.logger.info(`Performing differential update for ${preparedVariants.length} variants for product ${productId}`);

			// Get existing variants with their attributes for comparison
			const existingVariants = await this.knex('products as p')
				.leftJoin('product_attributes as pa', 'p.id', 'pa.product_id')
				.leftJoin('attributes as a', 'pa.attribute_id', 'a.id')
				.where('p.parent_product_id', productId)
				.where('p.product_type', 'simple')
				.select('p.id as variant_id', 'p.enabled', 'a.id as attribute_id', 'a.code as attribute_code', 'pa.value as attribute_value');

			// Group existing variants by variant_id with their attribute combinations
			const existingVariantMap = new Map<string, {
				id: string;
				enabled: boolean;
				attributes: Map<number, any>;
				attributeCombinationKey: string;
			}>();

			for (const row of existingVariants) {
				if (!existingVariantMap.has(row.variant_id)) {
					existingVariantMap.set(row.variant_id, {
						id: row.variant_id,
						enabled: row.enabled,
						attributes: new Map(),
						attributeCombinationKey: '',
					});
				}
				
				const variant = existingVariantMap.get(row.variant_id)!;
				if (row.attribute_id) {
					variant.attributes.set(row.attribute_id, row.attribute_value);
				}
			}

			// Generate combination keys for existing variants
			for (const [variantId, variant] of existingVariantMap) {
				variant.attributeCombinationKey = this.generateCombinationKey(variant.attributes);
			}

			// Process new variants and create combination keys
			const newVariantCombinations = new Map<string, {
				preparedData: any;
				combinationKey: string;
				attributes: Map<number, any>;
			}>();

			for (const preparedVariant of preparedVariants) {
				const attributeMap = new Map<number, any>();
				
				// Extract attribute values from prepared variant
				if (preparedVariant.attributes) {
					for (const attr of preparedVariant.attributes) {
						attributeMap.set(attr.attribute_id, attr.value);
					}
				}

				const combinationKey = this.generateCombinationKey(attributeMap);
				newVariantCombinations.set(combinationKey, {
					preparedData: preparedVariant,
					combinationKey,
					attributes: attributeMap,
				});
			}

			// Perform differential analysis
			const variantsToUpdate: Array<{ variantId: string; preparedData: any }> = [];
			const variantsToCreate: Array<{ preparedData: any; combinationKey: string }> = [];
			const variantsToDelete: string[] = [];

			// Find existing variants that match new combinations (to update)
			const usedCombinationKeys = new Set<string>();
			for (const [variantId, existingVariant] of existingVariantMap) {
				if (newVariantCombinations.has(existingVariant.attributeCombinationKey)) {
					const newVariant = newVariantCombinations.get(existingVariant.attributeCombinationKey)!;
					variantsToUpdate.push({
						variantId,
						preparedData: newVariant.preparedData,
					});
					usedCombinationKeys.add(existingVariant.attributeCombinationKey);
				}
				// Don't delete existing variants - they should remain unless explicitly marked for deletion
			}

			// Find new combinations that don't exist yet (to create)
			for (const [combinationKey, newVariant] of newVariantCombinations) {
				if (!usedCombinationKeys.has(combinationKey)) {
					variantsToCreate.push({
						preparedData: newVariant.preparedData,
						combinationKey,
					});
				}
			}

			this.logger.info(`Differential update plan: ${variantsToUpdate.length} updates, ${variantsToCreate.length} creates, ${variantsToDelete.length} deletes`);

			// Execute differential update in transaction
			await this.knex.transaction(async (trx) => {
				// 1. Update existing variants
				if (variantsToUpdate.length > 0) {
					await this.updateExistingVariants(variantsToUpdate, trx);
					result.updated = variantsToUpdate.length;
				}

				// 2. Create new variants
				if (variantsToCreate.length > 0) {
					await this.createNewVariants(variantsToCreate, modelProduct, trx);
					result.created = variantsToCreate.length;
				}

				// 3. Delete obsolete variants
				if (variantsToDelete.length > 0) {
					await this.deleteVariants(variantsToDelete, trx);
					result.deleted = variantsToDelete.length;
				}
			});

			this.logger.info(
				`Updated ${result.updated} variants, created ${result.created} variants, deleted ${result.deleted} variants for product ${productId}`,
			);

			return result;
		} catch (error) {
			this.logger.error(`Error generating variants for product ${productId}:`, error);
			result.errors.push(error instanceof Error ? error.message : String(error));
			return result;
		}
	}

	/**
	 * Generate variants for a specific model product
	 */
	async generateVariantsForProduct(productId: number): Promise<GenerationResult> {
		const result: GenerationResult = {
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		try {
			// Get the model product details
			const modelProduct = await this.knex('products').where('id', productId).first();

			if (!modelProduct) {
				throw new Error(`Product ${productId} not found`);
			}

			if (modelProduct.product_type !== 'product_model') {
				throw new Error(`Product ${productId} is not a model type`);
			}

			if (!modelProduct.family_variant) {
				this.logger.info(`Product ${productId} has no family variant, skipping variant generation`);
				return result;
			}

			// Get variant axes and their selected values
			const axes = await this.getVariantAxes(modelProduct.family_variant);

			if (axes.length === 0) {
				this.logger.info(`No variant axes configured for family variant ${modelProduct.family_variant}`);
				return result;
			}

			// Get selected attribute options from product_variant_selections
			const selectedOptions = await this.getProductSelectedOptions(productId, axes);

			// Generate all possible combinations
			const combinations = this.generateVariantCombinations(axes, selectedOptions);

			this.logger.info(`Generated ${combinations.length} variant combinations for product ${productId}`);

			// Get existing variants
			const existingVariants = await this.knex('products')
				.where('parent_product_id', productId)
				.where('product_type', 'simple')
				.select('id');

			const existingIds = new Set(existingVariants.map((v) => v.id));

			// Create missing variants
			const variantsToCreate: Array<{
				modelProduct: Record<string, any>;
				combination: VariantCombination;
			}> = [];

			for (const combination of combinations) {
				// Create all combinations as new variants
				variantsToCreate.push({
					modelProduct,
					combination,
				});
			}

			// Use transaction for consistency
			await this.knex.transaction(async (trx) => {
				// Delete existing variants first (before creating new ones)
				if (existingIds.size > 0) {
					await this.deleteVariants(Array.from(existingIds), trx);
					result.deleted = existingIds.size;
				}

				// Then create new variants
				if (variantsToCreate.length > 0) {
					await this.createVariants(variantsToCreate, trx);
					result.created = variantsToCreate.length;
				}
			});

			// Log generation results
			await this.logGeneration(modelProduct.family_variant, productId, 'generate', result);

			return result;
		} catch (error) {
			this.logger.error(`Error generating variants for product ${productId}:`, error);
			result.errors.push(error instanceof Error ? error.message : String(error));
			return result;
		}
	}

	/**
	 * Get variant axes for a family variant
	 */
	private async getVariantAxes(familyVariantId: number): Promise<VariantAxis[]> {
		const axes = await this.knex('family_variants_axes as fva')
			.join('attributes as a', 'fva.attributes_id', 'a.id')
			.where('fva.family_variants_id', familyVariantId)
			.orderBy('fva.sort')
			.select('fva.id', 'fva.attributes_id as attribute_id', 'a.code as attribute_code', 'fva.sort');

		return axes;
	}

	/**
	 * Get selected attribute options for a specific product
	 * First tries variant_configuration field (new approach)
	 * Then falls back to product_variant_selections (for existing data)
	 */
	private async getProductSelectedOptions(
		productId: number,
		axes: VariantAxis[],
	): Promise<Map<number, AttributeOption[]>> {
		const optionMap = new Map<number, AttributeOption[]>();

		// First try to get configuration from variant_configuration field
		try {
			const product = await this.knex('products').where('id', productId).first();

			if (product && product.variant_configuration) {
				const selectedConfig =
					typeof product.variant_configuration === 'string'
						? JSON.parse(product.variant_configuration)
						: product.variant_configuration;

				// Process each axis
				for (const axis of axes) {
					const selectedOptionIds = selectedConfig[axis.id] || [];

					if (selectedOptionIds.length > 0) {
						const options = await this.knex('attribute_options')
							.whereIn('id', selectedOptionIds)
							.where('attribute_id', axis.attribute_id)
							.select('id', 'value', 'label', 'code', 'attribute_id');

						if (options.length > 0) {
							optionMap.set(axis.attribute_id, options);
							this.logger.info(
								`Found ${options.length} configured options for product ${productId}, attribute ${axis.attribute_code}`,
							);
						}
					}
				}

				// If we found configuration, return it
				if (optionMap.size > 0) {
					return optionMap;
				}
			}
		} catch (error) {
			this.logger.warn('Error reading variant_configuration field, falling back to selections:', error);
		}

		// Fallback to product_variant_selections for backward compatibility
		for (const axis of axes) {
			try {
				// Get selected options from product_variant_selections table
				const selectedOptions = await this.knex('product_variant_selections as pvs')
					.join('attribute_options as ao', 'pvs.attribute_option_id', 'ao.id')
					.where('pvs.product_id', productId)
					.where('pvs.attribute_id', axis.attribute_id)
					.where('pvs.is_selected', true)
					.orderBy('pvs.sort', 'asc')
					.select('ao.id', 'ao.value', 'ao.label', 'ao.code', 'ao.attribute_id');

				if (selectedOptions.length > 0) {
					optionMap.set(axis.attribute_id, selectedOptions);
					this.logger.info(
						`Found ${selectedOptions.length} selected options for product ${productId}, attribute ${axis.attribute_code}`,
					);
				} else {
					this.logger.warn(`No selected options found for product ${productId}, attribute ${axis.attribute_code}`);
				}
			} catch (error) {
				this.logger.error(
					`Error getting selected options for product ${productId}, attribute ${axis.attribute_code}:`,
					error,
				);
			}
		}

		return optionMap;
	}

	/**
	 * Generate all possible variant combinations from axes and their options
	 */
	private generateVariantCombinations(
		axes: VariantAxis[],
		selectedOptions: Map<number, AttributeOption[]>,
	): VariantCombination[] {
		if (axes.length === 0) return [];

		const combinations: VariantCombination[] = [];

		// Recursive function to generate combinations
		const generateCombination = (axisIndex: number, currentCombination: VariantCombination): void => {
			if (axisIndex === axes.length) {
				combinations.push({ ...currentCombination });
				return;
			}

			const axis = axes[axisIndex];
			const options = selectedOptions.get(axis.attribute_id) || [];

			for (const option of options) {
				currentCombination[axis.attribute_code] = {
					id: option.id,
					value: option.value,
					label: option.label,
					code: option.code,
					attribute_id: option.attribute_id,
				};
				generateCombination(axisIndex + 1, currentCombination);
			}
		};

		generateCombination(0, {});
		return combinations;
	}


	/**
	 * Create variant products in batch
	 */
	private async createVariants(
		variants: Array<{
			modelProduct: Record<string, any>;
			combination: VariantCombination;
		}>,
		trx: Knex.Transaction,
	): Promise<void> {
		// Use ItemsService to create products so hooks are triggered
		const ItemsService = this.services.ItemsService;
		const productsService = new ItemsService('products', {
			knex: trx,
			accountability: this.accountability,
			schema: this.schema,
		});

		// Create products one by one to ensure hooks are triggered
		const createdProducts = [];
		for (const variant of variants) {
			const productData = {
				id: randomUUID(),
				uuid: randomUUID(),
				parent_product_id: variant.modelProduct.id,
				product_type: 'simple',
				family: variant.modelProduct.family,
				family_variant: variant.modelProduct.family_variant,
				enabled: false, // Start disabled, can be enabled later
				user_created: this.accountability?.user || null,
				date_created: new Date().toISOString(),
			};

			const createdId = await productsService.createOne(productData);
			createdProducts.push({ id: createdId });
		}

		// Create a map of index to product ID
		const indexToId = new Map(createdProducts.map((p, i) => [i, p.id]));

		// Prepare attribute assignments
		const attributeAssignments = [];

		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i];
			const productId = indexToId.get(i);
			if (!productId) continue;

			for (const [, attributeData] of Object.entries(variant.combination)) {
				// Store the full attribute option value as JSON
				attributeAssignments.push({
					product_id: productId,
					attribute_id: attributeData.attribute_id,
					value: JSON.stringify(attributeData.value),
					created_by: this.accountability?.user || null,
					date_created: new Date().toISOString(),
				});
			}
		}

		// Insert attribute assignments in batch
		if (attributeAssignments.length > 0) {
			await trx('product_attributes').insert(attributeAssignments);
		}

		this.logger.info(
			`Created ${createdProducts.length} variant products with ${attributeAssignments.length} attribute assignments`,
		);
	}

	/**
	 * Delete obsolete variants
	 */
	private async deleteVariants(variantIds: string[], trx: Knex.Transaction): Promise<void> {
		// First delete attribute assignments
		await trx('product_attributes').whereIn('product_id', variantIds).delete();

		// Then delete the variant products
		await trx('products').whereIn('id', variantIds).delete();

		this.logger.info(`Deleted ${variantIds.length} obsolete variant products`);
	}

	/**
	 * Get the number of variant combinations that would be generated
	 * for a product (for UX preview)
	 */
	async getVariantCombinationCount(productId: number): Promise<number> {
		try {
			const product = await this.knex('products').where('id', productId).first();

			if (!product || !product.family_variant) {
				return 0;
			}

			// Get variant axes
			const axes = await this.getVariantAxes(product.family_variant);

			if (axes.length === 0) {
				return 0;
			}

			// Get selected options for each axis
			const selectedOptions = await this.getProductSelectedOptions(productId, axes);

			// Calculate total combinations
			let totalCombinations = 1;

			for (const axis of axes) {
				const options = selectedOptions.get(axis.attribute_id) || [];
				totalCombinations *= options.length;
			}

			return totalCombinations;
		} catch (error) {
			this.logger.error(`Error calculating variant combination count for product ${productId}:`, error);
			return 0;
		}
	}

	/**
	 * Get detailed combination breakdown for UX preview
	 */
	async getVariantCombinationBreakdown(productId: number): Promise<{
		axes: Array<{
			attribute_code: string;
			attribute_label: string;
			selected_count: number;
			total_count: number;
		}>;
		total_combinations: number;
	}> {
		try {
			const product = await this.knex('products').where('id', productId).first();

			if (!product || !product.family_variant) {
				return { axes: [], total_combinations: 0 };
			}

			const axes = await this.getVariantAxes(product.family_variant);
			const selectedOptions = await this.getProductSelectedOptions(productId, axes);

			const breakdown = {
				axes: [] as Array<{
					attribute_code: string;
					attribute_label: string;
					selected_count: number;
					total_count: number;
				}>,
				total_combinations: 1,
			};

			for (const axis of axes) {
				const options = selectedOptions.get(axis.attribute_id) || [];

				// Get total count for this attribute
				const totalOptions = await this.knex('attribute_options')
					.where('attribute_id', axis.attribute_id)
					.count('id as count')
					.first();

				// Get attribute label
				const attribute = await this.knex('attributes').where('id', axis.attribute_id).select('label').first();

				const axisInfo = {
					attribute_code: axis.attribute_code,
					attribute_label: attribute?.label || axis.attribute_code,
					selected_count: options.length,
					total_count: Number(totalOptions?.count || 0),
				};

				breakdown.axes.push(axisInfo);
				breakdown.total_combinations *= options.length;
			}

			return breakdown;
		} catch (error) {
			this.logger.error(`Error getting variant combination breakdown for product ${productId}:`, error);
			return { axes: [], total_combinations: 0 };
		}
	}

	/**
	 * Log variant generation activity
	 */
	private async logGeneration(
		familyVariantId: number,
		modelProductId: number | null,
		action: string,
		result: GenerationResult,
	): Promise<void> {
		try {
			// Check if the table exists
			const hasLogsTable = await this.knex.schema.hasTable('variant_generation_logs');

			if (hasLogsTable) {
				await this.knex('variant_generation_logs').insert({
					family_variant_id: familyVariantId,
					model_product_id: modelProductId,
					action,
					variants_created: result.created,
					variants_updated: result.updated,
					variants_deleted: result.deleted,
					details: JSON.stringify({
						errors: result.errors,
						timestamp: new Date().toISOString(),
					}),
					user_created: this.accountability?.user || null,
					date_created: new Date().toISOString(),
				});
			} else {
				this.logger.info(
					`Variant generation completed - Created: ${result.created}, Deleted: ${result.deleted}, Errors: ${result.errors.length}`,
				);
			}
		} catch (error) {
			// Log to console if database logging fails
			this.logger.info(
				`Variant generation completed - Created: ${result.created}, Deleted: ${result.deleted}, Errors: ${result.errors.length}`,
			);
		}
	}


	/**
	 * Generate a consistent key for variant attribute combination
	 */
	private generateCombinationKey(attributes: Map<number, any>): string {
		const sortedEntries = Array.from(attributes.entries())
			.sort(([a], [b]) => a - b)
			.map(([attrId, value]) => {
				// Normalize the value for comparison
				let normalizedValue = value;
				if (typeof value === 'string') {
					try {
						normalizedValue = JSON.parse(value);
					} catch {
						// Keep as string if not JSON
					}
				}
				// For objects, extract the ID or use the whole value
				if (normalizedValue && typeof normalizedValue === 'object' && normalizedValue.id) {
					normalizedValue = normalizedValue.id;
				}
				return `${attrId}:${JSON.stringify(normalizedValue)}`;
			});
		return sortedEntries.join('|');
	}

	/**
	 * Update existing variants with new data
	 */
	private async updateExistingVariants(
		variantsToUpdate: Array<{ variantId: string; preparedData: any }>,
		trx: Knex.Transaction,
	): Promise<void> {
		const ItemsService = this.services.ItemsService;
		const productsService = new ItemsService('products', {
			knex: trx,
			accountability: this.accountability,
			schema: this.schema,
		});

		for (const { variantId, preparedData } of variantsToUpdate) {
			// Prepare update data
			const updateData: any = {
				enabled: preparedData.enabled !== undefined ? preparedData.enabled : true,
			};

			// Add attributes if provided
			if (preparedData.name || preparedData.price || preparedData.attributes) {
				updateData.attributes = [] as Array<{
					attribute_id: number;
					value: string | null;
				}>;

				// Get name and price attributes
				const nameAttribute = await trx('attributes').where('code', 'name').first();
				const priceAttribute = await trx('attributes').where('code', 'price').first();

				// Add name if provided
				if (preparedData.name && nameAttribute) {
					updateData.attributes.push({
						attribute_id: nameAttribute.id,
						value: JSON.stringify(preparedData.name),
					});
				}

				// Add price if provided
				if (preparedData.price !== null && preparedData.price !== undefined && priceAttribute) {
					updateData.attributes.push({
						attribute_id: priceAttribute.id,
						value: JSON.stringify(preparedData.price),
					});
				}

				// Add variant attributes
				if (preparedData.attributes) {
					for (const attr of preparedData.attributes) {
						let preparedValue: any;
						if (attr.value && typeof attr.value === 'object') {
							preparedValue = JSON.stringify(attr.value);
						} else if (
							typeof attr.value === 'string' ||
							typeof attr.value === 'number' ||
							typeof attr.value === 'boolean'
						) {
							preparedValue = JSON.stringify(attr.value);
						} else {
							preparedValue = null;
						}

						updateData.attributes.push({
							attribute_id: attr.attribute_id,
							value: preparedValue,
						});
					}
				}
			}

			// Update the variant
			await productsService.updateOne(variantId, updateData);

			// Handle image updates separately
			if (preparedData.image) {
				await this.updateVariantImage(variantId, preparedData.image, trx);
			}
		}

		this.logger.info(`Updated ${variantsToUpdate.length} existing variants`);
	}

	/**
	 * Create new variants with prepared data
	 */
	private async createNewVariants(
		variantsToCreate: Array<{ preparedData: any; combinationKey: string }>,
		modelProduct: Record<string, any>,
		trx: Knex.Transaction,
	): Promise<void> {
		const ItemsService = this.services.ItemsService;
		const productsService = new ItemsService('products', {
			knex: trx,
			accountability: this.accountability,
			schema: this.schema,
		});

		const createdProducts = [];
		for (const { preparedData } of variantsToCreate) {
			const productData = {
				id: randomUUID(),
				uuid: randomUUID(),
				parent_product_id: modelProduct.id,
				product_type: 'simple',
				family: modelProduct.family,
				family_variant: modelProduct.family_variant,
				enabled: preparedData.enabled || false,
				user_created: this.accountability?.user || null,
				date_created: new Date().toISOString(),
				attributes: [] as Array<{
					attribute_id: number;
					value: string;
				}>,
			};

			// Add name, price and variant attributes
			const nameAttribute = await trx('attributes').where('code', 'name').first();
			const priceAttribute = await trx('attributes').where('code', 'price').first();

			// Add name as attribute if provided
			if (preparedData.name && nameAttribute) {
				productData.attributes.push({
					attribute_id: nameAttribute.id,
					value: JSON.stringify(preparedData.name),
				});
			}

			// Add price as attribute if provided
			if (preparedData.price !== null && preparedData.price !== undefined && priceAttribute) {
				productData.attributes.push({
					attribute_id: priceAttribute.id,
					value: JSON.stringify(preparedData.price),
				});
			}

			// Add variant attributes
			if (preparedData.attributes) {
				for (const attributeData of preparedData.attributes) {
					let preparedValue: any;
					if (attributeData.value && typeof attributeData.value === 'object') {
						preparedValue = JSON.stringify(attributeData.value);
					} else if (
						typeof attributeData.value === 'string' ||
						typeof attributeData.value === 'number' ||
						typeof attributeData.value === 'boolean'
					) {
						preparedValue = JSON.stringify(attributeData.value);
					} else {
						preparedValue = null;
					}

					productData.attributes.push({
						attribute_id: attributeData.attribute_id,
						value: preparedValue,
					});
				}
			}

			const createdId = await productsService.createOne(productData);
			createdProducts.push({ id: createdId, preparedData });
		}

		// Handle product images for new variants
		for (const { id: variantId, preparedData } of createdProducts) {
			if (preparedData.image) {
				await this.updateVariantImage(variantId, preparedData.image, trx);
			}
		}

		this.logger.info(`Created ${createdProducts.length} new variants`);
	}

	/**
	 * Update or create variant image
	 */
	private async updateVariantImage(variantId: string, imageId: string, trx: Knex.Transaction): Promise<void> {
		try {
			// Remove existing image assignments for this variant
			const existingImageAssignments = await trx('products_product_images')
				.where('products_id', variantId)
				.select('product_images_id');

			if (existingImageAssignments.length > 0) {
				const imageIds = existingImageAssignments.map((r) => r.product_images_id);
				await trx('products_product_images').where('products_id', variantId).delete();
				await trx('product_images').whereIn('id', imageIds).delete();
			}

			// Create new image assignment
			const result = await trx('product_images').insert({
				id: randomUUID(),
				media: imageId,
				role: JSON.stringify(['base']), // JSON stringified array for dropdown multiple
				sort: 1,
			}).returning('id');

			const productImageId = result[0]?.id || result[0];

			if (productImageId) {
				await trx('products_product_images').insert({
					products_id: variantId,
					product_images_id: productImageId,
				});
			}
		} catch (error) {
			this.logger.warn(`Failed to update image for variant ${variantId}:`, error);
		}
	}

	/**
	 * Create variants from prepared data (legacy method for backward compatibility)
	 */
	private async createPreparedVariants(
		variants: Array<{
			modelProduct: Record<string, any>;
			combination: any;
			preparedData: any;
		}>,
		trx: Knex.Transaction,
	): Promise<void> {
		// Use ItemsService to create products so hooks are triggered
		const ItemsService = this.services.ItemsService;
		const productsService = new ItemsService('products', {
			knex: trx,
			accountability: this.accountability,
			schema: this.schema,
		});

		// Create products one by one to ensure hooks are triggered (including SKU generation)
		const createdProducts = [];
		for (const variant of variants) {
			const productData = {
				id: randomUUID(),
				uuid: randomUUID(),
				parent_product_id: variant.modelProduct.id,
				product_type: 'simple',
				family: variant.modelProduct.family,
				family_variant: variant.modelProduct.family_variant,
				enabled: variant.preparedData.enabled || false,
				user_created: this.accountability?.user || null,
				date_created: new Date().toISOString(),
				// Add attributes array to trigger SKU generation
				attributes: [],
			};

			// Add name, price and variant attributes
			const nameAttribute = await trx('attributes').where('code', 'name').first();
			const priceAttribute = await trx('attributes').where('code', 'price').first();

			// Add name as attribute if provided
			if (variant.preparedData.name && nameAttribute) {
				productData.attributes.push({
					attribute_id: nameAttribute.id,
					value: JSON.stringify(variant.preparedData.name),
				});
			}

			// Add price as attribute if provided
			if (variant.preparedData.price !== null && variant.preparedData.price !== undefined && priceAttribute) {
				productData.attributes.push({
					attribute_id: priceAttribute.id,
					value: JSON.stringify(variant.preparedData.price),
				});
			}

			// Add variant attributes
			for (const attributeData of variant.preparedData.attributes) {
				// Prepare value for database storage based on the attribute value structure
				let preparedValue: any;

				if (attributeData.value && typeof attributeData.value === 'object') {
					// If it's an object (like from reference collections), stringify it
					preparedValue = JSON.stringify(attributeData.value);
				} else if (
					typeof attributeData.value === 'string' ||
					typeof attributeData.value === 'number' ||
					typeof attributeData.value === 'boolean'
				) {
					// For simple scalar values, store as-is but still stringify for JSON column
					preparedValue = JSON.stringify(attributeData.value);
				} else {
					// For null/undefined, store as null
					preparedValue = null;
				}

				productData.attributes.push({
					attribute_id: attributeData.attribute_id,
					value: preparedValue,
				});
			}

			const createdId = await productsService.createOne(productData);
			createdProducts.push({ id: createdId });
		}


		// Handle product assets (images) if provided
		const assetAssignments = [];
		for (let i = 0; i < variants.length; i++) {
			const variant = variants[i];
			const productId = createdProducts[i]?.id;
			if (!productId || !variant.preparedData.image) continue;

			assetAssignments.push({
				product_id: productId,
				directus_files_id: variant.preparedData.image,
			});
		}

		// Handle product images (via m2m relationship) instead of direct product_assets
		const imageAssignments = [];
		for (let i = 0; i < assetAssignments.length; i++) {
			const asset = assetAssignments[i];
			try {
				// First create a product_images record
				const result = await trx('product_images').insert({
					id: randomUUID(),
					media: asset.directus_files_id, // Reference to directus_files
					role: JSON.stringify(['base']), // JSON stringified array for dropdown multiple
					sort: 1,
				}).returning('id');

				// Extract the ID from the result
				const productImageId = result[0]?.id || result[0];

				if (productImageId) {
					// Then create the junction record
					imageAssignments.push({
						products_id: asset.product_id,
						product_images_id: productImageId,
					});
				} else {
					this.logger.warn(`No ID returned when creating product image for product ${asset.product_id}`);
				}
			} catch (error) {
				this.logger.warn(`Failed to create product image for product ${asset.product_id}:`, error);
			}
		}

		// Insert junction records if any
		if (imageAssignments.length > 0) {
			try {
				await trx('products_product_images').insert(imageAssignments);
				this.logger.info(`Created ${imageAssignments.length} product image assignments`);
			} catch (error) {
				this.logger.warn('Could not insert product image assignments:', error);
			}
		}

		this.logger.info(
			`Created ${createdProducts.length} variant products with ${imageAssignments.length} image assignments`,
		);
	}
}
