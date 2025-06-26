<template>
	<div class="product-filters">
		<v-button
			v-tooltip.bottom="activeFilterCount > 0 ? t('filters_active', activeFilterCount) : t('filters')"
			@click="showFilters = !showFilters"
			icon
			rounded
			outlined
			secondary
		>
			<v-icon name="filter_list" />
			<v-badge v-if="activeFilterCount > 0" :value="activeFilterCount" />
		</v-button>

		<v-drawer 
			v-model="showFilters" 
			:title="t('filters')" 
			icon="filter_list" 
			:sidebar-label="sidebarCollapsed ? '' : t('select_attributes')"
			:sidebar-resizeable="!sidebarCollapsed"
			:class="{ 'sidebar-collapsed': sidebarCollapsed }"
			@cancel="showFilters = false"
		>
			<template #sidebar>
				<div class="attribute-selector">
					<div class="sidebar-content" :class="{ collapsed: sidebarCollapsed }">
						<div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
							<v-icon :name="sidebarCollapsed ? 'chevron_right' : 'chevron_left'" />
						</div>
						
						<div class="attribute-selector-content" v-show="!sidebarCollapsed">
							<div class="attribute-selector-header">
								<span class="title">{{ t('available_attributes') }}</span>
								<v-button 
									v-tooltip.bottom="t('toggle_all')" 
									icon 
									x-small 
									secondary 
									@click="toggleAllAttributes"
								>
									<v-icon :name="allAttributesSelected ? 'check_box' : 'check_box_outline_blank'" />
								</v-button>
							</div>
						
							<div class="attribute-list">
								<div 
									v-for="attr in allAttributes" 
									:key="attr.id" 
									class="attribute-item"
									:class="{ disabled: !selectedAttributeIds.includes(attr.id) }"
									@click="toggleAttribute(attr.id, !selectedAttributeIds.includes(attr.id))"
								>
									<span class="attribute-label">{{ attr.label }}</span>
									<v-checkbox
										:model-value="selectedAttributeIds.includes(attr.id)"
										@click.stop
										@update:model-value="toggleAttribute(attr.id, $event)"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>
			<div class="filter-content">
				<div class="filter-scrollable">
					<!-- Active filters display -->
					<div v-if="activeFilterCount > 0" class="active-filters">
						<div class="filter-group-title">{{ t('active_filters') }}</div>
						<div class="active-filter-list">
							<!-- System field active filters -->
							<template v-for="(config, field) in systemFieldConfigs" :key="field">
								<div v-if="isFilterActive(field, currentFilters[field])" class="active-filter-item">
									<span class="filter-label">{{ t(config.label) }}:</span>
									<span class="filter-value">{{ formatSystemFieldValue(field, currentFilters[field]) }}</span>
								</div>
							</template>

							<!-- Attribute filters -->
							<div v-for="(value, field) in currentAttributeFilters" :key="field" class="active-filter-item">
								<template v-if="isFilterActive(field, value)">
									<span class="filter-label">{{ getAttributeLabel(field) }}:</span>
									<span class="filter-value">{{ formatAttributeFilterValue(field, value) }}</span>
								</template>
							</div>
						</div>
					</div>

					<!-- Standard field filters -->
					<div class="filter-group">
						<div class="filter-group-title">{{ t('standard_fields') }}</div>

						<!-- Dynamic system field filters -->
						<div v-for="(config, field) in systemFieldConfigs" :key="field" class="filter-field">
							<label>{{ t(config.label) }}</label>

							<!-- Regular filter components -->
							<component
								v-if="config.component && config.type !== 'date'"
								:is="config.component"
								v-model="systemFieldFilters[field]"
								:attribute="{
									code: field,
									label: t(config.label),
									input_interface: config.input_interface,
									is_system_field: config.is_system_field,
								}"
								:options="config.options ? config.options() : undefined"
								:loading="false"
								:allow-any="config.allowAny"
								@update:model-value="onSystemFieldFilterChange"
							/>

							<!-- Special handling for date fields -->
							<div v-else-if="config.type === 'date'" class="date-range-inputs">
								<component
									v-if="DatetimeInterface"
									:is="DatetimeInterface"
									:value="filters[`${field}_start`] || null"
									@input="filters[`${field}_start`] = $event || null"
									:field="{
										field: `${field}_start`,
										name: t('from'),
										type: 'date',
										meta: {
											interface: 'datetime',
											width: 'half',
											options: {
												includeSeconds: false,
											},
										},
									}"
									:type="'date'"
									:disabled="false"
									:loading="false"
									:primary-key="'+'"
									:collection="'products'"
								/>
								<component
									v-if="DatetimeInterface"
									:is="DatetimeInterface"
									:value="filters[`${field}_end`] || null"
									@input="filters[`${field}_end`] = $event || null"
									:field="{
										field: `${field}_end`,
										name: t('to'),
										type: 'date',
										meta: {
											interface: 'datetime',
											width: 'half',
											options: {
												includeSeconds: false,
											},
										},
									}"
									:type="'date'"
									:disabled="false"
									:loading="false"
									:primary-key="'+'"
									:collection="'products'"
								/>
							</div>
						</div>
					</div>

					<!-- Dynamic attribute filters -->
					<div class="filter-group" v-if="filterableAttributes.length > 0">
						<div class="filter-group-title">{{ t('attributes') }}</div>
						<div v-for="attr in filterableAttributes" :key="attr.id" class="filter-field">
							<label>{{ attr.label }}</label>

							<!-- Dynamic filter component based on type -->
							<component
								:is="getFilterComponent(attr)"
								v-model="attributeFilters[`attr_${attr.code}`]"
								:attribute="attr"
								@update:model-value="onAttributeFilterChange"
							/>
						</div>
					</div>
					
					<!-- No attributes selected message -->
					<div v-else-if="selectedAttributeIds.length === 0" class="no-attributes-message">
						<v-info icon="filter_list" :title="t('no_attributes_selected')">
							{{ t('select_attributes_from_sidebar') }}
						</v-info>
					</div>
				</div>

				<div class="filter-actions">
					<v-button secondary @click="clearFilters" :disabled="activeFilterCount === 0">
						{{ t('clear_filters') }}
					</v-button>
					<v-button kind="primary" @click="applyFilters" :disabled="!hasChanges">
						{{ t('apply_filters') }}
					</v-button>
				</div>
			</div>
		</v-drawer>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, markRaw } from 'vue';
