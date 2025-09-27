import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

const TermsScreen = () => {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="服务条款" showBack={true} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>最后更新：2024年12月</Text>

          <Text style={styles.intro}>
            欢迎使用 Avant
            Regard！在使用我们的服务之前，请仔细阅读以下服务条款。
            使用我们的服务即表示您同意遵守这些条款。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 服务说明</Text>
          <Text style={styles.content}>
            Avant Regard
            是一个时尚内容分享平台，为用户提供时尚资讯、搭配分享、设计师作品展示等服务。
            我们致力于为时尚爱好者创建一个高品质的交流社区。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 用户账户</Text>
          <Text style={styles.content}>
            • 您需要创建账户才能使用某些功能{"\n"}• 您有责任保护账户信息的安全
            {"\n"}• 不得与他人分享账户信息{"\n"}•
            如发现账户被盗用，请立即联系我们
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 内容规范</Text>
          <Text style={styles.content}>
            用户发布的内容必须符合以下规范：{"\n\n"}•
            不得包含违法、有害、威胁、诽谤、骚扰、侵权等内容{"\n"}•
            不得发布虚假信息或误导性内容{"\n"}• 尊重他人的知识产权{"\n"}•
            不得发布垃圾信息或进行恶意营销{"\n"}• 保持内容的真实性和原创性
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 知识产权</Text>
          <Text style={styles.content}>
            • 平台上的所有内容受知识产权法保护{"\n"}•
            用户发布的原创内容，版权归用户所有{"\n"}•
            用户授权平台在服务范围内使用其发布的内容{"\n"}•
            未经授权不得复制、传播他人的受保护内容
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. 隐私保护</Text>
          <Text style={styles.content}>
            我们重视用户隐私，详细的隐私保护政策请参考《隐私政策》。
            我们承诺按照相关法律法规保护用户个人信息。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. 服务变更</Text>
          <Text style={styles.content}>
            • 我们可能会不时更新或修改服务功能{"\n"}• 重大变更将提前通知用户
            {"\n"}• 继续使用服务即表示接受变更
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. 责任限制</Text>
          <Text style={styles.content}>
            • 我们努力确保服务的稳定性，但不保证服务永不中断{"\n"}•
            对于因使用服务而产生的任何损失，我们的责任仅限于法律规定的范围{"\n"}
            • 用户应当为其行为承担责任
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. 违规处理</Text>
          <Text style={styles.content}>
            对于违反服务条款的行为，我们保留以下权利：{"\n\n"}• 删除违规内容
            {"\n"}• 限制账户功能{"\n"}• 暂停或终止账户{"\n"}• 追究法律责任
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. 条款更新</Text>
          <Text style={styles.content}>
            我们可能会定期更新这些条款。更新后的条款将在平台上公布，
            并在公布后生效。建议您定期查看最新版本的服务条款。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. 联系我们</Text>
          <Text style={styles.content}>
            如果您对这些条款有任何疑问，请通过以下方式联系我们：{"\n\n"}
            邮箱：support@avantregard.com{"\n"}
            电话：400-123-4567{"\n"}
            地址：北京市朝阳区时尚大厦
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Avant Regard. 保留所有权利。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  lastUpdated: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    marginBottom: 20,
  },
  intro: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
    backgroundColor: theme.colors.gray50,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 12,
  },
  content: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
  },
});

export default TermsScreen;
