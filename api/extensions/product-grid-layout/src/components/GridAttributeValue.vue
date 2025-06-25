<template>
	<div class="grid-attribute-value" :class="valueClass">
		<!-- Null/Empty Value -->
		<template v-if="isEmpty">
			<span class="null-value">-</span>
		</template>

		<!-- Boolean/Yes-No -->
		<template v-else-if="inputInterface === 'yes_no'">
			<div class="boolean-value">
				<v-icon
					:name="displayValue ? 'check_circle' : 'cancel'"
					:class="{ yes: displayValue, no: !displayValue }"
					small
				/>
				<span>{{ displayValue ? 'Yes' : 'No' }}</span>
			</div>
		</template>

		<!-- Price/Metric -->
		<template v-else-if="inputInterface === 'price' || inputInterface === 'metric'">
			<div class="metric-value">
				<span class="value">{{ formatNumber(displayValue) }}</span>
				<span v-if="unit" class="unit">{{ unit }}</span>
			</div>
		</template>

		<!-- Date -->
		<template v-else-if="inputInterface === 'date'">
			<span class="date-value">{{ formatDate(displayValue) }}</span>
		</template>

		<!-- Simple Select -->
		<template v-else-if="inputInterface === 'simple_select'">
			<v-chip small>
				{{ getOptionLabelLocal(displayValue) }}
			</v-chip>
		</template>

		<!-- Reference Entity (Single) -->
		<template v-else-if="inputInterface === 'reference_entity_single'">
			<v-chip small>
				{{ getOptionLabelLocal(displayValue) }}
			</v-chip>
		</template>

		<!-- Reference Entity (Multiple) -->
		<template v-else-if="inputInterface === 'reference_entity_multiple'">
			<div class="chips-value">
				<v-chip v-for="val in ensureArray(displayValue)" :key="getReferenceKey(val)" x-small>
					{{ getOptionLabelLocal(val) }}
				</v-chip>
				<span v-if="ensureArray(displayValue).length > 3" class="more-count">
					+{{ ensureArray(displayValue).length - 3 }}
				</span>
			</div>
		</template>

		<!-- Multi Select -->
		<template v-else-if="inputInterface === 'multi_select'">
			<div class="chips-value">
				<v-chip v-for="val in ensureArray(displayValue)" :key="val" x-small>
					{{ getOptionLabelLocal(val) }}
				</v-chip>
				<span v-if="ensureArray(displayValue).length > 3" class="more-count">
					+{{ ensureArray(displayValue).length - 3 }}
				</span>
			</div>
		</template>

		<!-- Image -->
		<template v-else-if="inputInterface === 'image'">
			<div class="image-value" v-if="displayValue">
				<img :src="getThumbnail(displayValue)" :alt="attribute?.label || 'Image'" @error="imageError = true" />
			</div>
		</template>

		<!-- Table -->
		<template v-else-if="inputInterface === 'table'">
			<div class="table-value">
				<v-icon name="table_chart" small />
				<span>{{ getTableSummary(displayValue) }}</span>
			</div>
		</template>

		<!-- Text/Identifier -->
		<template v-else-if="['text', 'identifier'].includes(inputInterface)">
			<span class="text-value" :title="String(displayValue)">
				{{ truncateText(String(displayValue), 50) }}
			</span>
		</template>

		<!-- Number -->
		<template v-else-if="inputInterface === 'number'">
			<span class="number-value">{{ formatNumber(displayValue) }}</span>
		</template>

		<!-- Default -->
		<template v-else>
			<span class="default-value" :title="String(displayValue)">
				{{ truncateText(String(displayValue), 50) }}
			</span>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useAttributeOptions } from '../composables/useAttributeOptions';

interface Props {
	value: any;
	attribute?: any;
}

const props = defineProps<Props>();
const imageError = ref(false);

// Use the attribute options composable
const { loadOptions, getOptionLabel, getOptionsRef } = useAttributeOptions();

// Track if options are loaded
const optionsLoaded = ref(false);

// Get reactive reference to options for this attribute
const attributeOptions = computed(() => {
	if (!props.attribute?.code) return [];
	return getOptionsRef(props.attribute.code).value;
});

