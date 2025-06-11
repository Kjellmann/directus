# Directus PIM Extensions

This directory contains custom extensions for the Directus-based Product Information Management (PIM) system.

## Extensions

### 1. Product Attributes Values Interface
**Location**: `/product-attributes-values`
**Type**: Interface Extension

A custom interface for managing product attribute values with:
- Metric unit support for numeric attributes
- Visual grouping by attribute groups
- Inline editing capabilities
- Group detail button integration

### 2. SKU Generator
**Location**: `/sku-generator`
**Type**: Hook Extension

Advanced SKU generation system for products:
- Conditional SKU generation based on configurable rules
- Multiple generation strategies (free text, attribute values, auto-numbering)
- Support for nomenclature mapping and value formatting
- Auto-number scanning to prevent duplicates
- Text transformation options (uppercase/lowercase)

**Key Features**:
- Rule-based generator selection using product attributes
- Flexible SKU composition with delimiters
- Transaction-safe auto-number incrementing
- Comprehensive logging for debugging
- Graceful fallback when generation fails

### 3. Variant Generator Hooks
**Location**: `/variant-generator-hooks`
**Type**: Hook Extension

Automatic hooks for product variant generation:
- Triggers on family variant axes changes
- Triggers on product creation/updates (for `product_type = 'product_model'`)
- Handles attribute value additions/deletions
- Manages variant lifecycle automatically

**Key Features**:
- Supports both JSON-based selections (legacy) and relationship-based selections
- Product-level variant selection support via `product_variant_selections` table
- Automatic cleanup of obsolete variants
- Transaction-based operations for data consistency

### 4. Variant Generator Operation
**Location**: `/variant-generator-operation`
**Type**: Flow Operation Extension

Manual flow operation for variant generation with modes:
- `product`: Generate variants for a specific product
- `family_variant`: Generate variants for all products using a family variant
- `all`: Generate variants for all family variants in the system

## Product Variant Generation System

### Overview
The system generates product variants based on family variant axes. Key concepts:

- **Family Variants**: Define which attributes can vary (e.g., Color, Size)
- **Product Models** (`product_type = 'product_model'`): Main products that can have variants
- **Product Variants** (`product_type = 'simple'`): Generated variant products
- **Variant Axes**: Attributes that create variations

### Variant Selection Approaches

1. **Product-Level Selection** (Recommended for new implementations)
   - Uses `product_variant_selections` table
   - Selections managed per product_model
   - Provides granular control over which values generate variants

2. **Family Variant Level Selection** (Legacy/Fallback)
   - Uses JSON field `selected_value_ids` in family_variant_axes
   - Selections apply to all products using the family variant

3. **Automatic Selection** (Default)
   - If no selections configured, uses all attribute values

### Database Requirements

For product-level variant selection, create:

```sql
CREATE TABLE product_variant_selections (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id INT NOT NULL REFERENCES attributes(id),
    attribute_value_id INT NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
    is_selected BOOLEAN DEFAULT true,
    sort INT DEFAULT 1,
    UNIQUE(product_id, attribute_value_id)
);
```

## Installation

1. Ensure all extensions are built:
```bash
cd variant-generator-hooks && npm run build
cd ../variant-generator-operation && npm run build
cd ../product-attributes-values && npm run build
```

2. Restart Directus to load extensions

## Usage

### Automatic Variant Generation
Variants are automatically generated when:
- A product_model is created with a family_variant
- Family variant axes are modified
- Attribute values are added/removed

### Manual Variant Generation
Use the Flow Operation in Directus Flows:
1. Create a new Flow
2. Add the "Generate Product Variants" operation
3. Configure mode and parameters
4. Execute manually or via trigger

## Notes

- The system maintains backward compatibility with existing JSON-based selections
- SKU generation is handled by the existing SKU generator (not included in these extensions)
- All operations use transactions for data consistency
- Comprehensive logging available in `variant_generation_logs` table