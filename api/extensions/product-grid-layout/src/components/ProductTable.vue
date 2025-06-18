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
		<!-- Column selector -->
		<v-menu v-model="columnMenuOpen" :close-on-content-click="false">
			<template #activator="{ toggle }">
				<v-button class="add-columns-button" icon small @click="toggle">
					<v-icon name="view_column" />
				</v-button>
			</template>

			<div class="column-selector">
				<div class="column-selector-header">
					<h3>{{ t('select_columns') }}</h3>
					<v-input v-model="columnSearch" type="search" :placeholder="t('search')" prepend-icon="search" />
				</div>

				<div class="column-groups">
					<!-- Standard fields -->
					<div class="column-group">
						<div class="column-group-header">{{ t('standard_fields') }}</div>
						<v-checkbox
							v-for="field in filteredStandardFields"
							:key="field.value"
							v-model="selectedColumns"
							:value="field.value"
							:label="field.text"
						/>
					</div>

					<!-- Attribute fields -->
					<div v-if="filteredAttributeFields.length > 0" class="column-group">
						<div class="column-group-header">{{ t('attributes') }}</div>
						<v-checkbox
							v-for="field in filteredAttributeFields"
							:key="field.value"
							v-model="selectedColumns"
							:value="field.value"
							:label="field.text"
						/>
					</div>
				</div>

				<div class="column-selector-footer">
					<v-button secondary @click="resetColumns">
						{{ t('reset_to_default') }}
					</v-button>
					<v-button @click="applyColumns">
						{{ t('apply') }}
					</v-button>
				</div>
			</div>
		</v-menu>

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

					<v-divider />

					<v-list-item clickable @click="openColumnSelector">
						<v-list-item-icon>
							<v-icon name="view_column" />
						</v-list-item-icon>
						<v-list-item-content>
							{{ t('manage_columns') }}
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
					:display="header.field?.display || null"
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
	attributes?: any[];

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
	attributes: () => [],
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
const columnMenuOpen = ref(false);
const columnSearch = ref('');
const selectedColumns = ref<string[]>([]);
const isLoadingSavedState = ref(false);
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

// Type for field definitions
interface FieldDefinition {
	text: string;
	value: string;
	field: {
		type: string;
		interface?: string;
		display?: string;
		displayOptions?: any;
		interfaceOptions?: any;
	};
	standard?: boolean;
	attribute?: boolean;
}

// All available fields
const allAvailableFields = computed<FieldDefinition[]>(() => {
	const standardFields: FieldDefinition[] = [
		{ text: 'ID', value: 'id', field: { type: 'string' }, standard: true },
		{ text: 'UUID', value: 'uuid', field: { type: 'string' }, standard: true },
		{ text: 'Image', value: 'primary_image', field: { type: 'file', interface: 'file-image' }, standard: true },
		{ text: 'Enabled', value: 'enabled', field: { type: 'boolean', interface: 'boolean' }, standard: true },
		{ text: 'Product Type', value: 'product_type', field: { type: 'string' }, standard: true },
		{ text: 'Family', value: 'family', field: { type: 'integer' }, standard: true },
		{ text: 'Created', value: 'date_created', field: { type: 'timestamp', interface: 'datetime' }, standard: true },
		{ text: 'Updated', value: 'date_updated', field: { type: 'timestamp', interface: 'datetime' }, standard: true },
	];

	const attributeFields: FieldDefinition[] = props.attributes.map((attr) => ({
		text: attr.label,
		value: `attr_${attr.code}`,
		field: { type: 'alias' },
		attribute: true,
	}));

	return [...standardFields, ...attributeFields];
});

// Filtered fields based on search
const filteredStandardFields = computed(() => {
	const search = columnSearch.value.toLowerCase();
	return allAvailableFields.value.filter((f) => f.standard && f.text.toLowerCase().includes(search));
});

const filteredAttributeFields = computed(() => {
	const search = columnSearch.value.toLowerCase();
	return allAvailableFields.value.filter((f) => f.attribute && f.text.toLowerCase().includes(search));
});

// Currently visible headers
const visibleHeaders = computed({
	get: () => props.tableHeaders,
	set: (val) => {
		emit('update:tableHeaders', val);
	},
});

// Initialize selected columns from current headers
watch(
	() => props.tableHeaders,
	(headers) => {
		if (!isLoadingSavedState.value) {
			selectedColumns.value = headers.map((h) => h.value);
		}
	},
	{ immediate: true },
);

