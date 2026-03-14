import { useState, useEffect } from 'react';

/**
 * useMenuConfig — resolves async menu configs for DataMenuAsync.
 *
 * If menuConfig.fetchItems exists, calls it on mount and manages loading state.
 * Otherwise, passes through items/sections directly with loading: false.
 *
 * @param {object} menuConfig - { items?, sections?, fetchItems?, loading?, loadingComponent? }
 * @returns {{ items: array, sections: array, loading: boolean, loadingComponent: ReactElement|undefined }}
 */
export default function useMenuConfig(menuConfig) {
  const [items, setItems] = useState(menuConfig.items || []);
  const [sections, setSections] = useState(menuConfig.sections || []);
  const [loading, setLoading] = useState(!!menuConfig.fetchItems);

  useEffect(() => {
    if (!menuConfig.fetchItems) return;
    setLoading(true);
    menuConfig.fetchItems().then((result) => {
      if (result.items) setItems(result.items);
      if (result.sections) setSections(result.sections);
      setLoading(false);
    });
  }, []);

  if (!menuConfig.fetchItems) {
    return {
      items: menuConfig.items || [],
      sections: menuConfig.sections || [],
      loading: menuConfig.loading || false,
      loadingComponent: menuConfig.loadingComponent,
    };
  }

  return {
    items,
    sections,
    loading,
    loadingComponent: menuConfig.loadingComponent,
  };
}
