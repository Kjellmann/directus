<template>
	<!-- Grid View -->
	<product-grid
		v-if="viewMode === 'grid'"
		:items="items"
		:loading="loading"
		:selection="selectionWritable"
		:show-select="showSelect"
		:readonly="readonly"
		:on-row-click="handleRowClick"
		:page="page"
		:to-page="toPage"
		:total-pages="totalPages"
		:limit="limitWritable"
		:primary-key-field="primaryKeyField"
		:spacing="layoutOptions?.spacing || 'cozy'"
		@update:selection="selectionWritable = $event"
		@update:limit="limitWritable = $event"
	/>

	<!-- Table View -->
	<template v-else>
		<!-- Table -->
		<v-table
			ref="tableRef"
			v-model="selectionWritable"
			v-model:headers="visibleHeaders"
			class="product-table"
			fixed-header
			:show-select="showSelect"
			show-resize
			allow-header-reorder
			@update:headers="onHeadersUpdate"
			:must-sort="tableSort !== null"
			:sort="tableSort || { by: 'date_created', desc: true }"
			:items="items"
			:loading="loading"
			:item-key="primaryKeyField?.field ?? 'id'"
			:clickable="!readonly"
			selection-use-keys
			:row-height="tableRowHeight"
			@click:row="handleRowClick"
			@update:sort="onSortChange"
		>
			<template #header-context-menu="{ header }">
				<v-list>
					<!-- Sorting options -->
					<v-list-item
						v-if="header.sortable !== false"
						clickable
						@click="sortBy(header.value, 'asc')"
						:active="tableSort?.by === header.value && !tableSort?.desc"
					>
						<v-list-item-icon>
							<v-icon class="flip" name="sort" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('sort_asc') }}
						</v-list-item-content>
					</v-list-item>

					<v-list-item
						v-if="header.sortable !== false"
						clickable
						@click="sortBy(header.value, 'desc')"
						:active="tableSort?.by === header.value && tableSort?.desc"
					>
						<v-list-item-icon>
							<v-icon name="sort" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('sort_desc') }}
						</v-list-item-content>
					</v-list-item>

					<v-divider v-if="header.sortable !== false" />

					<!-- Alignment options -->
					<v-list-item clickable @click="setAlignment(header, 'left')">
						<v-list-item-icon>
							<v-icon name="format_align_left" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('left_align') }}
						</v-list-item-content>
					</v-list-item>

					<v-list-item clickable @click="setAlignment(header, 'center')">
						<v-list-item-icon>
							<v-icon name="format_align_center" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('center_align') }}
						</v-list-item-content>
					</v-list-item>

					<v-list-item clickable @click="setAlignment(header, 'right')">
						<v-list-item-icon>
							<v-icon name="format_align_right" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('right_align') }}
						</v-list-item-content>
					</v-list-item>

					<v-divider />

					<!-- Hide field option -->
					<v-list-item :disabled="header.required || visibleHeaders.length <= 1" clickable @click="hideColumn(header)">
						<v-list-item-icon>
							<v-icon name="visibility_off" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('hide_field') }}
						</v-list-item-content>
					</v-list-item>
				</v-list>
			</template>

			<template v-for="header in visibleHeaders" :key="header.value" #[`item.${header.value}`]="{ item }">
				<product-image
					v-if="header.value === 'primary_image'"
					:image-id="item.product_assets?.[0]?.assets_id?.media_file || item[header.value]"
					:alt="`Product ${item.id}`"
					:spacing="layoutOptions?.spacing || 'cozy'"
					view-mode="list"
				/>
				<render-display
					v-else-if="!isAttributeField(header.value)"
					:value="item[header.value]"
					:display="getDisplayForValue(item[header.value], header.field)"
					:options="header.field?.displayOptions || null"
					:interface="header.field?.interface || null"
					:interface-options="header.field?.interfaceOptions || null"
					:type="header.field?.type || 'string'"
					:collection="collection"
					:field="header.value"
				/>
				<grid-attribute-value v-else :value="item[header.value]" :attribute="getAttributeForField(header.value)" />
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

					<div v-if="!loading && (items.length >= 25 || limit < 25)" class="per-page">
						<span>{{ t('per_page') }}</span>
						<v-select
							:model-value="`${limitWritable}`"
							:items="pageSizes"
							inline
							@update:model-value="limitWritable = +$event"
						/>
					</div>
				</div>
			</template>
		</v-table>
	</template>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStores } from '@directus/extensions-sdk';
import GridAttributeValue from './GridAttributeValue.vue';
import ProductImage from './ProductImage.vue';
import ProductGrid from './ProductGrid.vue';
import { createI18nOptions } from '../translations';

interface Props {
	// Data
	items: any[];
	loading: boolean;
	collection: string;

