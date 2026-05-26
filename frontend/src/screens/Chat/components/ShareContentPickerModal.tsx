import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { useAuthStore } from "../../../store/authStore";

import type { ShareCategory } from "./SharePickerSheet";
import {
  PostSharePayload,
  StoreSharePayload,
  BrandSharePayload,
  ShowSharePayload,
  UserSharePayload,
  buildPostSharePayloadFromService,
  buildStoreSharePayload,
  buildBrandSharePayload,
  buildShowSharePayload,
  buildUserSharePayload,
} from "../../../components/ShareToChatModal";

import { Post as ServicePost } from "../../../services/postService";
import {
  getPostsByUserId,
  getLikedPostsByUserId,
  getFavoritePostsByUserId,
  searchPosts,
} from "../../../services/postService";
import {
  BuyerStore,
  getAllStores,
  searchStores,
} from "../../../services/buyerStoreService";
import { Brand, getBrands, searchBrands } from "../../../services/brandService";
import { Show, getShows, searchShows } from "../../../services/showService";
import {
  UserInfo,
  searchUsers,
} from "../../../services/userInfoService";
import {
  FollowingUser,
  getFollowingUsers,
} from "../../../services/followService";
import {
  Order,
  listMyOrders,
  formatOrderStatus,
} from "../../../services/orderService";
import { useFormatPrice } from "../../../utils/currency";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.6);


type PostTab = "published" | "favorite" | "liked";

const POST_TAB_KEYS: { key: PostTab; labelKey: string }[] = [
  { key: "published", labelKey: "chat.myPublished" },
  { key: "favorite", labelKey: "chat.myFavorites" },
  { key: "liked", labelKey: "chat.myLiked" },
];

/**
 * `order_status` 卡片由订单选择器构造，与 backend `_send_order_status_card`
 * 的 payload schema 一致（见 `TradingCards.tsx#OrderStatusCard`），客户端只填
 * 必要字段，富信息（product brief / shipment）由列表项里的现成 fallback 补足。
 */
export interface OrderStatusSharePayload {
  orderId: number;
  orderNo: string;
  status: string;
  paidPriceCents: number;
  currency?: string;
}

export type SharePayload =
  | { messageType: "post_card"; payload: PostSharePayload }
  | { messageType: "store_card"; payload: StoreSharePayload }
  | { messageType: "brand_card"; payload: BrandSharePayload }
  | { messageType: "show_card"; payload: ShowSharePayload }
  | { messageType: "user_card"; payload: UserSharePayload }
  | { messageType: "order_status"; payload: OrderStatusSharePayload };

interface ShareContentPickerModalProps {
  visible: boolean;
  category: ShareCategory | null;
  onClose: () => void;
  onSelect: (result: SharePayload) => void;
}

const CATEGORY_TITLE_KEY: Record<ShareCategory, string> = {
  post: "chat.selectPost",
  store: "chat.selectStore",
  brand: "chat.selectBrand",
  show: "chat.selectShow",
  user: "chat.selectUser",
  aftersales: "trading.aftersales.sheetTitle",
};

const CATEGORY_SEARCH_KEY: Record<ShareCategory, string> = {
  post: "chat.searchPost",
  store: "chat.searchStore",
  brand: "chat.searchBrand",
  show: "chat.searchShow",
  user: "chat.searchUser",
  aftersales: "chat.searchOrder",
};