import { useApi, useStores, useExtensions } from '@directus/extensions-sdk';
import { useI18n } from 'vue-i18n';
import { createI18nOptions } from '../translations';
import TextFilter from './filters/TextFilter.vue';
import NumericRangeFilter from './filters/NumericRangeFilter.vue';
import DateFilter from './filters/DateFilter.vue';
import SelectFilter from './filters/SelectFilter.vue';
import SelectFilterEnhanced from './filters/SelectFilterEnhanced.vue';
import BooleanFilter from './filters/BooleanFilter.vue';

const props = defineProps({
	attributes: {
		type: Array,
		default: () => [],
	},
	currentFilters: {
		type: Object,
		default: () => ({}),
	},
	currentAttributeFilters: {
		type: Object,
		default: () => ({}),
	},
});

// Type for system field configuration
interface SystemFieldConfig {
	type: string;
	component: any;
	label: string;
	input_interface?: string;
	is_system_field?: boolean;
	options?: () => any[];
	allowAny?: boolean;
}

// System field configurations - maps field names to their filter types
const systemFieldConfigs: Record<string, SystemFieldConfig> = {
	id: {
		type: 'numeric',
		component: markRaw(NumericRangeFilter),
		label: 'id',
	},
	parent_product_id: {
		type: 'numeric',
		component: markRaw(NumericRangeFilter),
		label: 'parent_product_id',
	},
	product_type: {
		type: 'select',
		component: markRaw(SelectFilter),
		label: 'product_type',
		input_interface: 'simple_select',
		is_system_field: true,
		options: () => productTypeOptions.value,
	},
	family: {
		type: 'select',
		component: markRaw(SelectFilter),
		label: 'family',
		input_interface: 'simple_select',
		is_system_field: true,
		options: () => familyOptions.value,
	},
	family_variant: {
		type: 'select',
		component: markRaw(SelectFilter),
		label: 'family_variant',
		input_interface: 'simple_select',
		is_system_field: true,
		options: () => familyVariantOptions.value,
	},
	enabled: {
		type: 'boolean',
		component: markRaw(BooleanFilter),
		label: 'enabled',
		allowAny: true,
	},
	date_created: {
		type: 'date',
		component: null, // Special handling with DatetimeInterface
		label: 'date_created',
	},
	date_updated: {
		type: 'date',
		component: null, // Special handling with DatetimeInterface
		label: 'date_updated',
	},
};

const emit = defineEmits(['update:filters']);

const api = useApi();
const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();

// Get current language from settings
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');

// Use translations with current language
const { t } = useI18n(createI18nOptions(currentLanguage.value));

// Ensure currentFilters is always an object
const currentFilters = computed(() => props.currentFilters || {});
const currentAttributeFilters = computed(() => props.currentAttributeFilters || {});

// Get the datetime interface from Directus
const { interfaces } = useExtensions();
const DatetimeInterface = computed(() => {
	const datetimeInterface = interfaces.value.find((i) => i.id === 'datetime');
	return datetimeInterface?.component || null;
});

const showFilters = ref(false);
const filters = ref({
	id: null,
	parent_product_id: null,
	product_type: null,
	family: null,
	family_variant: null,
	date_created_start: null,
	date_created_end: null,
	date_updated_start: null,
	date_updated_end: null,
	enabled: null,
});

// System field filters with operators
const systemFieldFilters = ref({
	id: null,
	parent_product_id: null,
	product_type: null,
	family: null,
	family_variant: null,
	enabled: null,
});
const attributeFilters = ref({});
const filterOptions = ref({});
const loadingOptions = ref({});
const appliedFilters = ref({});
const appliedAttributeFilters = ref({});

