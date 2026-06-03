export type ChatRouteParams = {
  Chat: {
    conversationId: number;
    otherUserName?: string;
    otherUserAvatar?: string;
    otherUserId?: number;
    /** offer 成交后从顶部提示进入时携带, 让 Chat 自动弹出收货地址表单。 */
    openShippingForOrderId?: number;
    shippingProductTitle?: string;
    shippingCoverImage?: string;
  };
};
