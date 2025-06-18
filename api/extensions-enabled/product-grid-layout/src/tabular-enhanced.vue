<template>
  <div class="layout-tabular-enhanced">
    <v-table
      ref="tableRef"
      v-model="selectionWritable"
      v-model:headers="tableHeadersWritable"
      class="table"
      fixed-header
      :show-select="showSelect"
      show-resize
      allow-header-reorder
      :must-sort="tableSort !== null"
      :sort="tableSort || { by: 'date_created', desc: true }"
      :items="enhancedItems || []"
      :loading="loading"
      :item-key="primaryKeyField?.field ?? 'id'"
      :clickable="!readonly"
      selection-use-keys
      :row-height="tableRowHeight"
      @click:row="onRowClick"
      @update:sort="onSortChange"
    >
      <template #header-context-menu="{ header }">
        <v-list>
          <v-list-item
            :disabled="header.required"
            clickable
            @click="toggleFieldVisibility(header)"
          >
            <v-list-item-icon>
              <v-icon name="visibility_off" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ t('hide_field') }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </template>

      <template v-for="header in tableHeaders" :key="header.value" #[`item.${header.value}`]="{ item }">
        <render-display
          v-if="!isAttributeField(header.value)"
          :value="item[header.value]"
          :display="header.display"
          :options="header.displayOptions"
          :interface="header.interface"
          :interface-options="header.interfaceOptions"
          :type="header.type"
          :collection="collection"
          :field="header.value"
        />
        <grid-attribute-value
          v-else
          :value="getAttributeValue(item, header.value)"
          :attribute="getAttributeForField(header.value)"
        />
      </template>

      <template #footer>
        <div class="footer">
          <div class="pagination">
            <v-pagination
              v-if="totalPages > 1"
              :length="totalPages"
              :total-visible="7"
              show-first-last
              :model-value="page"
              @update:model-value="toPage"
            />
          </div>

          <div v-if="loading === false && itemCount && itemCount > 0" class="per-page">
            <span>{{ t('per_page') }}</span>
            <v-select
              v-model="limitWritable"
              :items="pageSizes"
              inline
            />
          </div>
        </div>
      </template>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, toRefs } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { useI18n } from 'vue-i18n';
import { useSync } from '@directus/composables';
import type { Field, Filter, Item } from '@directus/types';
import type { HeaderRaw } from '@/components/v-table/types';
import type { ShowSelect } from '@directus/extensions';
import { Collection } from '@/types/collections';
import GridAttributeValue from './components/GridAttributeValue.vue';
import { debounce } from 'lodash-es';

interface Props {
  collection: string;
  selection?: Item[];
  readonly: boolean;
  tableHeaders: HeaderRaw[];
  showSelect?: ShowSelect;
  items: Item[];
  loading: boolean;
  error?: any;
  totalPages: number;
  tableSort?: { by: string; desc: boolean } | null;
  onRowClick: (event: { item: Item; event: PointerEvent }) => void;
  tableRowHeight: number;
  page: number;
  toPage: (newPage: number) => void;
  itemCount?: number;
  fields: string[];
  limit: number;
  primaryKeyField?: Field;
  info?: Collection;
  sortField?: string;
  search?: string;
  filter?: Filter;
  onSortChange: (newSort: { by: string; desc: boolean }) => void;
}

const props = withDefaults(defineProps<Props>(), {
  selection: () => [],
  showSelect: 'none',
  error: null,
  itemCount: 0,
  search: '',
  tableHeaders: () => [],
  tableSort: null,
  tableRowHeight: 48,
  items: () => [],
  loading: false,
  totalPages: 1,
  page: 1,
  limit: 25,
  readonly: false,
});

const emit = defineEmits(['update:selection', 'update:tableHeaders', 'update:limit', 'update:fields']);

const { t } = useI18n();
const api = useApi();

// Sync props
const selectionWritable = useSync(props, 'selection', emit);
const tableHeadersWritable = useSync(props, 'tableHeaders', emit);
const limitWritable = useSync(props, 'limit', emit);

