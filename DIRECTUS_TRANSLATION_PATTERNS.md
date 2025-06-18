# Directus Extension Translation Patterns

This document provides proper usage patterns for translations in Directus extensions.

## 1. Translation Key Format in Extension Definition

When defining extensions (interfaces, layouts, displays, etc.), use the `$t:` prefix for translatable strings:

```typescript
// In index.ts files
export default defineInterface({
  id: 'my-interface',
  name: '$t:interfaces.my_interface.name',
  description: '$t:interfaces.my_interface.description',
  // ...
  options: [
    {
      field: 'label',
      name: '$t:label',  // Uses common translation
      // ...
    },
    {
      field: 'customOption',
      name: '$t:interfaces.my_interface.custom_option',  // Interface-specific
      // ...
    }
  ]
});
```

## 2. Using Translations in Vue Components

### In Templates

Use the `t()` function from `useI18n`:

```vue
<template>
  <div>
    <div class="type-label">{{ t('view_mode') }}</div>
    <v-select
      v-model="viewMode"
      :items="[
        {
          text: t('list'),
          value: 'list',
        },
        {
          text: t('grid'),
          value: 'grid',
        },
      ]"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
```

### In Scripts

For default values or programmatic use:

```vue
<script setup lang="ts">
import { i18n } from '@/lang';

withDefaults(
  defineProps<{
    label?: string;
  }>(),
  {
    label: () => i18n.global.t('enabled'),
  }
);
</script>
```

## 3. Translation File Structure

Directus uses YAML files for translations. The main English file is located at:
`app/src/lang/translations/en-US.yaml`

### Structure Example

```yaml
# Common translations
label: Label
enabled: Enabled
view_mode: View Mode
list: List
grid: Grid

# Interface-specific translations
interfaces:
  my_interface:
    name: My Interface
    description: Description of my interface
    custom_option: Custom Option
    placeholder: Enter value...

# Layout-specific translations
layouts:
  my_layout:
    name: My Layout
    spacing: Spacing
    compact: Compact
    comfortable: Comfortable
```

## 4. Key Naming Conventions

- Use snake_case for translation keys
- Group related translations under namespaces (interfaces, layouts, displays, etc.)
- Keep keys descriptive but concise
- Avoid JavaScript reserved words in keys

## 5. Common Translation Keys

Directus provides many common translations you can reuse:

```
label: Label
description: Description
placeholder: Placeholder
enabled: Enabled
disabled: Disabled
save: Save
cancel: Cancel
delete: Delete
edit: Edit
create: Create
search: Search
filter: Filter
sort: Sort
```

## 6. Extension-Specific Translations

For custom extensions, follow this pattern:

```yaml
# For interfaces
interfaces:
  product_grid:
    name: Product Grid
    description: Display products in a grid layout
    columns: Columns
    image_size: Image Size

# For layouts
layouts:
  product_list:
    name: Product List
    view_as_grid: View as Grid
    view_as_list: View as List
```

## 7. Important Notes

1. **No Translation Files in Extensions**: Extensions don't include their own translation files. All translations must be added to the main Directus translation files.

2. **Use $t: Prefix**: In extension definitions (index.ts), always use `$t:` prefix for translatable strings.

3. **Use useI18n in Vue**: In Vue components, import and use `useI18n` from 'vue-i18n'.

4. **Fallback to en-US**: The system always falls back to en-US if a translation is missing.

5. **Reserved Words**: Be careful not to use JavaScript reserved words as translation keys.

## 8. Example: Complete Interface with Translations

```typescript
// index.ts
import { defineInterface } from '@directus/extensions';
import InterfaceComponent from './interface.vue';

export default defineInterface({
  id: 'custom-selector',
  name: '$t:interfaces.custom_selector.name',
  description: '$t:interfaces.custom_selector.description',
  icon: 'list',
  component: InterfaceComponent,
  options: [
    {
      field: 'placeholder',
      name: '$t:placeholder',
      type: 'string',
      meta: {
        interface: 'input',
      },
    },
  ],
});
```

```vue
<!-- interface.vue -->
<template>
  <v-input
    :model-value="value"
    :placeholder="placeholder || t('interfaces.custom_selector.default_placeholder')"
    @update:model-value="$emit('input', $event)"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  value: string;
  placeholder?: string;
}>();

defineEmits<{
  (e: 'input', value: string): void;
}>();
</script>
```

```yaml
# In en-US.yaml
interfaces:
  custom_selector:
    name: Custom Selector
    description: A custom selection interface
    default_placeholder: Select an option...
```