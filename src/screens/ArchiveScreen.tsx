import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  designerService,
  DesignerDetailDto,
} from "../services/designerService";

// 转换后的设计师类型
interface Designer {
  id: number;
  name: string;
  brand: string;
  collections: number;
  shows: number;
  totalLooks: number;
  latestSeason: string;
  designerUrl: string; // vogue.com 链接
}

const ArchiveScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch designers data from API
  const fetchDesigners = async () => {
    try {
      setLoading(true);
      setError(null);

      const allDesigners = await designerService.getAllDesignerDetails();
      // Convert API data to Designer format
      const convertedDesigners = allDesigners.map((data: DesignerDetailDto) => {
        // Extract brand and designer name from the name string
        const brandMatch = data.name.match(/^([^(]+?)(?:\s*\(|$)/);
        const designerMatch = data.name.match(/\(([^)]+)\)$/);

        const brand = designerMatch
          ? designerMatch[1]
          : brandMatch?.[1]?.trim() || data.name;
        const name = brandMatch?.[1]?.trim() || data.name;

        return {
          id: data.id,
          name: name,
          brand: brand,
          collections: data.showCount,
          shows: data.showCount,
          totalLooks: data.totalImages,
          latestSeason: data.latestSeason || "Unknown",
          designerUrl: data.designerUrl,
        };
      });

      setDesigners(convertedDesigners);
    } catch (err) {
      console.error("Failed to fetch designers:", err);
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
  }, [retryCount]);

  // Filter designers by search query
  const filteredDesigners = designers.filter((designer) => {
    const matchesSearch =
      designer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      designer.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group designers by first letter
  const groupedDesigners = filteredDesigners.reduce((groups, designer) => {
    const firstLetter = designer.name.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(designer);
    return groups;
  }, {} as Record<string, Designer[]>);

  // Sort groups alphabetically
  const sortedGroups = Object.keys(groupedDesigners)
    .sort()
    .map((letter) => ({
      letter,
      designers: groupedDesigners[letter].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));

  // 骨架屏动画
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [loading, shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // 骨架屏组件
  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.gray200,
          borderRadius: 4,
          opacity: skeletonOpacity,
        },
        style,
      ]}
    />
  );

  // 渲染骨架屏
  const renderSkeleton = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {["A", "B", "C", "D", "E"].map((letter) => (
        <View key={letter}>
          {/* Letter Header Skeleton */}
          <View style={styles.letterHeader}>
            <SkeletonBox width={20} height={14} />
          </View>

          {/* Designer Items Skeleton */}
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.designerItem}>
              {/* Image Skeleton */}
              <Animated.View
                style={[
                  styles.designerImage,
                  {
                    backgroundColor: theme.colors.gray200,
                    opacity: skeletonOpacity,
                  },
                ]}
              />

              {/* Info Skeleton */}
              <View style={styles.designerInfo}>
                <SkeletonBox
                  width={120}
                  height={20}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBox
                  width={80}
                  height={16}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBox
                  width={140}
                  height={14}
                  style={{ marginBottom: 4 }}
                />
                <SkeletonBox width={100} height={12} />
              </View>

              {/* Arrow Skeleton */}
              <SkeletonBox width={16} height={16} style={{ borderRadius: 8 }} />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="DESIGNERS"
        subtitle="探索时装界的传奇人物"
        boldTitle={true}
        borderless
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.gray400}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索设计师..."
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Loading State (Skeleton) */}
      {loading && renderSkeleton()}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.gray400}
          />
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setRetryCount((prev) => prev + 1);
            }}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Designers List */}
      {!loading && !error && (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {sortedGroups.map((group) => (
            <View key={group.letter}>
              {/* Letter Header */}
              <View style={styles.letterHeader}>
                <Text style={styles.letterText}>{group.letter}</Text>
              </View>

              {/* Designers in this group */}
              {group.designers.map((designer) => (
                <TouchableOpacity
                  key={designer.id}
                  style={styles.designerItem}
                  onPress={() => {
                    (navigation.navigate as any)("DesignerDetail", {
                      id: designer.id.toString(),
                      name: designer.name,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.designerInfo}>
                    <Text style={styles.designerName}>{designer.name}</Text>
                    <Text style={styles.designerBrand}>{designer.brand}</Text>
                    <Text style={styles.designerMeta}>
                      {designer.shows} 场秀 • {designer.totalLooks} 个造型
                    </Text>
                    <Text style={styles.designerSeason}>
                      最新: {designer.latestSeason}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.gray400}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {filteredDesigners.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="person-outline"
                size={48}
                color={theme.colors.gray400}
              />
              <Text style={styles.emptyTitle}>未找到设计师</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? "没有匹配的设计师" : "设计师列表正在更新中"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  searchContainer: {
    padding: theme.spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    paddingVertical: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: theme.spacing.lg,
  },
  letterHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
  },
  letterText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.gray400,
    letterSpacing: 1,
  },
  designerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  designerImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
  },
  designerImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  designerImagePlaceholderText: {
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.gray500,
  },
  designerInfo: {
    flex: 1,
  },
  designerName: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: "400",
    color: theme.colors.black,
    marginBottom: 2,
  },
  designerBrand: {
    ...theme.typography.bodySmall,
    fontSize: 14,
    color: theme.colors.gray500,
    marginBottom: 2,
  },
  designerMeta: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  designerSeason: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray500,
    fontStyle: "italic",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray500,
    marginTop: theme.spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  errorTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  retryButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
  },
});

export default ArchiveScreen;
