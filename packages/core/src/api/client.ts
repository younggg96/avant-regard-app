import axios, { AxiosInstance } from "axios";
import {
  ApiResponse,
  Designer,
  BrandBranch,
  Lookbook,
  Look,
  Item,
  Listing,
  Note,
  FeedItem,
  FilterOptions,
} from "../types";
import { mockData } from "../mocks/seeds";

// Mock API Client for development
export class ApiClient {
  private client: AxiosInstance;
  private useMock: boolean = true;

  constructor(
    baseURL: string = "http://localhost:3000/api",
    useMock: boolean = true
  ) {
    this.useMock = useMock;
    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Designer endpoints
  async getDesigners(initial?: string): Promise<ApiResponse<Designer[]>> {
    if (this.useMock) {
      let designers = mockData.designers;
      if (initial) {
        designers = designers.filter(
          (d) => d.letterIndex === initial.toUpperCase()
        );
      }
      return { data: designers };
    }
    const response = await this.client.get("/designers", {
      params: { initial },
    });
    return response.data;
  }

  async getDesigner(id: string): Promise<ApiResponse<Designer>> {
    if (this.useMock) {
      const designer = mockData.designers.find((d) => d.id === id);
      if (!designer) throw new Error("Designer not found");
      return { data: designer };
    }
    const response = await this.client.get(`/designers/${id}`);
    return response.data;
  }

  // Brand Branch endpoints
  async getBrandBranches(
    designerId?: string
  ): Promise<ApiResponse<BrandBranch[]>> {
    if (this.useMock) {
      let branches = mockData.brandBranches;
      if (designerId) {
        branches = branches.filter((b) => b.designerId === designerId);
      }
      return { data: branches };
    }
    const response = await this.client.get("/branches", {
      params: { designerId },
    });
    return response.data;
  }

  // Lookbook endpoints
  async getLookbooks(filters?: {
    brandBranchId?: string;
    seasonId?: string;
  }): Promise<ApiResponse<Lookbook[]>> {
    if (this.useMock) {
      let lookbooks = mockData.lookbooks;
      if (filters?.brandBranchId) {
        lookbooks = lookbooks.filter(
          (l) => l.brandBranchId === filters.brandBranchId
        );
      }
      if (filters?.seasonId) {
        lookbooks = lookbooks.filter((l) => l.seasonId === filters.seasonId);
      }
      return { data: lookbooks };
    }
    const response = await this.client.get("/lookbooks", { params: filters });
    return response.data;
  }

  async getLookbook(id: string): Promise<ApiResponse<Lookbook>> {
    if (this.useMock) {
      const lookbook = mockData.lookbooks.find((l) => l.id === id);
      if (!lookbook) throw new Error("Lookbook not found");
      return { data: lookbook };
    }
    const response = await this.client.get(`/lookbooks/${id}`);
    return response.data;
  }

  // Look endpoints
  async getLooks(lookbookId?: string): Promise<ApiResponse<Look[]>> {
    if (this.useMock) {
      let looks = mockData.looks;
      if (lookbookId) {
        looks = looks.filter((l) => l.lookbookId === lookbookId);
      }
      return { data: looks };
    }
    const response = await this.client.get("/looks", {
      params: { lookbookId },
    });
    return response.data;
  }

  async getLook(
    id: string
  ): Promise<ApiResponse<Look & { items: Item[]; notes: Note[] }>> {
    if (this.useMock) {
      const look = mockData.looks.find((l) => l.id === id);
      if (!look) throw new Error("Look not found");
      const items = mockData.items.filter((i) => i.lookId === id);
      const notes = mockData.notes.filter(
        (n) => n.targetType === "look" && n.targetId === id
      );
      return { data: { ...look, items, notes } };
    }
    const response = await this.client.get(`/looks/${id}`);
    return response.data;
  }

  // Item endpoints
  async getItem(
    id: string
  ): Promise<ApiResponse<Item & { listings: Listing[]; notes: Note[] }>> {
    if (this.useMock) {
      const item = mockData.items.find((i) => i.id === id);
      if (!item) throw new Error("Item not found");
      const listings = mockData.listings.filter((l) => l.itemId === id);
      const notes = mockData.notes.filter(
        (n) => n.targetType === "item" && n.targetId === id
      );
      return { data: { ...item, listings, notes } };
    }
    const response = await this.client.get(`/items/${id}`);
    return response.data;
  }

  // Feed endpoint
  async getFeed(filters?: FilterOptions): Promise<ApiResponse<FeedItem[]>> {
    if (this.useMock) {
      // Simulate feed algorithm
      const feedItems: FeedItem[] = [];

      // Add recent lookbooks
      mockData.lookbooks.slice(0, 2).forEach((lookbook) => {
        feedItems.push({
          type: "lookbook",
          data: lookbook,
          timestamp: lookbook.date || new Date().toISOString(),
          engagement: {
            views: Math.floor(Math.random() * 10000),
            saves: Math.floor(Math.random() * 500),
            shares: Math.floor(Math.random() * 100),
          },
        });
      });

      // Add some looks
      mockData.looks.slice(0, 3).forEach((look) => {
        feedItems.push({
          type: "look",
          data: look,
          timestamp: new Date().toISOString(),
          engagement: {
            views: Math.floor(Math.random() * 5000),
            saves: Math.floor(Math.random() * 300),
            shares: Math.floor(Math.random() * 50),
          },
        });
      });

      // Add notes
      mockData.notes.forEach((note) => {
        feedItems.push({
          type: "note",
          data: note,
          timestamp: note.createdAt,
          engagement: {
            views: Math.floor(Math.random() * 2000),
            saves: Math.floor(Math.random() * 100),
            shares: Math.floor(Math.random() * 20),
          },
        });
      });

      // Sort by timestamp
      feedItems.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return {
        data: feedItems,
        meta: {
          page: 1,
          limit: 20,
          total: feedItems.length,
        },
      };
    }
    const response = await this.client.get("/feed", { params: filters });
    return response.data;
  }

  // Search endpoint
  async search(query: string): Promise<
    ApiResponse<{
      designers: Designer[];
      lookbooks: Lookbook[];
      items: Item[];
    }>
  > {
    if (this.useMock) {
      const lowerQuery = query.toLowerCase();
      return {
        data: {
          designers: mockData.designers.filter(
            (d) =>
              d.name.toLowerCase().includes(lowerQuery) ||
              d.aliases?.some((a) => a.toLowerCase().includes(lowerQuery))
          ),
          lookbooks: mockData.lookbooks.filter((l) =>
            l.title.toLowerCase().includes(lowerQuery)
          ),
          items: mockData.items.filter(
            (i) =>
              i.name.toLowerCase().includes(lowerQuery) ||
              i.description?.toLowerCase().includes(lowerQuery)
          ),
        },
      };
    }
    const response = await this.client.get("/search", { params: { q: query } });
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
