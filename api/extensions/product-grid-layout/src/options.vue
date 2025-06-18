<script lang="ts">
export default {
	inheritAttrs: false,
};
</script>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useSync } from '@directus/composables';
import { useStores } from '@directus/extensions-sdk';
import { createI18nOptions } from './translations';

interface Props {
	spacing: 'compact' | 'cozy' | 'comfortable';
	viewMode?: 'grid' | 'list';
}

const props = withDefaults(defineProps<Props>(), {
	viewMode: 'list',
});

const emit = defineEmits(['update:spacing', 'update:viewMode']);

const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();
const currentLanguage = settingsStore.settings?.default_language;

const { t } = useI18n(createI18nOptions(currentLanguage.value));

const spacingWritable = useSync(props, 'spacing', emit);
const viewModeWritable = useSync(props, 'viewMode', emit);
</script>

<template>
	<div class="field">
		<div class="type-label">{{ t('view_mode') }}</div>
		<v-select
			v-model="viewModeWritable"
			:items="[
				{
					text: t('list'),
					value: 'list',
				},
				{
					text: t('grid'),
					value: 'grid',
				},
			]"
		/>
	</div>
	<div class="field">
		<div class="type-label">{{ t('layouts.tabular.spacing') }}</div>
		<v-select
			v-model="spacingWritable"
			:items="[
				{
					text: t('layouts.tabular.compact'),
					value: 'compact',
				},
				{
					text: t('layouts.tabular.comfortable'),
					value: 'comfortable',
				},
				{
					text: t('layouts.tabular.cozy'),
					value: 'cozy',
				},
			]"
		/>
	</div>
</template>
