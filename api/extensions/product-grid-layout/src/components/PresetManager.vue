<template>
	<div class="preset-manager">
		<!-- Preset selector button -->
		<v-menu placement="bottom-start" :close-on-content-click="false">
			<template #activator="{ toggle, active }">
				<v-button @click="toggle" icon rounded secondary outlined v-tooltip.bottom="presetTooltip">
					<v-icon name="visibility" />
					<v-badge :disabled="!isDirty" :dot="isDirty" />
				</v-button>
			</template>

			<v-list class="preset-list">
				<!-- Current state indicator -->
				<div v-if="activePreset" class="current-preset-info">
					<div class="preset-name">{{ activePreset.name }}</div>
					<div v-if="isDirty" class="preset-status">{{ t('modified') }}</div>
				</div>

				<!-- Preset list -->
				<template v-if="presets.length > 0">
					<v-divider v-if="activePreset" />
					<v-list-item
						v-for="preset in presets"
						:key="preset.id"
						clickable
						:active="preset.id === activePresetId"
						@click="applyPreset(preset.id)"
					>
						<v-list-item-content>
							<div class="preset-item-header">
								<v-text-overflow :text="preset.name" />
								<v-icon v-if="preset.isDefault" name="star" small />
							</div>
							<v-text-overflow v-if="preset.description" :text="preset.description" class="preset-description" />
						</v-list-item-content>
						<v-list-item-icon>
							<v-menu placement="left-start" show-arrow @click.stop>
								<template #activator="{ toggle }">
									<v-icon name="more_vert" clickable @click.stop="toggle" />
								</template>
								<v-list>
									<v-list-item
										clickable
										@click="handleUpdatePreset(preset.id)"
										:disabled="preset.id !== activePresetId || !isDirty"
									>
										<v-list-item-icon><v-icon name="save" /></v-list-item-icon>
										<v-list-item-content>{{ t('update_view') }}</v-list-item-content>
									</v-list-item>
									<v-list-item clickable @click="handleSetDefault(preset.id)" :disabled="preset.isDefault">
										<v-list-item-icon><v-icon name="star" /></v-list-item-icon>
										<v-list-item-content>{{ t('set_as_default') }}</v-list-item-content>
									</v-list-item>
									<v-divider />
									<v-list-item clickable @click="handleDeletePreset(preset.id)" class="danger">
										<v-list-item-icon><v-icon name="delete" /></v-list-item-icon>
										<v-list-item-content>{{ t('delete') }}</v-list-item-content>
									</v-list-item>
								</v-list>
							</v-menu>
						</v-list-item-icon>
					</v-list-item>
				</template>

				<v-list-item v-else class="no-presets">
					<v-list-item-content>
						<div class="no-presets-text">{{ t('no_saved_views') }}</div>
					</v-list-item-content>
				</v-list-item>

				<v-divider />

				<!-- Actions -->
				<v-list-item clickable @click="showSaveDialog = true">
					<v-list-item-icon><v-icon name="add" /></v-list-item-icon>
					<v-list-item-content>{{ t('save_current_view') }}</v-list-item-content>
				</v-list-item>
			</v-list>
		</v-menu>

		<!-- Save preset dialog -->
		<v-dialog v-model="showSaveDialog" @esc="showSaveDialog = false">
			<v-card>
				<v-card-title>{{ t('save_view') }}</v-card-title>
				<v-card-text>
					<div class="form-grid">
						<div class="field full">
							<p class="type-label">{{ t('view_name') }}</p>
							<v-input v-model="presetName" :placeholder="t('enter_view_name')" autofocus />
						</div>
						<div class="field full">
							<p class="type-label">{{ t('description') }}</p>
							<v-textarea v-model="presetDescription" :placeholder="t('optional_description')" :rows="3" />
						</div>
					</div>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="showSaveDialog = false">
						{{ t('cancel') }}
					</v-button>
					<v-button kind="primary" @click="handleSavePreset" :disabled="!presetName">
						{{ t('save') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStores } from '@directus/extensions-sdk';
import { ProductGridPreset } from '../composables/usePresetManager';
import { createI18nOptions } from '../translations';

const props = defineProps({
	presets: {
		type: Array as PropType<ProductGridPreset[]>,
		required: true,
	},
	activePreset: {
		type: Object as PropType<ProductGridPreset | undefined>,
		default: undefined,
	},
	activePresetId: {
		type: String as PropType<string | null>,
		default: null,
	},
	isDirty: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(['save-preset', 'update-preset', 'apply-preset', 'delete-preset', 'set-default']);

const { useNotificationsStore, useSettingsStore } = useStores();
const notificationsStore = useNotificationsStore();
const settingsStore = useSettingsStore();

// Get current language from settings
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');

// Use translations with current language
const { t } = useI18n(createI18nOptions(currentLanguage.value));

// Computed
const presetTooltip = computed(() => {
	if (props.activePreset) {
		const name = props.activePreset.name;
		const modified = props.isDirty ? ` (${t('modified')})` : '';
		return `${t('view')}: ${name}${modified}`;
	}
	return t('manage_views');
});

// Dialog state
const showSaveDialog = ref(false);
const presetName = ref('');
const presetDescription = ref('');

// Methods
const handleSavePreset = () => {
	if (!presetName.value) return;

	emit('save-preset', {
		name: presetName.value,
		description: presetDescription.value || undefined,
	});

	// Reset form
	presetName.value = '';
	presetDescription.value = '';
	showSaveDialog.value = false;

	showSuccessNotification(t('view_saved'));
};

const handleUpdatePreset = (presetId: string) => {
	emit('update-preset', presetId);
	showSuccessNotification(t('view_updated'));
};

const handleDeletePreset = (presetId: string) => {
	if (confirm(t('confirm_delete_view'))) {
		emit('delete-preset', presetId);
		showSuccessNotification(t('view_deleted'));
	}
};

const handleSetDefault = (presetId: string) => {
	emit('set-default', presetId);
	showSuccessNotification(t('default_view_set'));
};

const applyPreset = (presetId: string) => {
	emit('apply-preset', presetId);
};

// Notification helpers
const showSuccessNotification = (message: string) => {
	notificationsStore.add({
		title: message,
		type: 'success',
	});
};

const showErrorNotification = (message: string) => {
	notificationsStore.add({
		title: message,
		type: 'error',
	});
};
</script>

<style lang="scss" scoped>
.preset-manager {
	display: inline-block;
}

.preset-list {
	min-width: 300px;
	max-width: 400px;
}

.current-preset-info {
	padding: 12px 16px;
	background-color: var(--background-subdued);

	.preset-name {
		font-weight: 600;
		color: var(--foreground-normal);
	}

	.preset-status {
		font-size: 12px;
		color: var(--warning);
		margin-top: 4px;
	}
}

.preset-item-header {
	display: flex;
	align-items: center;
	gap: 8px;

	.v-icon {
		color: var(--warning);
	}
}

.preset-description {
	font-size: 12px;
	color: var(--foreground-subdued);
	margin-top: 4px;
}

.no-presets {
	pointer-events: none;

	.no-presets-text {
		color: var(--foreground-subdued);
		font-style: italic;
	}
}

.form-grid {
	display: grid;
	gap: 24px;
}

.field {
	&.full {
		grid-column: 1 / -1;
	}
}

.type-label {
	margin-bottom: 8px;
	font-weight: 600;
	font-size: 14px;
}

:deep(.v-list-item.danger) {
	--v-list-item-color: var(--danger);
	--v-list-item-color-hover: var(--danger);
	--v-list-item-icon-color: var(--danger);
}
</style>
