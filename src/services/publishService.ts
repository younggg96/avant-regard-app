// 发布服务 - 模拟API调用

export interface PublishReviewData {
  type: "review";
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
}

export interface PublishResponse {
  success: boolean;
  postId?: string;
  message?: string;
}

// 模拟发布评价的API调用
export const publishReview = async (
  data: PublishReviewData
): Promise<PublishResponse> => {
  try {
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 这里应该是实际的API调用
    // const response = await fetch('YOUR_API_ENDPOINT/reviews', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${token}`,
    //   },
    //   body: JSON.stringify(data),
    // });

    // 模拟成功响应
    const postId = `review_${Date.now()}`;

    console.log("Publishing review:", {
      ...data,
      postId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      postId,
      message: "评价发布成功",
    };
  } catch (error) {
    console.error("Error publishing review:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "发布失败，请重试",
    };
  }
};

// 验证发布数据
export const validateReviewData = (
  data: PublishReviewData
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push("请填写评价标题");
  }

  if (!data.productName || data.productName.trim().length === 0) {
    errors.push("请填写产品名称");
  }

  if (data.rating === 0) {
    errors.push("请给出评分");
  }

  if (!data.images || data.images.length === 0) {
    errors.push("请至少上传一张产品图片");
  }

  if (!data.associatedLooks || data.associatedLooks.length === 0) {
    errors.push("请至少关联一个相关造型");
  }

  if (!data.reviewText || data.reviewText.trim().length === 0) {
    errors.push("请填写评价内容");
  } else if (data.reviewText.trim().length < 10) {
    errors.push("评价内容至少需要10个字");
  } else if (data.reviewText.trim().length > 500) {
    errors.push("评价内容不能超过500个字");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
