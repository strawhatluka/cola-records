import React, { useRef, useEffect } from 'react';
import { Group } from 'react-resizable-panels';
import type { GroupProps } from 'react-resizable-panels';

/**
 * Wrapper for react-resizable-panels Group that removes invalid aria-orientation
 * attributes to comply with WCAG 2.1 AA standards.
 *
 * The library adds aria-orientation to divs without proper ARIA roles,
 * which violates accessibility requirements. This wrapper removes those
 * attributes after mount.
 */
export function ResizablePanelGroup(props: GroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remove invalid aria-orientation from the Group's rendered div
    const removeInvalidAria = () => {
      if (containerRef.current) {
        const groupDiv = containerRef.current.querySelector('[data-group="true"]');
        if (groupDiv) {
          groupDiv.removeAttribute('aria-orientation');
        }
      }
    };

    // Run after initial render and after any updates
    removeInvalidAria();

    // Use MutationObserver to catch any dynamic additions
    const observer = new MutationObserver(removeInvalidAria);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-orientation']
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      <Group {...props} />
    </div>
  );
}
