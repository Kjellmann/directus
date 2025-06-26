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
			:attribute-list="props.attributeList || attributes"
			:fields="fields"
			:layout-options="layoutOptions"
			:view-mode="layoutOptions?.viewMode || 'list'"
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
	onRowClick: (event: { item: any; event: PointerEvent }) => void;
	onFilterChange?: (filters: any) => void;
	useCustomApi?: boolean;
	layoutOptions?: any;
	attributeList?: any[];
	layoutQuery?: any;
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

const emit = defineEmits([
	'update:selection',
	'update:tableHeaders',
	'update:limit',
	'update:fields',
	'update:layoutOptions',
]);

// State
const attributes = ref<any[]>([]);
const transformedItems = ref<any[]>([]);
const hasInitializedColumns = ref(false);
const isWaitingForSavedColumns = ref(false);

// Only initialize default headers if no saved columns exist
// Wait for the actions component to apply saved columns if they exist
console.log('[TabularEnhanced] Initial check:', {
	tableHeaders: props.tableHeaders?.length || 0,
	savedColumns: props.layoutOptions?.savedColumns,
	hasInitializedColumns: hasInitializedColumns.value,
});

if ((!props.tableHeaders || props.tableHeaders.length === 0) && !props.layoutOptions?.savedColumns) {
	console.log('[TabularEnhanced] Initializing default headers');
	// Use primary_image, id, enabled, product_type, family as defaults
	const defaultHeaders = [] as any[];

	// Always include primary_image first
	defaultHeaders.push({
		text: 'Image',
		value: 'primary_image',
		width: 100,
		align: 'left',
		sortable: false,
		field: { type: 'file', interface: 'file-image' },
	});

	// Add other system fields if they exist
	const systemFields = [
		{ text: 'ID', value: 'id', width: 200, type: 'string' },
		{ text: 'Enabled', value: 'enabled', width: 100, type: 'boolean', interface: 'boolean' },
		{ text: 'Product Type', value: 'product_type', width: 150, type: 'string' },
		{ text: 'Family', value: 'family', width: 150, type: 'string' },
	];

	systemFields.forEach((field) => {
		// Check if field exists in the collection
		if (props.fields?.some((f) => f.field === field.value)) {
			defaultHeaders.push({
				text: field.text,
				value: field.value,
				width: field.width,
				align: 'left',
				sortable: true,
				field: { type: field.type, interface: field.interface },
			});
		}
	});

	emit('update:tableHeaders', defaultHeaders);
} else if (props.layoutOptions?.savedColumns && props.layoutOptions.savedColumns.length > 0) {
	console.log('[TabularEnhanced] Found saved columns, marking as initialized:', props.layoutOptions.savedColumns);
	// If we have saved columns, mark that we've initialized to prevent auto-adding columns
	hasInitializedColumns.value = true;
	isWaitingForSavedColumns.value = true;
} else if (props.layoutOptions?.savedColumns && props.layoutOptions.savedColumns.length === 0) {
	console.log('[TabularEnhanced] Found empty saved columns, will initialize defaults');
	// Empty saved columns, treat as if no saved columns exist
}

// Load attributes on mount
onMounted(() => {
	console.log('[TabularEnhanced] onMounted - checking if we should extract attributes');

	// If we have saved columns, wait a bit for the actions component to apply them
	if (props.layoutOptions?.savedColumns) {
		console.log('[TabularEnhanced] Delaying attribute extraction to allow saved columns to be applied');
		setTimeout(() => {
			if (props.useCustomApi) {
				extractAttributesFromTransformedItems();
			} else {
				extractAttributesFromItems();
				transformItems();
			}
		}, 200);
	} else {
		// No saved columns, proceed immediately
		if (props.useCustomApi) {
			extractAttributesFromTransformedItems();
		} else {
			extractAttributesFromItems();
			transformItems();
		}
	}
});

