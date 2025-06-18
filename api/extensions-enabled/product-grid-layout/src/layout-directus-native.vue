<template>
  <private-view :title="title">
    <template v-if="error" #headline>
      <v-banner>{{ error }}</v-banner>
    </template>

    <template #title-outer:prepend>
      <v-button class="header-icon" rounded icon exact :to="`/content/${collection}`">
        <v-icon name="arrow_back" />
      </v-button>
    </template>

    <template #actions>
      <search-input v-model="searchQuery" :collection="collection" />

      <v-dialog v-model="confirmDelete" @esc="confirmDelete = false">
        <v-card>
          <v-card-title>{{ t('delete_are_you_sure') }}</v-card-title>
          <v-card-actions>
            <v-button :disabled="deleting" secondary @click="confirmDelete = false">
              {{ t('cancel') }}
            </v-button>
            <v-button :loading="deleting" kind="danger" @click="deleteItems">
              {{ t('delete') }}
            </v-button>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog
        v-model="confirmBatchDelete"
        @esc="confirmBatchDelete = false"
      >
        <v-card>
          <v-card-title>{{ t('delete_are_you_sure', selection.length) }}</v-card-title>
          <v-card-actions>
            <v-button :disabled="batchDeleting" secondary @click="confirmBatchDelete = false">
              {{ t('cancel') }}
            </v-button>
            <v-button :loading="batchDeleting" kind="danger" @click="batchDelete">
              {{ t('delete') }}
            </v-button>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <template #navigation>
      <content-navigation :current="collection" />
    </template>

    <template #sidebar>
      <sidebar-detail icon="info" :title="t('information')" close>
        <div v-md="t('page_help_collections_overview')" class="page-description" />
      </sidebar-detail>
      <layout-sidebar-detail v-model="layout">
        <filter-sidebar-detail
          v-model:filters="filters"
          :collection="collection"
          :loading="loading"
          :refresh="refresh"
        />
      </layout-sidebar-detail>
      <component
        :is="`layout-actions-${layout}`"
        v-if="layout"
        v-bind="layoutState"
        :selection="selection"
        :collection="collection"
        :loading="loading"
        :error="error"
        :search="searchQuery"
        @refresh="refresh"
      />
      <refresh-sidebar-detail v-model="refreshInterval" @refresh="refresh" />
    </template>

    <v-table
      ref="table"
      v-model:headers="tableHeaders"
      v-model="selection"
      :items="items"
      :loading="loading"
      fixed-header
      :show-select="selection !== undefined ? 'multiple' : 'none'"
      show-resize
      must-sort
      :sort="tableSort"
      :item-key="primaryKeyField?.field || 'id'"
      :clickable="true"
      selection-use-keys
      :search="searchQuery"
      @update:sort="onSortChange"
      @click:row="onRowClick"
    >
      <template #header-context-menu="{ header }">
        <v-list>
          <v-list-item clickable @click="toggleColumn(header)">
            <v-list-item-icon>
              <v-icon name="visibility_off" />
            </v-list-item-icon>
            <v-list-item-content>{{ t('hide_field') }}</v-list-item-content>
          </v-list-item>
        </v-list>
      </template>

      <template v-for="header in tableHeaders" :key="header.value" #[`item.${header.value}`]="{ item }">
        <render-display
          v-if="!isAttributeField(header.value)"
          :value="getFieldValue(item, header.value)"
          :display="getDisplay(header.value)"
          :options="getDisplayOptions(header.value)"
          :type="getFieldType(header.value)"
          :collection="collection"
          :field="header.value"
        />
        <grid-attribute-value
          v-else
          :value="getFieldValue(item, header.value)"
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

          <div v-if="!loading && itemCount > 0" class="per-page">
            <span>{{ t('per_page') }}</span>
            <v-select
              v-model="limit"
              :items="[25, 50, 100, 250, 500, 1000]"
              inline
            />
          </div>
        </div>
      </template>
    </v-table>
  </private-view>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useApi, useStores } from '@directus/extensions-sdk';
