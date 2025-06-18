# Directus Translation Guide for Custom Extensions

## Where to Add Translation Strings

Translation strings are stored in YAML files located at:
```
app/src/lang/translations/[language-code].yaml
```

For example:
- `app/src/lang/translations/en-US.yaml` - English (US)
- `app/src/lang/translations/fr-FR.yaml` - French
- `app/src/lang/translations/de-DE.yaml` - German

### Adding Custom Extension Translations

To add translations for your custom extensions, you need to edit the appropriate language files:

1. **Open the translation file**: `app/src/lang/translations/en-US.yaml`

2. **Find the appropriate section**:
   - For interfaces: Look for the `interfaces:` section
   - For layouts: Look for the `layouts:` section
   - For displays: Look for the `displays:` section

3. **Add your custom translations**:

```yaml
# In en-US.yaml
interfaces:
  # ... existing interfaces ...
  m2o_searchable_dropdown:
    name: M2O Searchable Dropdown
    description: Select a related item from a searchable dropdown
  asset_collection:
    name: Asset Collection
    description: Simple asset management for products

layouts:
  # ... existing layouts ...
  product_grid:
    name: Product Grid
    select_columns: Select Columns
    manage_columns: Manage Columns
  tabular:
    # ... existing tabular translations ...
    select_columns: Select Columns
    manage_columns: Manage Columns

# Common translations (already exist)
standard_fields: Standard Fields
attributes: Attributes
search: Search
apply: Apply
cancel: Cancel
reset_to_default: Reset to Default
hide_field: Hide Field
per_page: Per Page
```

## Overview

Directus uses a specific pattern for translations that differs between extension definitions and Vue components. This guide explains how to properly implement translations in your custom extensions.

## Translation Patterns

### 1. In Extension Definitions (index.ts)

Use the `$t:` prefix for all translatable strings:

```typescript
import { defineInterface } from '@directus/extensions-sdk';

export default defineInterface({
  id: 'my-interface',
  name: '$t:interfaces.my_interface.name',
  description: '$t:interfaces.my_interface.description',
  icon: 'box',
  component: InterfaceComponent,
  options: [
    {
      field: 'placeholder',
      name: '$t:placeholder',
      type: 'string',
      meta: {
        interface: 'input',
        options: {
          placeholder: '$t:enter_a_value',
        },
      },
    },
  ],
});
```

### 2. In Vue Components

Import and use the `useI18n` composable from `vue-i18n`:

```vue
<template>
  <div>
    <h3>{{ t('my_title') }}</h3>
    <v-button>{{ t('save') }}</v-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Use t() function for translations
const label = t('field_label');
</script>
```

## Translation Key Conventions

### Common Keys (No Namespacing Required)
- `save`, `cancel`, `delete`, `create`, `update`
- `search`, `filter`, `sort`, `apply`
- `placeholder`, `label`, `description`
- `yes`, `no`, `true`, `false`
- `loading`, `error`, `success`

### Namespaced Keys
Use namespacing for extension-specific translations:
- `interfaces.my_interface.name`
- `interfaces.my_interface.description`
- `layouts.my_layout.name`
- `displays.my_display.name`

## Important Notes

1. **No Local Translation Files**: Extensions don't include their own translation files. All translations must be added to the main Directus translation files.

2. **Fallback**: If a translation key is not found, Directus will display the key itself as a fallback.

3. **Dynamic Translations**: For dynamic translation keys, use:
   ```typescript
   const message = t(condition ? 'message_a' : 'message_b');
   ```

4. **Reserved Words**: Avoid using JavaScript reserved words as translation keys.

## Migration Checklist

When migrating from custom translation implementations:

1. ✅ Remove any local translation objects or fallback functions
2. ✅ Replace custom `translate()` functions with `t()` from `useI18n`
3. ✅ Add `$t:` prefix to all strings in extension definitions
4. ✅ Use standard Directus translation keys where applicable
5. ✅ Ensure all custom keys follow the namespacing convention

## Example Migration

### Before:
```typescript
// Custom translation object
const translations = {
  select_columns: 'Select Columns',
  search_columns: 'Search columns...',
};

const translate = (key: string) => {
  try {
    return t(key);
  } catch {
    return translations[key] || key;
  }
};

// In template
{{ translate('select_columns') }}
```

### After:
```typescript
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

// In template
{{ t('layouts.tabular.select_columns') }}
```

## Complete Example: Adding Translations for Product Grid Layout

### Step 1: Update Extension Definition
```typescript
// api/extensions/product-grid-layout/src/index.ts
export default defineLayout({
  id: 'product-grid',
  name: '$t:layouts.product_grid.name',
  // ...
});
```

### Step 2: Add Translations to Language File
```yaml
# app/src/lang/translations/en-US.yaml
layouts:
  product_grid:
    name: Product Grid
    view_mode: View Mode
    grid_view: Grid View
    list_view: List View
```

### Step 3: Use in Vue Component
```vue
<template>
  <div>
    <h3>{{ t('layouts.product_grid.view_mode') }}</h3>
    <v-button>{{ t('save') }}</v-button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
```

## Alternative: Database-Based Translations

For dynamic translations that need to be managed without modifying files, you can use the `directus_translations` table:

```sql
-- Add custom translations to the database
INSERT INTO directus_translations (language, key, value) VALUES
('en-US', 'custom.my_extension.title', 'My Extension Title'),
('fr-FR', 'custom.my_extension.title', 'Titre de Mon Extension');
```

These can be accessed the same way in your extensions.

## Common Translation Keys in Directus

- `$t:search` - Search
- `$t:filter` - Filter
- `$t:sort` - Sort
- `$t:apply` - Apply
- `$t:cancel` - Cancel
- `$t:save` - Save
- `$t:delete` - Delete
- `$t:collection` - Collection
- `$t:field` - Field
- `$t:value` - Value
- `$t:placeholder` - Placeholder
- `$t:display_template` - Display Template
- `$t:per_page` - Per Page
- `$t:reset_to_default` - Reset to Default