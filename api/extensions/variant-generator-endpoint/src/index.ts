import type { EndpointConfig } from '@directus/extensions';
import { VariantGeneratorService } from '../variant-configuration/src/variant-generator-service';

const endpoints: EndpointConfig = {
	id: 'variant-generator',
	handler: (router, context) => {
		const { services, getSchema, database, logger } = context;

		router.post('/trigger/variant-generator', async (req, res) => {
			try {
				const accountability = (req as any).accountability;
				
				if (!accountability || !accountability.user) {
					return res.status(401).json({
						errors: [{
							message: 'Unauthorized',
							extensions: { code: 'UNAUTHORIZED' }
						}]
					});
				}

				const { mode, productId, familyVariantId, preparedVariants } = req.body;

				// Validate input
				if (!mode || !['product', 'family_variant', 'all'].includes(mode)) {
					return res.status(400).json({
						errors: [{
							message: 'Invalid mode. Must be one of: product, family_variant, all',
							extensions: { code: 'INVALID_PAYLOAD' }
						}]
					});
				}

				if (mode === 'product' && !productId) {
					return res.status(400).json({
						errors: [{
							message: 'Product ID is required when mode is "product"',
							extensions: { code: 'INVALID_PAYLOAD' }
						}]
					});
				}

				if (mode === 'family_variant' && !familyVariantId) {
					return res.status(400).json({
						errors: [{
							message: 'Family Variant ID is required when mode is "family_variant"',
							extensions: { code: 'INVALID_PAYLOAD' }
						}]
					});
				}

				// Initialize the variant generator service
				const schema = await getSchema({ database });
				const variantService = new VariantGeneratorService({
					knex: database as any,
					accountability: accountability as any,
					schema: schema as any,
					services,
					logger,
				});

				let result = {
					success: true,
					message: '',
					created: 0,
					updated: 0,
					deleted: 0,
					errors: [] as string[],
				};

				switch (mode) {
					case 'product':
						logger.info(`Generating variants for product ${productId}`);
						
						let productResult;
						if (preparedVariants && Array.isArray(preparedVariants) && preparedVariants.length > 0) {
							// Use prepared variant data
							logger.info(`Using prepared variant data with ${preparedVariants.length} variants`);
							productResult = await variantService.generateVariantsFromPrepared(productId, preparedVariants);
						} else {
							// Use existing configuration-based generation
							productResult = await variantService.generateVariantsForProduct(productId);
						}
						
						result.created = productResult.created;
						result.updated = productResult.updated;
						result.deleted = productResult.deleted;
						result.errors = productResult.errors;
						result.message = `Generated ${productResult.created} variants for product ${productId}`;
						break;

					case 'family_variant':
						logger.info(`Generating variants for family variant ${familyVariantId}`);
						const familyResult = await variantService.generateVariantsForFamilyVariant(familyVariantId);
						
						result.created = familyResult.created;
						result.updated = familyResult.updated;
						result.deleted = familyResult.deleted;
						result.errors = familyResult.errors;
						result.message = `Generated ${familyResult.created} variants for family variant ${familyVariantId}`;
						break;

					case 'all':
						logger.info('Generating variants for all family variants');
						
						// Get all family variants
						const familyVariants = await database('family_variants').select('id');
						
						for (const fv of familyVariants) {
							const fvResult = await variantService.generateVariantsForFamilyVariant(fv.id);
							result.created += fvResult.created;
							result.updated += fvResult.updated;
							result.deleted += fvResult.deleted;
							result.errors.push(...fvResult.errors);
						}
						
						result.message = `Generated ${result.created} variants across ${familyVariants.length} family variants`;
						break;
				}

				// Add summary to message
				if (result.deleted > 0) {
					result.message += `, deleted ${result.deleted} obsolete variants`;
				}

				if (result.errors.length > 0) {
					result.success = false;
					result.message += `. Errors: ${result.errors.join(', ')}`;
				}

				res.json(result);

			} catch (error) {
				logger.error('Variant generation endpoint failed:', error);
				
				res.status(500).json({
					errors: [{
						message: error instanceof Error ? error.message : 'Internal server error',
						extensions: { code: 'INTERNAL_SERVER_ERROR' }
					}]
				});
			}
		});
	},
};

export default endpoints;