	// Selection
	selection?: any[];
	showSelect?: string;
	readonly: boolean;

	// Table config
	tableHeaders: any[];
	tableSort?: { by: string; desc: boolean } | null;
	tableRowHeight: number;
	onRowClick: (event: { item: any; event: PointerEvent }) => void;
	onSortChange: (newSort: { by: string; desc: boolean }) => void;

	// Pagination
	page: number;
	toPage: (newPage: number) => void;
	totalPages: number;
	itemCount?: number;
	limit: number;

	// Fields
	primaryKeyField?: any;
	availableFields?: any[];
	attributeList?: any[];
	fields?: any[]; // Fields from the collection

	// Layout options for persistence
	layoutOptions?: any;
	viewMode?: 'grid' | 'list';

}

const props = withDefaults(defineProps<Props>(), {
	selection: () => [],
	showSelect: 'none',
	itemCount: 0,
	tableHeaders: () => [],
	tableSort: null,
	tableRowHeight: 80,
	items: () => [],
	loading: false,
	totalPages: 1,
	page: 1,
	limit: 25,
	readonly: false,
	availableFields: () => [],
	attributeList: () => [],
	fields: () => [],
	viewMode: 'list',
});

const emit = defineEmits(['update:selection', 'update:tableHeaders', 'update:limit', 'update:layoutOptions']);

// Get current language from Directus settings
const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');

// Use translations from our central translations file with current language
const { t } = useI18n(createI18nOptions(currentLanguage.value));

// Debug product with image
watch(
	() => props.items,
	(newItems) => {
		if (newItems && newItems.length > 0) {
			// Find product with SKU 10000132
			const targetProduct = newItems.find((item) => item.attr_sku === '10000132' || item.attr_sku === 10000132);
			if (targetProduct && targetProduct.product_assets && targetProduct.product_assets.length > 0) {
				console.log('[ProductTable] SKU 10000132 asset details:', targetProduct.product_assets[0]);
			}
		}
	},
	{ immediate: true },
);

// State
const tableRef = ref();
const pageSizes = ['25', '50', '100', '250', '500', '1000'];

// Sync selection
const selectionWritable = computed({
	get: () => props.selection,
	set: (val) => emit('update:selection', val),
});

// Sync limit
const limitWritable = computed({
	get: () => props.limit,
	set: (val) => emit('update:limit', val),
});



// Currently visible headers
const visibleHeaders = computed({
	get: () => props.tableHeaders,
	set: (val) => {
		emit('update:tableHeaders', val);
	},
});


// Methods
const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
	if (!isAttributeField(field)) return null;
	const code = field.replace('attr_', '');
	return props.attributeList.find((a) => a.code === code);
};

const getDisplayForValue = (value: any, field: any) => {
	// If display is 'related-values' but value is not an object, fallback to raw display
	if (field?.display === 'related-values' && (typeof value !== 'object' || value === null)) {
		return 'raw'; // Use raw display for non-expanded relations
	}
	return field?.display || null;
};

const hideColumn = (header: any) => {
	const newHeaders = visibleHeaders.value.filter((h) => h.value !== header.value);
	visibleHeaders.value = newHeaders;

	// Don't save state here - let the parent component handle it
	// The parent will receive the update through emit('update:tableHeaders')
};

const onHeadersUpdate = (newHeaders: any[]) => {
	// Update our headers
	visibleHeaders.value = newHeaders;

	// Don't save state here - let the parent component handle it
	// The parent will receive the update through emit('update:tableHeaders')
};

// Removed saveColumnState - column state is now managed by the actions component

// Row click handler
const handleRowClick = (event: { item: any; event: PointerEvent }) => {
	props.onRowClick(event);
};

// Sort functionality
const sortBy = (field: string, direction: 'asc' | 'desc') => {
	props.onSortChange({ by: field, desc: direction === 'desc' });
};

// Alignment functionality
const setAlignment = (header: any, alignment: 'left' | 'center' | 'right') => {
	const updatedHeaders = visibleHeaders.value.map((h) => {
		if (h.value === header.value) {
			return { ...h, align: alignment };
		}
		return h;
	});
	emit('update:tableHeaders', updatedHeaders);

	// Column state will be saved by the parent component
};
</script>

<style lang="scss" scoped>
.v-table :deep(table) {
	min-width: calc(100% - var(--content-padding)) !important;
	margin-left: var(--content-padding);
}

.footer {
	position: sticky;
	left: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 32px var(--content-padding);

	.per-page {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 240px;
		color: var(--theme--foreground-subdued);

		span {
			width: auto;
			margin-right: 4px;
		}

		.v-select {
			color: var(--theme--foreground);
		}
	}
}

.flip {
	transform: scaleY(-1);
}

</style>
