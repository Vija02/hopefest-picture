/**
 * Custom hook for virtualized masonry grid layout
 * Based on https://github.com/sahvar/virtualized-masonry-gallery
 * Implements efficient rendering with known image dimensions
 */
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

export interface VirtualizedItem<T> {
  data: T;
  index: number;
  columnIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MasonryGridConfig {
  columnCount: number;
  columnGap: number;
  rowGap: number;
  containerWidth: number;
}

interface UseVirtualizedMasonryProps<T> {
  items: T[];
  containerRef: RefObject<HTMLDivElement>;
  /** Function to get the original width of an item */
  getItemWidth: (item: T) => number;
  /** Function to get the original height of an item */
  getItemHeight: (item: T) => number;
  /** Minimum column width - actual width will be calculated to fill container */
  columnWidth?: number;
  columnGap?: number;
  rowGap?: number;
  /** Buffer area above/below viewport in pixels */
  overscan?: number;
}

interface UseVirtualizedMasonryReturn<T> {
  visibleItems: VirtualizedItem<T>[];
  containerHeight: number;
  columnWidth: number;
  columnCount: number;
}

/**
 * Calculate the number of columns based on container width and minimum column width
 */
function calculateColumnCount(
  containerWidth: number,
  minColumnWidth: number,
  columnGap: number,
): number {
  if (containerWidth <= 0) return 1;
  // Calculate how many columns fit with minimum width
  const count = Math.floor(
    (containerWidth + columnGap) / (minColumnWidth + columnGap),
  );
  return Math.max(1, count);
}

/**
 * Calculate actual column width to fill container evenly
 */
function calculateColumnWidth(
  containerWidth: number,
  columnCount: number,
  columnGap: number,
): number {
  const totalGaps = columnGap * (columnCount - 1);
  return Math.floor((containerWidth - totalGaps) / columnCount);
}

/**
 * Main virtualization hook
 * Calculates masonry layout using known dimensions and returns only visible items
 */
export function useVirtualizedMasonry<T>({
  items,
  containerRef,
  getItemWidth,
  getItemHeight,
  columnWidth: minColumnWidth = 240,
  columnGap = 8,
  rowGap = 8,
  overscan = 500,
}: UseVirtualizedMasonryProps<T>): UseVirtualizedMasonryReturn<T> {
  const [gridConfig, setGridConfig] = useState<MasonryGridConfig>({
    columnCount: 3,
    columnGap,
    rowGap,
    containerWidth: 0,
  });

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  // Store all positioned items - use state to trigger re-renders
  const [allItems, setAllItems] = useState<VirtualizedItem<T>[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  /**
   * Calculate actual column width based on container and column count
   */
  const columnWidth = useMemo(() => {
    const { containerWidth, columnCount } = gridConfig;
    return calculateColumnWidth(containerWidth, columnCount, columnGap);
  }, [gridConfig, columnGap]);

  /**
   * Calculate masonry layout positions for all items
   * Uses greedy algorithm: place each item in shortest column
   */
  useEffect(() => {
    if (!items.length || columnWidth <= 0) {
      setAllItems([]);
      setContainerHeight(0);
      return;
    }

    const { columnCount } = gridConfig;
    const columnHeights = new Array(columnCount).fill(0);
    const positionedItems: VirtualizedItem<T>[] = [];

    items.forEach((item, index) => {
      // Find shortest column
      const shortestColumnIndex = columnHeights.indexOf(
        Math.min(...columnHeights),
      );

      // Calculate display height maintaining aspect ratio
      const originalWidth = getItemWidth(item);
      const originalHeight = getItemHeight(item);
      const aspectRatio = originalHeight / originalWidth;
      const displayHeight = Math.round(columnWidth * aspectRatio);

      // Calculate left position
      const left = shortestColumnIndex * (columnWidth + columnGap);

      // Create virtualized item
      const virtualizedItem: VirtualizedItem<T> = {
        data: item,
        index,
        columnIndex: shortestColumnIndex,
        left,
        top: columnHeights[shortestColumnIndex],
        width: columnWidth,
        height: displayHeight,
      };

      positionedItems.push(virtualizedItem);

      // Update column height
      columnHeights[shortestColumnIndex] += displayHeight + rowGap;
    });

    setAllItems(positionedItems);
    setContainerHeight(Math.max(...columnHeights) - rowGap);
  }, [
    items,
    columnWidth,
    gridConfig,
    columnGap,
    rowGap,
    getItemWidth,
    getItemHeight,
  ]);

  /**
   * Filter items to only those visible in viewport
   * Uses overscan buffer for smoother scrolling
   */
  const visibleItems = useMemo(() => {
    // Get container's offset from top of document
    const containerOffset =
      containerRef.current?.getBoundingClientRect().top ?? 0;
    const scrollOffset = window.scrollY ?? 0;
    const containerTop = containerOffset + scrollOffset;

    // Calculate viewport bounds relative to container
    const relativeScrollTop = scrollTop - containerTop;
    const viewportTop = relativeScrollTop - overscan;
    const viewportBottom = relativeScrollTop + viewportHeight + overscan;

    return allItems.filter((item) => {
      const itemBottom = item.top + item.height;
      return itemBottom >= viewportTop && item.top <= viewportBottom;
    });
  }, [scrollTop, viewportHeight, overscan, containerRef, allItems]);

  /**
   * Handle container resize using ResizeObserver
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateGridConfig = () => {
      const containerWidth = container.clientWidth;
      const columnCount = calculateColumnCount(
        containerWidth,
        minColumnWidth,
        columnGap,
      );

      setGridConfig((prev) => {
        if (
          prev.containerWidth === containerWidth &&
          prev.columnCount === columnCount
        ) {
          return prev;
        }
        return {
          columnCount,
          columnGap,
          rowGap,
          containerWidth,
        };
      });
    };

    // Initial measurement
    updateGridConfig();

    // Set up ResizeObserver for responsive updates
    resizeObserverRef.current = new ResizeObserver(() => {
      updateGridConfig();
    });

    resizeObserverRef.current.observe(container);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [containerRef, minColumnWidth, columnGap, rowGap]);

  /**
   * Track scroll position using RAF for smooth performance
   */
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }

      scrollRafRef.current = requestAnimationFrame(() => {
        const currentScrollTop =
          window.scrollY || document.documentElement.scrollTop;
        const currentViewportHeight = window.innerHeight;

        setScrollTop(currentScrollTop);
        setViewportHeight(currentViewportHeight);
      });
    };

    // Initial values
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);

      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  return {
    visibleItems,
    containerHeight,
    columnWidth,
    columnCount: gridConfig.columnCount,
  };
}