// Options for system field selects
const productTypeOptions = ref<Array<{ text: string; value: any }>>([]);
const familyOptions = ref<Array<{ text: string; value: any }>>([]);
const familyVariantOptions = ref<Array<{ text: string; value: any }>>([]);

// Attribute selection state
const allAttributes = ref<any[]>([]);
const selectedAttributeIds = ref<number[]>([]);
const isLoadingAttributes = ref(false);
const sidebarCollapsed = ref(false);

// Map of input interfaces to filter components
const filterComponentMap = {
	text: markRaw(TextFilter),
	text_area: markRaw(TextFilter),
	identifier: markRaw(TextFilter),
	price: markRaw(NumericRangeFilter),
	number: markRaw(NumericRangeFilter),
	measurement: markRaw(NumericRangeFilter),
	date: markRaw(DateFilter),
	simple_select: markRaw(SelectFilterEnhanced),
	multi_select: markRaw(SelectFilterEnhanced),
	reference_entity_single: markRaw(SelectFilterEnhanced),
	reference_entity_multiple: markRaw(SelectFilterEnhanced),
	yes_no: markRaw(BooleanFilter),
	table: markRaw(TextFilter), // Complex type, use text filter for now
};

// Get filterable attributes with type info based on user selection
const filterableAttributes = computed(() => {
	// Get selected attributes from allAttributes (which has ALL attributes)
	const selected = allAttributes.value.filter((attr: any) => {
		// Filter by selected attributes
		return selectedAttributeIds.value.includes(attr.id);
	});
	
	// Log for debugging
	console.log('[ProductFilters] filterableAttributes:', {
		allAttributesCount: allAttributes.value.length,
		selectedCount: selectedAttributeIds.value.length,
		selectedAttributes: selected.map(a => ({ id: a.id, code: a.code, type_info: a.type_info })),
		filteredWithTypeInfo: selected.filter(a => a.type_info).length
	});
	
	// Return only those with type info
	return selected.filter(attr => attr.type_info);
});

// Check if all attributes are selected
const allAttributesSelected = computed(() => {
	return allAttributes.value.length > 0 && 
		allAttributes.value.every(attr => selectedAttributeIds.value.includes(attr.id));
});

// Get the appropriate filter component for an attribute
function getFilterComponent(attribute) {
	const inputInterface = attribute.type_info?.input_interface;
	return filterComponentMap[inputInterface] || markRaw(TextFilter);
}

// Count active filters (from current props, not from local state)
const activeFilterCount = computed(() => {
	let count = 0;

	// Count system field filters from currentFilters using systemFieldConfigs
	Object.keys(systemFieldConfigs).forEach((field) => {
		if (isFilterActive(field, currentFilters.value[field])) {
			count++;
		}
	});

	// Count attribute filters from currentAttributeFilters
	Object.entries(currentAttributeFilters.value).forEach(([field, value]) => {
		if (isFilterActive(field, value)) {
			count++;
		}
	});

	return count;
});

// Check if there are unsaved changes
const hasChanges = computed(() => {
	// Get applied standard filters and system filters separately
	const appliedStandardFilters = {};
	const appliedSystemFields = {};

	Object.entries(appliedFilters.value).forEach(([key, value]) => {
		if (['date_created_start', 'date_created_end', 'date_updated_start', 'date_updated_end'].includes(key)) {
			appliedStandardFilters[key] = value;
		} else {
			appliedSystemFields[key] = value;
		}
	});

	// Check standard filters (dates)
	const standardChanged =
		JSON.stringify(filters.value) !==
		JSON.stringify({
			...appliedStandardFilters,
			id: null,
			parent_product_id: null,
			product_type: null,
			family: null,
			family_variant: null,
			enabled: null,
		});
	// Check system field filters
	const systemChanged = JSON.stringify(systemFieldFilters.value) !== JSON.stringify(appliedSystemFields);
	// Check attribute filters
	const attributeChanged = JSON.stringify(attributeFilters.value) !== JSON.stringify(appliedAttributeFilters.value);
	return standardChanged || systemChanged || attributeChanged;
});

