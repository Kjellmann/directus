<!-- components/table/TableField.vue -->
<template>
	<div class="table-attribute">
		<div v-if="tableColumns.length === 0" class="empty-config">
			<p>This table attribute is not configured correctly. No columns defined in meta_options.</p>
		</div>

		<template v-else>
			<v-notice v-if="!modelValue || modelValue.length === 0" class="empty-table">
				{{ t('no_rows_yet') }}
			</v-notice>

			<v-list v-else-if="modelValue && modelValue.length > 0">
				<v-list-item v-for="(row, rowIndex) in modelValue" :key="rowIndex" block clickable @click="openItem(rowIndex)">
					<v-list-item-content>
						<div class="list-item-title">{{ getRowLabel(rowIndex) }}</div>
						<div class="list-item-subtitle">
							<span v-for="(column, idx) in getRowSummaryColumns(row)" :key="column.code">
								<template v-if="idx > 0"><span>•</span></template>
								{{ column.label }}: {{ getDisplayValue(row[column.code], column) }}
							</span>
						</div>
					</v-list-item-content>
					<template #append>
						<v-icon v-if="!disabled" name="close" clickable @click.stop="removeRow(rowIndex)" />
					</template>
				</v-list-item>
			</v-list>

			<div v-if="!disabled" class="table-footer">
				<v-button :disabled="isRowLimitReached" @click="addNewRow">
					<v-icon name="add" />
					{{ addRowLabel }}
				</v-button>
			</div>

			<v-drawer v-model="drawerActive" :title="drawerTitle || ''" icon="table" persistent @cancel="cancelEdit">
				<template #actions>
					<v-button 
						v-if="!disabled && !isNewItem" 
						v-tooltip.bottom="t('delete')" 
						icon 
						rounded 
						secondary
						@click="deleteCurrentItem"
					>
						<v-icon name="delete" />
					</v-button>
					<v-button v-tooltip.bottom="t('save')" icon rounded :disabled="disabled" @click="saveItem">
						<v-icon name="check" />
					</v-button>
				</template>

				<div class="drawer-item-content">
					<div class="drawer-fields">
						<div v-for="column in visibleTableColumns" :key="column.code" class="drawer-field">
							<div class="field-label type-label">
								<span class="field-name">{{ column.label }}</span>
								<span v-if="column.required" class="required">*</span>
							</div>
							<div class="field">
								<metric-field
									v-if="column.type === 'measurement'"
									:value="getMetricValue(edits[column.code])"
									:units="getMetricUnits(column)"
									:selected-unit-id="getSelectedUnitId(edits[column.code])"
									:disabled="disabled"
									:input-props="getColumnProps(column, edits[column.code])"
									@update:value="(value) => updateEditValue(column.code, value)"
									@update:unit="(unitId) => updateEditUnit(column.code, unitId)"
								/>

								<component
									v-else
									:is="getColumnComponentName(column)"
									v-bind="getColumnProps(column, edits[column.code])"
									:value="edits[column.code]"
									:model-value="edits[column.code]"
									@update:model-value="(value: any) => updateEditValue(column.code, value)"
								/>
							</div>
						</div>
					</div>
				</div>
			</v-drawer>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import MetricField from './MetricField.vue';
import { useMetricAttributes } from '../composables/useMetricAttributes';

const { t } = useI18n();

interface TableColumn {
	code: string;
	label: string;
	type: string;
	width?: string | number;
	required?: boolean;
	placeholder?: string;
	defaultValue?: any;
	metric_family?: string;
	options?: {
		choices?: any[];
		allowOther?: boolean;
		step?: number;
		min?: number;
		max?: number;
	};
}

interface Props {
	modelValue: Record<string, any>[];
	attribute: {
		meta_options?:
			| {
					columns?: TableColumn[];
					rowLimit?: number;
					addRowLabel?: string;
			  }
			| string;
	};
	disabled?: boolean;
	interfaceMap: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: () => [],
	disabled: false,
});

const emit = defineEmits<{
	'update:modelValue': [value: Record<string, any>[]];
}>();
const metricHandler = useMetricAttributes();
const metricUnitsCache = ref<Record<string, any[]>>({});

// Drawer state
const drawerActive = ref(false);
const currentEditIndex = ref<number | null>(null);
const edits = ref<Record<string, any>>({});
const isNewItem = ref(false);

