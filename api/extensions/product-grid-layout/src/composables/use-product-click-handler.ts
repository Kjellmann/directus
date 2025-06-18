import { computed, inject, Ref } from 'vue';
import { useRouter } from 'vue-router';

export function useProductClickHandler(
  collection: Ref<string>,
  primaryKeyField: Ref<any>,
  selection: Ref<any[]>,
  selectMode: boolean,
  readonly: boolean
) {
  const router = useRouter();

  function onClick({ item, event }: { item: any; event: PointerEvent }) {
    console.log('[Product Click Handler] onClick called', { item, event, readonly, selectMode });
    
    if (readonly) return;

    const primaryKey = item[primaryKeyField.value?.field || 'id'];

    // If in select mode or items are already selected, toggle selection
    if (selectMode || selection.value.length > 0) {
      console.log('[Product Click Handler] In selection mode, toggling selection');
      
      const index = selection.value.indexOf(primaryKey);
      if (index === -1) {
        selection.value = [...selection.value, primaryKey];
      } else {
        selection.value = selection.value.filter(id => id !== primaryKey);
      }
      return;
    }

    // Otherwise navigate to the item
    const route = `/content/${collection.value}/${primaryKey}`;
    console.log('[Product Click Handler] Navigating to:', route);

    if (event.ctrlKey || event.metaKey) {
      // Open in new tab
      window.open(window.location.origin + route, '_blank');
    } else {
      // Navigate in current tab
      router.push(route);
    }
  }

  return { onClick };
}