import { useCollection, useItems, useLayout } from '@directus/composables';
import GridAttributeValue from './components/GridAttributeValue.vue';
import ContentNavigation from '@/views/private/components/navigation.vue';
import SearchInput from '@/views/private/components/search-input.vue';
import LayoutSidebarDetail from '@/views/private/components/layout-sidebar-detail.vue';
import RefreshSidebarDetail from '@/views/private/components/refresh-sidebar-detail.vue';
import FilterSidebarDetail from '@/views/private/components/filter-sidebar-detail.vue';
import SidebarDetail from '@/components/v-detail/v-detail.vue';
import { debounce } from 'lodash';

interface Props {
  collection: string;
  bookmark?: string | null;
  archive?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  bookmark: null,
  archive: null,
});

const emit = defineEmits(['update:selection', 'update:layout']);

const { t } = useI18n();
const router = useRouter();
const api = useApi();
const { useFieldsStore, useCollectionsStore } = useStores();
const fieldsStore = useFieldsStore();
const collectionsStore = useCollectionsStore();

const { collection } = toRefs(props);
const { info: collectionInfo, primaryKeyField } = useCollection(collection);

// State
const selection = ref<any[]>([]);
const layout = ref('tabular');
const searchQuery = ref('');
const filters = ref([]);
const tableHeaders = ref<any[]>([]);
const tableSort = ref({ by: 'date_created', desc: true });
const page = ref(1);
const limit = ref(25);
const refreshInterval = ref(null);
const confirmDelete = ref(false);
const confirmBatchDelete = ref(false);
const deleting = ref(false);
const batchDeleting = ref(false);
const attributes = ref<any[]>([]);
const attributeMap = ref(new Map());

// Data fetching
const {
  items,
  loading,
  error,
  totalPages,
  itemCount,
  getItems,
  getItemCount,
} = useItems(collection, {
  limit,
  page,
  search: searchQuery,
  filter: filters,
  sort: computed(() => (tableSort.value?.by ? `${tableSort.value.desc ? '-' : ''}${tableSort.value.by}` : null)),
  fields: computed(() => {
    // Include attribute fields in the query
    const fields = tableHeaders.value.map(h => h.value);
    return ['*', ...fields.filter(f => f.startsWith('attr_'))];
  }),
});

// Layout state
const layoutState = computed(() => ({
  layout: layout.value,
  collection: collection.value,
  selection: selection.value,
  items: items.value,
  loading: loading.value,
  error: error.value,
  totalPages: totalPages.value,
  itemCount: itemCount.value,
  tableHeaders: tableHeaders.value,
  tableSort: tableSort.value,
  onSortChange,
  fields: fieldsStore.getFieldsForCollection(collection.value),
  limit: limit.value,
  page: page.value,
  toPage,
  primaryKeyField: primaryKeyField.value,
}));

// Title
const title = computed(() => {
  if (loading.value) return t('loading');
  return collectionInfo.value?.name || collection.value;
});

