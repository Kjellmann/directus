<template>
  <div class="layout-tabular-enhanced">
    <product-table
      :items="props.useCustomApi ? props.items : transformedItems"
      :loading="loading"
      :collection="collection"
      :selection="selection"
      :show-select="showSelect"
      :readonly="readonly"
      :table-headers="tableHeaders"
      :table-sort="tableSort"
      :table-row-height="tableRowHeight"
      :on-row-click="onRowClick"
      :on-sort-change="onSortChange"
      :page="page"
      :to-page="toPage"
      :total-pages="totalPages"
      :item-count="itemCount"
      :limit="limit"
      :primary-key-field="primaryKeyField"
      :attributes="attributes"
      :layout-options="layoutOptions"
      @update:selection="emit('update:selection', $event)"
      @update:table-headers="emit('update:tableHeaders', $event)"
      @update:limit="emit('update:limit', $event)"
      @update:layout-options="emit('update:layoutOptions', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ProductTable from './components/ProductTable.vue';

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
  layoutOptions?: any;
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

const emit = defineEmits(['update:selection', 'update:tableHeaders', 'update:limit', 'update:fields', 'update:layoutOptions']);

// State
const attributes = ref<any[]>([]);
const transformedItems = ref<any[]>([]);

// Initialize headers if empty and no saved state
if ((!props.tableHeaders || props.tableHeaders.length === 0) && !props.layoutOptions?.savedColumns) {
  emit('update:tableHeaders', [
    { text: 'ID', value: 'id', width: 200, align: 'left', sortable: true, field: { type: 'string' } },
    { text: 'Enabled', value: 'enabled', width: 100, align: 'left', sortable: true, field: { type: 'boolean', interface: 'boolean' } },
    { text: 'Created', value: 'date_created', width: 200, align: 'left', sortable: true, field: { type: 'timestamp', interface: 'datetime' } },
  ]);
}

// Load attributes on mount
onMounted(() => {
  console.log('[Product Grid] Mounting with props:', {
    items: props.items?.length,
    loading: props.loading,
    collection: props.collection,
    tableHeaders: props.tableHeaders?.length,
    page: props.page,
    limit: props.limit,
    itemCount: props.itemCount,
    useCustomApi: props.useCustomApi,
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
  
  // Add attribute columns to headers if not already present
  if (attributes.value.length > 0) {
    const currentHeaders = [...props.tableHeaders];
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
      emit('update:tableHeaders', [...currentHeaders, ...attributeHeaders]);
    }
  }
};

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
            // The value might be a JSON object with a 'value' property
            let value = attrJunction.value;
            if (value && typeof value === 'object' && 'value' in value) {
              value = value.value;
            } else if (typeof value === 'string') {
              // Try to parse JSON strings
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
</style>