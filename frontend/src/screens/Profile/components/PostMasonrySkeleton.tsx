import React from "react";
import { View } from "react-native";

import { HStack, VStack } from "../../../components/ui";
import { SkeletonPostCard, useSkeletonAnimation } from "../../Discover/components/SkeletonPostCard";

interface PostMasonrySkeletonProps {
  count?: number;
}

export const PostMasonrySkeleton: React.FC<PostMasonrySkeletonProps> = ({
  count = 4,
}) => {
  const { skeletonOpacity } = useSkeletonAnimation();
  const leftIndices = Array.from({ length: count }, (_, i) => i).filter(
    (i) => i % 2 === 0,
  );
  const rightIndices = Array.from({ length: count }, (_, i) => i).filter(
    (i) => i % 2 === 1,
  );

  return (
    <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
      <VStack flex={1} space="sm">
        {leftIndices.map((i) => (
          <SkeletonPostCard key={i} opacity={skeletonOpacity} />
        ))}
      </VStack>
      <VStack flex={1} space="sm">
        {rightIndices.map((i) => (
          <SkeletonPostCard key={i} opacity={skeletonOpacity} />
        ))}
      </VStack>
    </HStack>
  );
};

export default PostMasonrySkeleton;
