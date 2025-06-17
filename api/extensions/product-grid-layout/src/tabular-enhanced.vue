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
      :items="props.useCustomApi ? props.items : transformedItems"
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
          :display="header.field?.display || null"
          :options="header.field?.displayOptions || null"
          :interface="header.field?.interface || null"
          :interface-options="header.field?.interfaceOptions || null"
          :type="header.field?.type || 'string'"
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
import { ref, computed, watch, onMounted, toRefs, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import GridAttributeValue from './components/GridAttributeValue.vue';

interface Props {
  collection: string;
  selection?: any[];
  readonly: boolean;
  tableHeaders: any[];
  showSelect?: string;
  items: any[];
  loading: boolean;
  error?: any;
  totalPages: number;
  tableSort?: { by: string; desc: boolean } | null;
  onRowClick: (event: { item: any; event: PointerEvent }) => void;
  tableRowHeight: number;
  page: number;
  toPage: (newPage: number) => void;
  itemCount?: number;
  fields: string[];
  limit: number;
  primaryKeyField?: any;
  info?: any;
  sortField?: string;
  search?: string;
  filter?: any;
  onSortChange: (newSort: { by: string; desc: boolean }) => void;
  useCustomApi?: boolean;
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

// Sync props manually
const selectionWritable = computed({
  get: () => props.selection,
  set: (val) => emit('update:selection', val)
});

const tableHeadersWritable = computed({
  get: () => props.tableHeaders,
  set: (val) => emit('update:tableHeaders', val)
});

const limitWritable = computed({
  get: () => props.limit,
  set: (val) => emit('update:limit', val)
});

// State
const tableRef = ref();
const attributes = ref<any[]>([]);
const attributeMap = ref(new Map());
const transformedItems = ref<any[]>([]);
const pageSizes = [25, 50, 100, 250, 500, 1000];

// Initialize headers if empty
if (!tableHeadersWritable.value || tableHeadersWritable.value.length === 0) {
  tableHeadersWritable.value = [
    { text: 'ID', value: 'id', width: 200, align: 'left', sortable: true, field: { type: 'string' } },
    { text: 'Enabled', value: 'enabled', width: 100, align: 'left', sortable: true, field: { type: 'boolean', interface: 'boolean' } },
    { text: 'Created', value: 'date_created', width: 200, align: 'left', sortable: true, field: { type: 'timestamp', interface: 'datetime' } },
  ];
}

// Load attributes on mount
onMounted(() => {
  console.log('[Product Grid] Mounting with props:', {
    items: props.items?.length,
    loading: props.loading,
    collection: props.collection,
    tableHeaders: tableHeadersWritable.value?.length,
    page: props.page,
    limit: props.limit,
    itemCount: props.itemCount,
    useCustomApi: props.useCustomApi,
    allProps: Object.keys(props)
  });
  
  if (props.useCustomApi) {
    // Items are already transformed by the API
    console.log('[Product Grid] Using custom API - items are pre-transformed');
    extractAttributesFromTransformedItems();
  } else {
    // Extract attributes from items if available
    extractAttributesFromItems();
    // Transform items
    transformItems();
  }
});

// Methods
const extractAttributesFromItems = () => {
  if (!props.items || props.items.length === 0) return;
  
  console.log('[Product Grid] First item attributes:', props.items[0].attributes);
  
  // Extract unique attributes from items
  const uniqueAttributes = new Map();
  
  props.items.forEach(item => {
    if (Array.isArray(item.attributes)) {
      item.attributes.forEach((attrJunction, idx) => {
        if (idx === 0 && item === props.items[0]) {
          console.log('[Product Grid] First attribute junction:', attrJunction);
        }
        
        // Check if attribute_id is expanded or just an ID
        if (attrJunction.attribute_id && typeof attrJunction.attribute_id === 'object') {
          const attr = attrJunction.attribute_id;
          if (!uniqueAttributes.has(attr.id)) {
            uniqueAttributes.set(attr.id, {
              id: attr.id,
              code: attr.code,
              label: attr.label,
              is_searchable: attr.is_searchable || false
            });
          }
        } else if (typeof attrJunction.attribute_id === 'number') {
          console.log('[Product Grid] Warning: attribute_id is just a number, not expanded:', attrJunction.attribute_id);
        }
      });
    }
  });
  
  attributes.value = Array.from(uniqueAttributes.values());
  
  console.log('[Product Grid] Extracted attributes:', attributes.value);
  
  // Build attribute map
  attributeMap.value.clear();
  attributes.value.forEach(attr => {
    attributeMap.value.set(attr.code, attr);
  });
  
  // Add attribute columns to headers
  if (attributes.value.length > 0) {
    console.log('[Product Grid] Extracted attributes:', attributes.value.length);
    const currentHeaders = [...tableHeadersWritable.value];
    const existingFields = new Set(currentHeaders.map(h => h.value));
    
    // Add searchable attributes that aren't already in headers
    const attributeHeaders = attributes.value
      .filter(attr => attr.is_searchable && !existingFields.has(`attr_${attr.code}`))
      .map(attr => ({
        text: attr.label,
        value: `attr_${attr.code}`,
        width: 150,
        align: 'left',
        sortable: true,
        field: { type: 'alias' } // Mark as alias so render-display doesn't complain
      }));
    
    if (attributeHeaders.length > 0) {
      console.log('[Product Grid] Adding attribute headers:', attributeHeaders);
      tableHeadersWritable.value = [...currentHeaders, ...attributeHeaders];
    } else {
      console.log('[Product Grid] No searchable attributes found');
    }
  }
};

// No need to load attribute values - they're already in the items

// Computed
const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
  if (!isAttributeField(field)) return null;
  const code = field.replace('attr_', '');
  return attributeMap.value.get(code);
};

const getAttributeValue = (item: any, field: string) => {
  const value = item[field];
  console.log(`[Product Grid] Getting attribute value for ${field}:`, value);
  return value ?? null;
};

const toggleFieldVisibility = (header: HeaderRaw) => {
  const newHeaders = [...tableHeadersWritable.value];
  const index = newHeaders.findIndex(h => h.value === header.value);
  if (index > -1) {
    newHeaders.splice(index, 1);
    tableHeadersWritable.value = newHeaders;
  }
};

// Extract attributes from pre-transformed items (when using custom API)
const extractAttributesFromTransformedItems = () => {
  if (!props.items || props.items.length === 0) return;
  
  const firstItem = props.items[0];
  console.log('[Product Grid] First transformed item:', firstItem);
  
  // Extract attribute fields from the item
  const attrFields = Object.keys(firstItem)
    .filter(k => k.startsWith('attr_'))
    .map(field => {
      const code = field.replace('attr_', '');
      // Try to find a label from somewhere, or use the code
      const label = code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
      return {
        id: field,
        code: code,
        label: label,
        is_searchable: true // Assume all returned attributes are searchable
      };
    });
  
  attributes.value = attrFields;
  console.log('[Product Grid] Extracted attributes from transformed items:', attributes.value);
  
  // Build attribute map
  attributeMap.value.clear();
  attributes.value.forEach(attr => {
    attributeMap.value.set(attr.code, attr);
  });
  
  // Add attribute columns to headers
  if (attributes.value.length > 0) {
    const currentHeaders = [...tableHeadersWritable.value];
    const existingFields = new Set(currentHeaders.map(h => h.value));
    
    const attributeHeaders = attributes.value
      .filter(attr => !existingFields.has(`attr_${attr.code}`))
      .map(attr => ({
        text: attr.label,
        value: `attr_${attr.code}`,
        width: 150,
        align: 'left',
        sortable: true,
        field: { type: 'alias' }
      }));
    
    if (attributeHeaders.length > 0) {
      console.log('[Product Grid] Adding attribute headers:', attributeHeaders);
      tableHeadersWritable.value = [...currentHeaders, ...attributeHeaders];
    }
  }
};

// Transform items to include attribute values
const transformItems = () => {
  if (!props.items || props.items.length === 0) {
    transformedItems.value = [];
    return;
  }
  
  console.log('[Product Grid] Transforming items, first item:', props.items[0]);
  console.log('[Product Grid] Attributes available:', attributes.value);
  
  // If items have attributes field, transform them
  if (props.items[0] && props.items[0].attributes) {
    const transformed = props.items.map(item => {
      const enhancedItem = { ...item };
      
      // Transform attributes array into individual fields
      if (Array.isArray(item.attributes)) {
        item.attributes.forEach(attrJunction => {
          let attr = null;
          let attrId = null;
          
          // Handle different attribute_id formats
          if (typeof attrJunction.attribute_id === 'object' && attrJunction.attribute_id) {
            // attribute_id is an object with id, code, label
            attr = attrJunction.attribute_id;
            attrId = attr.id;
          } else if (typeof attrJunction.attribute_id === 'number' || typeof attrJunction.attribute_id === 'string') {
            // attribute_id is just an ID
            attrId = attrJunction.attribute_id;
            attr = attributes.value.find(a => a.id === attrId);
          }
          
          if (attr && attr.code) {
            // Extract the value from the junction record
            let value = attrJunction.value;
            
            // Handle different value formats
            if (value && typeof value === 'object' && 'value' in value) {
              value = value.value;
            } else if (typeof value === 'string') {
              try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && 'value' in parsed) {
                  value = parsed.value;
                } else {
                  value = parsed;
                }
              } catch (e) {
                // Not JSON, use as is
              }
            }
            
            enhancedItem[`attr_${attr.code}`] = value;
          }
        });
      }
      
      return enhancedItem;
    });
    
    transformedItems.value = transformed;
    console.log('[Product Grid] Transformed items:', transformed.length);
    if (transformed.length > 0) {
      console.log('[Product Grid] Sample transformed item:', transformed[0]);
      // Log all the attr_ fields
      const attrFields = Object.keys(transformed[0]).filter(k => k.startsWith('attr_'));
      console.log('[Product Grid] Attribute fields in transformed item:', attrFields);
    }
  } else {
    transformedItems.value = props.items;
  }
};

// Watch for item changes
watch(() => props.items, (newItems) => {
  console.log('[Product Grid] Items changed:', newItems?.length);
  if (newItems && newItems.length > 0) {
    if (props.useCustomApi) {
      extractAttributesFromTransformedItems();
    } else {
      transformItems();
    }
  }
}, { immediate: true });

// Watch for attribute changes
watch(attributes, () => {
  if (props.items && props.items.length > 0) {
    transformItems();
  }
});

// Re-extract attributes when items change significantly
watch(() => props.items?.length, (newLength, oldLength) => {
  if (newLength && newLength !== oldLength) {
    if (props.useCustomApi) {
      extractAttributesFromTransformedItems();
    } else {
      extractAttributesFromItems();
    }
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