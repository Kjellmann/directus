<template>
	<div class="product-attributes">
		<!-- Toolbar for batch operations in list view -->
		<div v-if="isBatchMode" class="batch-toolbar">
			<div class="batch-info">
				<v-icon name="info" />
				<span>{{ t('batch_mode_active', 'Batch mode - Only changed fields will be updated') }}</span>
			</div>
		</div>

		<!-- Validation Summary -->
		<v-notice v-if="validationErrors.length > 0" type="warning" class="validation-summary">
			<div class="validation-header">{{ t('validation_errors', 'Validation Errors') }}</div>
			<ul class="validation-list">
				<li v-for="error in validationErrors" :key="error.attributeId">
					{{ error.message }}
				</li>
			</ul>
		</v-notice>

		<!-- Loading State -->
		<div v-if="isLoading" class="loading-container">
			<v-progress-circular />
			<p>{{ t('loading_attributes', 'Loading attributes...') }}</p>
		</div>

		<!-- Attributes Display -->
		<template v-else-if="!isLoading && groupedAttributes.length > 0">
			<attribute-group-detail
				v-for="group in groupedAttributes"
				:key="group.group.id"
				:group="group.group"
				:attributes="group.attributes"
				:has-changes="hasChangesInGroup(group.group.id)"
				:validation-errors="getGroupValidationErrors(group.group.id)"
				:start-open="true"
				:disabled="disabled"
				:loading="isLoading"
			>
				<template #default="{ attributes }">
					<attribute-field-enhanced
						v-for="item in attributes"
						:key="item.attribute_id.id"
						:attribute="item.attribute_id"
						:value="item.value"
						:state="getAttributeState(item.attribute_id.id)"
						:units="metricUnits[item.attribute_id.id] || []"
						:selected-unit-id="selectedUnitIds[item.attribute_id.id] || null"
						:disabled="disabled || item.attribute_id.read_only"
						:interface-map="interfaceMap"
						:component-props="getComponentProps(item)"
						:batch-mode="isBatchMode"
						:show-dirty-indicator="!isBatchMode"
						@update:value="handleValueUpdate"
						@update:unit="handleUnitUpdate"
						@reset="handleReset"
					/>
				</template>
			</attribute-group-detail>
		</template>

		<!-- Empty State -->
		<div v-else-if="!isLoading && familyId && familyAttributes.length === 0" class="empty-state">
			<v-icon name="widgets" large />
			<p>{{ t('no_attributes_defined', 'No attributes defined for this family') }}</p>
		</div>

		<!-- No Family Selected -->
		<div v-else-if="!isLoading && !familyId && !isBatchMode" class="empty-state">
			<v-icon name="category" large />
			<p>{{ t('no_family_selected', 'No family selected') }}</p>
		</div>

		<!-- Batch Mode - No Common Attributes -->
		<div v-else-if="!isLoading && isBatchMode && groupedAttributes.length === 0" class="empty-state">
			<v-icon name="inventory_2" large />
			<p>
				{{
					t(
						'no_batch_attributes',
						'No attributes are configured for batch editing. Mark attributes as filterable, searchable, or used in variants to enable batch editing.',
					)
				}}
			</p>
			<small>
				{{ t('batch_mode_hint', 'Select products with similar attributes or use the "Show All Attributes" option') }}
			</small>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useApi } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import AttributeFieldEnhanced from './AttributeFieldEnhanced.vue';
import AttributeGroupDetail from './AttributeGroupDetail.vue';
import { useAttributeValues } from '../composables/useAttributeValues';
import { useMetricAttributes } from '../composables/useMetricAttributes';
import { useAttributeGroups } from '../composables/useAttributeGroups';
import { useAttributeState } from '../composables/useAttributeState';

import type { AttributeValueItem, AttributeDefinition } from '../composables/useAttributeValues';

