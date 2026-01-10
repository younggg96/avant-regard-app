import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack, VStack, Image, Pressable } from "../ui";
import { theme } from "../../theme";
import { Post } from "../PostCard";
import { styles } from "./styles";

interface PostContentSectionProps {
  post: Post;
}

export const PostContentSection: React.FC<PostContentSectionProps> = ({
  post,
}) => {
  return (
    <VStack
      px="$md"
      py="$md"
      space="md"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      {/* Title */}
      <Text fontSize="$xl" fontWeight="$bold" color="$black">
        {post.content?.title}
      </Text>

      {/* Description */}
      {post.content?.description && (
        <Text
          fontSize="$md"
          color="$gray800"
          lineHeight="$lg"
          style={{ letterSpacing: 0.3 }}
        >
          {post.content.description}
        </Text>
      )}

      {post.type === "article" && post.readTime && (
        <HStack space="xs" alignItems="center" mt="$xs">
          <Ionicons
            name="time-outline"
            size={16}
            color={theme.colors.gray600}
          />
          <Text fontSize="$sm" color="$gray600">
            {post.readTime}
          </Text>
        </HStack>
      )}

      {post.type === "review" && post.rating !== undefined && (
        <HStack space="xs" alignItems="center" mt="$xs">
          <Ionicons name="star" size={16} color={theme.colors.accent} />
          <Text fontSize="$sm" color="$gray800" fontWeight="$medium">
            评分: {post.rating}/5
          </Text>
        </HStack>
      )}
    </VStack>
  );
};

// 搭配单品组件
interface OutfitItemsSectionProps {
  items: Post["items"];
}

export const OutfitItemsSection: React.FC<OutfitItemsSectionProps> = ({
  items,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <VStack px="$md" py="$md" space="md">
      <VStack space="md" mt="$lg">
        <Text fontSize="$lg" fontWeight="$semibold" color="$black">
          搭配单品
        </Text>
        {items.map((item) => (
          <Pressable key={item.id}>
            <HStack
              space="md"
              p="$md"
              bg="$gray50"
              rounded="$md"
              alignItems="center"
            >
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              <VStack flex={1} space="xs">
                <Text fontSize="$md" fontWeight="$semibold" color="$black">
                  {item.name}
                </Text>
                <Text fontSize="$sm" color="$gray600">
                  {item.brand}
                </Text>
                <Text fontSize="$md" fontWeight="$bold" color="$accent">
                  {item.price}
                </Text>
              </VStack>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray400}
              />
            </HStack>
          </Pressable>
        ))}
      </VStack>
    </VStack>
  );
};
