<!-- components/AttributeField.vue (updates) -->
<template>
	<div class="field" :class="[widthClass]">
		<div class="field-label type-label">
			<span class="field-name">
				<div class="v-text-overflow">{{ attribute.label }}</div>
				<span v-if="attribute.required" class="v-icon sup required">
					<i class="filled" data-icon="star"></i>
				</span>
			</span>
		</div>

		<div class="interface" :class="{ 'metric-attribute': isMetric, 'table-attribute': isTable }">
			<component
				v-if="!isMetric && !isTable"
				:is="componentName"
				v-bind="componentProps"
				:value="value"
				:model-value="value"
				@update:model-value="onValueChange"
			/>

			<metric-field
				v-else-if="isMetric"
				:value="metricValue"
				:units="units"
				:selected-unit-id="selectedUnitId"
				:disabled="disabled"
				:input-props="componentProps"
				@update:value="onValueChange"
				@update:unit="onUnitChange"
			/>

			<table-field
				v-else
				:model-value="tableValue"
				:attribute="attribute"
				:disabled="disabled"
				:interface-map="interfaceMap"
				@update:model-value="onValueChange"
			/>
		</div>

		<small v-if="attribute.description" class="type-note" v-md="{ value: attribute.description, target: '_blank' }" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MetricField from './MetricField.vue';
import TableField from './TableField.vue';

const props = defineProps({
	attribute: { type: Object, required: true },
	value: { type: [Object, String, Number, Boolean, Array], default: null },
	units: { type: Array, default: () => [] },
	selectedUnitId: { type: [String, Number, null], default: null },
	disabled: { type: Boolean, default: false },
	interfaceMap: { type: Object, required: true },
	componentProps: { type: Object, default: () => ({}) },
	widthClass: { type: String, default: 'full' },
});

const emit = defineEmits(['update:value', 'update:unit']);

const isMetric = computed(() => {
	return props.attribute.type.input_interface === 'measurement';
});

const isTable = computed(() => {
	return props.attribute.type.input_interface === 'table';
});

const componentName = computed(() => {
	const interfaceId = props.interfaceMap[props.attribute.type.input_interface] || 'input';
	return `interface-${interfaceId}`;
});

const metricValue = computed(() => {
	if (!props.value || typeof props.value !== 'object') {
		return { value: props.value };
	}
	return props.value;
});

const tableValue = computed(() => {
	if (!props.value || !Array.isArray(props.value)) {
		return [];
	}
	return props.value;
});

function onValueChange(newValue: any) {
	emit('update:value', {
		attributeId: props.attribute.id,
		value: newValue,
	});
}

function onUnitChange(unitId: any) {
	emit('update:unit', {
		attributeId: props.attribute.id,
		unitId,
	});
}
</script>

<style lang="scss" scoped>
.field {
	margin-bottom: var(--theme--form--column-gap, 32px);
	position: relative;
}

.field-label {
	margin-bottom: 8px;
}

.required {
	color: var(--theme--danger);
	margin-left: 2px;
}

.type-note {
	position: relative;
	display: block;
	max-width: 520px;
	margin-top: 4px;
	color: var(--theme--foreground-subdued);
	font-style: italic;
}

/* Add table-specific styling if needed */
.table-attribute {
	width: 100%;
}
</style>
