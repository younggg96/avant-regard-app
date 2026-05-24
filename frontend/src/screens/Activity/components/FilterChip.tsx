import React from "react";
import { AnimatedChip, type AnimatedChipProps } from "../../../components/ui";

export type FilterChipProps = Pick<
  AnimatedChipProps,
  "label" | "isActive" | "onPress" | "count" | "showZeroCount"
>;

export const FilterChip = (props: FilterChipProps) => (
  <AnimatedChip {...props} />
);
