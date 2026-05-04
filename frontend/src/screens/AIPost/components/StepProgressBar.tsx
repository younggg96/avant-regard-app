/**
 * AI 发帖助手问答的底部进度条 (步数由 props.total 驱动)。
 * 当前步数实色,后续灰色。
 */

import React from "react";
import { Box, HStack } from "../../../components/ui";

interface StepProgressBarProps {
  current: number;
  total: number;
}

const StepProgressBar: React.FC<StepProgressBarProps> = ({ current, total }) => {
  return (
    <HStack px="$lg" py="$md" gap={6}>
      {Array.from({ length: total }).map((_, idx) => {
        const filled = idx < current;
        return (
          <Box
            key={idx}
            flex={1}
            h={3}
            rounded={2}
            bg={filled ? "$black" : "$gray100"}
          />
        );
      })}
    </HStack>
  );
};

export default StepProgressBar;