// Load system field options
async function loadSystemFieldOptions() {
	try {
		// Load product types (this is a simple string field)
		const productsResponse = await api.get('/items/products', {
			params: {
				fields: ['product_type'],
				limit: -1,
			},
		});

		if (productsResponse.data?.data) {
			const products = productsResponse.data.data;

			// Extract unique product types
			const productTypes = new Set();
			products.forEach((product) => {
				if (product.product_type && product.product_type !== '') {
					productTypes.add(product.product_type);
				}
			});
			// Create a mapping for product type labels
			const productTypeLabels = {
				simple: 'Simple Product',
				configurable: 'Configurable Product',
				virtual: 'Virtual Product',
				downloadable: 'Downloadable Product',
				bundle: 'Bundle Product',
				grouped: 'Grouped Product',
			};

			productTypeOptions.value = Array.from(productTypes)
				.sort()
				.map((type) => ({
					text: productTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
					value: type,
				}));
		}

		// Load families (these are relations, so we need to fetch the actual family records)
		const familiesResponse = await api.get('/items/families', {
			params: {
				fields: ['id', 'label', 'code'],
				limit: -1,
			},
		});

		if (familiesResponse.data?.data) {
			familyOptions.value = familiesResponse.data.data
				.map((family) => ({
					text: family.label || family.code || `Family ${family.id}`,
					value: String(family.id), // Convert to string for v-checkbox compatibility
				}))
				.sort((a, b) => a.text.localeCompare(b.text));
		}

		// Load family variants (these are relations, so we need to fetch the actual family variant records)
		const familyVariantsResponse = await api.get('/items/family_variants', {
			params: {
				fields: ['id', 'label', 'code'],
				limit: -1,
			},
		});

		if (familyVariantsResponse.data?.data) {
			familyVariantOptions.value = familyVariantsResponse.data.data
				.map((variant) => ({
					text: variant.label || variant.code || `Variant ${variant.id}`,
					value: String(variant.id), // Convert to string for v-checkbox compatibility
				}))
				.sort((a, b) => a.text.localeCompare(b.text));
		}
	} catch (error) {
		console.error('Failed to load system field options:', error);

		// If families/family_variants tables don't exist, fall back to showing IDs
		if (error.response?.status === 403 || error.response?.status === 404) {
			console.warn('Families or family_variants collection not accessible, using IDs instead');

			// Load distinct IDs from products
			const productsWithRelations = await api.get('/items/products', {
				params: {
					fields: ['family', 'family_variant'],
					limit: -1,
				},
			});

			if (productsWithRelations.data?.data) {
				const products = productsWithRelations.data.data;

				// Extract unique family IDs
				const familyIds = new Set();
				products.forEach((product) => {
					if (product.family) {
						familyIds.add(product.family);
					}
				});
				familyOptions.value = Array.from(familyIds)
					.sort((a, b) => a - b)
					.map((id) => ({ text: `Family ${id}`, value: String(id) }));

				// Extract unique family variant IDs
				const variantIds = new Set();
				products.forEach((product) => {
					if (product.family_variant) {
						variantIds.add(product.family_variant);
					}
				});
				familyVariantOptions.value = Array.from(variantIds)
					.sort((a, b) => a - b)
					.map((id) => ({ text: `Variant ${id}`, value: String(id) }));
			}
		}
	}
}

// Load filter options for select-type attributes
async function loadFilterOptions(attribute) {
	const inputInterface = attribute.type_info?.input_interface;

	// Only load options for select-type filters
	if (
		!['simple_select', 'multi_select', 'reference_entity_single', 'reference_entity_multiple'].includes(inputInterface)
	) {
		return;
	}

	loadingOptions.value[attribute.code] = true;

	try {
		console.log(`[ProductFilters] Loading filter options for attribute: ${attribute.code}`);
		const response = await api.get('/product-grid/products/filters', {
			params: { attribute_code: attribute.code },
		});
		console.log(`[ProductFilters] Filter API response for ${attribute.code}:`, response.data);

		if (response.data && response.data.data) {
			// Extract unique options from the response
			const uniqueOptions = new Map();

			response.data.data.forEach((val) => {
				// Handle both object and string values
				if (typeof val === 'object' && val !== null) {
					// Check if it's already in value/text format (from API)
					if (val.value !== undefined && val.text !== undefined) {
						// Already in the correct format
						if (!uniqueOptions.has(val.value)) {
							uniqueOptions.set(val.value, {
								text: val.text,
								value: val.value,
							});
						}
					} else if (val.code || val.id) {
						// Legacy format with code/label or id
						const key = val.code || val.id;
						const value = val.code || val.id;
						const text = val.label || val.code || val.id;

						if (key && !uniqueOptions.has(key)) {
							uniqueOptions.set(key, {
								text: text,
								value: value,
							});
						}
					}
				} else if (typeof val === 'string' && !uniqueOptions.has(val)) {
					// For strings, use the value as both key and text
					// Special handling for reference entities - try to make them more readable
					let displayText = val;
					if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple') {
						// Try to format reference entity codes (e.g., "collection_3" -> "Collection 3")
						displayText = val.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
					}
					uniqueOptions.set(val, {
						text: displayText,
						value: val,
					});
				}
			});

			// Convert Map to array
			filterOptions.value[attribute.code] = Array.from(uniqueOptions.values());

			console.log(
				`[ProductFilters] Loaded ${filterOptions.value[attribute.code].length} unique options for ${attribute.code}:`,
				filterOptions.value[attribute.code],
			);

			// Special debug for reference entities
			if (inputInterface === 'reference_entity_single' || inputInterface === 'reference_entity_multiple') {
				console.log(`[ProductFilters] Reference entity options for ${attribute.code}:`, {
					inputInterface: inputInterface,
					raw_data: response.data.data,
					processed_options: filterOptions.value[attribute.code],
					firstFiveProcessed: filterOptions.value[attribute.code].slice(0, 5)
				});
			}
		}
	} catch (error) {
		console.error('Failed to load filter options:', error);
		filterOptions.value[attribute.code] = [];
	} finally {
		loadingOptions.value[attribute.code] = false;
	}
}

