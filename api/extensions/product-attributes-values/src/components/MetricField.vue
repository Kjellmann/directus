<!-- components/MetricField.vue -->
<template>
	<div class="metric-attribute">
		<v-input
			:value="numericValue"
			:model-value="numericValue"
			@update:model-value="updateValue"
			v-bind="inputProps"
			type="number"
			:disabled="disabled"
		/>

		<div v-if="units.length" class="metric-unit-selector">
			<v-select :items="units" :model-value="selectedUnitId" @update:model-value="updateUnit" :disabled="disabled" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
	value: { type: Object, default: () => ({}) },
	units: { type: Array, default: () => [] },
	selectedUnitId: { type: [String, Number, null], default: null },
	disabled: { type: Boolean, default: false },
	inputProps: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:value', 'update:unit']);

const numericValue = computed(() => {
	console.log('props.value', props.value);
	if (!props.value || typeof props.value !== 'object') return '';
	return props.value.value ?? '';
});

function updateValue(newValue: any) {
	emit('update:value', newValue);
}

function updateUnit(unitId: any) {
	emit('update:unit', unitId);
}
</script>

<style lang="scss" scoped>
.metric-attribute {
	display: flex;
	align-items: center;
	gap: 8px;

	.metric-unit-selector {
		flex-shrink: 0;
		width: 100px;
	}
}
</style>