// Props & Emits
const props = defineProps({
	value: { type: Array as () => any[], default: () => [] },
	collection: { type: String, default: 'products' },
	primaryKey: { type: [String, Number], default: '' },
	disabled: { type: Boolean, default: false },
	batchMode: { type: Boolean, default: false },
	batchActive: { type: Boolean, default: true },
});

const emit = defineEmits(['input', 'batch-complete']);

// State (declare before composables that need them)
const isLoading = ref(false);
const isSaving = ref(false);
const relationData = ref<AttributeValueItem[]>([]);
const familyAttributes = ref<AttributeDefinition[]>([]);
const familyId = ref<string | number | null>(null);
const metricUnits = ref<Record<string | number, any[]>>({});
const selectedUnitIds = ref<Record<string | number, string | number | null>>({});
const validationErrors = ref<Array<{ attributeId: string | number; message: string }>>([]);
const attributesInBatch = ref<Set<string>>(new Set());

// Composables
const api = useApi();
const { t } = useI18n();
const metricHandler = useMetricAttributes();
const attrValueHandler = useAttributeValues();
const { groupedAttributes } = useAttributeGroups(relationData);
const {
	dirtyAttributes,
	hasChanges,
	initializeState,
	getAttributeState,
	updateAttributeValue,
	validateAttribute,
	resetAttribute,
	resetAll,
	markAsSaved,
	setBatchMode,
} = useAttributeState();

const isBatchMode = computed(() => {
	// Directus sets batchMode=true and primaryKey="+" when in batch edit
	return props.batchMode === true;
});

const interfaceMap: Record<string, string> = {
	text: 'input',
	text_area: 'input-multiline',
	number: 'input',
	price: 'input',
	yes_no: 'boolean',
	identifier: 'input',
	measurement: 'input',
	simple_select: 'select-dropdown',
	multi_select: 'select-multiple-dropdown',
	date: 'datetime',
	image: 'file-image',
	file: 'file',
	asset_collection: 'files',
	reference_entity_single: 'm2o-searchable-dropdown',
	reference_entity_multiple: 'list-o2m',
	table: 'list',
};

// Methods
function hasChangesInGroup(groupId: string | number): boolean {
	return dirtyAttributes.value.some((attr) => attr.attribute_id.group?.id === groupId);
}

function getGroupValidationErrors(groupId: string | number): Array<{ attributeId: string | number; message: string }> {
	return validationErrors.value.filter((error) => {
		// Find the attribute for this error and check if it belongs to the group
		const attribute = familyAttributes.value.find((attr) => attr.id === error.attributeId);
		return attribute?.group?.id === groupId;
	});
}

function getComponentProps(item: AttributeValueItem): Record<string, any> {
	const typeInterface = item.attribute_id.type.input_interface;
	const interfaceOptions = getInterfaceOptions(item.attribute_id);

	const typeMap: Record<string, string> = {
		price: 'number',
		number: 'number',
		date: 'datetime',
		identifier: 'text',
		text: 'text',
		text_area: 'textarea',
	};

	if (typeInterface === 'table') {
		return {
			field: 'value',
			collection: 'product_attributes',
			primaryKey: item.id || null,
			disabled: props.disabled || item.attribute_id.read_only || false,
			loading: isLoading.value,
			fields: item.attribute_id.meta_options?.columns || [],
			template: '{{id}}',
			limit: item.attribute_id.meta_options?.rowLimit || null,
			...interfaceOptions,
		};
	}

	// Handle reference_entity_single which needs special collection handling
	if (typeInterface === 'reference_entity_single') {
		try {
			const referenceCollection = item.attribute_id.reference_collection;

			// The value could be an object (full reference data) or just an ID
			let value = item.value;

			// Convert invalid types to null for the M2O interface
			if (typeof value === 'boolean' || value === '' || value === undefined) {
				value = null;
			}

			// The interface now accepts objects or IDs
			// No need to convert objects to null

			// For our custom interface, we need to pass the correct collection info
			// The interface will use this to fetch items from the reference collection
			return {
				value: value,
				field: 'value',
				collection: referenceCollection,
				disabled: props.disabled || item.attribute_id.read_only || false,
				loading: isLoading.value,
				template: interfaceOptions.template || '{{label}} ({{code}})',
				placeholder: interfaceOptions.placeholder || `Select ${item.attribute_id.label}...`,
				filter: interfaceOptions.filter || {},
				width: 'full',
				...interfaceOptions,
			};
		} catch (error) {
			console.error('[ProductAttributes] Error getting reference collection:', error);
			return {};
		}
	}

	return {
		field: 'value',
		collection: 'product_attributes',
		primaryKey: item.id || null,
		disabled: props.disabled || item.attribute_id.read_only || false,
		loading: isLoading.value,
		...(typeMap[typeInterface] ? { type: typeMap[typeInterface] } : {}),
		...interfaceOptions,
	};
}