// Get filter options for an attribute
function getFilterOptions(attribute) {
	const options = filterOptions.value[attribute.code] || [];
	console.log(`[ProductFilters] Getting options for ${attribute.code}:`, {
		code: attribute.code,
		optionsCount: options.length,
		options: options.slice(0, 5), // Show first 5 for debugging
		loadingState: loadingOptions.value[attribute.code]
	});
	return options;
}

// Handle attribute filter change
function onAttributeFilterChange() {
	// This is called when filter values change
}

// Handle system field filter change
function onSystemFieldFilterChange(value, field) {
	console.log('[ProductFilters] System field filter changed:', { field, value });
	// This is called when system field filter values change
}

// Get attribute label for display
function getAttributeLabel(field) {
	const code = field.replace('attr_', '');
	const attr = props.attributes.find((a) => a.code === code);
	return attr?.label || code;
}

// Format attribute filter value for display
function formatAttributeFilterValue(field, value) {
	const code = field.replace('attr_', '');
	const attr = props.attributes.find((a) => a.code === code);

	// Get options for this attribute if it's a select type
	let options = null;
	if (attr && filterOptions.value[attr.code]) {
		options = filterOptions.value[attr.code];
	}

	return formatFilterValue(value, field, options);
}

// Check if a filter is active
function isFilterActive(field, value) {
	if (value === null || value === undefined) return false;
	if (value === '') return false;
	if (typeof value === 'object') {
		if (Array.isArray(value)) return value.length > 0;
		return Object.keys(value).length > 0;
	}
	return true;
}

// Format system field filter value for display
function formatSystemFieldValue(field, value) {
	// Special handling for date fields
	if (field === 'date_created' || field === 'date_updated') {
		if (value && value._gte && value._lte) {
			return `${formatDate(value._gte)} - ${formatDate(value._lte)}`;
		}
	}

	// Get options for select fields
	let options = null;
	if (field === 'family') {
		options = familyOptions.value;
	} else if (field === 'family_variant') {
		options = familyVariantOptions.value;
	} else if (field === 'product_type') {
		options = productTypeOptions.value;
	}

	return formatFilterValue(value, field, options);
}

// Format date for display
function formatDate(dateString) {
	if (!dateString) return '...';
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString();
	} catch {
		return dateString;
	}
}

// Format filter value for display
function formatFilterValue(value, field = null, options = null) {
	if (typeof value === 'object' && value !== null) {
		// Handle operator-based filters
		if (value._eq !== undefined) {
			// Special handling for boolean values
			if (typeof value._eq === 'boolean') {
				return value._eq ? t('yes') : t('no');
			}
			// Look up label if options are provided
			if (options && options.length > 0) {
				const option = options.find((opt) => String(opt.value) === String(value._eq));
				if (option) return `= ${option.text}`;
			}
			return `= ${value._eq}`;
		}
		if (value._neq !== undefined) {
			if (options && options.length > 0) {
				const option = options.find((opt) => String(opt.value) === String(value._neq));
				if (option) return `≠ ${option.text}`;
			}
			return `≠ ${value._neq}`;
		}
		if (value._contains !== undefined) return `contains "${value._contains}"`;
		if (value._ncontains !== undefined) return `doesn't contain "${value._ncontains}"`;
		if (value._starts_with !== undefined) return `starts with "${value._starts_with}"`;
		if (value._ends_with !== undefined) return `ends with "${value._ends_with}"`;
		if (value._gt !== undefined) return `> ${value._gt}`;
		if (value._gte !== undefined) return `≥ ${value._gte}`;
		if (value._lt !== undefined) return `< ${value._lt}`;
		if (value._lte !== undefined) return `≤ ${value._lte}`;
		if (value._between !== undefined) return `between ${value._between[0]} and ${value._between[1]}`;
		if (value._in !== undefined) {
			// Look up labels if options are provided
			if (options && options.length > 0) {
				const labels = value._in.map((v) => {
					const option = options.find((opt) => String(opt.value) === String(v));
					return option ? option.text : v;
				});
				return labels.join(', ');
			}
			return value._in.join(', ');
		}
		if (value._nin !== undefined) {
			if (options && options.length > 0) {
				const labels = value._nin.map((v) => {
					const option = options.find((opt) => String(opt.value) === String(v));
					return option ? option.text : v;
				});
				return `not in (${labels.join(', ')})`;
			}
			return `not in (${value._nin.join(', ')})`;
		}
		if (value._empty !== undefined) return value._empty ? 'is empty' : 'is not empty';
		if (value._nempty !== undefined) return value._nempty ? 'is not empty' : 'is empty';
		if (value._null !== undefined) return value._null ? 'is empty' : 'is not empty';
		if (value._nnull !== undefined) return value._nnull ? 'is not empty' : 'is empty';
	}

	if (Array.isArray(value)) {
		return value.join(', ');
	}

	// Special handling for boolean values
	if (typeof value === 'boolean') {
		return value ? t('yes') : t('no');
	}

	return String(value);
}

