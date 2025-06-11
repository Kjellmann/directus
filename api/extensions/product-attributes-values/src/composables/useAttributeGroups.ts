// composables/useAttributeGroups.ts
import { computed, Ref } from 'vue';
import { type AttributeValueItem as BaseAttributeValueItem } from './useAttributeValues';

export interface AttributeGroup {
	id: string | number;
	code: string;
	label: string;
	enabled?: boolean;
	sort?: number;
}

// Re-export the AttributeValueItem from useAttributeValues
export type AttributeValueItem = BaseAttributeValueItem;

export function useAttributeGroups(relationData: Ref<AttributeValueItem[]>) {
	/**
	 * Organize attributes into their respective groups
	 */
	const groupedAttributes = computed(() => {
		const groups: Record<
			string | number,
			{
				group: AttributeGroup;
				attributes: AttributeValueItem[];
			}
		> = {};

		// First, initialize groups
		relationData.value.forEach((item) => {
			if (item.attribute_id?.group) {
				const groupId = item.attribute_id.group.id;

				if (!groups[groupId]) {
					groups[groupId] = {
						group: item.attribute_id.group,
						attributes: [],
					};
				}
			}
		});

		// Then add attributes to their respective groups
		relationData.value.forEach((item) => {
			if (item.attribute_id?.group) {
				const groupId = item.attribute_id.group.id;
				groups[groupId].attributes.push(item);
			}
		});

		// Sort the groups by their sort property
		return Object.values(groups)
			.sort((a, b) => {
				const sortA = a.group.sort ?? Infinity;
				const sortB = b.group.sort ?? Infinity;
				return sortA - sortB;
			})
			.map((group) => {
				// Sort the attributes within each group
				group.attributes.sort((a, b) => {
					const sortA = a.attribute_id.sort ?? Infinity;
					const sortB = b.attribute_id.sort ?? Infinity;
					return sortA - sortB;
				});
				return group;
			});
	});

	return {
		groupedAttributes,
	};
}
