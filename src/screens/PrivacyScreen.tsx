import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

const PrivacyScreen = () => {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="隐私政策" showBack={true} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>最后更新：2024年12月</Text>

          <Text style={styles.intro}>
            Avant Regard
            深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。
            我们致力于维持您对我们的信任，恪守以下原则：权责一致原则、目的明确原则、选择同意原则、
            最少够用原则、确保安全原则、主体参与原则、公开透明原则等。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            1. 我们如何收集和使用您的个人信息
          </Text>

          <Text style={styles.subTitle}>1.1 注册和登录</Text>
          <Text style={styles.content}>
            当您注册 Avant Regard 账户时，我们会收集：{"\n"}•
            手机号码或邮箱地址（用于账户验证）{"\n"}• 用户名和密码{"\n"}•
            头像和个人简介（可选）
          </Text>

          <Text style={styles.subTitle}>1.2 内容发布和互动</Text>
          <Text style={styles.content}>
            当您使用我们的服务时，我们会收集：{"\n"}•
            您发布的内容（图片、文字、视频等）{"\n"}• 点赞、评论、收藏等互动行为
            {"\n"}• 浏览历史和偏好设置
          </Text>

          <Text style={styles.subTitle}>1.3 设备信息</Text>
          <Text style={styles.content}>
            为了提供更好的服务体验，我们可能收集：{"\n"}• 设备型号、操作系统版本
            {"\n"}• IP地址和网络信息{"\n"}• 应用崩溃日志（用于改进服务质量）
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 我们如何使用您的信息</Text>
          <Text style={styles.content}>
            我们会将收集到的信息用于以下目的：{"\n\n"}•
            提供、维护和改进我们的服务{"\n"}• 处理您的请求和交易{"\n"}•
            发送服务相关通知{"\n"}• 个性化内容推荐{"\n"}• 防范安全风险{"\n"}•
            遵守法律法规要求
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 我们如何共享您的信息</Text>
          <Text style={styles.content}>
            我们不会向第三方出售或出租您的个人信息。在以下情况下，我们可能会共享您的信息：
            {"\n\n"}• 获得您的明确同意{"\n"}• 根据法律法规要求{"\n"}•
            为保护我们或他人的合法权益{"\n"}•
            与可信的服务提供商合作（仅限于提供服务所需）
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 我们如何保护您的信息</Text>
          <Text style={styles.content}>
            我们采用多种安全措施保护您的个人信息：{"\n\n"}• 数据加密传输和存储
            {"\n"}• 访问权限控制{"\n"}• 定期安全审计{"\n"}• 员工安全培训{"\n"}•
            事故响应机制
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. 您的权利</Text>
          <Text style={styles.content}>
            您对自己的个人信息享有以下权利：{"\n\n"}•
            访问权：了解我们收集了您的哪些信息{"\n"}•
            更正权：要求更正不准确的信息{"\n"}• 删除权：要求删除您的个人信息
            {"\n"}• 限制处理权：限制我们对您信息的处理{"\n"}•
            数据可携带权：要求获得您的数据副本{"\n"}•
            撤回同意权：随时撤回您的同意
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Cookie 和类似技术</Text>
          <Text style={styles.content}>
            我们使用 Cookie 和类似技术来：{"\n\n"}• 记住您的偏好设置{"\n"}•
            提供个性化体验{"\n"}• 分析服务使用情况{"\n"}• 改进服务质量{"\n\n"}
            您可以通过设备设置管理 Cookie 偏好。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. 第三方服务</Text>
          <Text style={styles.content}>
            我们的服务可能包含第三方链接或集成第三方服务。这些第三方有自己的隐私政策，
            我们建议您仔细阅读。我们不对第三方的隐私做法负责。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. 儿童隐私</Text>
          <Text style={styles.content}>
            我们的服务面向13岁以上的用户。我们不会故意收集13岁以下儿童的个人信息。
            如果我们发现收集了儿童的信息，会立即删除。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. 数据保留</Text>
          <Text style={styles.content}>
            我们会在提供服务所需的期间保留您的个人信息。具体保留期限取决于：
            {"\n\n"}• 信息类型{"\n"}• 收集目的{"\n"}• 法律要求{"\n"}• 业务需要
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. 政策更新</Text>
          <Text style={styles.content}>
            我们可能会不时更新本隐私政策。重大变更会通过应用内通知或其他方式告知您。
            继续使用服务即表示您接受更新后的政策。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. 联系我们</Text>
          <Text style={styles.content}>
            如果您对本隐私政策有任何疑问或需要行使您的权利，请联系我们：{"\n\n"}
            邮箱：privacy@avantregard.com{"\n"}
            电话：400-123-4567{"\n"}
            地址：北京市朝阳区时尚大厦{"\n\n"}
            我们会在30天内回复您的请求。
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
  scrollView: {
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
  subTitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 8,
    marginTop: 12,
  },
  content: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
    marginBottom: 8,
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

export default PrivacyScreen;