// State
const tableRef = ref();
const attributes = ref<any[]>([]);
const attributeMap = ref(new Map());
const enhancedItems = ref<any[]>([]);
const pageSizes = [25, 50, 100, 250, 500, 1000];

// Initialize headers if empty
if (!tableHeadersWritable.value || tableHeadersWritable.value.length === 0) {
  tableHeadersWritable.value = [
    { text: 'ID', value: 'id', width: 200, align: 'left', sortable: true },
    { text: 'Enabled', value: 'enabled', width: 100, align: 'left', sortable: true },
    { text: 'Created', value: 'date_created', width: 200, align: 'left', sortable: true },
  ];
}

// Load attributes on mount
onMounted(async () => {
  console.log('[Product Grid] Mounting with props:', {
    items: props.items?.length,
    loading: props.loading,
    collection: props.collection,
    tableHeaders: tableHeadersWritable.value?.length,
    page: props.page,
    limit: props.limit,
    itemCount: props.itemCount,
    allProps: Object.keys(props)
  });
  await loadAttributes();
  
  // Add attribute columns to headers after loading
  if (attributes.value.length > 0) {
    console.log('[Product Grid] Loaded attributes:', attributes.value.length);
    const currentHeaders = [...tableHeadersWritable.value];
    const existingFields = new Set(currentHeaders.map(h => h.value));
    
    // Add first 5 attributes that aren't already in headers
    const attributeHeaders = attributes.value
      .slice(0, 5)
      .filter(attr => !existingFields.has(`attr_${attr.code}`))
      .map(attr => ({
        text: attr.label,
        value: `attr_${attr.code}`,
        width: 150,
        align: 'left',
        sortable: true,
      }));
    
    if (attributeHeaders.length > 0) {
      console.log('[Product Grid] Adding attribute headers:', attributeHeaders);
      tableHeadersWritable.value = [...currentHeaders, ...attributeHeaders];
    }
  }
  
  // Ensure items are loaded
  if (props.items) {
    await loadAttributeValues();
  }
  
  // Check for items after a delay (in case they load asynchronously)
  setTimeout(() => {
    console.log('[Product Grid] Checking for items after delay:', {
      items: props.items?.length,
      loading: props.loading,
      itemCount: props.itemCount,
      totalPages: props.totalPages,
      page: props.page,
      limit: props.limit,
      filter: props.filter,
      search: props.search,
    });
    
    // Try to manually check if there are products
    if (props.items?.length === 0) {
      console.log('[Product Grid] No items found. Checking products via API...');
      checkProductsDirectly();
    }
  }, 2000);
});

// Methods
const checkProductsDirectly = async () => {
  try {
    const response = await api.get('/items/products', {
      params: { limit: 5 }
    });
    console.log('[Product Grid] Direct API check:', {
      data: response.data.data?.length,
      total: response.data.meta?.total_count
    });
  } catch (error) {
    console.error('[Product Grid] Error checking products:', error);
  }
};

const loadAttributes = async () => {
  try {
    const response = await api.get('/items/attributes', {
      params: {
        filter: { usable_in_grid: { _eq: true } },
        fields: ['id', 'code', 'label', 'type.*', 'options.*', 'units.*'],
        sort: ['sort'],
        limit: -1,
      },
    });
    
    attributes.value = response.data.data || [];
    
    // Build attribute map
    attributeMap.value.clear();
    attributes.value.forEach(attr => {
      attributeMap.value.set(attr.code, attr);
    });
  } catch (error) {
    console.error('Error loading attributes:', error);
  }
};

