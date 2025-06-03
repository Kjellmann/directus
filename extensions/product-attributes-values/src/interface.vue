<template>
	<div class="attributes">
		<div
			class="attribute-row"
			v-for="item in displayedAttributes"
			:key="item.attribute_id?.id || item.attribute_id?.code"
		>
			<div class="attribute-label">
				{{ item.attribute_id?.label }}
				<span v-if="item.attribute_id?.required">*</span>
			</div>

			<template v-if="item.attribute_id">
				<component
					:is="getVerifiedComponentName(item.attribute_id)"
					v-bind="getComponentProps(item)"
					:modelValue="item.value"
					@update:modelValue="(val: any) => onValueChange(item, val)"
				/>
			</template>
			<template v-else>
				<div style="color: var(--theme--danger-125)">Error: Attribute definition missing for an item.</div>
			</template>
		</div>
		<div
			v-if="!isLoading && familyAttributes.length === 0 && primaryKey && primaryKey !== '+'"
			class="no-attributes-message"
		>
			No attributes defined for this product's family, or family not set.
		</div>
		<div v-if="isLoading" class="loading-message">Loading attributes...</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useApi, useExtensions } from '@directus/extensions-sdk';

interface AttributeOption {
	id: string | number;
	label: string;
	code: string;
	sort?: number;
}

interface AttributeType {
	id: string | number;
	code: string;
	input_interface: string;
}

interface AttributeGroup {
	id: string | number;
	code: string;
	label: string;
	enabled?: boolean;
	sort?: number;
}

interface AttributeDefinition {
	id: string | number;
	code: string;
	label: string;
	required?: boolean;
	read_only?: boolean;
	sort?: number;
	type: AttributeType;
	group?: AttributeGroup;
	meta?: {
		interface?: string;
		options?: Record<string, any>;
		note?: string;
		width?: string;
		collection?: string;
		special?: string[];
		validation_message?: string;
	};
	options?: AttributeOption[];
	schema?: {
		is_nullable?: boolean;
		default_value?: any;
		min_length?: number;
		max_length?: number;
		min_value?: number;
		max_value?: number;
		validation_regex?: string;
		validation_message?: string;
	};
}

interface AttributeValueItem {
	id: string | number | null;
	product_id: string | number;
	attribute_id: AttributeDefinition;
	value: any;
}

interface ProductAttributeSaveItem {
	id?: string | number; // PK of product_attributes (for updates) // FK to attributes (REQUIRED for creates, can be included for updates)
	value: any; // The prepared value for JSON or Text column
	attribute_id?: string | number; // Required for new items, optional for updates
}

// --- Component Props & Emits ---
const props = defineProps({
	value: { type: Array as () => AttributeValueItem[], default: () => [] },
	collection: { type: String, default: '' },
	primaryKey: { type: [String, Number], default: '' },
});

const emit = defineEmits<{
	(e: 'update:modelValue', value: ProductAttributeSaveItem[]): void;
}>();

//const emit = defineEmits(['update:modelValue']);

// --- SDK & State ---
const { interfaces } = useExtensions(); // For checking if an interface ID exists
const api = useApi();
const isLoading = ref(false);
const relationData = ref<AttributeValueItem[]>([]);
const familyAttributes = ref<AttributeDefinition[]>([]);
const familyId = ref<number | string | null>(null);

// --- Interface Mapping & Component Naming ---
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
	reference_entity_single: 'select-dropdown-m2o',
	reference_entity_multiple: 'list-o2m',
	table: 'list',
};

function getVerifiedComponentName(attribute: AttributeDefinition): string {
	console.log('[ProductAttributes] getVerifiedComponentName:', attribute);
	const interfaceId = interfaceMap[attribute.type.input_interface] || 'input';
	return `interface-${interfaceId}`;
}

function getInterfaceOptions(attribute: AttributeDefinition): Record<string, any> {
	const typeInterface = attribute.type.input_interface;
	let options: Record<string, any> = { ...(attribute.meta?.options || {}) };

	options.placeholder = options.placeholder || attribute.meta?.note || `Enter ${attribute.label}...`;
	options.allowNone = options.allowNone ?? !(attribute.required ?? false);

	if (['simple_select', 'multi_select'].includes(typeInterface) && attribute.options?.length) {
		options.choices = options.choices || attribute.options.map((opt) => ({ text: opt.label, value: opt.code }));
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
		options.template = options.template || '{{id}}';
		options.enableCreate = options.enableCreate ?? true;
		options.enableSelect = options.enableSelect ?? true;
	}
	return options;
}