function getInterfaceOptions(attribute: AttributeDefinition): Record<string, any> {
	const typeInterface = attribute.type.input_interface;
	let options = { ...(attribute.meta_options || {}) };

	options.placeholder = options.placeholder || `Enter ${attribute.label}...`;
	options.allowNone = options.allowNone ?? !(attribute.required === true);

	if (['simple_select', 'multi_select'].includes(typeInterface) && attribute.options?.length) {
		options.choices =
			options.choices ||
			attribute.options.map((opt) => ({
				text: opt.label,
				value: opt.code,
			}));
		options.allowOther = options.allowOther ?? false;
	} else if (typeInterface === 'price') {
		options.step = options.step ?? (options.precision ? 1 / Math.pow(10, options.precision) : 0.01);
		options.min = options.min ?? 0;
	} else if (typeInterface === 'number') {
		options.step = options.step ?? 1;
	} else if (
		['reference_entity_single', 'reference_entity_multiple', 'asset_collection', 'image', 'file'].includes(
			typeInterface,
		)
	) {
		options.template = options.template || '{{$thumbnail}}';
		options.enableCreate = options.enableCreate ?? true;
		options.enableSelect = options.enableSelect ?? true;
	} else if (typeInterface === 'table') {
		options.fields = options.columns || [];
		options.addLabel = options.addRowLabel || t('add_row');
		options.limit = options.rowLimit || null;
	}

	return options;
}

// Validation
function validateAllAttributes(): boolean {
	validationErrors.value = [];

	relationData.value.forEach((item) => {
		const error = validateAttribute(item.attribute_id, item.value);
		if (error) {
			validationErrors.value.push({
				attributeId: item.attribute_id.id,
				message: error,
			});
		}
	});

	return validationErrors.value.length === 0;
}

// Event Handlers
function handleValueUpdate({ attributeId, value }: { attributeId: string | number; value: any }): void {
	const item = relationData.value.find((i) => i.attribute_id.id === attributeId);
	if (item) {
		updateAttributeValue(attributeId, value);
		onValueChange(item, value);
	}
}

function handleUnitUpdate({ attributeId, unitId }: { attributeId: string | number; unitId: string | number }): void {
	const item = relationData.value.find((i) => i.attribute_id.id === attributeId);
	if (item) {
		onUnitChange(item, unitId);
	}
}

function handleReset(attributeId: string | number): void {
	resetAttribute(attributeId);
	const item = relationData.value.find((i) => i.attribute_id.id === attributeId);
	if (item) {
		const state = getAttributeState(attributeId);
		if (state) {
			item.value = state.value;
		}
	}
	emitUpdatePayload();
}

async function onValueChange(item: AttributeValueItem, newValue: any): Promise<void> {
	console.log(
		'[ProductAttributes] onValueChange - attribute:',
		item.attribute_id.code,
		'type:',
		item.attribute_id.type.input_interface,
		'newValue:',
		newValue,
		'typeof:',
		typeof newValue,
	);

	if (isMetricAttribute(item.attribute_id)) {
		relationData.value = await metricHandler.updateMetricValue(item, newValue, relationData);
	} else {
		const index = relationData.value.findIndex((rd) => rd.attribute_id.id === item.attribute_id.id);
		if (index !== -1) {
			relationData.value[index] = {
				...relationData.value[index],
				value: newValue,
			};
			console.log('[ProductAttributes] Updated relationData item:', relationData.value[index]);
		}
	}

	debouncedEmitUpdate();
}