// Methods
const loadAttributes = async () => {
  try {
    const response = await api.get('/items/attributes', {
      params: {
        filter: { usable_in_grid: { _eq: true } },
        fields: ['id', 'code', 'label', 'type.*', 'options.*', 'units.*', 'is_searchable'],
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

    // Set default headers including some attributes
    const standardHeaders = [
      { text: 'ID', value: 'id', width: 200 },
      { text: 'Enabled', value: 'enabled', width: 100 },
      { text: 'Family', value: 'family', width: 150 },
      { text: 'Created', value: 'date_created', width: 200 },
    ];

    // Add first 5 attributes as default columns
    const attributeHeaders = attributes.value.slice(0, 5).map(attr => ({
      text: attr.label,
      value: `attr_${attr.code}`,
      width: 150,
    }));

    tableHeaders.value = [...standardHeaders, ...attributeHeaders];
  } catch (error) {
    console.error('Error loading attributes:', error);
  }
};

const refresh = async () => {
  await getItems();
  await getItemCount();
};

const toPage = (newPage: number) => {
  page.value = newPage;
};

const onSortChange = (newSort: any) => {
  tableSort.value = newSort;
};

const onRowClick = ({ item, event }: any) => {
  if (event.target?.classList.contains('v-checkbox')) return;
  router.push(`/content/${collection.value}/${item[primaryKeyField.value?.field || 'id']}`);
};

const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
  if (!isAttributeField(field)) return null;
  const code = field.replace('attr_', '');
  return attributeMap.value.get(code);
};

const getFieldValue = (item: any, field: string) => {
  if (isAttributeField(field)) {
    // For attributes, we need to load the value from our enhanced endpoint
    return item[field] || null;
  }
  return item[field];
};

const getDisplay = (field: string) => {
  const fieldInfo = fieldsStore.getField(collection.value, field);
  return fieldInfo?.meta?.display || null;
};

const getDisplayOptions = (field: string) => {
  const fieldInfo = fieldsStore.getField(collection.value, field);
  return fieldInfo?.meta?.display_options || null;
};

const getFieldType = (field: string) => {
  const fieldInfo = fieldsStore.getField(collection.value, field);
  return fieldInfo?.type || 'unknown';
};

const toggleColumn = (header: any) => {
  const index = tableHeaders.value.findIndex(h => h.value === header.value);
  if (index > -1) {
    tableHeaders.value.splice(index, 1);
  }
};

const deleteItems = async () => {
  // Implementation for delete
  confirmDelete.value = false;
};

const batchDelete = async () => {
  // Implementation for batch delete
  confirmBatchDelete.value = false;
};

// Load attribute values when items change
const loadAttributeValues = debounce(async () => {
  if (!items.value || items.value.length === 0) return;

  const productIds = items.value.map(item => item.id);
  const attributeFields = tableHeaders.value
    .filter(h => h.value.startsWith('attr_'))
    .map(h => h.value);

  if (attributeFields.length === 0) return;

  try {
    // Get attribute IDs
    const attributeCodes = attributeFields.map(f => f.replace('attr_', ''));
    const attrIds = attributes.value
      .filter(a => attributeCodes.includes(a.code))
      .map(a => a.id);

    // Load values
    const response = await api.get('/items/product_attributes', {
      params: {
        filter: {
          product_id: { _in: productIds },
          attribute_id: { _in: attrIds },
        },
        limit: -1,
        fields: ['product_id', 'attribute_id', 'value'],
      },
    });

    // Build value map
    const valueMap = new Map();
    (response.data.data || []).forEach((row: any) => {
      const attr = attributes.value.find(a => a.id === row.attribute_id);
      if (attr) {
        const key = `${row.product_id}_attr_${attr.code}`;
        valueMap.set(key, row.value);
      }
    });

    // Update items with attribute values
    items.value = items.value.map(item => {
      const updatedItem = { ...item };
      attributeFields.forEach(field => {
        const key = `${item.id}_${field}`;
        updatedItem[field] = valueMap.get(key) || null;
      });
      return updatedItem;
    });
  } catch (error) {
    console.error('Error loading attribute values:', error);
  }
}, 300);

// Lifecycle
onMounted(async () => {
  await loadAttributes();
  await refresh();
});

// Watch for changes
watch(items, () => {
  loadAttributeValues();
});

watch([searchQuery, filters, tableSort, limit], () => {
  page.value = 1;
});
</script>

<style scoped>
.header-icon {
  --v-button-color: var(--foreground-subdued);
  --v-button-background-color: var(--background-normal);
  --v-button-background-color-hover: var(--background-normal-alt);
}

.footer {
  position: sticky;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 32px;
  background-color: var(--background-normal);
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

:deep(.v-table) {
  --v-table-sticky-offset-top: var(--layout-offset-top);
}

.page-description {
  padding: var(--content-padding);
  padding-top: 0;
  line-height: 1.5;
}
</style>