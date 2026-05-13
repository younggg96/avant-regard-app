import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedStyles, type AppTheme } from "../../theme";

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}

interface ActionSheetBaseProps {
  visible: boolean;
  onClose: () => void;
  cancelLabel?: string;
  footerRight?: React.ReactNode;
}

interface ActionSheetWithActions extends ActionSheetBaseProps {
  title?: string;
  actions: ActionSheetAction[];
  children?: never;
}

interface ActionSheetWithChildren extends ActionSheetBaseProps {
  title?: never;
  actions?: never;
  children: React.ReactNode;
}

type ActionSheetProps = ActionSheetWithActions | ActionSheetWithChildren;

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ANIMATION_DURATION = 250;

export const ActionSheet = ({
  visible,
  onClose,
  cancelLabel,
  footerRight,
  ...rest
}: ActionSheetProps) => {
  const { t } = useTranslation();
  const s = useThemedStyles(makeStyles);
  const resolvedCancelLabel = cancelLabel ?? t("common.cancel");
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleAction = (action: ActionSheetAction) => {
    onClose();
    setTimeout(() => action.onPress(), ANIMATION_DURATION);
  };

  const hasChildren = "children" in rest && rest.children;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: backdrop }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[s.container, { paddingBottom: insets.bottom || 16 }, { transform: [{ translateY }] }]}
      >
        <View style={s.sheet}>
          {hasChildren ? (
            rest.children
          ) : (
            <>
              {"title" in rest && rest.title && (
                <Text style={s.title}>{rest.title}</Text>
              )}
              {rest.actions?.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[s.actionBtn, idx === 0 && !!rest.title && s.actionBtnFirst]}
                  onPress={() => handleAction(action)}
                  activeOpacity={0.6}
                >
                  {action.icon && <View style={s.actionIcon}>{action.icon}</View>}
                  <Text style={[s.actionText, action.destructive && s.destructiveText]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {footerRight ? (
          <View style={s.footerRow}>
            <TouchableOpacity style={s.cancelBtnHalf} onPress={onClose} activeOpacity={0.6}>
              <Text style={s.cancelText}>{resolvedCancelLabel}</Text>
            </TouchableOpacity>
            {footerRight}
          </View>
        ) : (
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.6}>
            <Text style={s.cancelText}>{resolvedCancelLabel}</Text>
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 10,
  },
  sheet: {
    backgroundColor: t.colors.card,
    borderRadius: 8,
    overflow: "hidden",
  },
  title: {
    textAlign: "center",
    fontSize: 13,
    color: t.colors.gray300,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.divider,
  },
  actionBtn: {
    flexDirection: "row",
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.divider,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnFirst: {
    borderTopWidth: 0,
  },
  actionIcon: {
    marginRight: 2,
  },
  actionText: {
    fontSize: 18,
    color: t.colors.text,
    fontWeight: "400",
  },
  destructiveText: {
    color: t.colors.error,
  },
  cancelBtn: {
    marginTop: 8,
    backgroundColor: t.colors.card,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  cancelBtnHalf: {
    flex: 1,
    backgroundColor: t.colors.card,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 18,
    fontWeight: "600",
    color: t.colors.text,
  },
});
