import { useState, useMemo, useCallback } from 'preact/hooks';

/**
 * Custom hook for pagination logic.
 * Manages current page state and derives the current page's data slice.
 * 
 * @param {Array} dataList - The full array of data to paginate
 * @param {number} [itemsPerPage=32] - Number of items per page
 * @returns {Object} Pagination state and controls
 * @returns {number} returns.currentPage - Current page index (0-based, auto-clamped to valid range)
 * @returns {number} returns.totalPages - Total number of pages
 * @returns {Array} returns.currentPageData - Data slice for the current page
 * @returns {number} returns.itemsPerPage - Items per page (echoes input parameter)
 * @returns {number} returns.totalItems - Total number of items in dataList
 * @returns {boolean} returns.hasMultiplePages - True if there is more than one page
 * @returns {boolean} returns.isFirstPage - True if currently on the first page
 * @returns {boolean} returns.isLastPage - True if currently on the last page
 * @returns {function(number): void} returns.goToPage - Navigate to specific page (auto-clamped)
 * @returns {function(): void} returns.goToNext - Navigate to next page
 * @returns {function(): void} returns.goToPrev - Navigate to previous page
 * @returns {function(): void} returns.goToFirst - Navigate to first page
 * @returns {function(): void} returns.goToLast - Navigate to last page
 * 
 * @example
 * const { currentPageData, currentPage, totalPages, goToNext, goToPrev } = usePagination(items, 10);
 * // currentPageData contains items 0-9 for page 0, 10-19 for page 1, etc.
 */
export function usePagination(dataList, itemsPerPage = 32) {
  const [currentPage, setCurrentPage] = useState(0);
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(dataList.length / itemsPerPage));
  
  // Auto-adjust page if data shrinks (e.g., after filtering)
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  
  // Sync internal page if it was clamped
  if (safePage !== currentPage) {
    setCurrentPage(safePage);
  }
  
  // Derive current page data
  const currentPageData = useMemo(() => {
    const start = safePage * itemsPerPage;
    return dataList.slice(start, start + itemsPerPage);
  }, [dataList, safePage, itemsPerPage]);
  
  // Navigation functions
  const goToPage = useCallback((page) => {
    const clamped = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(clamped);
  }, [totalPages]);
  
  const goToNext = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);
  
  const goToPrev = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 0));
  }, []);
  
  const goToFirst = useCallback(() => {
    setCurrentPage(0);
  }, []);
  
  const goToLast = useCallback(() => {
    setCurrentPage(totalPages - 1);
  }, [totalPages]);
  
  return {
    currentPage: safePage,
    totalPages,
    currentPageData,
    itemsPerPage,
    totalItems: dataList.length,
    hasMultiplePages: totalPages > 1,
    isFirstPage: safePage === 0,
    isLastPage: safePage === totalPages - 1,
    goToPage,
    goToNext,
    goToPrev,
    goToFirst,
    goToLast,
  };
}
