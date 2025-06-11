# Product Attributes Interface Extension

A sophisticated Directus interface extension for managing dynamic product attributes based on product families. This refactored version includes batch operations, revision support, and enhanced validation.

## Features

### Core Features
- **Dynamic Attribute Loading**: Automatically loads attributes based on product family
- **Multiple Field Types**: Supports text, number, select, date, file, measurement, table, and more
- **Attribute Grouping**: Organizes attributes by groups with custom sorting
- **Metric/Measurement Support**: Special handling for measurements with units
- **Table Attributes**: Grid-based data entry for structured information
- **Validation**: Real-time validation with custom error messages
- **Default Values**: Supports default values from attribute definitions

### Enhanced Features (Refactored)
- **Dirty State Tracking**: Visual indicators for modified fields
- **Batch Operations**: Update multiple products at once in list view
- **Revision Support**: Full integration with Directus revision system
- **Auto-save**: Optional automatic saving with debounce
- **Field-level Reset**: Reset individual fields to original values
- **Validation Summary**: Consolidated validation error display
- **Performance Optimizations**: Debounced updates and efficient state management

## Installation

1. Copy the extension folder to your Directus extensions directory:
   ```bash
   cp -r product-attributes-values /path/to/directus/extensions/
   ```

2. Build the extension:
   ```bash
   cd /path/to/directus/extensions/product-attributes-values
   npm install
   npm run build
   ```

3. Restart Directus

## Data Model Requirements

### Collections

1. **products**
   - `family` - M2O relation to families

2. **families**
   - `attributes` - O2M relation to family_attributes junction

3. **attributes**
   - `id` - Primary key
   - `code` - Unique identifier
   - `label` - Display name
   - `type` - M2O to attribute_types
   - `group` - M2O to attribute_groups
   - `sort` - Sort order
   - `required` - Boolean
   - `read_only` - Boolean
   - `default_value` - JSON
   - `meta_options` - JSON (interface-specific options)
   - Various validation fields

4. **attribute_types**
   - `input_interface` - Interface type (text, number, etc.)

5. **attribute_groups**
   - `label` - Group name
   - `sort` - Sort order

6. **product_attributes**
   - `id` - Primary key
   - `product_id` - M2O to products
   - `attribute_id` - M2O to attributes
   - `value` - JSON

7. **metric_units** (for measurement attributes)
   - `family` - M2O to metric_families
   - `code` - Unit code
   - `symbol` - Display symbol
   - `standard_unit` - Boolean

## Usage

### Basic Setup

1. Add a field to your products collection with type "Alias"
2. Select "Product Attributes" as the interface
3. Configure the field relationship to point to product_attributes

### Configuration Options

- **Show Footer Actions**: Display save/reset buttons at the bottom
- **Enable Batch Mode**: Allow batch updates in list view
- **Auto Save**: Automatically save changes after delay
- **Auto Save Delay**: Milliseconds to wait before auto-saving
- **Show Revisions**: Display revision history

### Batch Operations

In list view, you can:
1. Select multiple products
2. Click on any attribute's menu
3. Choose an operation:
   - **Set Value**: Replace value for all selected products
   - **Append Value**: Add to existing value (text/multi-select)
   - **Clear Value**: Remove value for all selected products

### Revision Support

The interface integrates with Directus revisions:
- All changes are tracked with proper metadata
- Revision preview shows attribute changes
- Easy revert to previous versions

## Edge Cases Handled

### 1. Batch Updates in List View
- Efficient bulk operations with progress tracking
- Merge similar operations for performance
- Proper error handling and rollback

### 2. Revision Compatibility
- Structured data format for revision tracking
- Human-readable attribute labels in revision UI
- Proper diff calculation for complex values

### 3. Save Optimization
- Debounced updates to prevent excessive API calls
- Only save changed values
- Batch save operations

### 4. Validation
- Real-time field validation
- Consolidated error display
- Prevents saving invalid data

### 5. Empty/Null Values
- Proper handling of null vs empty values
- Array filtering for table attributes
- JSON serialization for all value types

### 6. Performance
- Lazy loading of metric units
- Cached attribute definitions
- Optimized re-renders with computed properties

## Development

### Project Structure
```
src/
├── components/
│   ├── ProductAttributesRefactored.vue  # Main component
│   ├── AttributeFieldEnhanced.vue       # Enhanced field renderer
│   ├── MetricField.vue                  # Measurement input
│   └── TableField.vue                   # Table/grid input
├── composables/
│   ├── useAttributeState.ts    # State management
│   ├── useRevisionSupport.ts   # Revision handling
│   ├── useBatchOperations.ts   # Batch updates
│   ├── useAttributeValues.ts   # Value parsing/saving
│   ├── useMetricAttributes.ts  # Metric/measurement logic
│   └── useAttributeGroups.ts   # Grouping logic
└── index.ts                    # Extension definition
```

### Adding New Field Types

1. Add the type to `interfaceMap` in the component
2. Update `getComponentProps()` for type-specific options
3. Add validation rules if needed
4. Update batch operation logic if applicable

### Testing Recommendations

1. **Unit Tests**: Test composables independently
2. **Integration Tests**: Test with Directus API
3. **E2E Tests**: Test complete workflows
4. **Performance Tests**: Test with large datasets

## Troubleshooting

### Common Issues

1. **Attributes not loading**: Check family relationship
2. **Validation errors**: Verify attribute configuration
3. **Batch operations failing**: Check permissions
4. **Performance issues**: Enable auto-save delay

### Debug Mode

Set `console.log` statements are included with `[ProductAttributes]` prefix for debugging.

## License

MIT