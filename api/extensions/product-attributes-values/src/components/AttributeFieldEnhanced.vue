<!-- components/AttributeFieldEnhanced.vue -->
<template>
	<div class="field full" :class="fieldClasses">
		<!-- Field Header -->
		<div class="field-header">
			<div class="field-label type-label">
				<span class="field-name">{{ attribute.label }}</span>
				<span v-if="attribute.required" class="required-indicator">*</span>
				<v-icon
					v-if="showDirtyIndicator && state?.isDirty"
					v-tooltip="t('field_modified')"
					name="edit"
					small
					class="dirty-indicator"
				/>
			</div>

			<div class="field-actions">
				<v-button
					v-if="state?.isDirty && !batchMode"
					v-tooltip="t('reset_field')"
					x-small
					icon
					secondary
					@click="$emit('reset', attribute.id)"
				>
					<v-icon name="undo" small />
				</v-button>

				<v-menu v-if="batchMode" placement="bottom-end" show-arrow>
					<template #activator="{ toggle }">
						<v-button v-tooltip="t('batch_options')" x-small icon secondary @click="toggle">
							<v-icon name="more_vert" small />
						</v-button>
					</template>
					<v-list>
						<v-list-item clickable @click="applyBatchOperation('set')">
							<v-list-item-icon><v-icon name="edit" /></v-list-item-icon>
							<v-list-item-content>{{ t('set_value') }}</v-list-item-content>
						</v-list-item>
						<v-list-item v-if="canAppend" clickable @click="applyBatchOperation('append')">
							<v-list-item-icon><v-icon name="add" /></v-list-item-icon>
							<v-list-item-content>{{ t('append_value') }}</v-list-item-content>
						</v-list-item>
						<v-list-item clickable @click="applyBatchOperation('clear')">
							<v-list-item-icon><v-icon name="clear" /></v-list-item-icon>
							<v-list-item-content>{{ t('clear_value') }}</v-list-item-content>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>

		<!-- Field Interface -->
		<div class="field-interface" :class="{ 'has-error': state?.validationError }">
			<!-- Metric Field -->
			<metric-field
				v-if="isMetric"
				:value="metricValue"
				:units="units"
				:selected-unit-id="selectedUnitId"
				:disabled="disabled"
				:input-props="componentProps"
				:error="state?.validationError"
				@update:value="onValueChange"
				@update:unit="onUnitChange"
			/>

			<!-- Table Field -->
			<table-field
				v-else-if="isTable"
				:model-value="tableValue"
				:attribute="attribute"
				:disabled="disabled"
				:interface-map="interfaceMap"
				:error="state?.validationError"
				@update:model-value="onValueChange"
			/>

			<!-- Regular Field -->
			<component
				v-else
				:is="componentName"
				v-bind="componentProps"
				:value="value"
				:disabled="disabled"
				:error="!!state?.validationError"
				@input="onValueChange"
				@update:model-value="onValueChange"
			/>
		</div>

		<!-- Error Message -->
		<v-notice v-if="state?.validationError" type="error">
			<div v-md="{ value: state.validationError, target: '_blank' }" />
		</v-notice>

		<!-- Field Description -->
		<v-notice v-if="attribute.description && !state?.validationError" type="info">
			<div v-md="{ value: attribute.description, target: '_blank' }" />
		</v-notice>

		<!-- Batch Operation Dialog -->
		<v-dialog v-model="showBatchDialog" @cancel="cancelBatchOperation">
			<template #activator><!-- Hidden --></template>
			<v-card>
				<v-card-title>
					{{ t('batch_update_attribute', { attribute: attribute.label }) }}
				</v-card-title>
				<v-card-text>
					<p class="batch-info">
						{{ t('batch_update_description', { count: selectedProductCount }) }}
					</p>

					<div class="batch-input">
						<!-- Use appropriate interface for batch input -->
						<component :is="componentName" v-bind="batchComponentProps" v-model="batchValue" :disabled="false" />
					</div>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="cancelBatchOperation">
						{{ t('cancel') }}
					</v-button>
					<v-button :loading="applyingBatch" @click="confirmBatchOperation">
						{{ t('apply') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import MetricField from './MetricField.vue';
import TableField from './TableField.vue';

const { t } = useI18n();

const props = defineProps({
	attribute: { type: Object, required: true },
	value: { type: [Object, String, Number, Boolean, Array], default: null },
	state: { type: Object, default: null },
	units: { type: Array, default: () => [] },
	selectedUnitId: { type: [String, Number, null], default: null },
	disabled: { type: Boolean, default: false },
	interfaceMap: { type: Object, required: true },
	componentProps: { type: Object, default: () => ({}) },
	batchMode: { type: Boolean, default: false },
	showDirtyIndicator: { type: Boolean, default: true },
	selectedProductCount: { type: Number, default: 0 },
});

const emit = defineEmits(['update:value', 'update:unit', 'batch-update', 'reset']);

// State
const showBatchDialog = ref(false);
const batchValue = ref<any>(null);
const batchOperation = ref<'set' | 'append' | 'clear'>('set');
const applyingBatch = ref(false);

// Computed
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

const fieldClasses = computed(() => {
	return {
		'is-dirty': props.state?.isDirty,
		'has-error': !!props.state?.validationError,
		'is-required': props.attribute.required,
		'is-disabled': props.disabled,
		'batch-mode': props.batchMode,
	};
});

const canAppend = computed(() => {
	const appendableTypes = ['text', 'text_area', 'multi_select'];
	return appendableTypes.includes(props.attribute.type.input_interface);
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

const batchComponentProps = computed(() => {
	return {
		...props.componentProps,
		placeholder: t('enter_batch_value'),
	};
});

// Methods
function onValueChange(newValue: any) {
	console.log('[AttributeFieldEnhanced] onValueChange for', props.attribute.code, '- newValue:', newValue, 'typeof:', typeof newValue);
	
	// For reference_entity_single, filter out boolean values (dropdown states)
	if (props.attribute.type.input_interface === 'reference_entity_single' && typeof newValue === 'boolean') {
		console.warn('[AttributeFieldEnhanced] Ignoring boolean value for reference_entity_single:', newValue);
		return; // Don't emit boolean values for reference entities
	}
	
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

function applyBatchOperation(operation: 'set' | 'append' | 'clear') {
	batchOperation.value = operation;

	if (operation === 'clear') {
		// No need to show dialog for clear operation
		confirmBatchOperation();
	} else {
		// Initialize batch value based on current value
		if (operation === 'append') {
			batchValue.value = '';
		} else {
			batchValue.value = props.value;
		}
		showBatchDialog.value = true;
	}
}

function cancelBatchOperation() {
	showBatchDialog.value = false;
	batchValue.value = null;
	batchOperation.value = 'set';
}

function confirmBatchOperation() {
	const finalValue = batchOperation.value === 'clear' ? null : batchValue.value;

	emit('batch-update', {
		attributeId: props.attribute.id,
		value: finalValue,
		operation: batchOperation.value,
	});

	cancelBatchOperation();
}
</script>

<style lang="scss" scoped>
.field {
	position: relative;

	&.has-error {
		border-color: var(--theme--danger);
		background-color: var(--theme--danger-background);
	}

	&.batch-mode {
		&:hover {
			background-color: var(--theme--background-accent);
		}
	}

	&.full {
		grid-column: span 2;
	}
}

.field-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.field-label {
	display: flex;
	align-items: center;
	gap: 4px;
	font-weight: 600;
	color: var(--theme--form--field--label--foreground);

	.required-indicator {
		color: var(--theme--danger);
	}

	.dirty-indicator {
		color: var(--theme--primary);
	}
}

.field-actions {
	display: flex;
	gap: 4px;
}

.field-interface {
	position: relative;

	&.has-error {
		:deep(.v-input) {
			--v-input-border-color: var(--theme--danger);
		}
	}
}

.field-error {
	display: block;
	margin-top: 4px;
	color: var(--theme--danger);
	font-size: 12px;
}

.field-description {
	display: block;
	margin-top: 4px;
	color: var(--theme--foreground-subdued);
	font-size: 12px;
	font-style: italic;
}

.batch-info {
	margin-bottom: 16px;
	color: var(--theme--foreground-subdued);
}

.batch-input {
	padding: 16px;
	background-color: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
}

.field-interface {
	+ .v-notice {
		margin-top: 12px;
	}
}
</style>
