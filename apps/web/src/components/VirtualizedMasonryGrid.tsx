/**
 * VirtualizedMasonryGrid Component
 * A performant masonry grid using known image dimensions
 * Only renders items visible in the viewport
 */
import { Box } from "@chakra-ui/react";
import { type ReactNode, useRef } from "react";

import {
  type VirtualizedItem,
  useVirtualizedMasonry,
} from "../hooks/useVirtualizedMasonry";

interface VirtualizedMasonryGridProps<T> {
  items: T[];
  /** Function to get the original width of an item */
  getItemWidth: (item: T) => number;
  /** Function to get the original height of an item */
  getItemHeight: (item: T) => number;
  /** Render function for each item */
  render: (props: {
    item: T;
    index: number;
    width: number;
    height: number;
  }) => ReactNode;
  /** Function to generate a unique key for each item */
  itemKey?: (item: T, index: number) => string | number;
  /** Minimum column width - actual width will be calculated to fill container */
  columnWidth?: number;
  /** Horizontal gap between columns */
  columnGap?: number;
  /** Vertical gap between rows */
  rowGap?: number;
  /** Buffer area above/below viewport in pixels for pre-rendering */
  overscan?: number;
}

export function VirtualizedMasonryGrid<T>({
  items,
  getItemWidth,
  getItemHeight,
  render,
  itemKey = (_item, index) => index,
  columnWidth = 240,
  columnGap = 8,
  rowGap = 8,
  overscan = 500,
}: VirtualizedMasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    visibleItems,
    containerHeight,
    columnWidth: actualColumnWidth,
  } = useVirtualizedMasonry({
    items,
    containerRef,
    getItemWidth,
    getItemHeight,
    columnWidth,
    columnGap,
    rowGap,
    overscan,
  });

  return (
    <Box ref={containerRef} position="relative" width="100%">
      <Box position="relative" width="100%" height={`${containerHeight}px`}>
        {visibleItems.map((virtualItem: VirtualizedItem<T>) => (
          <Box
            key={itemKey(virtualItem.data, virtualItem.index)}
            position="absolute"
            left={`${virtualItem.left}px`}
            top={`${virtualItem.top}px`}
            width={`${virtualItem.width}px`}
            height={`${virtualItem.height}px`}
            // CSS containment for better performance
            style={{ contain: "layout style paint" }}
          >
            {render({
              item: virtualItem.data,
              index: virtualItem.index,
              width: actualColumnWidth,
              height: virtualItem.height,
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
