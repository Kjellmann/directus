<!-- components/AttributeGroupDetail.vue -->
<template>
	<v-detail v-model="detailOpen" :start-open="startOpen" class="group-detail">
		<template #activator="{ toggle, active }">
			<v-divider
				:class="{ active, edited: hasChanges }"
				:inline-title="false"
				large
				@click="toggle"
			>
				<template v-if="group.icon" #icon>
					<v-icon :name="group.icon" class="header-icon" />
				</template>
				
				<template v-if="group.label">
					<span v-if="hasChanges" v-tooltip="t('edited')" class="edit-dot"></span>
					<span class="title">{{ group.label }}</span>
				</template>
				
				<v-icon
					v-if="!active && validationMessages.length > 0"
					v-tooltip="validationMessages.join('\n')"
					class="warning"
					name="error"
					small
				/>
				<v-icon class="expand-icon" name="expand_more" />
			</v-divider>
		</template>

		<div class="v-form">
			<div class="attributes-grid">
				<slot :attributes="attributes" :group="group" />
			</div>
		</div>
	</v-detail>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AttributeValueItem } from '../composables/useAttributeValues';

interface AttributeGroup {
	id: string | number;
	code: string;
	label: string;
	enabled?: boolean;
	sort?: number;
	icon?: string;
	description?: string;
}

const props = withDefaults(
	defineProps<{
		group: AttributeGroup;
		attributes: AttributeValueItem[];
		hasChanges?: boolean;
		validationErrors?: Array<{ attributeId: string | number; message: string }>;
		startOpen?: boolean;
		disabled?: boolean;
		loading?: boolean;
	}>(),
	{
		hasChanges: false,
		validationErrors: () => [],
		startOpen: true,
		disabled: false,
		loading: false,
	}
);

const { t } = useI18n();

const detailOpen = ref(props.startOpen);

// In case that conditions change the start prop after the group already got rendered
// caused by the async loading of data to run the conditions against
watch(
	() => props.loading,
	(newVal) => {
		if (!newVal) detailOpen.value = props.startOpen;
	},
	{ once: true }
);

const validationMessages = computed(() => {
	if (!props.validationErrors || props.validationErrors.length === 0) return [];
	return props.validationErrors.map(error => error.message);
});

watch(validationMessages, (newVal, oldVal) => {
	if (!validationMessages.value) return;
	// Simple array comparison for our use case
	if (newVal.length === oldVal.length && newVal.every((val, index) => val === oldVal[index])) return;
	detailOpen.value = validationMessages.value.length > 0;
});
</script>

<style scoped>
/* Direct copy from Directus group-detail.vue styling */
.v-form {
	padding-top: calc(var(--theme--form--row-gap) / 2);
}

.v-divider {
	cursor: pointer;
}

.v-divider .expand-icon {
	float: right;
	transform: rotate(90deg) !important;
	transition: transform var(--fast) var(--transition);
}

.v-divider.active .expand-icon {
	transform: rotate(0) !important;
}

.v-divider :deep(.type-text) {
	position: relative;
}

.v-divider.edited:not(.active) .edit-dot {
	position: absolute;
	top: 7px;
	left: -7px;
	display: block;
	width: 4px;
	height: 4px;
	background-color: var(--theme--form--field--input--foreground-subdued);
	border-radius: 4px;
	content: '';
}

.header-icon {
	margin-right: 12px !important;
}

.warning {
	margin-left: 8px;
	color: var(--theme--danger);
}

/* Additional styling for attributes grid */
.attributes-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: var(--theme--form--row-gap) var(--theme--form--column-gap);
}

@media (max-width: 768px) {
	.attributes-grid {
		grid-template-columns: 1fr;
	}
}
</style>