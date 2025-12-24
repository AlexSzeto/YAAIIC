import { useState, useMemo, useCallback } from 'preact/hooks';

/**
 * Custom hook for pagination logic.
 * Manages current page state and derives the current page's data slice.
 * 
 * @param {Array} dataList - The full array of data to paginate
 * @param {number} itemsPerPage - Number of items per page (default: 32)
 * @returns {Object} Pagination state and controls
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
