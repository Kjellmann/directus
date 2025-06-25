<template>
	<div class="layout-actions">
		<!-- Preset Manager -->
		<preset-manager
			:presets="presets"
			:active-preset="activePreset"
			:active-preset-id="activePresetId"
			:is-dirty="isDirty"
			@save-preset="handleSavePreset"
			@update-preset="handleUpdatePreset"
			@apply-preset="handleApplyPreset"
			@delete-preset="handleDeletePreset"
			@set-default="handleSetDefault"
		/>

		<!-- Filters Button -->
		<product-filters
			:attributes="attributeList"
			:current-filters="currentFilters"
			:current-attribute-filters="currentAttributeFilters"
			@update:filters="onFiltersUpdate"
		/>

		<!-- Column Selector Button -->
		<v-button
			v-if="viewMode === 'list'"
			v-tooltip.bottom="t('select_columns')"
			icon
			rounded
			outlined
			secondary
			@click="showColumnSelector = true"
		>
			<v-icon name="view_column" />
		</v-button>

		<!-- Column Selector Dialog -->
		<v-drawer
			v-model="showColumnSelector"
			:title="t('select_columns')"
			icon="view_column"
			@cancel="cancelColumnSelection"
		>
			<div class="column-selector-content">
				<div class="column-selector-scrollable">
					<div class="column-selector-search">
						<v-input v-model="columnSearch" type="search" :placeholder="t('search')" prepend-icon="search" />
					</div>

					<div class="column-selector-info">
						<span class="column-count">
							{{ tempSelectedColumns.length }} {{ t('out_of') }} {{ filteredAllFields.length }} {{ t('visible') }}
						</span>
					</div>

					<div class="columns-grid">
						<div
							class="column-item"
							v-for="field in filteredAllFields"
							:key="field.value"
							:class="{
								selected: tempSelectedColumns.includes(field.value),
								disabled: tempSelectedColumns.length === 1 && tempSelectedColumns.includes(field.value),
							}"
							@click="toggleColumn(field.value)"
						>
							<div class="column-content">
								<div class="column-label-container">
									<div class="column-label">
										{{ field.text }}
									</div>
									<div class="column-code">
										{{ field.value.startsWith('attr_') ? field.value.replace('attr_', '') : field.value }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="column-selector-actions">
					<v-button secondary @click="resetColumns">
						{{ t('reset_to_default') }}
					</v-button>
					<v-button kind="primary" @click="applyColumns">
						{{ t('apply') }}
					</v-button>
				</div>
			</div>
		</v-drawer>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStores } from '@directus/extensions-sdk';
import ProductFilters from './components/ProductFilters.vue';
import PresetManager from './components/PresetManager.vue';
import { usePresetManager } from './composables/usePresetManager';
import { createI18nOptions } from './translations';

interface Props {
	// Data
	collection: string;
	selection?: any[];

	// Table config
	tableHeaders: any[];
	viewMode?: 'grid' | 'list';

	// Attributes
	attributeList?: any[];
	fields?: any[]; // Fields from the collection

	// Layout options for persistence
	layoutOptions?: any;
	layoutQuery?: any;

	// Filters
	filter?: any;
	onFilterChange?: (filters: any) => void;
}

const props = withDefaults(defineProps<Props>(), {
	selection: () => [],
	tableHeaders: () => [],
	attributeList: () => [],
	fields: () => [],
	viewMode: 'list',
});

const emit = defineEmits(['update:tableHeaders', 'update:layoutOptions']);

const toggleColumn = (column: string) => {
	if (tempSelectedColumns.value.includes(column)) {
		tempSelectedColumns.value = tempSelectedColumns.value.filter((c) => c !== column);
	} else {
		tempSelectedColumns.value.push(column);
	}
};

// Get current language from Directus settings
const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');

// Use translations
const { t } = useI18n(createI18nOptions(currentLanguage.value));

// Initialize preset manager
const presetManager = usePresetManager({
	collection: props.collection,
	layoutOptions: computed(() => props.layoutOptions),
	layoutQuery: computed(() => props.layoutQuery),
	tableHeaders: computed(() => props.tableHeaders),
	currentFilters: computed(() => currentFilters.value),
	currentAttributeFilters: computed(() => currentAttributeFilters.value),
	emit,
});

