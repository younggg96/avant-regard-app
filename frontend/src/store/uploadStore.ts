import { create } from "zustand";
import {
  postService,
  CreatePostParams,
  UpdatePostParams,
} from "../services/postService";

export type UploadStatus = "idle" | "uploading" | "publishing" | "success" | "error";

export interface UploadTask {
  id: string;
  status: UploadStatus;
  progress: number;
  title: string;
  thumbnailUri: string | null;
  errorMessage: string | null;
  createdAt: number;
}

interface UploadPayload {
  title: string;
  thumbnailUri: string | null;
  localMediaUris: string[];
  imageMapping: Record<string, string>;
  allImages: string[];
  createParams: Omit<CreatePostParams, "imageUrls"> & { imageUrls?: string[] };
  updateParams?: { postId: number; params: Omit<UpdatePostParams, "imageUrls"> & { imageUrls?: string[] } };
  contentBlocks?: any[];
  coverImageKey?: string | null;
}

interface UploadStore {
  currentTask: UploadTask | null;
  startUpload: (payload: UploadPayload) => void;
  dismissTask: () => void;
  retryUpload: () => void;
  _lastPayload: UploadPayload | null;
}

const generateTaskId = () => `upload_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export const useUploadStore = create<UploadStore>((set, get) => ({
  currentTask: null,
  _lastPayload: null,

  startUpload: (payload: UploadPayload) => {
    const taskId = generateTaskId();
    set({
      currentTask: {
        id: taskId,
        status: "uploading",
        progress: 0,
        title: payload.title,
        thumbnailUri: payload.thumbnailUri,
        errorMessage: null,
        createdAt: Date.now(),
      },
      _lastPayload: payload,
    });

    executeUpload(payload, taskId);
  },

  dismissTask: () => {
    set({ currentTask: null, _lastPayload: null });
  },

  retryUpload: () => {
    const { _lastPayload } = get();
    if (_lastPayload) {
      get().startUpload(_lastPayload);
    }
  },
}));

async function executeUpload(payload: UploadPayload, taskId: string) {
  const {
    localMediaUris,
    imageMapping,
    allImages,
    createParams,
    updateParams,
    contentBlocks,
    coverImageKey,
  } = payload;

  const store = useUploadStore;

  try {
    const uploadedMapping = { ...imageMapping };
    const totalLocal = localMediaUris.length;

    if (totalLocal > 0) {
      for (let i = 0; i < localMediaUris.length; i++) {
        const uri = localMediaUris[i];
        const uploadedUrl = await postService.uploadMedia(uri, (filePercent) => {
          const overall = Math.round((i * 100 + filePercent) / totalLocal);
          const progress = Math.min(overall, 95);
          const current = store.getState().currentTask;
          if (current?.id === taskId) {
            store.setState({
              currentTask: { ...current, progress, status: "uploading" },
            });
          }
        });
        uploadedMapping[uri] = uploadedUrl;

        const current = store.getState().currentTask;
        if (current?.id !== taskId) return;
      }
    }

    const current = store.getState().currentTask;
    if (current?.id !== taskId) return;
    store.setState({
      currentTask: { ...current, status: "publishing", progress: 98 },
    });

    let finalImageUrls: string[];
    if (contentBlocks) {
      const updatedBlocks = contentBlocks.map((block: any) => {
        if (block.type === "image" && uploadedMapping[block.content]) {
          return { ...block, content: uploadedMapping[block.content] };
        }
        return block;
      });
      const contentText = JSON.stringify(updatedBlocks);
      const finalCover = coverImageKey
        ? uploadedMapping[coverImageKey] || coverImageKey
        : null;

      if (updateParams) {
        await postService.updatePost(updateParams.postId, {
          ...updateParams.params,
          contentText,
          imageUrls: finalCover ? [finalCover] : [],
        } as UpdatePostParams);
      } else {
        await postService.createPost({
          ...createParams,
          contentText,
          imageUrls: finalCover ? [finalCover] : [],
        } as CreatePostParams);
      }
    } else {
      finalImageUrls = allImages.map((uri) => uploadedMapping[uri] || uri);
      if (updateParams) {
        await postService.updatePost(updateParams.postId, {
          ...updateParams.params,
          imageUrls: finalImageUrls,
        } as UpdatePostParams);
      } else {
        await postService.createPost({
          ...createParams,
          imageUrls: finalImageUrls,
        } as CreatePostParams);
      }
    }

    const latest = store.getState().currentTask;
    if (latest?.id === taskId) {
      store.setState({
        currentTask: { ...latest, status: "success", progress: 100 },
      });

      setTimeout(() => {
        const check = store.getState().currentTask;
        if (check?.id === taskId && check?.status === "success") {
          store.setState({ currentTask: null, _lastPayload: null });
        }
      }, 3000);
    }
  } catch (error) {
    const latest = store.getState().currentTask;
    if (latest?.id === taskId) {
      store.setState({
        currentTask: {
          ...latest,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "发布失败，请重试",
        },
      });
    }
  }
}
