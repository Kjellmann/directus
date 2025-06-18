import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint({
  id: 'product-grid',
  handler: (router, context) => {
    const { services, getSchema, logger, database } = context;
    const { ItemsService } = services;

    // Enhanced products endpoint with attribute filtering/sorting
    router.get('/products', async (req, res) => {
      try {
        // Get schema for database operations
        const schema = await getSchema();
        const accountability = req.accountability;
        
        const {
          limit = 25,
          page = 1,
          sort,
          search,
          filter,
          attribute_filters
        } = req.query;
        
        // Calculate offset from page
        const offset = (Number(page) - 1) * Number(limit);
        
        // Parse filter if it's a string
        const parsedFilter = filter && typeof filter === 'string' ? JSON.parse(filter) : filter || {};
        
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
        
        // Build query - always get all data if we need attribute sorting later
        let products;
        let total;
        let needsAttributeSort = isAttributeSort;
        
        const query = {
          limit: needsAttributeSort ? -1 : Number(limit),
          offset: needsAttributeSort ? 0 : offset,
          sort: needsAttributeSort ? ['-date_created'] : (sort ? [sort] : ['-date_created']),
          filter: parsedFilter,
          search: search ? String(search) : undefined,
          fields: ['*']
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
            filter: parsedFilter,
            search: search ? String(search) : undefined
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
                products_id: { _in: products.map(p => p.id) }
              },
              fields: ['*', 'assets_id.*', 'assets_id.media_file'],
              sort: ['sort'],
              limit: -1
            });
            
            logger.info(`Found product assets: ${productAssets.length}`);
            
            // Log structure of first asset to understand the data
            if (productAssets.length > 0) {
              logger.info('First asset structure:', JSON.stringify(productAssets[0], null, 2));
            }
            
            // Group assets by product
            const assetMap = new Map();
            productAssets.forEach(pa => {
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
              const imageAsset = assets.find(pa => pa.assets_id?.media_file);
              
              if (imageAsset?.assets_id?.media_file) {
                // media_file is already the file ID we need
                product.primary_image = imageAsset.assets_id.media_file;
                
                // Debug log for SKU 10000132
                if (product.id === 'ea4c19a9-bb4a-417b-b8db-49842c252619') {
                  logger.info(`Product SKU 10000132: Set primary_image to ${product.primary_image}`);
                }
              } else {
                product.primary_image = null;
              }
            });
            
            // Get searchable attributes
            const attributesService = new ItemsService('attributes', { schema, accountability });
            const attributes = await attributesService.readByQuery({
              filter: { is_searchable: true },
              fields: ['id', 'code', 'label'],
              limit: -1
            });
            
            logger.info(`Found searchable attributes: ${attributes.length}`);
            
            if (attributes.length > 0) {
              // Get attribute values
              const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
              const attrValues = await productAttributesService.readByQuery({
                filter: {
                  product_id: { _in: products.map(p => p.id) },
                  attribute_id: { _in: attributes.map(a => a.id) }
                },
                fields: ['product_id', 'attribute_id', 'value'],
                limit: -1
              });
              
              logger.info(`Found attribute values: ${attrValues.length}`);
              if (attrValues.length > 0) {
                logger.info('First attribute value:', JSON.stringify(attrValues[0]));
              }
              
              // Build value map
              const valueMap = new Map();
              attrValues.forEach(v => {
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
                attributes.forEach(attr => {
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
            products.forEach(product => {
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
            total_count: Number(total)
          }
        });
      } catch (error) {
        logger.error('Product grid error:', error);
        res.status(500).json({ 
          error: 'Failed to load products',
          message: error.message
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
            limit: -1
          });

          // Get all attribute values
          const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
          const values = await productAttributesService.readByQuery({
            filter: {
              product_id: { _in: products.map(p => p.id) },
              attribute_id: { _in: attributes.map(a => a.id) }
            },
            fields: ['product_id', 'attribute_id', 'value'],
            limit: -1
          });

          // Build value map
          const valueMap = new Map();
          values.forEach(v => {
            const key = `${v.product_id}_${v.attribute_id}`;
            try {
              const parsed = JSON.parse(v.value);
              valueMap.set(key, parsed?.value ?? parsed);
            } catch {
              valueMap.set(key, v.value);
            }
          });

          // Add attribute values to products
          products.forEach(product => {
            attributes.forEach(attr => {
              const key = `${product.id}_${attr.id}`;
              product[`attr_${attr.code}`] = valueMap.get(key) ?? null;
            });
          });
        }

        if (format === 'csv') {
          // Convert to CSV
          const fields = Object.keys(products[0] || {});
          const csv = [
            fields.join(','),
            ...products.map(p => 
              fields.map(f => {
                const val = p[f];
                if (val === null) return '';
                if (typeof val === 'string' && val.includes(',')) {
                  return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
              }).join(',')
            )
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
  }
});