// Load saved state only once on mount
onMounted(() => {
	if (props.layoutOptions?.savedColumns?.length > 0) {
		isLoadingSavedState.value = true;
		selectedColumns.value = props.layoutOptions.savedColumns;
		applySavedColumns();
		// Reset flag after a delay
		setTimeout(() => {
			isLoadingSavedState.value = false;
		}, 500);
	}
});

// Methods
const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
	if (!isAttributeField(field)) return null;
	const code = field.replace('attr_', '');
	return props.attributes.find((a) => a.code === code);
};

const hideColumn = (header: any) => {
	const newHeaders = visibleHeaders.value.filter((h) => h.value !== header.value);
	visibleHeaders.value = newHeaders;
	selectedColumns.value = newHeaders.map((h) => h.value);

	// Save the state
	saveColumnState();
};

const openColumnSelector = () => {
	columnMenuOpen.value = true;
};

const resetColumns = () => {
	// Default columns
	selectedColumns.value = ['primary_image', 'id', 'enabled', 'date_created'];

	// Clear saved state
	emit('update:layoutOptions', {
		...props.layoutOptions,
		savedColumns: null,
		columnWidths: null,
	});

	applyColumns();
};

const onHeadersUpdate = (newHeaders: any[]) => {
	// Update our headers
	visibleHeaders.value = newHeaders;

	// Save the new state (including new widths and order) with debounce
	if (!isLoadingSavedState.value) {
		setTimeout(() => {
			saveColumnState();
		}, 300);
	}
};

const applyColumns = () => {
	const newHeaders = selectedColumns.value
		.map((col: string) => {
			const field = allAvailableFields.value.find((f) => f.value === col);
			if (!field) return null;

			// Check if we have saved widths
			const savedWidth = props.layoutOptions?.columnWidths?.[col] || 150;
			// Check if we have saved alignment
			const savedAlignment = props.layoutOptions?.columnAlignments?.[col] || 'left';

			return {
				text: field.text,
				value: field.value,
				width: savedWidth,
				align: savedAlignment,
				sortable: !['json'].includes(field.field?.type || ''),
				field: field.field,
			};
		})
		.filter((h) => h !== null);

	visibleHeaders.value = newHeaders;
	columnMenuOpen.value = false;

	// Save the column configuration
	saveColumnState();
};

const applySavedColumns = () => {
	if (!props.layoutOptions?.savedColumns) return;

	const newHeaders = props.layoutOptions.savedColumns
		.map((col) => {
			const field = allAvailableFields.value.find((f) => f.value === col);
			if (!field) return null;

			const savedWidth = props.layoutOptions?.columnWidths?.[col] || 150;
			const savedAlignment = props.layoutOptions?.columnAlignments?.[col] || 'left';

			return {
				text: field.text,
				value: field.value,
				width: savedWidth,
				align: savedAlignment,
				sortable: !['json'].includes(field.field?.type || ''),
				field: field.field,
			};
		})
		.filter((h) => h !== null);

	if (newHeaders.length > 0) {
		// Don't trigger saves while loading
		isLoadingSavedState.value = true;
		visibleHeaders.value = newHeaders;
		setTimeout(() => {
			isLoadingSavedState.value = false;
		}, 100);
	}
};

const saveColumnState = () => {
	// Prevent saving if we're in the process of loading saved state
	if (isLoadingSavedState.value) return;

	const columnOrder = visibleHeaders.value.map((h) => h.value);
	const columnWidths = {};
	const columnAlignments = {};

	visibleHeaders.value.forEach((header) => {
		if (header.width) {
			columnWidths[header.value] = header.width;
		}
		if (header.align && header.align !== 'left') {
			// Only save non-default alignments
			columnAlignments[header.value] = header.align;
		}
	});

	// Only emit if the state has actually changed
	const currentSaved = props.layoutOptions?.savedColumns || [];
	const currentWidths = props.layoutOptions?.columnWidths || {};
	const currentAlignments = props.layoutOptions?.columnAlignments || {};

	const columnsChanged = JSON.stringify(columnOrder) !== JSON.stringify(currentSaved);
	const widthsChanged = JSON.stringify(columnWidths) !== JSON.stringify(currentWidths);
	const alignmentsChanged = JSON.stringify(columnAlignments) !== JSON.stringify(currentAlignments);

	if (columnsChanged || widthsChanged || alignmentsChanged) {
		emit('update:layoutOptions', {
			...props.layoutOptions,
			savedColumns: columnOrder,
			columnWidths: columnWidths,
			columnAlignments: columnAlignments,
		});
	}
};

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

	// Save the updated alignment to layout options
	saveColumnState();
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