const {
	presets,
	activePreset,
	activePresetId,
	isDirty,
	savePreset,
	updatePreset,
	applyPreset,
	deletePreset,
	setDefaultPreset,
	checkDirtyState,
} = presetManager;

// State for column selector
const showColumnSelector = ref(false);
const columnSearch = ref('');
const selectedColumns = ref<string[]>([]);
const tempSelectedColumns = ref<string[]>([]);
const isLoadingSavedState = ref(false);
const hasSavedStateBeenApplied = ref(false);

// Default system fields that should be enabled by default
const DEFAULT_SYSTEM_FIELDS = ['primary_image', 'id', 'enabled', 'product_type', 'family'];

// Parse filters for the ProductFilters component
const currentFilters = computed(() => {
	// Check layoutQuery first (persisted filters), then props.filter
	const filterSource = props.layoutQuery?.filter || props.filter;
	if (!filterSource || typeof filterSource !== 'object') return {};

	// Extract standard Directus filters
	const standardFilters = { ...filterSource };
	// Remove attribute filters from standard filters
	Object.keys(standardFilters).forEach((key) => {
		if (key.startsWith('attr_')) {
			delete standardFilters[key];
		}
	});
	return standardFilters;
});

const currentAttributeFilters = computed(() => {
	// Check if we have attribute filters in layoutQuery
	if (props.layoutQuery?.attribute_filters) {
		try {
			return JSON.parse(props.layoutQuery.attribute_filters);
		} catch (e) {
			console.error('Failed to parse attribute_filters:', e);
			return {};
		}
	}
	return {};
});

// Handle filter updates from ProductFilters component
function onFiltersUpdate(filters: { filter: any; attribute_filters: string | null }) {
	console.log('[Actions] onFiltersUpdate called with:', filters);
	console.log('[Actions] props.onFilterChange exists:', !!props.onFilterChange);
	if (props.onFilterChange) {
		props.onFilterChange(filters);
	} else {
		console.warn('[Actions] props.onFilterChange is not defined!');
	}
}

// Type for field definitions
interface FieldDefinition {
	text: string;
	value: string;
	displayValue?: string; // Optional display value for UI (without prefix)
	field: {
		type: string;
		interface?: string;
		display?: string;
		displayOptions?: any;
		interfaceOptions?: any;
	};
	standard?: boolean;
	attribute?: boolean;
	usableInGrid?: boolean;
}

// Fields to exclude from the column selector
const EXCLUDED_FIELDS = ['variant_configuration', 'product_assets', 'attributes', 'user_created', 'user_updated'];

// All available fields
const allAvailableFields = computed<FieldDefinition[]>(() => {
	// Always include primary_image as the first field
	const imageField: FieldDefinition = {
		text: 'Image',
		value: 'primary_image',
		field: {
			type: 'file',
			interface: 'file-image',
		},
		standard: true,
	};

	// Get standard fields from the collection fields, filtering out excluded ones
	const standardFields: FieldDefinition[] = (props.fields || [])
		.filter((field) => {
			// Exclude certain fields and system fields that start with directus_
			return (
				!EXCLUDED_FIELDS.includes(field.field) && !field.field.startsWith('directus_') && field.meta?.hidden !== true
			);
		})
		.map((field) => ({
			text: field.name || field.field,
			value: field.field,
			field: {
				type: field.type,
				interface: field.meta?.interface,
				display: field.meta?.display,
				displayOptions: field.meta?.display_options,
				interfaceOptions: field.meta?.options,
			},
			standard: true,
		}));

	// Get attribute fields from the attributeList prop
	const attributeFields: FieldDefinition[] = (props.attributeList || []).map((attr) => ({
		text: attr.label,
		value: `attr_${attr.code}`, // Internal value keeps prefix for compatibility
		displayValue: attr.code, // Display value without prefix for UI
		field: { type: 'alias' },
		attribute: true,
		usableInGrid: attr.usable_in_grid || false,
	}));

	const standardFieldValues = standardFields.map((f) => f.value);
	const attributeFieldValues = attributeFields.map((f) => f.value);

	console.log('[Actions] allAvailableFields computed:', {
		standardFieldsCount: standardFields.length,
		standardFields: standardFieldValues,
		attributeFieldsCount: attributeFields.length,
		attributeFields: attributeFieldValues,
		totalCount: 1 + standardFields.length + attributeFields.length,
	});

	return [imageField, ...standardFields, ...attributeFields];
});