function getFieldMeta(attribute: AttributeDefinition): Record<string, any> {
	const interfaceId = interfaceMap[attribute.type.input_interface] || 'input';
	const calculatedOptions = getInterfaceOptions(attribute);

	return {
		collection: props.collection,
		field: attribute.code,
		name: attribute.label,
		type: attribute.type.code,
		meta: {
			interface: interfaceId,
			options: calculatedOptions,
			width: attribute.meta?.width || 'full',
			readonly: attribute.read_only || false,
			note: attribute.meta?.note,
			hidden: false,
			required: attribute.required || false,
			sort: attribute.sort,
			special: attribute.meta?.special,
			field: attribute.code,
			collection: attribute.meta?.collection,
		},
		schema: {
			is_nullable: !(attribute.required || false),
			default_value: attribute.schema?.default_value,
			max_length: attribute.schema?.max_length,
			min_length: attribute.schema?.min_length,
			min_value: attribute.schema?.min_value,
			max_value: attribute.schema?.max_value,
			validation_regex: attribute.schema?.validation_regex,
			validation_message: attribute.schema?.validation_message,
		},
	};
}

function getComponentProps(item: AttributeValueItem): Record<string, any> {
	const fieldMetaData = getFieldMeta(item.attribute_id);
	const options = fieldMetaData.meta?.options || {};
	const meta = fieldMetaData.meta || {};

	const propsToBind: Record<string, any> = {
		'field-data': fieldMetaData,
		field: item.attribute_id.code,
		collection: props.collection,
		primaryKey: props.primaryKey,
		disabled: meta.readonly || false,
		type: item.attribute_id.type.code,
		width: meta.width || 'full',
		length: fieldMetaData.schema?.max_length,
		loading: isLoading.value,
		...options,
	};

	Object.keys(propsToBind).forEach((key) => propsToBind[key] === undefined && delete propsToBind[key]);
	return propsToBind;
}

async function fetchProductAttributeValuesByIds(
	productAttributeRecordIds: (string | number)[],
): Promise<AttributeValueItem[]> {
	if (!productAttributeRecordIds || productAttributeRecordIds.length === 0) return [];
	try {
		console.log('[ProductAttributes] Fetching full product_attributes for PKs:', productAttributeRecordIds);
		const response = await api.get(`/items/product_attributes`, {
			params: {
				filter: { id: { _in: productAttributeRecordIds } },
				// Fetch all necessary fields from product_attributes,
				// especially attribute_id (the FK) and value.
				// If attribute_id is just a primitive here, we'll map it later.
				fields: ['id', 'product_id', 'attribute_id', 'value', 'sort'], // Adjust if 'attribute_id' can be fetched as an object with 'id'
			},
		});

		const fetchedItems = response.data.data as any[]; // e.g., [{id:3, product_id:"12d...", attribute_id:5, value:"collection_3"}, ...]

		// Map these fetched items to your local AttributeValueItem structure,
		// ensuring the attribute_id is the full AttributeDefinition object.
		return fetchedItems
			.map((fetchedPA) => {
				const attributeDefinition = familyAttributes.value.find((fa) => fa.id === fetchedPA.attribute_id); // Match FK with definition ID
				if (!attributeDefinition) {
					console.warn(
						`[ProductAttributes] During fetch, couldn't find full definition for attribute_id: ${fetchedPA.attribute_id}`,
					);
					return null; // Or handle as error
				}
				return {
					id: fetchedPA.id,
					product_id: fetchedPA.product_id,
					attribute_id: attributeDefinition, // Use the rich object
					value: fetchedPA.value, // This is the value that might need parsing
				};
			})
			.filter((item) => item !== null) as AttributeValueItem[];
	} catch (error) {
		console.error('[ProductAttributes] Error fetching product_attribute values by IDs:', error);
		return [];
	}
}