function onUnitChange(item: AttributeValueItem, unitId: string | number): void {
	relationData.value = metricHandler.updateMetricUnit(item, unitId, relationData);
	selectedUnitIds.value[item.attribute_id.id] = unitId;
	debouncedEmitUpdate();
}

const debouncedEmitUpdate = debounce(() => {
	emitUpdatePayload();
}, 300);

function emitUpdatePayload(): void {
	if (isBatchMode.value) {
		// In batch mode, only emit changed attributes
		const changedAttributes = relationData.value.filter((item) => {
			const state = getAttributeState(item.attribute_id.id);
			return state?.isDirty;
		});

		if (changedAttributes.length > 0) {
			const savePayload = attrValueHandler.prepareSavePayload(changedAttributes);
			console.log('savePayload', savePayload);
			emit('input', savePayload);
		}
	} else {
		// In normal mode, emit all attributes
		const savePayload = attrValueHandler.prepareSavePayload(relationData.value);
		console.log('savePayload', savePayload);
		emit('input', savePayload);
	}
}

// Save Operations
async function saveAllChanges(): Promise<void> {
	if (!validateAllAttributes()) return;

	isSaving.value = true;
	try {
		// Save via parent component
		emitUpdatePayload();

		// Mark as saved after successful save
		markAsSaved();
	} finally {
		isSaving.value = false;
	}
}

function resetAllChanges(): void {
	resetAll();
	relationData.value.forEach((item) => {
		const state = getAttributeState(item.attribute_id.id);
		if (state) {
			item.value = state.value;
		}
	});
	emitUpdatePayload();
}

// Helper Functions
function isMetricAttribute(attribute: AttributeDefinition): boolean {
	return attribute.type.input_interface === 'measurement';
}

async function loadCommonAttributes(): Promise<void> {
	console.log('[ProductAttributes] Loading attributes for batch mode');

	try {
		// Load attributes that are suitable for batch editing
		// Using is_filterable as it indicates attributes that are commonly used across products
		// When saved, these attributes will be added to products even if they don't currently have them
		const response = await api.get('/items/attributes', {
			params: {
				fields: ['*', 'type.*', 'group.*', 'options.*', 'metric_family.*'],
				filter: {
					_and: [{ usable_in_grid: { _eq: true } }],
				},
				sort: ['group.sort', 'sort'],
				limit: -1,
			},
		});

		if (response?.data?.data) {
			const batchAttributes = response.data.data as AttributeDefinition[];

			// Sort by group and then by attribute sort order
			familyAttributes.value = batchAttributes.sort((a: AttributeDefinition, b: AttributeDefinition) => {
				const groupSortA = a.group?.sort ?? Infinity;
				const groupSortB = b.group?.sort ?? Infinity;
				if (groupSortA !== groupSortB) return groupSortA - groupSortB;
				return (a.sort ?? Infinity) - (b.sort ?? Infinity);
			});

			// Track which attributes are available for batch editing
			attributesInBatch.value = new Set(familyAttributes.value.map((attr) => attr.code));

			// Initialize with empty values for batch mode
			// When saving, only attributes with actual values will be applied to products
			await initializeRelationData();
		}
	} catch (error) {
		console.error('[ProductAttributes] Error loading common attributes:', error);
		familyAttributes.value = [];
	}
}

