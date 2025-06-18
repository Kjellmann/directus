<template>
	<div class="product-grid" :data-spacing="spacing">
		<div v-if="loading" class="grid-loading">
			<v-progress-circular indeterminate />
		</div>
		
		<div v-else class="grid-container">
			<div
				v-for="item in items"
				:key="item[primaryKeyField?.field || 'id']"
				class="grid-item"
				:class="{ selected: isSelected(item) }"
				@click="handleItemClick(item, $event)"
			>
				<div v-if="showSelect !== 'none'" class="grid-item-select">
					<v-checkbox
						:model-value="isSelected(item)"
						@update:model-value="toggleSelection(item)"
						@click.stop
					/>
				</div>
				
				<div class="grid-item-image">
					<product-image
						:image-id="item.product_assets?.[0]?.assets_id?.media_file || item.primary_image"
						:alt="`Product ${item.id}`"
						:spacing="spacing"
						view-mode="grid"
					/>
				</div>
				
				<div class="grid-item-content">
					<div class="grid-item-title">
						{{ item.attr_name || item.uuid || item.id }}
					</div>
					<div class="grid-item-sku">
						{{ item.attr_sku || 'No SKU' }}
					</div>
					<div class="grid-item-status">
						<v-chip v-if="item.enabled" small color="success">
							Enabled
						</v-chip>
						<v-chip v-else small color="danger">
							Disabled
						</v-chip>
					</div>
				</div>
			</div>
		</div>
		
		<div class="grid-footer">
			<div class="pagination">
				<v-pagination
					v-if="totalPages > 1"
					:length="totalPages"
					:total-visible="7"
					show-first-last
					:model-value="page"
					@update:model-value="toPage"
				/>
			</div>
			
			<div v-if="!loading && (items.length >= 25 || limit < 25)" class="per-page">
				<span>{{ t('per_page') }}</span>
				<v-select
					:model-value="`${limitWritable}`"
					:items="pageSizes"
					inline
					@update:model-value="limitWritable = +$event"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ProductImage from './ProductImage.vue';

interface Props {
	items: any[];
	loading: boolean;
	selection?: any[];
	showSelect?: string;
	readonly: boolean;
	onRowClick: (event: { item: any; event: PointerEvent }) => void;
	page: number;
	toPage: (newPage: number) => void;
	totalPages: number;
	limit: number;
	primaryKeyField?: any;
	spacing?: 'compact' | 'cozy' | 'comfortable';
}

const props = withDefaults(defineProps<Props>(), {
	selection: () => [],
	showSelect: 'none',
	items: () => [],
	loading: false,
	totalPages: 1,
	page: 1,
	limit: 25,
	readonly: false,
	spacing: 'cozy',
});

const emit = defineEmits(['update:selection', 'update:limit']);

const { t } = useI18n();

const pageSizes = ['25', '50', '100', '250', '500', '1000'];

// Sync selection
const selectionWritable = computed({
	get: () => props.selection,
	set: (val) => emit('update:selection', val),
});

// Sync limit
const limitWritable = computed({
	get: () => props.limit,
	set: (val) => emit('update:limit', val),
});

// Check if item is selected
const isSelected = (item: any) => {
	const pk = props.primaryKeyField?.field || 'id';
	return props.selection?.some(sel => sel[pk] === item[pk]);
};

// Toggle selection
const toggleSelection = (item: any) => {
	const pk = props.primaryKeyField?.field || 'id';
	const isCurrentlySelected = isSelected(item);
	
	if (isCurrentlySelected) {
		selectionWritable.value = props.selection.filter(sel => sel[pk] !== item[pk]);
	} else {
		selectionWritable.value = [...props.selection, item];
	}
};

// Handle item click
const handleItemClick = (item: any, event: PointerEvent) => {
	if (!props.readonly) {
		props.onRowClick({ item, event });
	}
};
</script>

<style scoped>
.product-grid {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: var(--content-padding);
}

.grid-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 200px;
}

.grid-container {
	display: grid;
	flex: 1;
	overflow-y: auto;
	padding-bottom: var(--content-padding);
}

.product-grid[data-spacing="compact"] .grid-container {
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: 12px;
}

.product-grid[data-spacing="cozy"] .grid-container {
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	gap: 20px;
}

.product-grid[data-spacing="comfortable"] .grid-container {
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 28px;
}

.grid-item {
	background: var(--theme--background);
	border: 2px solid var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	cursor: pointer;
	transition: all 0.2s;
	position: relative;
}

.product-grid[data-spacing="compact"] .grid-item {
	padding: 12px;
}

.product-grid[data-spacing="cozy"] .grid-item {
	padding: 20px;
}

.product-grid[data-spacing="comfortable"] .grid-item {
	padding: 28px;
}

.grid-item:hover {
	border-color: var(--theme--primary);
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.grid-item.selected {
	border-color: var(--theme--primary);
	background: var(--theme--primary-background);
}

.grid-item-select {
	position: absolute;
	top: 8px;
	right: 8px;
}

.grid-item-image {
	display: flex;
	justify-content: center;
	margin-bottom: var(--theme--form--row-gap);
}

.grid-item-content {
	text-align: center;
}

.grid-item-title {
	font-weight: 600;
	margin-bottom: 4px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.grid-item-sku {
	color: var(--theme--foreground-subdued);
	font-size: 0.875em;
	margin-bottom: 8px;
}

.grid-item-status {
	display: flex;
	justify-content: center;
}

.grid-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--content-padding) 0;
	border-top: 2px solid var(--theme--border-color-subdued);
}

.pagination {
	flex: 1;
}

.per-page {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--theme--foreground-subdued);
}
</style>