const tableColumns = computed<TableColumn[]>(() => {
	if (
		typeof props.attribute.meta_options === 'object' &&
		props.attribute.meta_options?.columns &&
		props.attribute.meta_options.columns.length > 0
	) {
		return props.attribute.meta_options.columns;
	}

	if (typeof props.attribute.meta_options === 'string') {
		try {
			const parsed = JSON.parse(props.attribute.meta_options);
			if (parsed.columns && parsed.columns.length > 0) {
				console.log('Using columns from parsed meta_options:', parsed.columns);
				return parsed.columns;
			}
		} catch (e) {
			console.error('Error parsing meta_options string:', e);
		}
	}

	console.warn('No columns found in meta_options');
	return [];
});

const visibleTableColumns = computed(() => {
	return tableColumns.value.filter((column) => column.code !== 'row_label');
});

const rowLabelColumn = computed(() => {
	return tableColumns.value.find((column) => column.code === 'row_label');
});

const isRowLimitReached = computed(() => {
	const rowLimit =
		(typeof props.attribute.meta_options === 'object' ? props.attribute.meta_options?.rowLimit : undefined) || 50;
	return props.modelValue.length >= rowLimit;
});

const addRowLabel = computed(() => {
	return (
		(typeof props.attribute.meta_options === 'object' ? props.attribute.meta_options?.addRowLabel : undefined) ||
		t('add_row')
	);
});

const drawerTitle = computed(() => {
	if (isNewItem.value) {
		return t('add_new_item');
	}
	return currentEditIndex.value !== null ? getRowLabel(currentEditIndex.value) : '';
});

onMounted(async () => {
	await loadMetricUnits();
});

async function loadMetricUnits() {
	for (const column of tableColumns.value) {
		if (column.type === 'measurement' && column.metric_family) {
			const units = await metricHandler.getMetricUnits({
				metric_family: { id: column.metric_family },
			});

			metricUnitsCache.value[column.code] = units;
		}
	}
}

function getMetricUnits(column: TableColumn) {
	if (column.type === 'measurement' && column.metric_family) {
		return metricUnitsCache.value[column.code] || [];
	}
	return [];
}

function getMetricValue(cellValue: any) {
	if (!cellValue) return { value: null };
	if (typeof cellValue === 'object') return cellValue;
	return { value: cellValue };
}

function getSelectedUnitId(cellValue: any) {
	if (!cellValue || typeof cellValue !== 'object') return null;
	return cellValue.unit?.id || null;
}

function getColumnComponentName(column: TableColumn) {
	if (!column || !column.type) {
		console.warn('Column missing type:', column);
		return 'interface-input';
	}

	const interfaceType = column.type;
	const mapped = props.interfaceMap[interfaceType] || 'input';
	return `interface-${mapped}`;
}

function getRowLabel(rowIndex: number) {
	if (rowLabelColumn.value) {
		if (rowLabelColumn.value.label && rowLabelColumn.value.label.trim() !== '') {
			return `${rowLabelColumn.value.label} ${rowIndex + 1}`;
		}
	}

	return `Item ${rowIndex + 1}`;
}

function getColumnProps(column: TableColumn, cellValue: any) {
	const baseProps = {
		disabled: props.disabled,
		placeholder: column.placeholder || `Enter ${column.label}...`,
		required: column.required || false,
	};

	if (column.type === 'simple_select' || column.type === 'multi_select') {
		return {
			...baseProps,
			choices: (column.options?.choices || []).map((choice) =>
				typeof choice === 'object' ? choice : { text: choice, value: choice },
			),
			allowNone: !(column.required === true),
			allowOther: column.options?.allowOther || false,
		};
	} else if (column.type === 'number' || column.type === 'price' || column.type === 'measurement') {
		return {
			...baseProps,
			type: 'number',
			step: column.options?.step || (column.type === 'price' ? 0.01 : 1),
			min: column.options?.min,
			max: column.options?.max,
		};
	} else if (column.type === 'date') {
		return {
			...baseProps,
			type: 'datetime',
		};
	} else if (column.type === 'yes_no') {
		return {
			...baseProps,
			value: cellValue ?? false,
		};
	}

	return baseProps;
}