// Apply filters
function applyFilters() {
	const combinedFilters = buildStandardFilters();
	const cleanedAttributeFilters = {};

	// Build attribute filters - they already have the correct operator structure
	Object.entries(attributeFilters.value).forEach(([field, value]) => {
		if (value !== null && value !== undefined) {
			cleanedAttributeFilters[field] = value;
		}
	});

	// Store applied filters
	appliedFilters.value = { ...filters.value, ...systemFieldFilters.value };
	appliedAttributeFilters.value = { ...attributeFilters.value };

	console.log('[ProductFilters] Applying filters:', {
		systemFieldFilters: systemFieldFilters.value,
		combinedFilters,
		cleanedAttributeFilters,
	});

	const emitPayload = {
		filter: combinedFilters,
		attribute_filters: Object.keys(cleanedAttributeFilters).length > 0 ? JSON.stringify(cleanedAttributeFilters) : null,
	};

	console.log('[ProductFilters] Emitting update:filters with payload:', emitPayload);
	console.log('[ProductFilters] Attribute filters being sent:', cleanedAttributeFilters);
	emit('update:filters', emitPayload);

	showFilters.value = false;
}

// Build standard Directus filters
function buildStandardFilters() {
	const directusFilter = {};

	// Handle system field filters dynamically using systemFieldConfigs
	Object.keys(systemFieldConfigs).forEach((field) => {
		const config = systemFieldConfigs[field];
		const filterValue = systemFieldFilters.value[field];

		if (config.type === 'date') {
			// Handle date filters from the filters object
			const startValue = filters.value[`${field}_start`];
			const endValue = filters.value[`${field}_end`];

			if (startValue || endValue) {
				directusFilter[field] = {};
				if (startValue) {
					directusFilter[field]._gte = startValue;
				}
				if (endValue) {
					directusFilter[field]._lte = endValue;
				}
			}
		} else if (filterValue !== null && filterValue !== undefined) {
			// Check if the filter value is meaningful (not just {_eq: null} or empty)
			if (typeof filterValue === 'object') {
				// Check if it's an operator object with null/undefined/empty values
				const operators = ['_eq', '_neq', '_in', '_nin', '_gt', '_gte', '_lt', '_lte', '_contains', '_icontains'];
				const hasValidValue = operators.some(op => {
					if (filterValue[op] !== undefined) {
						// Check if the value is meaningful
						if (filterValue[op] === null) return false;
						if (Array.isArray(filterValue[op]) && filterValue[op].length === 0) return false;
						if (filterValue[op] === '') return false;
						return true;
					}
					return false;
				});
				
				// Also check for _empty/_nempty which don't need values
				const hasEmptyOperator = filterValue._empty === true || filterValue._nempty === true;
				
				if (!hasValidValue && !hasEmptyOperator) {
					// Skip this filter as it has no meaningful value
					return;
				}
			}

			// Handle special cases for family and family_variant (convert string IDs back to numbers)
			if ((field === 'family' || field === 'family_variant') && typeof filterValue === 'object') {
				if (filterValue._in) {
					directusFilter[field] = { _in: filterValue._in.map((v: any) => Number(v)) };
				} else if (filterValue._eq) {
					directusFilter[field] = { _eq: Number(filterValue._eq) };
				} else {
					directusFilter[field] = filterValue;
				}
			} else {
				// All other fields - filter components already provide operator structure
				directusFilter[field] = filterValue;
			}
		}
	});

	console.log('[ProductFilters] buildStandardFilters result:', directusFilter);
	return Object.keys(directusFilter).length > 0 ? directusFilter : null;
}

// Clear all filters
function clearFilters() {
	// Clear date filters
	Object.keys(filters.value).forEach((key) => {
		filters.value[key] = null;
	});

	// Clear system field filters - use fresh object to ensure clean state
	systemFieldFilters.value = {
		id: null,
		parent_product_id: null,
		product_type: null,
		family: null,
		family_variant: null,
		enabled: null,
	};

	attributeFilters.value = {};
	appliedFilters.value = {};
	appliedAttributeFilters.value = {};

	emit('update:filters', {
		filter: null,
		attribute_filters: null,
	});
}

