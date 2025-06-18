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

// Initialize headers if empty and no saved state
if ((!props.tableHeaders || props.tableHeaders.length === 0) && !props.layoutOptions?.savedColumns) {
	emit('update:tableHeaders', [
		{
			text: 'Image',
			value: 'primary_image',
			width: 100,
			align: 'left',
			sortable: false,
			field: { type: 'file', interface: 'file-image' },
		},
		{ text: 'ID', value: 'id', width: 200, align: 'left', sortable: true, field: { type: 'string' } },
		{
			text: 'Enabled',
			value: 'enabled',
			width: 100,
			align: 'left',
			sortable: true,
			field: { type: 'boolean', interface: 'boolean' },
		},
		{
			text: 'Created',
			value: 'date_created',
			width: 200,
			align: 'left',
			sortable: true,
			field: { type: 'timestamp', interface: 'datetime' },
		},
	]);
}

// Load attributes on mount
onMounted(() => {
	if (props.useCustomApi) {
		// Items are already transformed by the API
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

	// Extract attribute fields from the item
	const attrFields = Object.keys(firstItem)
		.filter((k) => k.startsWith('attr_'))
		.map((field) => {
			const code = field.replace('attr_', '');
			// Try to find a label from somewhere, or use the code
			const label = code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ');
			return {
				id: field,
				code: code,
				label: label,
				is_searchable: true, // Assume all returned attributes are searchable
			};
		});

	attributes.value = attrFields;

	// Add attribute columns to headers if not already present
	if (attributes.value.length > 0) {
		const currentHeaders = [...props.tableHeaders];
		const existingFields = new Set(currentHeaders.map((h) => h.value));

		const attributeHeaders = attributes.value
			.filter((attr) => !existingFields.has(`attr_${attr.code}`))
			.map((attr) => ({
				text: attr.label,
				value: `attr_${attr.code}`,
				width: 150,
				align: 'left',
				sortable: true,
				field: { type: 'alias' },
			}));

		if (attributeHeaders.length > 0) {
			emit('update:tableHeaders', [...currentHeaders, ...attributeHeaders]);
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
							is_searchable: attr.is_searchable || false,
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
</script>

<style scoped>
.layout-tabular-enhanced {
	display: contents;
}
</style>