// Filtered fields based on search
const filteredAllFields = computed(() => {
	const search = columnSearch.value.toLowerCase();
	if (!search) return allAvailableFields.value;
	return allAvailableFields.value.filter((f) => f.text.toLowerCase().includes(search));
});

// Initialize selected columns from current headers
watch(
	() => props.tableHeaders,
	(headers) => {
		console.log('[Actions] tableHeaders watcher triggered:', {
			headers: headers?.map((h) => h.value),
			isLoadingSavedState: isLoadingSavedState.value,
			savedColumnsLength: props.layoutOptions?.savedColumns?.length,
		});

		// Only sync and save if we have headers
		// Don't save empty state when navigating away
		if (headers && headers.length > 0) {
			const newSelection = headers.map((h) => h.value);
			selectedColumns.value = newSelection;
			tempSelectedColumns.value = [...newSelection];

			// Save the updated state if not loading
			if (!isLoadingSavedState.value) {
				setTimeout(() => {
					saveColumnState();
				}, 100);
			}
		}
	},
	{ immediate: true },
);

// Sync temp columns when dialog opens
watch(showColumnSelector, (isOpen) => {
	if (isOpen) {
		tempSelectedColumns.value = [...selectedColumns.value];
	}
});

// Apply saved columns to table headers
const applySavedColumns = () => {
	console.log('[Actions] applySavedColumns called with:', {
		savedColumns: props.layoutOptions?.savedColumns,
		availableFieldsCount: allAvailableFields.value.length,
	});

	if (!props.layoutOptions?.savedColumns || props.layoutOptions.savedColumns.length === 0) {
		console.log('[Actions] No saved columns to apply');
		return;
	}

	console.log(
		'[Actions] Available fields:',
		allAvailableFields.value.map((f) => f.value),
	);

	const savedHeaders = props.layoutOptions.savedColumns
		.map((col: string) => {
			const field = allAvailableFields.value.find((f) => f.value === col);
			if (!field) {
				console.log('[Actions] WARNING: Field not found for saved column:', col);
				return null;
			}

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

	console.log(
		'[Actions] Emitting saved headers:',
		savedHeaders.map((h) => h.value),
	);
	if (savedHeaders.length > 0) {
		emit('update:tableHeaders', savedHeaders);
	}
};

// Watch for available fields and saved columns to be ready
watch(
	[
		() => props.layoutOptions?.savedColumns,
		() => allAvailableFields.value.length,
		() => props.fields?.length,
		() => props.attributeList?.length,
	],
	([savedCols, fieldCount, fieldsLength, attrLength]) => {
		console.log('[Actions] Column watcher triggered:', {
			savedCols,
			fieldCount,
			fieldsLength,
			attrLength,
			hasSavedStateBeenApplied: hasSavedStateBeenApplied.value,
		});

		// Make sure we have all field sources loaded before applying saved columns
		const hasStandardFields = fieldsLength > 0;
		const hasAttributes = !props.attributeList || attrLength > 0;
		const allFieldsReady = hasStandardFields && hasAttributes && fieldCount > 0;

		if (savedCols && allFieldsReady) {
			// Check if saved columns have changed (indicates preset was applied)
			const currentSavedStr = JSON.stringify(selectedColumns.value);
			const newSavedStr = JSON.stringify(savedCols);
			const columnsChanged = currentSavedStr !== newSavedStr;

			// Apply if not yet applied OR if columns have changed
			if (!hasSavedStateBeenApplied.value || columnsChanged) {
				console.log('[Actions] Applying saved columns:', {
					columnsChanged,
					currentColumns: selectedColumns.value,
					newColumns: savedCols,
				});

				// Handle empty saved columns - reset to defaults
				if (savedCols.length === 0) {
					console.log('[Actions] Empty saved columns detected, applying defaults');
					resetColumns();
					// Apply the default columns
					selectedColumns.value = [...tempSelectedColumns.value];
					hasSavedStateBeenApplied.value = true;

					// Build headers for default columns
					const defaultHeaders = selectedColumns.value
						.map((col: string) => {
							const field = allAvailableFields.value.find((f) => f.value === col);
							if (!field) return null;
							return {
								text: field.text,
								value: field.value,
								width: 150,
								align: 'left',
								sortable: !['json'].includes(field.field?.type || ''),
								field: field.field,
							};
						})
						.filter((h) => h !== null);

					if (defaultHeaders.length > 0) {
						emit('update:tableHeaders', defaultHeaders);
					}
					return;
				}

				// Check if all saved columns are available
				const missingColumns = savedCols.filter((col) => !allAvailableFields.value.find((f) => f.value === col));

				if (missingColumns.length > 0) {
					console.log('[Actions] Some saved columns are not yet available:', missingColumns);
					return; // Wait for all columns to be available
				}

				// All columns are available, apply them
				console.log('[Actions] All saved columns are available, applying now');
				isLoadingSavedState.value = true;
				hasSavedStateBeenApplied.value = true;
				selectedColumns.value = savedCols;
				tempSelectedColumns.value = [...savedCols];

				// Apply the saved columns to the table
				applySavedColumns();

				// Reset flag after a delay
				setTimeout(() => {
					isLoadingSavedState.value = false;
				}, 500);
			}
		}
	},
	{ immediate: true },
);

// Methods
const cancelColumnSelection = () => {
	// Reset temp columns to current state
	tempSelectedColumns.value = [...selectedColumns.value];
	columnSearch.value = '';
	showColumnSelector.value = false;
};

const resetColumns = () => {
	// Use the default view columns from preset manager: Image, SKU, Name, Enabled, Price
	const defaultViewColumns = ['primary_image', 'attr_sku', 'attr_name', 'enabled', 'attr_price'];
	const defaultColumns: string[] = [];

	// Add columns that exist in available fields
	defaultViewColumns.forEach((col) => {
		if (allAvailableFields.value.find((f) => f.value === col)) {
			defaultColumns.push(col);
		}
	});

	// If not all default columns are available, add other available columns
	if (defaultColumns.length < defaultViewColumns.length) {
		// Add other system fields that exist
		DEFAULT_SYSTEM_FIELDS.forEach((field) => {
			if (!defaultColumns.includes(field) && allAvailableFields.value.find((f) => f.value === field)) {
				defaultColumns.push(field);
			}
		});

		// Add attributes that have usable_in_grid = true
		allAvailableFields.value
			.filter((f) => f.attribute && f.usableInGrid && !defaultColumns.includes(f.value))
			.forEach((f) => defaultColumns.push(f.value));
	}

	// Ensure at least one column is selected
	if (defaultColumns.length === 0) {
		defaultColumns.push('primary_image');
	}

	tempSelectedColumns.value = defaultColumns;
};

const applyColumns = () => {
	// Ensure at least one column is selected
	if (tempSelectedColumns.value.length === 0) {
		console.warn('[Actions] No columns selected, cannot apply');
		return;
	}

	// Apply the temp selection
	selectedColumns.value = [...tempSelectedColumns.value];

	console.log('[Actions] applyColumns - selected columns:', selectedColumns.value);

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

	console.log(
		'[Actions] applyColumns - emitting headers:',
		newHeaders.map((h) => h.value),
	);
	emit('update:tableHeaders', newHeaders);
	showColumnSelector.value = false;
	columnSearch.value = '';

	// Save the column configuration
	saveColumnState();
};

const saveColumnState = () => {
	// Prevent saving if we're in the process of loading saved state
	if (isLoadingSavedState.value) {
		console.log('[Actions] Skipping save - loading saved state');
		return;
	}

	// Don't save empty column state
	if (!selectedColumns.value || selectedColumns.value.length === 0) {
		console.log('[Actions] Skipping save - no columns selected');
		return;
	}

	// Use selectedColumns which represents the current selection, not tableHeaders
	const columnOrder = selectedColumns.value;
	const columnWidths = {};
	const columnAlignments = {};

	// Get widths and alignments from current table headers
	props.tableHeaders.forEach((header) => {
		// Only save widths/alignments for columns that are in the current selection
		if (selectedColumns.value.includes(header.value)) {
			if (header.width) {
				columnWidths[header.value] = header.width;
			}
			if (header.align && header.align !== 'left') {
				// Only save non-default alignments
				columnAlignments[header.value] = header.align;
			}
		}
	});

	// Only emit if the state has actually changed
	const currentSaved = props.layoutOptions?.savedColumns || [];
	const currentWidths = props.layoutOptions?.columnWidths || {};
	const currentAlignments = props.layoutOptions?.columnAlignments || {};

	const columnsChanged = JSON.stringify(columnOrder) !== JSON.stringify(currentSaved);
	const widthsChanged = JSON.stringify(columnWidths) !== JSON.stringify(currentWidths);
	const alignmentsChanged = JSON.stringify(columnAlignments) !== JSON.stringify(currentAlignments);

	console.log('[Actions] saveColumnState:', {
		selectedColumns: selectedColumns.value,
		columnOrder,
		currentSaved,
		columnsChanged,
		willEmit: columnsChanged || widthsChanged || alignmentsChanged,
	});

	if (columnsChanged || widthsChanged || alignmentsChanged) {
		emit('update:layoutOptions', {
			...props.layoutOptions,
			savedColumns: columnOrder,
			columnWidths: columnWidths,
			columnAlignments: columnAlignments,
		});
	}
};

// Preset manager handlers
const handleSavePreset = ({ name, description }: { name: string; description?: string }) => {
	savePreset(name, description);
};

const handleUpdatePreset = (presetId: string) => {
	updatePreset(presetId);
};

const handleApplyPreset = (presetId: string) => {
	applyPreset(presetId);
};

const handleDeletePreset = (presetId: string) => {
	deletePreset(presetId);
};

const handleSetDefault = (presetId: string) => {
	setDefaultPreset(presetId);
};

// Watch for state changes to update dirty flag (only column changes)
watch(
	[
		() => props.tableHeaders,
		() => props.layoutOptions?.savedColumns,
		() => props.layoutOptions?.columnWidths,
		() => props.layoutOptions?.columnAlignments,
	],
	() => {
		// Check dirty state after a small delay to ensure all updates have been applied
		setTimeout(() => {
			checkDirtyState();
		}, 100);
	},
	{ deep: true },
);

// Reset state when component is destroyed
onUnmounted(() => {
	console.log('[Actions] Component unmounting, resetting state flags');
	hasSavedStateBeenApplied.value = false;
	isLoadingSavedState.value = false;
});
</script>

<style lang="scss" scoped>
.layout-actions {
	display: flex;
	gap: 8px;
	align-items: center;
	margin-right: 8px;

	--v-icon-color: var(--theme--foreground);
}

.column-selector-content {
	min-width: 420px;
	height: calc(100% - calc(var(--header-bar-height) + var(--theme--header--border-width) + 48px));
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.column-selector-scrollable {
	flex: 1;
	overflow-y: auto;
	padding: 0 var(--content-padding);
}

.column-selector-search {
	padding-top: var(--content-padding);
	margin-bottom: 24px;
}

.column-selector-info {
	margin-bottom: 16px;
	color: var(--theme--navigation--list--foreground);
	font-size: 14px;

	.column-count {
		font-weight: 600;
	}
}

.column-list {
	padding: 0 0 16px 0;
}

.column-selector-actions {
	display: flex;
	gap: 12px;
	padding: var(--content-padding);
	border-top: var(--theme--border-width) solid var(--theme--border-color);
}

.columns-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12px;
	margin-bottom: 16px;

	.column-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--theme--background-normal);
		border: var(--theme--border-width) solid var(--theme--border-color-subdued);
		border-radius: var(--theme--border-radius);
		cursor: pointer;
		transition: all 0.2s;

		&:hover:not(.selected, .disabled) {
			border-color: var(--theme--primary);
			background: var(--theme--primary-subdued);
		}

		&.selected:not(.disabled) {
			border-color: var(--theme--primary);
			background: var(--theme--primary-background);
		}

		&.disabled {
			opacity: 0.5;
			cursor: not-allowed;
			pointer-events: none;
		}
	}

	.column-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		flex: 1;
	}

	.column-label {
		font-weight: 500;
		line-height: 1.5;
	}

	.column-code {
		color: var(--theme--foreground-subdued);
		font-size: 12px;
		line-height: 1.2;
	}
}
</style>
