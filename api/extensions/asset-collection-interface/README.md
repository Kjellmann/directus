# Simplified Asset Collection Interface

A streamlined asset management interface for Directus, inspired by Akeneo PIM's approach to digital asset management.

## Overview

This extension provides a simple, flexible way to manage product assets in Directus. It focuses on the core essentials:

- **Asset Families** - Templates for different types of assets (e.g., Product Images, Documents, Videos)
- **Assets** - Media files with basic metadata (code, label, family)
- **Product Assets** - Simple linking between products and assets

## Key Features

### Simple & Clean Interface
- Grid view of attached assets
- Easy add/remove functionality
- Basic edit capabilities for asset labels

### Flexible Asset Management
- Upload new assets directly
- Select from existing asset library
- Automatic asset code generation from filenames

### No Hardcoded Values
- Asset families loaded dynamically from database
- All configuration done through Directus admin
- Extensible through custom attributes

## Database Structure

### Required Collections (Only 3!)

1. **asset_families**
   - `id` - UUID primary key
   - `code` - Unique identifier
   - `name` - Display name
   - `description` - Optional description
   - `folder` - Reference to Directus folder for uploads

2. **assets**
   - `id` - UUID primary key
   - `code` - Unique asset code
   - `label` - Display label
   - `media_file` - Reference to Directus file
   - `asset_family` - Reference to asset family

3. **product_assets**
   - `id` - UUID primary key
   - `products_id` - Reference to product
   - `assets_id` - Reference to asset
   - `sort` - Sort order

### NOT Needed:
- ❌ **asset_family_attributes** - Use Directus's native field management instead
- ❌ **product_link_rules** - Manual selection gives better control
- ❌ **Complex metadata tables** - Keep it simple!

## Usage

1. **Create Asset Families** in Directus admin
   - Navigate to Asset Families collection
   - Add families like "Product Images", "Documents", etc.
   - Optionally set a default upload folder for each family

2. **Add Assets to Products**
   - Edit any product
   - Use the Asset Collection interface
   - Upload new or select existing assets

3. **Manage Assets**
   - Click on any asset to edit its label
   - Remove assets with the X button
   - Reorder by updating sort values

## Extension Configuration

The interface accepts a single configuration option:

- **collection** - The collection to link assets to (default: "products")

## Customization

### Adding Custom Attributes

You can extend assets with custom fields by:

1. Adding fields to the `assets` table in Directus
2. Or using the `attributes` JSONB field for dynamic properties

### Supporting Other Collections

The interface automatically adapts to any collection by using:
```javascript
`${props.collection}_id`
```

This means you can use it for categories, brands, or any other collection that needs assets.

## Benefits Over Complex Solutions

- **Simplicity** - Focus on core asset management needs
- **Flexibility** - Easy to extend without modifying code
- **Performance** - Minimal database queries and simple structure
- **Maintainability** - Clean, understandable codebase
- **No Lock-in** - Standard Directus collections and relationships