// --- Parsing values loaded from the DB (from product_attributes.value column) ---
function parseLoadedValue(dbValue: any): any {
	// If the value from the DB is null or undefined, return it as is
	if (dbValue === null || dbValue === undefined) {
		return null;
	}

	// If your 'value' column in product_attributes is indeed storing primitives as JSON strings
	// (e.g., "\"text\"", "\"123\"", "true", "false", "null")
	// or actual JSON objects/arrays like "[1,2]" or {"key":"value"}
	if (typeof dbValue === 'string') {
		try {
			// Attempt to parse it as JSON.
			// JSON.parse will correctly convert:
			// - "\"text\"" to "text" (string)
			// - "\"123\"" to "123" (string, if the attribute type is string) OR 123 (number, if attribute type is number and it was stored as "123")
			//   To be precise: JSON.parse("123") yields number 123. JSON.parse("\"123\"") yields string "123".
			// - "true" to true (boolean)
			// - "null" to null
			// - "[1,2]" to [1,2] (array)
			// - "{\"key\":\"val\"}" to {key:"val"} (object)
			return JSON.parse(dbValue);
		} catch (e) {
			// If JSON.parse fails, it means the string was not a valid JSON document.
			// This could happen if:
			// 1. The value was a plain string that was never JSON.stringify'd (e.g., if your DB column was TEXT).
			// 2. It's an improperly formatted JSON string in the database.
			// In this scenario, returning the original string is a safe fallback.
			// console.warn(`[ProductAttributes] parseLoadedValue: Value "${dbValue}" was not valid JSON, returning as raw string.`);
			return dbValue;
		}
	}

	// If the dbValue is already a number, boolean, or object (e.g., if Directus pre-parses top-level JSON fields when fetching,
	// or if your DB column type isn't actually storing JSON strings for these but native types already).
	// This path also handles arrays or objects that were correctly stored as JSON and parsed by Directus/the DB driver.
	return dbValue;
}

async function initializeRelationData() {
	if (!props.primaryKey || props.primaryKey === '+') {
		relationData.value = [];
		console.log('[ProductAttributes] Reset relationData for new/cleared item.');
		return;
	}
	if (familyAttributes.value.length === 0) {
		console.log(
			'[ProductAttributes] No family attributes loaded, relationData remains empty (will re-evaluate if family loads).',
		);
		relationData.value = [];
		return;
	}

	console.log(
		'[ProductAttributes] Initializing relationData. Family count:',
		familyAttributes.value.length,
		'Initial props.value (PKs of product_attributes):',
		JSON.stringify(props.value),
	);

	let fetchedProductAttributes: AttributeValueItem[] = [];

	// Step 1: Fetch the full product_attributes items if props.value gives IDs
	if (
		props.value &&
		props.value.length > 0 &&
		props.value.every((id) => typeof id === 'number' || typeof id === 'string')
	) {
		fetchedProductAttributes = await fetchProductAttributeValuesByIds(props.value as (string | number)[]);
	} else if (props.value && props.value.length > 0) {
		// If props.value is already rich objects, ensure attribute_id is the full definition
		fetchedProductAttributes = (props.value as any[])
			.map((propItem) => {
				const attrDef = familyAttributes.value.find(
					(fa) => fa.id === (propItem.attribute_id?.id || propItem.attribute_id),
				);
				if (!attrDef) return null;
				return {
					id: propItem.id || null,
					product_id: propItem.product_id || props.primaryKey,
					attribute_id: attrDef,
					value: propItem.value, // Raw value from prop, will be parsed next
				};
			})
			.filter((item) => item !== null) as AttributeValueItem[];
	}

	// Step 2: Build the final relationData by mapping over familyAttributes
	// and merging with the (now fully detailed) fetchedProductAttributes
	const finalRelationData: AttributeValueItem[] = familyAttributes.value.map((attrDef) => {
		// Find the corresponding item from the fetched product_attributes data
		const existingPAItem = fetchedProductAttributes.find((pa) => pa.attribute_id?.id === attrDef.id);

		const rawDbValue = existingPAItem ? existingPAItem.value : (attrDef.schema?.default_value ?? null);
		const parsedDisplayValue = parseLoadedValue(rawDbValue); // Use your parsing function

		return {
			// IMPORTANT: Use the 'id' from the fetched product_attributes record if it exists
			id: existingPAItem?.id || null,
			product_id: props.primaryKey,
			attribute_id: attrDef, // Full definition
			value: parsedDisplayValue,
		};
	});

	relationData.value = finalRelationData;
	console.log('[ProductAttributes] relationData initialized. Count:', relationData.value.length);
	// Log a sample to verify 'id' and 'value'
	relationData.value
		.slice(0, 2)
		.forEach((item) =>
			console.log(
				`[ProductAttributes] Init item: attr ${item.attribute_id.code}, pa_id: ${item.id}, val: ${JSON.stringify(item.value)}`,
			),
		);
}

