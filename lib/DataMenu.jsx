import React, { useState, useCallback } from 'react';
import useMenuConfig from './useMenuConfig.js';
import './dataMenu.css';

/**
 * Generic data-driven menu component (presentational).
 *
 * Props:
 *   menuConfig shape:
 *     items?           - MenuItem[]              — ungrouped items rendered first
 *     sections?        - Section[]               — grouped sections rendered after items
 *     loading?         - boolean                 — show loading indicator
 *     loadingComponent - ReactElement            — custom spinner replacement
 *
 *   Section  shape: { name: string, items: MenuItem[] }
 *   MenuItem shape: { label: string, onClick: () => void, icon?: ReactElement }
 *
 *   onClose - () => void — called when an item is clicked
 */
export default function DataMenu({ menuConfig, onClose }) {
  const items = menuConfig.items || [];
  const sections = menuConfig.sections || [];
  const loading = menuConfig.loading || false;
  const [search, setSearch] = useState('');

  const handleItemClick = useCallback((item) => {
    if (item.onClick) item.onClick();
    if (onClose) onClose();
  }, [onClose]);

  const stopEvent = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // Filter by search
  const searchLower = search.toLowerCase();
  const matchItem = (item) => item.label.toLowerCase().indexOf(searchLower) !== -1;

  const filteredItems = search ? items.filter(matchItem) : items;
  const filteredSections = search
    ? sections
        .map((sec) => ({ ...sec, items: sec.items.filter(matchItem) }))
        .filter((sec) => sec.items.length > 0)
    : sections;

  const hasResults = filteredItems.length > 0 || filteredSections.length > 0;
  const isEmpty = items.length === 0 && sections.length === 0;

  return (
    <div className="eq-data-menu" onClick={stopEvent} onMouseDown={stopEvent} onWheelCapture={stopEvent}>
      <input
        className="eq-data-menu-search"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClick={stopEvent}
        onMouseDown={stopEvent}
        onKeyDown={stopEvent}
        autoFocus
      />
      <div className="eq-data-menu-items">
        {loading && isEmpty && (
          menuConfig.loadingComponent || (
            <div className="eq-data-menu-loading">
              <div className="eq-data-menu-spinner" />
            </div>
          )
        )}

        {filteredItems.map((item, idx) => (
          <div
            key={`u-${idx}`}
            className="eq-data-menu-item"
            onClick={() => handleItemClick(item)}
          >
            {item.icon && item.icon}
            {item.label}
          </div>
        ))}

        {filteredSections.map((sec) => (
          <React.Fragment key={`s-${sec.name}`}>
            <div className="eq-data-menu-section-header">{sec.name}</div>
            {sec.items.map((item, idx) => (
              <div
                key={`${sec.name}-${idx}`}
                className="eq-data-menu-item"
                onClick={() => handleItemClick(item)}
              >
                {item.icon && item.icon}
                {item.label}
              </div>
            ))}
          </React.Fragment>
        ))}

        {!loading && !hasResults && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: '#999' }}>
            No items found
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DataMenuAsync — resolves fetchItems via useMenuConfig, then renders DataMenu.
 *
 * Use this when menuConfig may contain fetchItems.
 * DataMenu itself is now purely presentational.
 */
export function DataMenuAsync({ menuConfig, onClose }) {
  const resolved = useMenuConfig(menuConfig);
  return <DataMenu menuConfig={resolved} onClose={onClose} />;
}