// Initialize filters from props
function initializeFilters() {
	console.log('[ProductFilters] initializeFilters called with currentFilters:', currentFilters.value);

	// Reset all filters
	Object.keys(filters.value).forEach((key) => {
		filters.value[key] = null;
	});
	Object.keys(systemFieldFilters.value).forEach((key) => {
		systemFieldFilters.value[key] = null;
	});
	attributeFilters.value = {};

	// Initialize system field filters from currentFilters
	if (currentFilters.value) {
		Object.keys(systemFieldConfigs).forEach((field) => {
			const config = systemFieldConfigs[field];

			if (config.type === 'date') {
				// Special handling for date fields
				if (currentFilters.value[field]) {
					filters.value[`${field}_start`] = currentFilters.value[field]._gte || null;
					filters.value[`${field}_end`] = currentFilters.value[field]._lte || null;
				}
			} else {
				// Regular system fields
				if (currentFilters.value[field] !== null && currentFilters.value[field] !== undefined) {
					// Check if the filter has meaningful values
					const filterValue = currentFilters.value[field];
					
					// Skip filters that are just {_eq: null} or similar
					if (typeof filterValue === 'object') {
						const hasValidValue = Object.entries(filterValue).some(([op, val]) => {
							if (val === null || val === undefined || val === '') return false;
							if (Array.isArray(val) && val.length === 0) return false;
							return true;
						});
						
						if (!hasValidValue) {
							systemFieldFilters.value[field] = null;
							return;
						}
					}
					
					// Special handling for family and family_variant - convert numeric IDs to strings
					if ((field === 'family' || field === 'family_variant') && currentFilters.value[field]) {
						const filterValue = currentFilters.value[field];
						if (filterValue._in) {
							systemFieldFilters.value[field] = { _in: filterValue._in.map((v: any) => String(v)) };
						} else if (filterValue._eq) {
							systemFieldFilters.value[field] = { _eq: String(filterValue._eq) };
						} else {
							systemFieldFilters.value[field] = filterValue;
						}
					} else {
						systemFieldFilters.value[field] = currentFilters.value[field];
					}
					console.log(`[ProductFilters] Set ${field} filter:`, systemFieldFilters.value[field]);
				}
			}
		});
	}

	console.log('[ProductFilters] After initialization, systemFieldFilters:', systemFieldFilters.value);

	// Initialize attribute filters - they come with operator structure
	if (currentAttributeFilters.value) {
		Object.entries(currentAttributeFilters.value).forEach(([field, condition]) => {
			attributeFilters.value[field] = condition;
		});
	}

	// Only copy non-null/undefined values to applied filters
	appliedFilters.value = {};
	// Copy date filters
	Object.entries(filters.value).forEach(([key, val]) => {
		if (val !== null && val !== undefined && val !== '') {
			appliedFilters.value[key] = val;
		}
	});
	// Copy system field filters
	Object.entries(systemFieldFilters.value).forEach(([key, val]) => {
		if (val !== null && val !== undefined) {
			appliedFilters.value[key] = val;
		}
	});

	appliedAttributeFilters.value = { ...attributeFilters.value };
}

// Load all attributes from the attributes collection
async function loadAllAttributes() {
	if (isLoadingAttributes.value) return;
	
	isLoadingAttributes.value = true;
	try {
		const response = await api.get('/items/attributes', {
			params: {
				fields: ['id', 'code', 'label', 'usable_in_filter', 'type', 'type.input_interface'],
				sort: ['label'],
				limit: -1,
				// No filter - get ALL attributes
			},
		});

		if (response.data?.data) {
			allAttributes.value = response.data.data.map((attr: any) => ({
				...attr,
				type_info: attr.type, // type is expanded with input_interface
			}));
			
			// Initialize selected attributes based on usable_in_filter defaults
			// TODO: In the future, load from user preferences here
			const defaultSelected = allAttributes.value
				.filter(attr => attr.usable_in_filter)
				.map(attr => attr.id);
			
			selectedAttributeIds.value = defaultSelected;
		}
	} catch (error) {
		console.error('Failed to load attributes:', error);
	} finally {
		isLoadingAttributes.value = false;
	}
}

// Toggle attribute selection
function toggleAttribute(attributeId: number, selected: boolean) {
	console.log('[ProductFilters] toggleAttribute called:', { attributeId, selected, currentSelected: selectedAttributeIds.value });
	
	if (selected) {
		// Add to selected if not already there
		if (!selectedAttributeIds.value.includes(attributeId)) {
			selectedAttributeIds.value = [...selectedAttributeIds.value, attributeId];
		}
	} else {
		// Remove from selected
		selectedAttributeIds.value = selectedAttributeIds.value.filter(id => id !== attributeId);
		
		// Clear any active filters for this attribute
		const attribute = allAttributes.value.find(attr => attr.id === attributeId);
		if (attribute) {
			const filterKey = `attr_${attribute.code}`;
			if (attributeFilters.value[filterKey]) {
				delete attributeFilters.value[filterKey];
				// If filters are applied, we need to update them
				if (appliedAttributeFilters.value[filterKey]) {
					applyFilters();
				}
			}
		}
	}
	
	console.log('[ProductFilters] After toggle, selectedAttributeIds:', selectedAttributeIds.value);
}

// Toggle all attributes
function toggleAllAttributes() {
	if (allAttributesSelected.value) {
		// Deselect all - but this would clear all filters, so we should confirm
		selectedAttributeIds.value = [];
		// Clear all attribute filters
		attributeFilters.value = {};
		if (Object.keys(appliedAttributeFilters.value).length > 0) {
			applyFilters();
		}
	} else {
		// Select all
		selectedAttributeIds.value = allAttributes.value.map(attr => attr.id);
	}
}

// Initialize filter options when component mounts
onMounted(() => {
	initializeFilters();
	loadSystemFieldOptions();
	loadAllAttributes();
	// Don't eagerly load filter options - let the SelectFilterEnhanced component handle it
});

