import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import ScreenHeader from "../../components/ScreenHeader";
import SubmitBrandForm from "../../components/SubmitBrandForm";
import { useThemedStyles, type AppTheme } from "../../theme";
import { useArchiveBrandListRefreshStore } from "../../store/archiveBrandListRefreshStore";

/**
 * Archive 底部「+」专属入口：全屏上传品牌，与列表内「上传品牌」弹窗共用表单逻辑。
 */
const SubmitBrandScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const bumpRefreshNonce = useArchiveBrandListRefreshStore((s) => s.bumpRefreshNonce);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("archive.submitBrand")}
        showBack
        borderless
      />
      <SubmitBrandForm
        variant="screen"
        onClose={() => navigation.goBack()}
        onSuccess={() => bumpRefreshNonce()}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
  });

export default SubmitBrandScreen;