export const ShareContentPickerModal: React.FC<ShareContentPickerModalProps> = ({
  visible,
  category,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.userId;
  const styles = useThemedStyles(makeStyles);

  const [postTab, setPostTab] = useState<PostTab>("published");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [users, setUsers] = useState<(UserInfo | FollowingUser)[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const reqIdRef = useRef(0);

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // Reset internal state on category change / open
  useEffect(() => {
    if (!visible || !category) return;
    setKeyword("");
    setPostTab("published");
  }, [visible, category]);

  // ---------- Data loading ----------
  const loadData = useCallback(async (searchKeyword?: string) => {
    if (!category) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const trimmed = (searchKeyword ?? "").trim();

      if (category === "post") {
        let list: ServicePost[] = [];
        if (trimmed.length > 0) {
          const result = await searchPosts(trimmed, 30);
          list = result.posts;
        } else if (currentUserId) {
          if (postTab === "published") {
            list = await getPostsByUserId(currentUserId, "PUBLISHED");
          } else if (postTab === "liked") {
            list = await getLikedPostsByUserId(currentUserId);
          } else {
            list = await getFavoritePostsByUserId(currentUserId);
          }
        }
        if (reqId === reqIdRef.current) setPosts(list);
      } else if (category === "store") {
        const list = trimmed
          ? await searchStores(trimmed, 30)
          : await getAllStores({ pageSize: 30 });
        if (reqId === reqIdRef.current) setStores(list);
      } else if (category === "brand") {
        const list = trimmed
          ? await searchBrands(trimmed, 30)
          : (await getBrands({ pageSize: 30 })).brands;
        if (reqId === reqIdRef.current) setBrands(list);
      } else if (category === "show") {
        const list = trimmed
          ? await searchShows(trimmed, 30)
          : (await getShows({ pageSize: 30 })).shows;
        if (reqId === reqIdRef.current) setShows(list);
      } else if (category === "user") {
        let list: (UserInfo | FollowingUser)[] = [];
        if (trimmed) {
          list = await searchUsers(trimmed, 30);
        } else if (currentUserId) {
          list = await getFollowingUsers(currentUserId);
        }
        if (reqId === reqIdRef.current) setUsers(list);
      } else if (category === "aftersales") {
        // 售后入口只列「我作为买家」的订单：客服需要的是协助买家维权，
        // 给客服看自己卖的订单意义不大（卖家自己的售后渠道是「我的销售」）。
        // 客户端不做关键词搜索；后端 list 接口也没有 fulltext，所以这里
        // 仅展示前 30 单按时间倒序，覆盖售后高发的近期窗口。
        const result = await listMyOrders({ page: 1, pageSize: 30 });
        const filtered = (result.items || []).filter((o) => {
          if (trimmed) {
            return (
              o.orderNo.toLowerCase().includes(trimmed.toLowerCase()) ||
              String(o.productId).includes(trimmed)
            );
          }
          return true;
        });
        if (reqId === reqIdRef.current) setOrders(filtered);
      }
    } catch (err) {
      console.error("ShareContentPickerModal load error:", err);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [category, postTab, currentUserId]);

  useEffect(() => {
    if (!visible || !category) return;
    loadData();
  }, [visible, category, postTab, loadData]);

  // ---------- Row renderers ----------
  const handleSelectPost = useCallback(
    (post: ServicePost) => {
      onSelect({
        messageType: "post_card",
        payload: buildPostSharePayloadFromService(post),
      });
    },
    [onSelect]
  );

  const handleSelectStore = useCallback(
    (store: BuyerStore) => {
      onSelect({
        messageType: "store_card",
        payload: buildStoreSharePayload(store),
      });
    },
    [onSelect]
  );

  const handleSelectBrand = useCallback(
    (brand: Brand) => {
      onSelect({
        messageType: "brand_card",
        payload: buildBrandSharePayload(brand),
      });
    },
    [onSelect]
  );

  const handleSelectShow = useCallback(
    (show: Show) => {
      onSelect({
        messageType: "show_card",
        payload: buildShowSharePayload({
          id: show.id,
          title: show.title || show.brand,
          season: show.season,
          year: show.year,
          coverImage: show.coverImage,
          brandName: show.brand,
          designer: show.designer,
          category: show.category,
        }),
      });
    },
    [onSelect]
  );

  const handleSelectUser = useCallback(
    (user: UserInfo | FollowingUser) => {
      onSelect({
        messageType: "user_card",
        payload: buildUserSharePayload(user as any),
      });
    },
    [onSelect]
  );

  const handleSelectOrder = useCallback(
    (order: Order) => {
      onSelect({
        messageType: "order_status",
        payload: {
          orderId: order.id,
          orderNo: order.orderNo,
          status: order.status,
          paidPriceCents: order.paidPriceCents,
          currency: order.currency,
        },
      });
    },
    [onSelect]
  );

  const renderPostItem = useCallback(
    ({ item }: { item: ServicePost }) => {
      const cover = item.imageUrls?.[0];
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectPost(item)}
        >
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {item.title || t("chat.noTitle")}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectPost]
  );

  const renderStoreItem = useCallback(
    ({ item }: { item: BuyerStore }) => {
      const cover = item.images?.[0];
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectStore(item)}
        >
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons
                name="storefront-outline"
                size={20}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {item.city}, {item.country}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectStore]
  );

  const renderBrandItem = useCallback(
    ({ item }: { item: Brand }) => {
      const cover = item.coverImage || item.coverImages?.[0];
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectBrand(item)}
        >
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={styles.thumbInitial}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {[item.country, item.category].filter(Boolean).join(" · ") || t("chat.brandLabel")}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectBrand]
  );

  const renderShowItem = useCallback(
    ({ item }: { item: Show }) => {
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectShow(item)}
        >
          {item.coverImage ? (
            <OptimizedImage
              uri={item.coverImage}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.brand} · {item.title || item.season}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {[item.season, item.year].filter(Boolean).join(" ")}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectShow]
  );

  const renderUserItem = useCallback(
    ({ item }: { item: UserInfo | FollowingUser }) => {
      const avatar =
        (item as UserInfo).avatarUrl ?? (item as FollowingUser).avatar;
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectUser(item)}
        >
          <UserAvatar uri={avatar} name={item.username} size={44} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.username}
            </Text>
            {item.bio || item.location ? (
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {[item.location, item.bio].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectUser]
  );

  const renderOrderItem = useCallback(
    ({ item }: { item: Order }) => {
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => handleSelectOrder(item)}
        >
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons
              name="receipt-outline"
              size={20}
              color={theme.colors.gray300}
            />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.orderNo}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {formatPrice(item.paidPriceCents, item.currency)} ·{" "}
              {formatOrderStatus(item.status)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectOrder, formatPrice]
  );

  const renderEmpty = useCallback(
    (keywordValue: string, noResultsText: string, emptyText: string) => (
      <View style={styles.center}>
        <Ionicons
          name="search-outline"
          size={32}
          color={theme.colors.gray200}
        />
        <Text style={styles.emptyText}>
          {keywordValue.trim() ? noResultsText : emptyText}
        </Text>
      </View>
    ),
    [styles]
  );

  // ---------- List to render ----------
  const list = useMemo(() => {
    if (!category) return null;
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.colors.gray300} />
        </View>
      );
    }

    if (category === "post") {
      if (!posts.length) return renderEmpty(keyword, t("search.noResults"), t("common.empty"));
      return (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPostItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    if (category === "store") {
      if (!stores.length) return renderEmpty(keyword, t("search.noResults"), t("common.empty"));
      return (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.id}
          renderItem={renderStoreItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    if (category === "brand") {
      if (!brands.length) return renderEmpty(keyword, t("search.noResults"), t("common.empty"));
      return (
        <FlatList
          data={brands}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBrandItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    if (category === "show") {
      if (!shows.length) return renderEmpty(keyword, t("search.noResults"), t("common.empty"));
      return (
        <FlatList
          data={shows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderShowItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    if (category === "user") {
      if (!users.length) return renderEmpty(keyword, t("search.noResults"), t("common.empty"));
      return (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.userId)}
          renderItem={renderUserItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    if (category === "aftersales") {
      if (!orders.length) return renderEmpty(keyword, t("search.noResults"), t("trading.orders.empty"));
      return (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          keyboardShouldPersistTaps="handled"
        />
      );
    }
    return null;
  }, [
    category,
    loading,
    keyword,
    posts,
    stores,
    brands,
    shows,
    users,
    orders,
    renderPostItem,
    renderStoreItem,
    renderBrandItem,
    renderShowItem,
    renderUserItem,
    renderOrderItem,
    renderEmpty,
    styles,
    t,
  ]);

  if (!category) return null;

  const title = t(CATEGORY_TITLE_KEY[category]);
  const placeholder = t(CATEGORY_SEARCH_KEY[category]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.container,
          { height: MODAL_HEIGHT, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={theme.colors.gray400} />
          </TouchableOpacity>
        </View>

        {category === "post" && !keyword.trim() && (
          <View style={styles.tabsRow}>
            {POST_TAB_KEYS.map((tab) => {
              const active = postTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setPostTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.colors.gray300} />
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.gray200}
            returnKeyType="search"
            onSubmitEditing={() => loadData(keyword)}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => { setKeyword(""); loadData(); }}>
              <Ionicons
                name="close-circle"
                size={16}
                color={theme.colors.gray300}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listContainer}>{list}</View>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.overlay,
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: t.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: t.colors.gray200,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.spacing.md,
    paddingVertical: 10,
  },
  title: {
    ...t.typography.h4,
    fontWeight: "600",
    color: t.colors.text,
  },
  closeBtn: {
    position: "absolute",
    right: t.spacing.md,
    top: 6,
    padding: 6,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: t.spacing.md,
    gap: 8,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: t.colors.gray50,
  },
  tabActive: {
    backgroundColor: t.colors.text,
  },
  tabText: {
    ...t.typography.caption,
    fontWeight: "500",
    color: t.colors.gray400,
  },
  tabTextActive: {
    color: t.colors.textInverted,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: t.spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: t.colors.gray50,
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    ...t.typography.bodySmall,
    color: t.colors.text,
    padding: 0,
  },
  listContainer: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: t.colors.gray100,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbInitial: {
    fontSize: 20,
    fontWeight: "300",
    color: t.colors.gray300,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...t.typography.bodySmall,
    fontWeight: "500",
    color: t.colors.text,
  },
  rowSubtitle: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: {
    ...t.typography.bodySmall,
    color: t.colors.gray300,
  },
});

export default ShareContentPickerModal;
