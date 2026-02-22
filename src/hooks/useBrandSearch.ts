import { useState, useCallback, useRef, useEffect } from "react";
import { brandService, Brand } from "../services/brandService";

const BRAND_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface UseBrandSearchReturn {
  brands: Brand[];
  searchQuery: string;
  isLoading: boolean;
  hasMore: boolean;
  setSearchQuery: (query: string) => void;
  loadMore: () => void;
  reload: () => void;
}

export function useBrandSearch(): UseBrandSearchReturn {
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [searchResults, setSearchResults] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingMoreRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBrands = useCallback(
    async (reset: boolean = true) => {
      if (isLoadingMoreRef.current && !reset) return;

      try {
        if (reset) {
          setIsLoadingList(true);
          setPage(1);
          setHasMore(true);
        }
        isLoadingMoreRef.current = true;

        const targetPage = reset ? 1 : page;
        const response = await brandService.getBrands({
          page: targetPage,
          pageSize: BRAND_PAGE_SIZE,
        });

        if (reset) {
          setAllBrands(response.brands);
          setPage(1);
        } else {
          setAllBrands((prev) => [...prev, ...response.brands]);
        }

        setHasMore(response.brands.length >= BRAND_PAGE_SIZE);
      } catch (error) {
        console.error("Failed to load brands:", error);
      } finally {
        setIsLoadingList(false);
        isLoadingMoreRef.current = false;
      }
    },
    [page]
  );

  const loadMore = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore || isLoadingList || searchQuery.trim()) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingList(true);

    const nextPage = page + 1;
    brandService
      .getBrands({ page: nextPage, pageSize: BRAND_PAGE_SIZE })
      .then((response) => {
        if (response.brands.length > 0) {
          setAllBrands((prev) => [...prev, ...response.brands]);
          setPage(nextPage);
          setHasMore(response.brands.length >= BRAND_PAGE_SIZE);
        } else {
          setHasMore(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load more brands:", error);
      })
      .finally(() => {
        setIsLoadingList(false);
        isLoadingMoreRef.current = false;
      });
  }, [page, hasMore, isLoadingList, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await brandService.searchBrands(query, 30);
        setSearchResults(results);
      } catch (error) {
        console.error("Failed to search brands:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    loadBrands(true);
  }, []);

  const isSearchActive = !!searchQuery.trim();
  const brands = isSearchActive ? searchResults : allBrands;
  const isLoading = isSearchActive ? isSearching : isLoadingList;

  return {
    brands,
    searchQuery,
    isLoading,
    hasMore: isSearchActive ? false : hasMore,
    setSearchQuery,
    loadMore,
    reload: () => loadBrands(true),
  };
}
