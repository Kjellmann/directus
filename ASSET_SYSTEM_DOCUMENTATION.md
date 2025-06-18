# Akeneo-Style Asset Management System Documentation

## Overview

This asset management system provides Akeneo-like functionality within Directus, featuring:
- Dynamic asset families and attributes
- Role-based asset organization
- Tag-based categorization
- Automatic completeness calculation
- Collection type grouping (images, videos, documents, etc.)
- Bulk operations and metadata management

## Database Architecture

### Core Tables

1. **asset_families**
   - Defines different types of assets (e.g., Product Images, Marketing Materials)
   - Each family can have custom attributes

2. **assets**
   - Main asset records
   - Links to asset families
   - Stores metadata, tags, and file information
   - Automatic completeness calculation via triggers

3. **product_assets** (Junction Table)
   - Links assets to products
   - Supports multiple collection types per product
   - Stores role, sort order, and enabled status

### Lookup Tables

1. **asset_roles**
   - Predefined roles: packshot, lifestyle, detail, thumbnail, 360, video_main, etc.
   - Fully customizable via Directus interface

2. **asset_collection_types**
   - Groups assets by type: images, videos, documents, downloads
   - Each type has an icon and sort order

3. **asset_tags**
   - Flexible tagging system
   - Custom colors for visual organization

4. **asset_attributes**
   - Dynamic attributes per asset family
   - Supports various field types: text, number, boolean, select, date, media

## Key Features

### 1. Asset Upload & Management
- Drag-and-drop file upload
- Automatic code generation from filenames
- Bulk metadata assignment
- Role and tag selection during upload

### 2. Akeneo-Style Interface
- Tabbed interface grouping assets by:
  - Collection type (default)
  - Asset family
  - Role
- Visual completeness indicators
- Quick actions menu per asset

### 3. Asset Editor
- Edit asset metadata
- Change roles and collection types
- View and manage tags
- Sort order management
- Enable/disable assets

### 4. Smart Organization
- Dynamic grouping strategies
- Configurable collection attributes
- Custom role definitions
- Tag-based filtering

## Interface Configuration

When adding the asset collection field to a product:

```json
{
  "grouping_strategy": "collection_attribute",
  "enable_tabs": true,
  "allow_upload": true,
  "show_completeness": true,
  "collection_attributes": {
    "images": "Product Images",
    "videos": "Product Videos",
    "documents": "Documents"
  },
  "available_roles": ["packshot", "lifestyle", "detail", "thumbnail"]
}
```

## API Usage

### Creating an Asset
```javascript
POST /items/assets
{
  "code": "product_image_001",
  "label": "Product Front View",
  "asset_family_id": "uuid",
  "main_media": "file-uuid",
  "tags": ["tag-uuid-1", "tag-uuid-2"],
  "metadata": {
    "original_filename": "IMG_001.jpg",
    "file_size": 1024000,
    "mime_type": "image/jpeg"
  }
}
```

### Linking Asset to Product
```javascript
POST /items/product_assets
{
  "products_id": "product-uuid",
  "assets_id": "asset-uuid",
  "role_id": "role-uuid",
  "collection_type_id": "type-uuid",
  "sort": 0,
  "enabled": true
}
```

## Maintenance

### Adding New Roles
1. Navigate to Content > Asset Roles
2. Click "+" to add new role
3. Enter code, label, and description
4. Set sort order

### Managing Collection Types
1. Navigate to Content > Asset Collection Types
2. Add new types as needed
3. Choose appropriate icons

### Creating Asset Families
1. Navigate to Content > Asset Families
2. Create new family
3. Add custom attributes via Asset Attributes

## Best Practices

1. **Consistent Naming**: Use clear, descriptive codes for assets
2. **Role Assignment**: Assign appropriate roles during upload
3. **Tagging**: Use tags for cross-category organization
4. **Completeness**: Ensure all required attributes are filled
5. **Performance**: Use collection types to optimize loading

## Troubleshooting

### Common Issues

1. **"Column products.assets_collection does not exist"**
   - The field is an alias, not a database column
   - Ensure proper field registration in directus_fields

2. **"Invalid input syntax for type uuid: '+'"**
   - Occurs when editing new products
   - Save the product first before managing assets

3. **Missing Dropdowns**
   - Check that lookup tables are populated
   - Verify API permissions for asset_roles, asset_tags tables

## Migration from Legacy System

If migrating from a text-based role system:
```sql
-- Migrate text roles to role_id
UPDATE product_assets pa
SET role_id = ar.id
FROM asset_roles ar
WHERE pa.role = ar.code;
```

## Extensions

The system includes three main extensions:

1. **asset-collection-interface**: Main UI component
2. **asset-linking-hooks**: Automatic asset-product linking
3. **asset-management-endpoints**: Custom API endpoints

Each extension can be configured independently in the Directus extensions panel.