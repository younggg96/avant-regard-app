import React, { useCallback } from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  HStack,
} from "../../../components/ui";
import { Community, CommunityListResponse } from "../../../services/communityService";
import { styles } from "../styles";

interface PopularCommunitiesProps {
  communities: CommunityListResponse | null;
}

/**
 * 热门社区组件
 * 显示热门社区的水平滚动列表
 */
export const PopularCommunities: React.FC<PopularCommunitiesProps> = ({
  communities,
}) => {
  const navigation = useNavigation();

  // 处理社区点击
  const handleCommunityPress = useCallback(
    (community: Community) => {
      (navigation.navigate as any)("CommunityDetail", { communityId: community.id });
    },
    [navigation]
  );

  // 处理查看全部点击
  const handleViewAll = useCallback(() => {
    (navigation.navigate as any)("AllCommunities");
  }, [navigation]);

  if (!communities?.popular || communities.popular.length === 0) {
    return null;
  }

  return (
    <Box py="$md" px="$md" bg="$white">
      <HStack justifyContent="space-between" alignItems="center" mb="$sm">
        <Text fontSize="$md" fontWeight="$semibold" color="$black">
          热门社区
        </Text>
        <Pressable onPress={handleViewAll}>
          <Text fontSize="$sm" color="$gray500">
            查看全部
          </Text>
        </Pressable>
      </HStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack gap="$md">
          {communities.popular.map((community: Community) => (
            <TouchableOpacity
              key={community.id}
              onPress={() => handleCommunityPress(community)}
              style={styles.communityButton}
            >
              <View style={styles.communityIcon}>
                {community.iconUrl ? (
                  <Image
                    source={{ uri: community.iconUrl }}
                    style={styles.communityImage}
                  />
                ) : (
                  <View style={styles.communityPlaceholder}>
                    <Text fontSize="$lg" fontWeight="$bold" color="$white">
                      {community.name.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                fontSize="$xs"
                color="$black"
                textAlign="center"
                numberOfLines={1}
                style={styles.communityName}
              >
                {community.name}
              </Text>
            </TouchableOpacity>
          ))}
        </HStack>
      </ScrollView>
    </Box>
  );
};

export default PopularCommunities;