// Watch for attribute changes
watch(
	() => props.attributes,
	(newAttrs) => {
		// Attributes changed - no need to load options here
		// The SelectFilterEnhanced component will handle loading when opened
	},
	{ deep: true },
);

// Watch for current filters changes from parent
watch(
	() => props.currentFilters,
	(newFilters) => {
		console.log('[ProductFilters] currentFilters changed:', newFilters);
		initializeFilters();
	},
	{ deep: true },
);

watch(
	() => props.currentAttributeFilters,
	(newFilters) => {
		console.log('[ProductFilters] currentAttributeFilters changed:', newFilters);
		initializeFilters();
	},
	{ deep: true },
);
</script>

<style scoped>
.product-filters {
	display: inline-block;
}

.filter-content {
	min-width: 420px;
	height: calc(100% - calc(var(--header-bar-height) + var(--theme--header--border-width) + 48px));
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.filter-scrollable {
	flex: 1;
	overflow-y: auto;
	padding: 0 var(--content-padding);
}

.filter-group {
	margin-bottom: 32px;
}

.filter-group:first-child {
	padding-top: var(--content-padding);
}

.filter-group-title {
	font-weight: 600;
	margin-bottom: 20px;
	color: var(--theme--foreground-subdued);
	text-transform: uppercase;
	font-size: 12px;
	letter-spacing: 0.08em;
}

.filter-field {
	margin-bottom: 24px;
}

.filter-field:last-child {
	margin-bottom: 0;
}

.filter-field label {
	display: block;
	margin-bottom: 8px;
	font-weight: 600;
	font-size: 14px;
	color: var(--theme--foreground-normal);
}

.filter-field :deep(.v-input),
.filter-field :deep(.v-select),
.filter-field :deep(.v-checkbox) {
	width: 100%;
}

.filter-field :deep(.v-input input),
.filter-field :deep(.v-select .v-input) {
	background-color: var(--theme--background-page);
	border-color: var(--theme--border-normal);
}

.date-range-inputs {
	display: flex;
	gap: 12px;
	align-items: center;
}

.date-range-inputs .v-input {
	flex: 1;
}

.active-filters {
	background-color: var(--background-subdued);
	padding: var(--content-padding);
	margin: 0 calc(-1 * var(--content-padding));
	margin-bottom: 24px;
}

.active-filter-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 12px;
}

.active-filter-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background-color: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
	font-size: 13px;
	color: var(--theme--foreground-normal);
}

.filter-label {
	font-weight: 600;
	color: var(--theme--foreground-subdued);
}

.filter-value {
	color: var(--theme--primary);
}

.filter-actions {
	display: flex;
	gap: 12px;
	padding: var(--content-padding);
	border-top: var(--theme--border-width) solid var(--theme--border-color);
}

/* Attribute selector sidebar styles */
.attribute-selector {
	height: 100%;
	width: 100%;
	background-color: var(--theme--background-subdued);
}

.sidebar-content {
	height: 100%;
	width: 100%;
	position: relative;
	transition: all 0.3s ease;
	
	&.collapsed {
		.attribute-selector-content {
			display: none;
		}
		
		.sidebar-toggle {
			position: absolute;
			left: 50%;
			transform: translateX(-50%);
		}
	}
}

.sidebar-toggle {
	position: absolute;
	top: 16px;
	right: 8px;
	z-index: 10;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: var(--theme--border-radius);
	background-color: var(--theme--background-normal);
	transition: all 0.2s;
	
	&:hover {
		background-color: var(--theme--background-accent);
	}
	
	.v-icon {
		--v-icon-size: 18px;
		color: var(--theme--foreground-subdued);
	}
}

.attribute-selector-content {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.attribute-selector-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px;
	border-bottom: 1px solid var(--theme--border-color-subdued);
	
	.title {
		font-weight: 600;
		font-size: 14px;
		color: var(--theme--foreground-normal);
	}
}

.attribute-list {
	flex: 1;
	overflow-y: auto;
	padding: 8px 0;
}

.attribute-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 16px;
	cursor: pointer;
	transition: background-color 0.2s;
	
	&:hover {
		background-color: var(--theme--background-normal);
	}
	
	&.disabled {
		opacity: 0.5;
		
		.attribute-label {
			color: var(--theme--foreground-subdued);
		}
	}
	
	.attribute-label {
		flex: 1;
		font-size: 13px;
		color: var(--theme--foreground-normal);
		padding-right: 12px;
	}
	
	.v-checkbox {
		flex-shrink: 0;
		--v-checkbox-color: var(--theme--primary);
	}
}

.no-attributes-message {
	padding: 24px;
	
	.v-info {
		margin: 0;
	}
}

/* Override v-drawer sidebar width when collapsed */
.sidebar-collapsed {
	:deep(.sidebar) {
		width: 48px !important;
		min-width: 48px !important;
		overflow: hidden;
	}
	
	:deep(.v-resizeable) {
		width: 48px !important;
		min-width: 48px !important;
	}
	
	:deep(.attribute-selector-content) {
		display: none !important;
	}
	
	:deep(.sidebar-toggle) {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: 16px;
		right: auto;
	}
}
</style>