watch(
	() => props.primaryKey,
	async (pk) => {
		console.log('[ProductAttributes] Primary Key watcher triggered:', pk);
		isLoading.value = true;
		familyAttributes.value = [];
		familyId.value = null;

		if (!pk || pk === '+') {
			await initializeRelationData();
			emit('update:modelValue', []);
			isLoading.value = false;
			return;
		}

		await loadProductAttributes(pk);
		await initializeRelationData();
		isLoading.value = false;
	},
	{ immediate: true },
);

async function loadProductAttributes(productId: string | number) {
	console.log('[ProductAttributes] Loading attributes for product ID:', productId);
	familyAttributes.value = [];
	familyId.value = null;

	try {
		const productRes = await api.get(`/items/products/${productId}`, { params: { fields: 'family.id' } });
		const foundFamilyId = productRes?.data?.data?.family?.id;

		if (!foundFamilyId) {
			console.warn('[ProductAttributes] Product has no family set.');
			isLoading.value = false;
			return;
		}
		familyId.value = foundFamilyId;
		console.log('[ProductAttributes] Found family ID:', familyId.value);

		/*const familyResParamsFields = [
			'attributes.attributes_id.id',
			'attributes.attributes_id.code',
			'attributes.attributes_id.label',
			'attributes.attributes_id.required',
			'attributes.attributes_id.read_only',
			'attributes.attributes_id.sort',
			'attributes.attributes_id.max_length',
			'attributes.attributes_id.min_length',
			'attributes.attributes_id.min_value',
			'attributes.attributes_id.max_value',
			'attributes.attributes_id.validation_regex',
			'attributes.attributes_id.validation_message',
			'attributes.attributes_id.type.id',
			'attributes.attributes_id.type.code',
			'attributes.attributes_id.type.input_interface',
			'attributes.attributes_id.group.id',
			'attributes.attributes_id.group.sort',
			'attributes.attributes_id.options.id',
			'attributes.attributes_id.options.label',
			'attributes.attributes_id.options.code',
			'attributes.attributes_id.options.sort',
		].join(',');*/

		const familyResParamsFields = [
			'*',
			'attributes.attributes_id.*',
			'attributes.attributes_id.type.*',
			'attributes.attributes_id.group.*',
			'attributes.attributes_id.options.*',
		].join(',');

		const familyRes = await api.get(`/items/families/${familyId.value}`, {
			params: { fields: familyResParamsFields },
		});

		console.log('[ProductAttributes] Family response:', familyRes);

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
			console.log('[ProductAttributes] Loaded family attributes definitions count:', familyAttributes.value.length);
		} else {
			console.warn('[ProductAttributes] No attributes found on this family.');
		}
	} catch (error: any) {
		console.error('[ProductAttributes] Error loading attributes:', error?.response?.data || error.message || error);
		familyAttributes.value = []; // Reset on error
	} finally {
		isLoading.value = false;
	}
}

const displayedAttributes = computed<AttributeValueItem[]>(() => {
	console.log(
		'[ProductAttributes] Computing displayedAttributes. Family count:',
		familyAttributes.value.length,
		'RelationData count:',
		relationData.value.length,
	);
	return familyAttributes.value.map((attrDef) => {
		const existingValueItem = relationData.value.find((item) => item.attribute_id?.id === attrDef.id);
		if (existingValueItem) {
			return { ...existingValueItem, attribute_id: attrDef };
		} else {
			return {
				id: null,
				product_id: props.primaryKey,
				attribute_id: attrDef,
				value: attrDef.schema?.default_value ?? null,
			};
		}
	});
});

function prepareValueForSave(newValue: any): any {
	const valueType = typeof newValue;
	if (newValue === null || newValue === undefined) return null;
	// Prevent saving event objects
	if (newValue instanceof Event || (newValue && typeof newValue.isTrusted === 'boolean' && newValue.target)) {
		console.warn('[ProductAttributes] prepareValueForSave: Detected Event object as value, filtering out.');
		return undefined; // Return undefined to have it filtered out later if it was a new item
	}

	if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
		try {
			return JSON.stringify(newValue);
		} catch (e) {
			console.error('Failed to stringify primitive for save:', e);
			return undefined;
		}
	}
	if (valueType === 'object') return newValue; // Arrays and actual objects are fine

	console.warn(
		`[ProductAttributes] prepareValueForSave: Unexpected value type: ${valueType}. Filtering out. Value:`,
		newValue,
	);
	return undefined; // Filter out unexpected types
}

