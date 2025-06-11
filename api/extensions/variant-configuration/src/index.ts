import { defineInterface, defineEndpoint, defineHook } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';
import endpoints from './endpoint';
import hooks from './hooks';

// Interface definition
const interfaceDefinition = defineInterface({
	id: 'variant-configuration',
	name: 'Variant Configuration',
	icon: 'auto_awesome',
	description: 'Configure attribute options for variant generation',
	component: InterfaceComponent,
	types: ['json'],
	localTypes: ['standard'],
	group: 'selection',
	options: [
		{
			field: 'enableBulkActions',
			name: 'Enable Bulk Actions',
			type: 'boolean',
			meta: {
				interface: 'boolean',
				width: 'half',
			},
			schema: {
				default_value: true,
			},
		},
		{
			field: 'showPreview',
			name: 'Show Variant Preview',
			type: 'boolean',
			meta: {
				interface: 'boolean',
				width: 'half',
			},
			schema: {
				default_value: true,
			},
		},
	],
	recommendedDisplays: ['raw'],
});

// Export bundle
export default {
	interfaces: {
		'variant-configuration': interfaceDefinition,
	},
	endpoints: {
		'variant-generator': defineEndpoint(endpoints),
	},
	hooks: {
		'variant-generator-hooks': defineHook(hooks),
	},
};