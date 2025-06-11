# Variant Configuration Interface

A Magento-style interface for selecting attribute options before generating product variants.

## Installation

1. Build the extension: `npm run build`
2. Restart your Directus server
3. Add a field with the "Variant Configuration" interface to your products collection

## Field Configuration

### Required Setup in Directus Admin

When adding the variant configuration field to your products collection:

1. **Field Type**: Choose `JSON` type
2. **Interface**: Select "Variant Configuration"
3. **Field Options**:
   - **Family Variant Field**: Set to the field name that stores the family variant reference (default: `family_variant`)
   - **Enable Bulk Actions**: Enable/disable bulk selection features (default: `true`)
   - **Show Variant Preview**: Show/hide the variant preview section (default: `true`)

### Conditional Display (Recommended)

To prevent the "collection field option is misconfigured" error, set up a conditional display rule:

1. In the field configuration, go to **Conditions**
2. Add a condition: `family_variant` **is not empty**
3. This ensures the interface only loads when a family variant is selected

### Alternative: Pass Family Variant as Prop

If you're using a custom form or have a different setup, you can pass the family variant value directly as a prop:

```html
<variant-configuration 
  :family-variant-value="currentFamilyVariant"
  :disabled="false"
/>
```

## How It Works

1. **Family Variant Selection**: User first selects a family variant for the product
2. **Option Configuration**: The interface loads available attribute options for the variant axes
3. **Visual Selection**: User selects desired options using a checkbox grid interface
4. **Variant Generation**: Generated variants are created automatically via hooks when configuration is saved

## Database Requirements

The interface expects these tables to exist:
- `family_variant_axes` - Links family variants to attributes
- `attribute_options` - Available options for each attribute

The variant configuration data is stored directly as JSON in the product field using the modern JSON-based approach.

## Integration with Hooks

The interface works with the `variant-generator-hooks` extension to automatically generate variants when configurations are saved.