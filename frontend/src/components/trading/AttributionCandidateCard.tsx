/**
 * AttributionCandidateCard —— 数字护照 5.2 的 AI 候选卡。
 *
 * 展示「品牌 + 系列 + 年份 + 匹配证据」，用户点一下就采纳。
 *
 * 证据分两种，措辞必须区分开，不能都说成「匹配依据」：
 *   - matchSource === "reference_images"：真的拿参照图逐张比对过，
 *     可以理直气壮地说「N 张参照图中 M 张一致」。
 *   - 其它：证据来自模型对可见特征的推理，只能说「识别到的特征」。
 *     参照图库目前还是空的，所以现在走的都是这一支。
 */
import React from "react";
import { View, Text as RNText, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Pressable } from "../ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import type { AttributionCandidate } from "../../services/passportService";

interface Props {
  candidate: AttributionCandidate;
  selected?: boolean;
  onPress: () => void;
}

const AttributionCandidateCard: React.FC<Props> = ({
  candidate,
  selected = false,
  onPress,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const hasRefMatch =
    candidate.matchSource === "reference_images" &&
    candidate.matchedRefs != null &&
    candidate.totalRefs != null;

  const subtitle = [candidate.season, candidate.year ? `${candidate.year}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <RNText style={styles.brand}>{candidate.brandName}</RNText>
          {subtitle ? <RNText style={styles.season}>{subtitle}</RNText> : null}
        </View>
        <View style={styles.confidenceWrap}>
          <RNText style={styles.confidence}>
            {Math.round((candidate.confidence || 0) * 100)}%
          </RNText>
          {selected ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.accent}
            />
          ) : null}
        </View>
      </View>

      <RNText style={styles.evidenceLabel}>
        {hasRefMatch
          ? t("trading.uploadArchive.evidenceMatched", {
              matched: candidate.matchedRefs,
              total: candidate.totalRefs,
            })
          : t("trading.uploadArchive.evidenceFeatures")}
      </RNText>
      {candidate.evidence ? (
        <RNText style={styles.evidence}>{candidate.evidence}</RNText>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      padding: 14,
      marginBottom: 10,
      backgroundColor: t.colors.card,
    },
    cardSelected: {
      borderColor: t.colors.accent,
      borderWidth: 2,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    brand: {
      ...t.typography.body,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    season: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: 2,
    },
    confidenceWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    confidence: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    evidenceLabel: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginBottom: 2,
    },
    evidence: {
      ...t.typography.caption,
      color: t.colors.text,
      lineHeight: 18,
    },
  });

export default AttributionCandidateCard;
