import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'asset-collection',
	name: '$t:interfaces.asset_collection.name',
	icon: 'perm_media',
	description: '$t:interfaces.asset_collection.description',
	component: InterfaceComponent,
	types: ['alias'],
	localTypes: ['presentation'],
	relational: false,
	group: 'presentation',
	options: () => {
		return [
			{
				field: 'collection',
				name: '$t:collection',
				type: 'string',
				meta: {
					width: 'full',
					interface: 'system-collection',
					options: {
						includeSystem: false,
					},
				},
				schema: {
					default_value: 'products',
				},
			},
		];
	},
});