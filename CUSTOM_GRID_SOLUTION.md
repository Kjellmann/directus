# Custom Product Grid Solution

## Overview
This solution provides a custom product grid layout for Directus that fully supports dynamic product attributes. Instead of trying to force virtual fields into Directus's schema system (which has limitations), we've created a custom layout that works directly with the product attributes system.

## Components

### 1. product-grid-api Extension
Location: `/api/extensions/product-grid-api/`

This endpoint extension provides:
- `/product-grid/products` - Enhanced products endpoint with attribute filtering/sorting
- `/product-grid/products/export` - Export products with attributes in CSV format

Features:
- Standard field filtering (id, enabled, etc.)
- Attribute filtering with support for:
  - Text search
  - Range filters (min/max for numbers)
  - Exact matches
- Sorting by both standard fields and attributes
- Efficient SQL queries with proper joins

### 2. product-grid-layout Extension
Location: `/api/extensions/product-grid-layout/`

This layout extension provides:
- Custom product grid view that replaces the standard Directus collection layout
- Dynamic attribute columns
- Advanced filtering panel
- Sorting capabilities
- Pagination

Features:
- Shows first 5 attributes as columns (configurable)
- Filter panel for both standard fields and attributes
- Click to sort any column
- Click row to edit product
- Responsive design matching Directus UI

## Installation

1. Build the extensions:
```bash
cd api/extensions/product-grid-api && npm run build
cd api/extensions/product-grid-layout && npm run build
```

2. Copy to extensions-enabled:
```bash
cp -r api/extensions/product-grid-api api/extensions-enabled/
cp -r api/extensions/product-grid-layout api/extensions-enabled/
```

3. Restart Directus:
```bash
docker-compose restart
```

## Usage

1. Navigate to the Products collection in Directus
2. Select "Product Grid" from the layout options (grid icon in top right)
3. Use the filter button to show/hide the filter panel
4. Click column headers to sort
5. Click any row to edit that product

## API Usage

The custom endpoint can be used directly:

```bash
# Get products with filtering
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8055/product-grid/products?limit=25&attribute_filters={\"brand\":\"Nike\"}"

# Export products with attributes
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8055/product-grid/products/export?format=csv&include_attributes=true"
```

## Advantages

1. **Full Attribute Support**: Unlike virtual fields, this solution fully supports all attribute types
2. **Performance**: Optimized queries with proper joins and indexes
3. **Flexibility**: Easy to extend with new features
4. **No Permission Issues**: Works within Directus's security model
5. **Export Support**: Built-in CSV export with attributes

## Future Enhancements

1. Column selector to choose which attributes to display
2. Advanced attribute filters (multi-select, date ranges, etc.)
3. Bulk operations support
4. Saved filter presets
5. Excel export format
6. Integration with the existing product-attributes-values interface