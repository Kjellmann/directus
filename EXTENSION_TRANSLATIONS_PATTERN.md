# Directus Extension Translation Pattern

Since Directus doesn't currently support bundling translation files with extensions, here's the recommended pattern for handling translations within your extensions.

## Recommended Pattern

### 1. Create a Central Translations File

Create a `translations.ts` file in your extension's src directory:

```typescript
// src/translations.ts
export const translations = {
  'en-US': {
    extension_name: 'My Extension',
    my_button: 'Click Me',
    my_label: 'Label Text',
    // ... more translations
  },
  'fr-FR': {
    extension_name: 'Mon Extension',
    my_button: 'Cliquez-moi',
    my_label: 'Texte du label',
    // ... more translations
  },
  // Add more languages as needed
};

export function createI18nOptions() {
  return {
    messages: translations,
  };
}
```

### 2. Use in Vue Components

```vue
<template>
  <div>
    <h3>{{ t('my_label') }}</h3>
    <v-button>{{ t('my_button') }}</v-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { createI18nOptions } from '../translations';

const { t } = useI18n(createI18nOptions());
</script>
```

### 3. Limitations

- Extension definitions (index.ts) cannot use dynamic translations
- The `name` and `description` fields in `defineInterface`, `defineLayout`, etc. must be static strings
- Only Vue components can use the i18n system with local messages

### 4. Best Practices

1. **Use existing Directus keys where possible**: Common UI terms like 'save', 'cancel', 'search' are already translated
2. **Namespace your keys**: Use prefixes to avoid conflicts (e.g., 'product_grid_select_columns')
3. **Keep translations close**: Define them in the extension folder, not in Directus core files
4. **Document required translations**: Include a README listing all translation keys used

## Alternative Patterns

### Pattern 1: Inline Translations (Simple)

For simple components with few translations:

```typescript
const { t } = useI18n({
  messages: {
    'en-US': { hello: 'Hello' },
    'fr-FR': { hello: 'Bonjour' },
  },
});
```

### Pattern 2: Per-Component Translation Files

For larger extensions:

```
src/
├── components/
│   ├── MyComponent.vue
│   └── MyComponent.translations.ts
└── translations/
    └── index.ts  // Combines all translations
```

### Pattern 3: Translation Composable

Create a reusable composable:

```typescript
// src/composables/useTranslations.ts
import { useI18n } from 'vue-i18n';
import { translations } from '../translations';

export function useExtensionTranslations() {
  return useI18n({
    messages: translations,
  });
}
```

## Future Support

There's an active feature request for native translation support in extensions:
https://github.com/directus/directus/discussions/19229

Once implemented, extensions will be able to include `translations/*.yaml` files that are automatically loaded.