function createEmptyRow() {
	const row: Record<string, any> = {};

	tableColumns.value.forEach((column) => {
		if (column.type === 'measurement') {
			row[column.code] = {
				value: column.defaultValue !== undefined ? column.defaultValue : null,
				unit: null,
			};

			const units = metricUnitsCache.value[column.code] || [];
			const standardUnit = units.find((unit: any) => unit.standard);

			if (standardUnit) {
				row[column.code].unit = {
					id: standardUnit.value,
					symbol: standardUnit.symbol || '',
				};
			}
		} else if (column.code === 'row_label') {
			row[column.code] = column.label || t('row_label');
		} else {
			row[column.code] = column.defaultValue !== undefined ? column.defaultValue : null;
		}
	});

	return row;
}

function removeRow(rowIndex: number) {
	const updatedRows = [...props.modelValue];
	updatedRows.splice(rowIndex, 1);
	emit('update:modelValue', updatedRows);
}

// New methods for drawer functionality
function openItem(index: number) {
	isNewItem.value = false;
	currentEditIndex.value = index;
	edits.value = { ...props.modelValue[index] };
	drawerActive.value = true;
}

function addNewRow() {
	isNewItem.value = true;
	currentEditIndex.value = null;
	edits.value = createEmptyRow();
	drawerActive.value = true;
}

function saveItem() {
	if (isNewItem.value) {
		// Add new item
		emit('update:modelValue', [...props.modelValue, edits.value]);
	} else if (currentEditIndex.value !== null) {
		// Update existing item
		const updatedRows = [...props.modelValue];
		updatedRows[currentEditIndex.value] = { ...edits.value };
		emit('update:modelValue', updatedRows);
	}
	closeDrawer();
}

function cancelEdit() {
	closeDrawer();
}

function closeDrawer() {
	drawerActive.value = false;
	currentEditIndex.value = null;
	edits.value = {};
	isNewItem.value = false;
}

function deleteCurrentItem() {
	if (currentEditIndex.value !== null) {
		removeRow(currentEditIndex.value);
		closeDrawer();
	}
}

function updateEditValue(columnCode: string, value: any) {
	// Check if this is a measurement column and preserve the unit
	const column = tableColumns.value.find((col) => col.code === columnCode);
	if (column?.type === 'measurement' && typeof edits.value[columnCode] === 'object') {
		// Preserve the unit information when updating measurement value
		edits.value = {
			...edits.value,
			[columnCode]: {
				...edits.value[columnCode],
				value: value,
			},
		};
	} else {
		edits.value = {
			...edits.value,
			[columnCode]: value,
		};
	}
}

function updateEditUnit(columnCode: string, unitId: string) {
	const units = metricUnitsCache.value[columnCode] || [];
	const selectedUnit = units.find((u: any) => u.value === unitId);

	edits.value = {
		...edits.value,
		[columnCode]: {
			...(edits.value[columnCode] || { value: null }),
			unit: {
				id: unitId,
				symbol: selectedUnit?.symbol || '',
			},
		},
	};
}

function getRowSummaryColumns(row: Record<string, any>) {
	// Show first 3 visible columns in the summary
	return visibleTableColumns.value.slice(0, 3).filter((column) => {
		const value = row[column.code];
		return value !== null && value !== undefined && value !== '';
	});
}

function getDisplayValue(value: any, column: any) {
	if (value === null || value === undefined) return '-';

	if (column.type === 'measurement' && typeof value === 'object') {
		const unit = value.unit?.symbol || '';
		return `${value.value || '-'} ${unit}`.trim();
	}

	if (column.type === 'yes_no') {
		return value ? t('yes') : t('no');
	}

	if (column.type === 'date' && value) {
		return new Date(value).toLocaleDateString();
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	return String(value);
}
</script>

<style lang="scss" scoped>
.table-attribute {
	width: 100%;
}

.empty-config {
	padding: var(--theme--form--row-gap);
	color: var(--theme--foreground-subdued);
	font-style: italic;
}

.empty-table {
	margin-bottom: var(--theme--form--row-gap);
}

.list-item-title {
	font-weight: 600;
	margin-bottom: 4px;
}

.list-item-subtitle {
	font-size: 14px;
	color: var(--theme--foreground-subdued);
	line-height: 1.4;
	display: flex;
	gap: 4px;
}

.table-footer {
	margin-top: 12px;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

.drawer-item-content {
	padding: var(--content-padding);
	padding-bottom: var(--content-padding-bottom);
}

.drawer-fields {
	display: flex;
	flex-direction: column;
	gap: var(--theme--form--row-gap);
}

.drawer-field {
	.field-label {
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 4px;

		.required {
			color: var(--theme--danger);
		}
	}
}
</style>