// Data Loading
async function loadProductAttributes(productId: string | number): Promise<void> {
	familyAttributes.value = [];
	familyId.value = null;

	try {
		const productRes = await api.get(`/items/products/${productId}`, {
			params: { fields: 'family.id' },
		});
		const foundFamilyId = productRes?.data?.data?.family?.id;

		if (!foundFamilyId) {
			console.warn('[ProductAttributes] Product has no family set.');
			return;
		}
		familyId.value = foundFamilyId;

		const familyResParamsFields = [
			'*',
			'attributes.attributes_id.*',
			'attributes.attributes_id.type.*',
			'attributes.attributes_id.group.*',
			'attributes.attributes_id.options.*',
			'attributes.attributes_id.metric_family.*',
		].join(',');

		const familyRes = await api.get(`/items/families/${familyId.value}`, {
			params: { fields: familyResParamsFields },
		});

		if (familyRes?.data?.data?.attributes) {
			familyAttributes.value = familyRes.data.data.attributes
				.map((entry: any) => entry.attributes_id)
				.filter((attr: any): attr is AttributeDefinition => !!attr)
				.sort((a: AttributeDefinition, b: AttributeDefinition) => {
					const groupSortA = a.group?.sort ?? Infinity;
					const groupSortB = b.group?.sort ?? Infinity;
					if (groupSortA !== groupSortB) return groupSortA - groupSortB;
					return (a.sort ?? Infinity) - (b.sort ?? Infinity);
				});
		}
	} catch (error) {
		console.error('[ProductAttributes] Error loading attributes:', error);
		familyAttributes.value = [];
	}
}

async function initializeRelationData(): Promise<void> {
	// In batch mode, initialize with empty values
	if (props.primaryKey === '+') {
		relationData.value = familyAttributes.value.map((attrDef) => ({
			id: null,
			product_id: '+',
			attribute_id: attrDef,
			value: null, // Start with null for batch mode
		}));
		initializeState(relationData.value);
		return;
	}

	if (!props.primaryKey) {
		relationData.value = [];
		return;
	}

	if (familyAttributes.value.length === 0) {
		relationData.value = [];
		return;
	}

	let fetchedProductAttributes: AttributeValueItem[] = [];

	if (props.value && Array.isArray(props.value) && props.value.length > 0) {
		const firstItem = props.value[0];
		if (typeof firstItem === 'number' || typeof firstItem === 'string') {
			fetchedProductAttributes = await attrValueHandler.fetchAttributeValuesByIds(
				'product_attributes',
				props.value,
				familyAttributes.value,
			);
			console.log('fetchedProductAttributes', fetchedProductAttributes);
		} else if (typeof firstItem === 'object' && firstItem !== null) {
			// Handle object format
			fetchedProductAttributes = props.value
				.map((propItem: any) => {
					const attrDef = familyAttributes.value.find(
						(fa) => fa.id === (propItem.attribute_id?.id || propItem.attribute_id),
					);
					if (!attrDef) return null;
					console.log('attrDef', attrDef);
					return {
						id: propItem.id || null,
						product_id: propItem.product_id || props.primaryKey,
						attribute_id: attrDef,
						value: attrValueHandler.parseLoadedValue(propItem.value, attrDef.type?.input_interface),
					};
				})
				.filter(Boolean) as AttributeValueItem[];
		}
	}

	relationData.value = familyAttributes.value.map((attrDef) => {
		const existingPAItem = fetchedProductAttributes.find((pa) => pa.attribute_id?.id === attrDef.id);

		return {
			id: existingPAItem?.id || null,
			product_id: props.primaryKey,
			attribute_id: attrDef,
			value: existingPAItem ? existingPAItem.value : attrValueHandler.initializeDefaultValue(attrDef),
		};
	});

	console.log('relationData.value', relationData.value);
	// Initialize state tracking
	initializeState(relationData.value);
}

async function loadMetricUnitsForAttributes(): Promise<void> {
	// Only proceed if we have both family attributes and relation data
	if (familyAttributes.value.length === 0 || relationData.value.length === 0) {
		console.log('loadMetricUnitsForAttributes: Skipping - missing data', {
			familyAttrs: familyAttributes.value.length,
			relationData: relationData.value.length,
		});
		return;
	}

	console.log('loadMetricUnitsForAttributes: Processing metric attributes');
	for (const attr of familyAttributes.value) {
		if (isMetricAttribute(attr)) {
			// Load available units for this metric attribute
			metricUnits.value[attr.id] = await metricHandler.getMetricUnits(attr);

			// Find the corresponding item in relationData and load its selected unit
			const item = relationData.value.find((item) => item.attribute_id.id === attr.id);
			if (item) {
				const unitId = await metricHandler.getSelectedMetricUnit(item);
				selectedUnitIds.value[attr.id] = unitId;
			}
		}
	}
}

