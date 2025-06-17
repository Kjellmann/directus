<template>
  <div class="layout-tabular">
    <v-table
      ref="table"
      v-model="selectionWritable"
      v-model:headers="tableHeadersWritable"
      class="table"
      fixed-header
      :show-select="showSelect"
      :show-resize="true"
      :must-sort="tableSort !== null"
      :sort="tableSort"
      :items="items"
      :loading="loading"
      :item-key="primaryKeyField?.field ?? 'id'"
      :clickable="!readonly"
      :selection-use-keys="true"
      @click:row="onRowClick"
      @update:sort="onSortChange"
    >
      <template #header-context-menu="{ header }">
        <v-list>
          <v-list-item
            v-if="!header.hideOnDetail"
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

          <v-list-item clickable @click="openFieldDetail(header.value)">
            <v-list-item-icon>
              <v-icon name="info" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ t('field_details') }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </template>

      <template v-for="header in tableHeaders" :key="header.value" #[`item.${header.value}`]="{ item }">
        <div v-if="isAttributeField(header.value)" class="cell-content">
          <grid-attribute-value
            :value="getAttributeValue(item, header.value)"
            :attribute="getAttributeForField(header.value)"
          />
        </div>
        <render-display
          v-else
          :value="item[header.value]"
          :display="header.display"
          :options="header.displayOptions"
          :interface="header.interface"
          :interface-options="header.interfaceOptions"
          :type="header.type"
          :collection="collection"
          :field="header.value"
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
              @update:model-value="updatePageSize"
            />
          </div>
        </div>
      </template>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, toRefs } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useSync } from '@directus/composables';
import type { Field, Filter, Item } from '@directus/types';
import type { HeaderRaw } from '@/components/v-table/types';
import type { ShowSelect } from '@directus/extensions';
import { Collection } from '@/types/collections';
import GridAttributeValue from './components/GridAttributeValue.vue';

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
});

const emit = defineEmits(['update:selection', 'update:tableHeaders', 'update:limit', 'update:fields']);

const { t } = useI18n();
const api = useApi();
const router = useRouter();
const { useNotificationsStore, useFieldsStore } = useStores();
const notifications = useNotificationsStore();
const fieldsStore = useFieldsStore();

// Sync props with parent
const selectionWritable = useSync(props, 'selection', emit);
const tableHeadersWritable = useSync(props, 'tableHeaders', emit);
const limitWritable = useSync(props, 'limit', emit);

// State
const attributes = ref<any[]>([]);
const attributeMap = ref(new Map());
const searchableAttributeCodes = ref<string[]>([]);

// Constants
const pageSizes = [25, 50, 100, 250, 500, 1000];

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

// Methods
const loadAttributes = async () => {
  try {
    // Load all grid-enabled attributes
    const response = await api.get('/items/attributes', {
      params: {
        filter: { usable_in_grid: { _eq: true } },
        fields: ['id', 'code', 'label', 'type.*', 'options.*', 'units.*', 'is_searchable'],
        sort: ['sort'],
        limit: -1
      }
    });
    
    attributes.value = response.data.data || [];
    
    // Build attribute map and searchable codes
    attributeMap.value.clear();
    searchableAttributeCodes.value = [];
    
    attributes.value.forEach(attr => {
      attributeMap.value.set(attr.code, attr);
      if (attr.is_searchable) {
        searchableAttributeCodes.value.push(attr.code);
      }
    });
    
    // Register virtual fields for attributes
    await registerAttributeFields();
  } catch (error) {
    console.error('Error loading attributes:', error);
  }
};

const registerAttributeFields = async () => {
  // Create virtual field definitions for attributes
  const attributeFields = attributes.value.map(attr => ({
    field: `attr_${attr.code}`,
    name: attr.label,
    type: 'alias',
    alias: true,
    collection: props.collection,
    meta: {
      id: `attr_${attr.code}`,
      collection: props.collection,
      field: `attr_${attr.code}`,
      display: null,
      display_options: null,
      interface: null,
      interface_options: null,
      required: false,
      readonly: true,
      hidden: false,
      sort: null,
      width: 'full',
      special: ['alias', 'no-data'],
      note: attr.description,
    },
    schema: null,
  }));
  
  // Add to fields store
  attributeFields.forEach(field => {
    fieldsStore.upsertField(props.collection, field);
  });
};

const toggleFieldVisibility = (header: HeaderRaw) => {
  const newHeaders = [...tableHeadersWritable.value];
  const index = newHeaders.findIndex(h => h.value === header.value);
  if (index > -1) {
    newHeaders.splice(index, 1);
    tableHeadersWritable.value = newHeaders;
  }
};

const openFieldDetail = (field: string) => {
  if (isAttributeField(field)) {
    const attr = getAttributeForField(field);
    if (attr) {
      notifications.add({
        title: attr.label,
        text: attr.description || 'Product attribute field',
        type: 'info'
      });
    }
  } else {
    // Navigate to field detail in system
    router.push(`/settings/data-model/${props.collection}/${field}`);
  }
};

const updatePageSize = (newSize: number) => {
  limitWritable.value = newSize;
};

// Load attributes on mount
onMounted(() => {
  loadAttributes();
});

// Re-load attributes if collection changes
watch(() => props.collection, () => {
  loadAttributes();
});
</script>

<style scoped>
.layout-tabular {
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

.cell-content {
  max-width: 400px;
  overflow: hidden;
}
</style>