// Methods
// Extract attributes from pre-transformed items (when using custom API)
const extractAttributesFromTransformedItems = () => {
	if (!props.items || props.items.length === 0) return;

	const firstItem = props.items[0];

	// Extract attribute fields from the item
	const attrFields = Object.keys(firstItem)
		.filter((k) => k.startsWith('attr_'))
		.map((field) => {
			const code = field.replace('attr_', '');
			// Try to find a label from somewhere, or use the code
			const label = code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
			// Try to find if this attribute has usable_in_grid from the attributeList prop
			const attrFromList = props.attributeList?.find((a) => a.code === code);
			return {
				id: field,
				code: code,
				label: attrFromList?.label || label,
				usable_in_search: true, // Assume all returned attributes are searchable
				usable_in_grid: attrFromList?.usable_in_grid || false,
			};
		});

	attributes.value = attrFields;

	// Only auto-add attribute columns if we don't have saved columns AND haven't initialized yet
	// This prevents overriding user's column selection on page refresh
	console.log('[TabularEnhanced] extractAttributesFromTransformedItems check:', {
		attributesLength: attributes.value.length,
		savedColumns: props.layoutOptions?.savedColumns,
		hasInitializedColumns: hasInitializedColumns.value,
		isWaitingForSavedColumns: isWaitingForSavedColumns.value,
		shouldAutoAdd:
			attributes.value.length > 0 &&
			!props.layoutOptions?.savedColumns &&
			!hasInitializedColumns.value &&
			!isWaitingForSavedColumns.value,
	});

	if (
		attributes.value.length > 0 &&
		!props.layoutOptions?.savedColumns &&
		!hasInitializedColumns.value &&
		!isWaitingForSavedColumns.value
	) {
		const currentHeaders = [...props.tableHeaders];
		const existingFields = new Set(currentHeaders.map((h) => h.value));

		// Only auto-add attributes that have usable_in_grid = true
		const attributeHeaders = attributes.value
			.filter((attr) => attr.usable_in_grid && !existingFields.has(`attr_${attr.code}`))
			.map((attr) => ({
				text: attr.label,
				value: `attr_${attr.code}`,
				width: 150,
				align: 'left',
				sortable: true,
				field: { type: 'alias' },
			}));

		if (attributeHeaders.length > 0) {
			console.log(
				'[TabularEnhanced] Auto-adding attribute columns:',
				attributeHeaders.map((h) => h.value),
			);
			emit('update:tableHeaders', [...currentHeaders, ...attributeHeaders]);
			hasInitializedColumns.value = true;
		}
	}
};

const extractAttributesFromItems = () => {
	if (!props.items || props.items.length === 0) return;

	// Extract unique attributes from items
	const uniqueAttributes = new Map();

	props.items.forEach((item) => {
		if (Array.isArray(item.attributes)) {
			item.attributes.forEach((attrJunction, idx) => {
				// Check if attribute_id is expanded or just an ID
				if (attrJunction.attribute_id && typeof attrJunction.attribute_id === 'object') {
					const attr = attrJunction.attribute_id;
					if (!uniqueAttributes.has(attr.id)) {
						uniqueAttributes.set(attr.id, {
							id: attr.id,
							code: attr.code,
							label: attr.label,
							usable_in_search: attr.usable_in_search || false,
						});
					}
				}
			});
		}
	});

	attributes.value = Array.from(uniqueAttributes.values());
};

// Transform items to include attribute values
const transformItems = () => {
	if (!props.items || props.items.length === 0) {
		transformedItems.value = [];
		return;
	}

	// If items have attributes field, transform them
	if (props.items[0] && props.items[0].attributes) {
		const transformed = props.items.map((item) => {
			const enhancedItem = { ...item };

			// Transform attributes array into individual fields
			if (Array.isArray(item.attributes)) {
				item.attributes.forEach((attrJunction) => {
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
						attr = attributes.value.find((a) => a.id === attrId);
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
	} else {
		transformedItems.value = props.items;
	}
};

// Watch for item changes
watch(
	() => props.items,
	(newItems) => {
		console.log('[TabularEnhanced] Items changed, length:', newItems?.length);
		if (newItems && newItems.length > 0) {
			if (props.useCustomApi) {
				extractAttributesFromTransformedItems();
			} else {
				transformItems();
			}
		}
	},
	{ immediate: true },
);

// Re-extract attributes when items change significantly
watch(
	() => props.items?.length,
	(newLength, oldLength) => {
		if (newLength && newLength !== oldLength) {
			if (props.useCustomApi) {
				extractAttributesFromTransformedItems();
			} else {
				extractAttributesFromItems();
			}
		}
	},
);

// Watch for table headers being set from saved columns
watch(
	() => props.tableHeaders,
	(headers) => {
		console.log('[TabularEnhanced] tableHeaders changed:', {
			headers: headers?.map((h) => h.value),
			savedColumns: props.layoutOptions?.savedColumns,
			hasInitializedColumns: hasInitializedColumns.value,
		});

		// If headers are being set and we have saved columns, mark as initialized
		if (headers && headers.length > 0 && props.layoutOptions?.savedColumns) {
			console.log('[TabularEnhanced] Headers set from saved columns, marking as initialized');
			hasInitializedColumns.value = true;
			isWaitingForSavedColumns.value = false;
		}

		// If headers match saved columns, we're done waiting
		if (
			headers &&
			headers.length > 0 &&
			props.layoutOptions?.savedColumns &&
			headers.length === props.layoutOptions.savedColumns.length
		) {
			const headerValues = headers.map((h) => h.value).sort();
			const savedValues = [...props.layoutOptions.savedColumns].sort();
			if (JSON.stringify(headerValues) === JSON.stringify(savedValues)) {
				console.log('[TabularEnhanced] Headers match saved columns, no longer waiting');
				isWaitingForSavedColumns.value = false;
			}
		}
	},
	{ immediate: true },
);
</script>

<style scoped>
.layout-tabular-enhanced {
	display: contents;
}
</style>