// Lifecycle
watch(
	() => props.primaryKey,
	async (pk) => {
		isLoading.value = true;

		if (!pk) {
			relationData.value = [];
			emit('input', []);
			isLoading.value = false;
			return;
		}

		// In batch mode, we need to handle things differently
		if (pk === '+') {
			console.log('[ProductAttributes] Batch mode detected, primaryKey:', pk);

			// For batch mode in Directus, load common attributes
			console.log('[ProductAttributes] Batch mode - loading common attributes');

			// Load common attributes that can be edited across products
			await loadCommonAttributes();
		} else {
			// Normal single product mode
			await loadProductAttributes(pk);
			await initializeRelationData();
		}

		isLoading.value = false;
	},
	{ immediate: true },
);

// Watch for changes to both familyAttributes and relationData
// This ensures metric units are loaded when both are ready
watch(
	[() => familyAttributes.value, () => relationData.value],
	async ([newFamilyAttrs, newRelationData]) => {
		if (newFamilyAttrs.length > 0 && newRelationData.length > 0) {
			console.log('watch: Both familyAttributes and relationData ready, loading metric units');
			await loadMetricUnitsForAttributes();
		}
	},
	{ deep: true },
);

watch(
	() => props.batchMode,
	(newVal) => {
		setBatchMode(newVal);
	},
);

onMounted(async () => {
	// Component mounted
});

onBeforeUnmount(() => {
	debouncedEmitUpdate.cancel();
});

// Expose methods for parent components
defineExpose({
	refresh: async () => {
		if (props.primaryKey && props.primaryKey !== '+') {
			isLoading.value = true;
			await loadProductAttributes(props.primaryKey);
			await initializeRelationData();
			emitUpdatePayload();
			isLoading.value = false;
		}
	},
	validateAllAttributes,
	hasChanges,
	saveAllChanges,
	resetAllChanges,
});
</script>

<style lang="scss" scoped>
.product-attributes {
	position: relative;
	display: grid;
	gap: var(--theme--form--row-gap) var(--theme--form--column-gap);
}

.batch-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	background-color: var(--theme--primary-background);
	border: 1px solid var(--theme--primary);
	border-radius: var(--theme--border-radius);
	margin-bottom: var(--theme--form--column-gap);

	.batch-info {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--theme--primary);
	}

	.batch-actions {
		display: flex;
		gap: 8px;
	}
}

.validation-summary {
	margin-bottom: var(--theme--form--column-gap);

	.validation-header {
		font-weight: 600;
		margin-bottom: 8px;
	}

	.validation-list {
		margin: 0;
		padding-left: 20px;
	}
}

.loading-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 60px 20px;
	color: var(--theme--foreground-subdued);

	p {
		margin-top: 16px;
	}
}

/* Group styling is now handled by AttributeGroupDetail component */

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 60px 20px;
	color: var(--theme--foreground-subdued);

	.v-icon {
		margin-bottom: 16px;
		color: var(--theme--foreground-subdued);
	}

	p {
		text-align: center;
		max-width: 400px;
	}

	small {
		display: block;
		margin-top: 8px;
		font-size: 12px;
		color: var(--theme--foreground-subdued);
	}
}

.family-selector {
	margin-top: 24px;
	max-width: 400px;

	p {
		margin-bottom: 12px;
		font-size: 14px;
	}
}

.batch-notice {
	background-color: var(--theme--warning-background);
	border-color: var(--theme--warning);

	.batch-info {
		color: var(--theme--warning);
	}
}
</style>
