import { useState, useCallback, useRef, useEffect } from "react";
import { brandService, Brand } from "../services/brandService";

const BRAND_PAGE_SIZE = 30;

interface UseBrandSearchReturn {
  brands: Brand[];
  searchQuery: string;
  isLoading: boolean;
  hasMore: boolean;
  setSearchQuery: (query: string) => void;
  search: () => void;
  loadMore: () => void;
  reload: () => void;
}

export function useBrandSearch(): UseBrandSearchReturn {
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [searchResults, setSearchResults] = useState<Brand[]>([]);
  const [searchQuery, setSearchQueryState] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingMoreRef = useRef(false);
  const searchQueryRef = useRef("");

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    searchQueryRef.current = query;
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, []);

  const search = useCallback(async () => {
    const query = searchQueryRef.current.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await brandService.searchBrands(query, 30);
      setSearchResults(results);
    } catch (error) {
      console.error("Failed to search brands:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

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
    if (isLoadingMoreRef.current || !hasMore || isLoadingList || searchQueryRef.current.trim()) {
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
  }, [page, hasMore, isLoadingList]);

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
    search,
    loadMore,
    reload: () => loadBrands(true),
  };
}
