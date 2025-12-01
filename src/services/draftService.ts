import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ReviewDraft {
  id: string;
  type: "ITEM_REVIEW";
  title: string;
  productName: string;
  brand: string;
  rating: number;
  reviewText: string;
  images: string[];
  associatedLooks: Array<{
    designer: string;
    season: string;
    imageUrl: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const DRAFT_STORAGE_KEY = "@avant_regard_drafts";

// 获取所有草稿
export const getAllDrafts = async (): Promise<ReviewDraft[]> => {
  try {
    const draftsJson = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
    if (draftsJson) {
      return JSON.parse(draftsJson);
    }
    return [];
  } catch (error) {
    console.error("Error getting drafts:", error);
    return [];
  }
};

// 保存草稿
export const saveDraft = async (
  draft: Omit<ReviewDraft, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const drafts = await getAllDrafts();
    const now = new Date().toISOString();

    const newDraft: ReviewDraft = {
      ...draft,
      id: `draft_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    drafts.push(newDraft);
    await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));

    return newDraft.id;
  } catch (error) {
    console.error("Error saving draft:", error);
    throw error;
  }
};

// 更新草稿
export const updateDraft = async (
  draftId: string,
  updates: Partial<Omit<ReviewDraft, "id" | "createdAt">>
): Promise<void> => {
  try {
    const drafts = await getAllDrafts();
    const draftIndex = drafts.findIndex((d) => d.id === draftId);

    if (draftIndex === -1) {
      throw new Error("Draft not found");
    }

    drafts[draftIndex] = {
      ...drafts[draftIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Error updating draft:", error);
    throw error;
  }
};

// 删除草稿
export const deleteDraft = async (draftId: string): Promise<void> => {
  try {
    const drafts = await getAllDrafts();
    const filteredDrafts = drafts.filter((d) => d.id !== draftId);
    await AsyncStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify(filteredDrafts)
    );
  } catch (error) {
    console.error("Error deleting draft:", error);
    throw error;
  }
};

// 获取单个草稿
export const getDraft = async (
  draftId: string
): Promise<ReviewDraft | null> => {
  try {
    const drafts = await getAllDrafts();
    return drafts.find((d) => d.id === draftId) || null;
  } catch (error) {
    console.error("Error getting draft:", error);
    return null;
  }
};
