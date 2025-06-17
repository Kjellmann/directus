import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint({
  id: 'product-grid',
  handler: (router, context) => {
    const { services, database, logger } = context;

    // Enhanced products endpoint with attribute filtering/sorting
    router.get('/products', async (req, res) => {
      try {
        const {
          limit = 25,
          offset = 0,
          sort,
          search,
          filter = {},
          attribute_filters,
          fields = []
        } = req.query;

        let query = database('products').select('products.*');
        
        // Apply standard filters
        if (filter && typeof filter === 'object') {
          Object.entries(filter).forEach(([field, condition]) => {
            if (typeof condition === 'object' && condition._contains) {
              query = query.where(field, 'like', `%${condition._contains}%`);
            } else if (typeof condition === 'object' && condition._eq) {
              query = query.where(field, '=', condition._eq);
            }
          });
        }

        // Apply attribute filters
        if (attribute_filters) {
          const attrFilters = JSON.parse(attribute_filters);
          
          for (const [attrCode, value] of Object.entries(attrFilters)) {
            if (value === null || value === '') continue;
            
            // Handle range filters
            if (attrCode.endsWith('_min') || attrCode.endsWith('_max')) {
              const baseCode = attrCode.replace(/_min|_max$/, '');
              const isMin = attrCode.endsWith('_min');
              
              query = query.whereIn('products.id', function() {
                this.select('product_id')
                  .from('product_attributes')
                  .join('attributes', 'product_attributes.attribute_id', 'attributes.id')
                  .where('attributes.code', baseCode)
                  .whereRaw(
                    `CAST(JSON_UNQUOTE(JSON_EXTRACT(value, '$.value')) AS DECIMAL) ${isMin ? '>=' : '<='} ?`,
                    [value]
                  );
              });
            } else {
              // Regular attribute filter
              query = query.whereIn('products.id', function() {
                this.select('product_id')
                  .from('product_attributes')
                  .join('attributes', 'product_attributes.attribute_id', 'attributes.id')
                  .where('attributes.code', attrCode)
                  .where(function() {
                    if (typeof value === 'string') {
                      this.whereRaw(
                        `JSON_UNQUOTE(JSON_EXTRACT(value, '$.value')) LIKE ?`,
                        [`%${value}%`]
                      );
                    } else {
                      this.whereRaw(
                        `JSON_UNQUOTE(JSON_EXTRACT(value, '$.value')) = ?`,
                        [value]
                      );
                    }
                  });
              });
            }
          }
        }

        // Apply search
        if (search) {
          // Get searchable attributes
          const searchableAttrs = await database('attributes')
            .where('is_searchable', true)
            .select('id', 'code');
          
          query = query.where(function() {
            // Search in standard fields
            this.where('products.id', 'like', `%${search}%`)
              .orWhere('products.uuid', 'like', `%${search}%`);
            
            // Search in searchable attributes
            if (searchableAttrs.length > 0) {
              this.orWhereIn('products.id', function() {
                this.select('product_id')
                  .from('product_attributes')
                  .whereIn('attribute_id', searchableAttrs.map(a => a.id))
                  .whereRaw(
                    `JSON_UNQUOTE(JSON_EXTRACT(value, '$.value')) LIKE ?`,
                    [`%${search}%`]
                  );
              });
            }
          });
        }

        // Get total count - use a separate query
        const countQuery = database('products').count('* as total');
        
        // Apply same filters to count query
        if (filter && typeof filter === 'object') {
          Object.entries(filter).forEach(([field, condition]) => {
            if (typeof condition === 'object' && condition._contains) {
              countQuery.where(field, 'like', `%${condition._contains}%`);
            } else if (typeof condition === 'object' && condition._eq) {
              countQuery.where(field, '=', condition._eq);
            }
          });
        }
        
        const [{ total }] = await countQuery;

        // Apply sorting
        if (sort) {
          const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
          const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
          
          if (sortField.startsWith('attr_')) {
            // Attribute sorting
            const attrCode = sortField.replace('attr_', '');
            query = query
              .leftJoin('product_attributes as pa_sort', function() {
                this.on('products.id', '=', 'pa_sort.product_id');
              })
              .leftJoin('attributes as a_sort', function() {
                this.on('pa_sort.attribute_id', '=', 'a_sort.id')
                  .andOn('a_sort.code', '=', database.raw('?', [attrCode]));
              })
              .orderByRaw(`JSON_UNQUOTE(JSON_EXTRACT(pa_sort.value, '$.value')) ${sortDir}`);
          } else {
            query = query.orderBy(sortField, sortDir);
          }
        }

        // Apply pagination
        query = query.limit(limit).offset(offset);

        // Execute query
        const products = await query;
        
        // Add attribute values to products
        if (products.length > 0) {
          // Get searchable attributes
          const attributes = await database('attributes')
            .where('is_searchable', true)
            .select('id', 'code', 'label');
          
          if (attributes.length > 0) {
            // Get attribute values for these products
            const values = await database('product_attributes')
              .whereIn('product_id', products.map(p => p.id))
              .whereIn('attribute_id', attributes.map(a => a.id))
              .select('product_id', 'attribute_id', 'value');
            
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
        }

        res.json({
          data: products,
          meta: {
            total_count: total
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
        const { format = 'csv', include_attributes = true } = req.query;

        // Get all products
        const products = await database('products').select('*');

        if (include_attributes === 'true') {
          // Get all grid-enabled attributes
          const attributes = await database('attributes')
            .where('usable_in_grid', true)
            .select('id', 'code', 'label');

          // Get all attribute values
          const values = await database('product_attributes')
            .whereIn('product_id', products.map(p => p.id))
            .whereIn('attribute_id', attributes.map(a => a.id))
            .select('product_id', 'attribute_id', 'value');

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