const loadAttributeValues = debounce(async () => {
  console.log('[Product Grid] Loading attribute values for', props.items?.length, 'items');
  
  if (!props.items || props.items.length === 0) {
    enhancedItems.value = [];
    return;
  }

  // Get attribute columns currently displayed
  const attributeColumns = tableHeadersWritable.value
    .filter(h => h.value.startsWith('attr_'))
    .map(h => h.value);

  console.log('[Product Grid] Attribute columns to load:', attributeColumns);

  if (attributeColumns.length === 0) {
    enhancedItems.value = props.items;
    return;
  }

  try {
    // Get product IDs
    const productIds = props.items.map(item => item.id || item[props.primaryKeyField?.field || 'id']);
    
    // Get attribute codes and IDs
    const attributeCodes = attributeColumns.map(col => col.replace('attr_', ''));
    const attrIds = attributes.value
      .filter(a => attributeCodes.includes(a.code))
      .map(a => a.id);

    console.log('[Product Grid] Loading values for attribute IDs:', attrIds);

    if (attrIds.length > 0) {
      const valuesResponse = await api.get('/items/product_attributes', {
        params: {
          filter: {
            product_id: { _in: productIds },
            attribute_id: { _in: attrIds },
          },
          limit: -1,
          fields: ['product_id', 'attribute_id', 'value'],
        },
      });

      console.log('[Product Grid] Loaded', valuesResponse.data.data?.length, 'attribute values');

      // Build value map
      const valueMap = new Map();
      (valuesResponse.data.data || []).forEach((row: any) => {
        const attr = attributes.value.find(a => a.id === row.attribute_id);
        if (attr) {
          const key = `${row.product_id}_attr_${attr.code}`;
          valueMap.set(key, row.value);
        }
      });

      // Enhance items with attribute values
      enhancedItems.value = props.items.map(item => {
        const enhanced = { ...item };
        attributeColumns.forEach(col => {
          const key = `${item.id || item[props.primaryKeyField?.field || 'id']}_${col}`;
          enhanced[col] = valueMap.get(key) || null;
        });
        return enhanced;
      });
    } else {
      enhancedItems.value = props.items;
    }
  } catch (error) {
    console.error('[Product Grid] Error loading attribute values:', error);
    enhancedItems.value = props.items;
  }
}, 300);

// Computed
const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
  if (!isAttributeField(field)) return null;
  const code = field.replace('attr_', '');
  return attributeMap.value.get(code);
};

const getAttributeValue = (item: any, field: string) => {
  return item[field] ?? null;
};

const toggleFieldVisibility = (header: HeaderRaw) => {
  const newHeaders = [...tableHeadersWritable.value];
  const index = newHeaders.findIndex(h => h.value === header.value);
  if (index > -1) {
    newHeaders.splice(index, 1);
    tableHeadersWritable.value = newHeaders;
  }
};

// Watch for item changes
watch(() => props.items, (newItems) => {
  console.log('[Product Grid] Items changed:', newItems?.length, 'items:', newItems);
  if (newItems && Array.isArray(newItems) && newItems.length > 0) {
    loadAttributeValues();
  } else {
    enhancedItems.value = [];
  }
}, { immediate: true, deep: true });

// Watch for header changes  
watch(tableHeadersWritable, () => {
  if (props.items && props.items.length > 0) {
    loadAttributeValues();
  }
});

// Also watch for loading state changes
watch(() => props.loading, (isLoading) => {
  console.log('[Product Grid] Loading state:', isLoading);
});

// Watch for any prop changes
watch(() => props, (newProps) => {
  console.log('[Product Grid] Props updated:', {
    items: newProps.items?.length,
    loading: newProps.loading,
    itemCount: newProps.itemCount,
  });
}, { deep: true });
</script>

<style scoped>
.layout-tabular-enhanced {
  display: contents;
}

.table {
  --v-table-sticky-offset-top: var(--layout-offset-top);
}

.table :deep(.resizer) {
  position: absolute;
  top: 0;
  right: -2px;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  transition: background-color var(--fast) var(--transition);
}

.table :deep(.resizer:hover),
.table :deep(.resizer.is-dragging) {
  background-color: var(--primary);
}

.table :deep(.sortable-ghost) {
  opacity: 0.5;
}

.footer {
  position: sticky;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 32px;
}

.pagination {
  display: inline-block;
}

.per-page {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground-subdued);
}

.per-page span {
  width: max-content;
}
</style>