// --- Revised Value Change Handling ---
function onValueChange(itemFromDisplay: AttributeValueItem, newValue: any) {
	console.log(`[ProductAttributes] Value change detected for ${itemFromDisplay.attribute_id?.code}:`, newValue);

	// --- Update local relationData state ---
	const targetItemInRelationData = relationData.value.find(
		(rd) => rd.attribute_id.id === itemFromDisplay.attribute_id.id,
	);

	if (targetItemInRelationData) {
		targetItemInRelationData.value = newValue;
		// Ensure reactivity
		const index = relationData.value.indexOf(targetItemInRelationData);
		if (index > -1) {
			relationData.value.splice(index, 1, { ...targetItemInRelationData });
		}
		console.log(`[ProductAttributes] Updated item value in relationData for ${itemFromDisplay.attribute_id.code}`);
	} else {
		console.warn(
			`[ProductAttributes] Item for ${itemFromDisplay.attribute_id.code} not found in relationData. Adding it.`,
		);
		relationData.value.push({
			id: null,
			product_id: props.primaryKey,
			attribute_id: itemFromDisplay.attribute_id,
			value: newValue,
		});
	}

	console.log('[ProductAttributes] relationData after onValueChange:', relationData.value);

	const dataForDirectusSave = prepareSavePayload();
	console.log(
		'[ProductAttributes] Emitting for Directus save. RelationData count:',
		relationData.value.length,
		'Payload:',
		JSON.stringify(dataForDirectusSave),
	);
	emit('update:modelValue', [...dataForDirectusSave]);
}

// --- Helper Function to Prepare the O2M Save Payload ---
// Generates the simplified array structure expected by Directus for O2M updates
function prepareSavePayload(): ProductAttributeSaveItem[] {
	// Use the current state of the local relationData
	return relationData.value
		.map((localItem): ProductAttributeSaveItem | null => {
			// Prepare the individual value (handles JSON stringify, filters events)
			const preparedValue = prepareValueForSave(localItem.value);
			console.log('[ProductAttributes] prepareSavePayload: preparedValue:', preparedValue);

			// Skip if the value was invalid or couldn't be prepared
			if (preparedValue === undefined) {
				console.log(
					`[ProductAttributes] Skipping ${localItem.attribute_id.code} in save payload due to undefined prepared value.`,
				);
				return null;
			}

			if (localItem.id) {
				// EXISTING item in product_attributes: needs 'id' and changed 'value'
				// Also include attribute_id to satisfy the ProductAttributeSaveItem type definition
				return {
					id: localItem.id,
					attribute_id: localItem.attribute_id.id, // Add primitive id
					value: preparedValue,
				};
			} else if (preparedValue !== null) {
				// NEW item for product_attributes: needs 'attribute_id' and 'value'
				// Only include if value is not strictly null
				return {
					attribute_id: localItem.attribute_id.id,
					value: preparedValue,
				};
			}

			// If it's a new item and the prepared value is null, filter it out
			return null;
		})
		.filter((saveItem): saveItem is ProductAttributeSaveItem => saveItem !== null); // Filter out nulls and ensure correct type
}
</script>

<style scoped>
.attributes {
	display: grid; /* Changed from flex for potentially simpler row layout */
	gap: 1.25rem; /* Based on Directus form styling */
	/* Removed padding to allow parent component to control it if needed */
}

.attribute-row {
	display: grid;
	grid-template-columns: var(--form-label-width, 180px) minmax(0, 1fr); /* Label width as CSS var */
	align-items: start; /* Align label to the top of the interface */
	gap: var(--form-horizontal-gap, 20px); /* Gap between label and interface */
	/* Add bottom margin/gap if not using display:grid on parent .attributes */
	margin-bottom: var(--form-vertical-gap, 1.25rem);
}
/* Remove margin-bottom for the last row if .attributes is display:grid */
.attributes > .attribute-row:last-child {
	margin-bottom: 0;
}

.attribute-label {
	font-weight: 600;
	text-align: right;
	padding-top: 8px; /* Approx vertical center with most inputs */
	color: var(--theme--form--field-label--color); /* Use theme variable */
	word-break: break-word; /* Allow long labels to wrap */
}

.attribute-label span {
	color: var(--theme--danger);
	margin-left: 3px;
}

.no-attributes-message,
.loading-message {
	color: var(--theme--foreground-subdued);
	padding: 1rem; /* Add some padding */
	text-align: center;
	font-style: italic;
	grid-column: 1 / -1; /* Span across all columns if .attributes is grid */
}
</style>