// Load options for select-type attributes
const loadAttributeOptions = async () => {
	const interface_ = props.attribute?.type?.input_interface || 'text';
	const shouldLoad = props.attribute && [
		'simple_select', 
		'multi_select',
		'reference_entity_single',
		'reference_entity_multiple'
	].includes(interface_);
	
	if (shouldLoad) {
		await loadOptions(props.attribute.code);
		optionsLoaded.value = true;
	}
};

onMounted(loadAttributeOptions);
watch(() => props.attribute, async () => {
	optionsLoaded.value = false;
	await loadAttributeOptions();
});

// Computed
const parsedValue = computed(() => {
	if (!props.value) return null;

	try {
		// If it's already an object, return it
		if (typeof props.value === 'object') return props.value;

		// Try to parse JSON
		const parsed = JSON.parse(props.value);
		return parsed;
	} catch {
		// Return as-is if not JSON
		return props.value;
	}
});

const displayValue = computed(() => {
	const val = parsedValue.value;

	// Handle metric/price values
	if (val && typeof val === 'object' && 'value' in val) {
		return val.value;
	}


	return val;
});

const unit = computed(() => {
	const val = parsedValue.value;

	if (val && typeof val === 'object' && val.unit) {
		// Find unit label if available
		if (props.attribute?.units) {
			const unitData = props.attribute.units.find((u: any) => u.id === val.unit);
			return unitData?.code || val.unit;
		}
		return val.unit;
	}

	return null;
});

const inputInterface = computed(() => {
	// Handle both nested and flat structure
	const interface_ = props.attribute?.type?.input_interface || 
	                  props.attribute?.input_interface || 
	                  'text';
	return interface_;
});

const isEmpty = computed(() => {
	return displayValue.value === null || displayValue.value === undefined || displayValue.value === '';
});

const valueClass = computed(() => {
	return {
		'is-empty': isEmpty.value,
		'is-boolean': inputInterface.value === 'yes_no',
		'is-metric': ['price', 'metric'].includes(inputInterface.value),
		'is-image': inputInterface.value === 'image',
		'has-error': imageError.value,
	};
});

// Methods
const formatNumber = (value: any) => {
	const num = parseFloat(value);
	if (isNaN(num)) return value;

	// Format based on type
	if (inputInterface.value === 'price') {
		return new Intl.NumberFormat('nb-NO', {
			style: 'decimal',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(num);
	}

	// Regular number formatting
	return new Intl.NumberFormat('en-US', {
		style: 'decimal',
		maximumFractionDigits: 2,
	}).format(num);
};

const formatDate = (value: string) => {
	if (!value) return '-';
	try {
		return new Date(value).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return value;
	}
};

const getOptionLabelLocal = computed(() => {
	return (code: string) => {
		// Use the reactive options
		const option = attributeOptions.value.find((opt: any) => opt.value === code);
		if (option) {
			return option.text || option.label || code;
		}
		
		// Fallback to attribute options if available
		if (props.attribute?.options) {
			const fallbackOption = props.attribute.options.find((opt: any) => opt.code === code);
			if (fallbackOption) {
				return fallbackOption.label || code;
			}
		}
		
		return code;
	};
});

const ensureArray = (value: any) => {
	if (Array.isArray(value)) return value.slice(0, 3);
	return [value];
};

const getThumbnail = (fileId: string) => {
	if (imageError.value) return '';
	return `/assets/${fileId}?width=40&height=40&fit=cover`;
};

const getTableSummary = (value: any) => {
	if (!Array.isArray(value)) return 'Invalid data';
	if (value.length === 0) return 'No rows';
	return `${value.length} row${value.length !== 1 ? 's' : ''}`;
};

const truncateText = (text: string, maxLength: number) => {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + '...';
};

const getReferenceLabel = (value: any) => {
	// If value is an object with label property, return it
	if (value && typeof value === 'object' && 'label' in value) {
		return value.label;
	}
	// If value is an object with code property, return it
	if (value && typeof value === 'object' && 'code' in value) {
		return value.code;
	}
	// Otherwise return the value as string
	return String(value);
};

const getReferenceKey = (value: any) => {
	// For v-for key, prioritize id, then code, then the value itself
	if (value && typeof value === 'object') {
		return value.id || value.code || JSON.stringify(value);
	}
	return value;
};
</script>

<style scoped></style>
