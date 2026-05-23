/**
 * OfferModal —— PRD 模块四「我要出价」浮层 (Bottom Sheet)。
 *
 * 完全跟随项目设计系统：useAppTheme + Box/HStack/VStack/Text + 主题化按钮。
 */
import React, { useState } from "react";
import {
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
} from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { createOffer, counterOffer } from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";

type Mode = "create" | "counter";

interface Props {
  visible: boolean;
  mode?: Mode;
  productId: number;
  listingPriceCents: number;
  offerId?: number;
  referencePriceCents?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const OfferModal: React.FC<Props> = ({
  visible,
  mode = "create",
  productId,
  listingPriceCents,
  offerId,
  referencePriceCents,
  onClose,
  onSuccess,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [priceText, setPriceText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    const yuan = parseFloat(priceText);
    if (!yuan || yuan <= 0) {
      setErrorMsg(t("trading.offer.invalidAmount"));
      return;
    }
    const cents = Math.round(yuan * 100);
    if (mode === "create" && cents >= listingPriceCents) {
      setErrorMsg(t("trading.offer.aboveListing"));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      if (mode === "counter") {
        if (!offerId) throw new Error("offerId required");
        await counterOffer(offerId, {
          priceCents: cents,
          message: message.trim() || undefined,
        });
      } else {
        await createOffer({
          productId,
          priceCents: cents,
          message: message.trim() || undefined,
        });
      }
      setPriceText("");
      setMessage("");
      onSuccess();
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.offer.failed"));
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "counter"
      ? t("trading.offer.counterTitle")
      : t("trading.offer.title");
  const subtitle =
    mode === "counter"
      ? t("trading.offer.counterSubtitle", {
          price: formatPrice(referencePriceCents ?? listingPriceCents),
        })
      : t("trading.offer.subtitle", { price: formatPrice(listingPriceCents) });
  const submitLabel =
    mode === "counter"
      ? t("trading.offer.submitCounter")
      : t("trading.offer.submit");

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <Box style={styles.sheet}>
          <Box style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <HStack style={styles.inputRow} alignItems="center">
            <Text style={styles.currency}>¥</Text>
            <TextInput
              style={styles.input}
              placeholder={t("trading.offer.inputPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
            />
          </HStack>

          <TextInput
            style={styles.message}
            placeholder={t("trading.offer.messagePlaceholder")}
            placeholderTextColor={theme.colors.placeholder}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <HStack style={styles.actions} space="md" justifyContent="end">
            <Pressable style={styles.ghostBtn} onPress={onClose}>
              <Text style={styles.ghostBtnText}>{t("trading.offer.cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, loading && styles.primaryDisabled]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.primaryBtnText}>{submitLabel}</Text>
              )}
            </Pressable>
          </HStack>
        </Box>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    backdropPress: { flex: 1 },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 32,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "700", color: t.colors.text },
    subtitle: { fontSize: 12, color: t.colors.gray300, marginTop: 4 },

    inputRow: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.text,
      paddingVertical: 8,
      marginTop: 16,
    },
    currency: {
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
    },
    message: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
      minHeight: 60,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    error: { color: t.colors.error, marginTop: 8 },
    actions: { marginTop: 20 },
    ghostBtn: { paddingVertical: 12, paddingHorizontal: 20 },
    ghostBtnText: { color: t.colors.gray300 },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 8,
    },
    primaryDisabled: { opacity: 0.5 },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontWeight: "600",
    },
  });

export default OfferModal;
