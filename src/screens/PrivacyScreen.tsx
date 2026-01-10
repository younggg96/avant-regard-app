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
          <Text style={styles.lastUpdated}>更新日期：2026年1月9日</Text>
          <Text style={styles.lastUpdated}>生效日期：2026年1月9日</Text>

          <View style={styles.companyInfo}>
            <Text style={styles.companyText}>
              运营方：上海南特克实业有限公司{"\n"}
              统一社会信用代码：9131011877976576X6{"\n"}
              注册地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室
            </Text>
          </View>

          <Text style={styles.intro}>
            欢迎使用 Avant Regard
            产品及服务！我们深知个人信息对您的重要性，将严格遵循《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》等法律法规，秉持合法正当、最小必要、公开透明的原则，保护您的个人信息安全与合法权益。本隐私政策将详细说明我们如何收集、使用、存储、共享您的个人信息，以及您享有的相关权利，建议您仔细阅读并理解。
          </Text>

          <Text style={styles.warning}>
            您下载、安装、注册、登录或使用本软件及服务的行为，视为您已充分理解并同意本隐私政策的全部内容。若您不同意本政策，应立即停止使用本软件及相关服务。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>一、适用范围</Text>
          <Text style={styles.content}>
            本隐私政策适用于上海南特克实业有限公司通过 Avant Regard
            移动客户端、小程序、官方网站等所有终端形态提供的二手设计师时装交易、商品展示、鉴定评估、社区互动、秀场与买手店地图等服务。
          </Text>
          <Text style={styles.content}>
            本政策不适用于第三方通过本平台提供的服务（如第三方支付、物流配送等），第三方服务的个人信息处理规则由其自行制定，我们建议您仔细阅读第三方的隐私政策。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>二、个人信息的收集与使用</Text>

          <Text style={styles.subTitle}>（一）必要个人信息</Text>
          <Text style={styles.content}>
            为保障您正常使用核心服务，我们需收集以下必要信息，若您拒绝提供，将无法完成注册或使用相关基础功能：
          </Text>
          <Text style={styles.content}>
            1.
            账号注册与管理：手机号码（用于账号注册、登录验证、安全提醒）、设置的账号密码；完成实名认证时需提供姓名及身份证件信息（符合法律法规要求及反欺诈风险控制需要）。
          </Text>
          <Text style={styles.content}>
            2.
            交易与履约：收货地址（含收货人姓名、联系电话、详细地址）、订单信息（商品名称、规格、价格、交易状态等）、支付相关信息（仅用于完成交易结算，不存储完整支付账号信息）。
          </Text>

          <Text style={styles.subTitle}>（二）非必要个人信息</Text>
          <Text style={styles.content}>
            为提升服务体验，您可自主选择是否提供以下信息，不提供不会影响基础服务使用：
          </Text>
          <Text style={styles.content}>
            1.
            个人资料完善：昵称、头像、性别、生日等（用于个性化展示及社区互动）。
          </Text>
          <Text style={styles.content}>2. 功能使用相关：</Text>
          <Text style={styles.bulletContent}>
            • 社区互动：发布内容时上传的文字、图片、视频等（用于展示与分享）；
          </Text>
          <Text style={styles.bulletContent}>
            •
            秀场与买手店地图：您主动上传的秀场信息、买手店地址等（按本平台协议约定，该行为属于用户独立行为）；
          </Text>
          <Text style={styles.bulletContent}>
            •
            个性化推荐：浏览记录、搜索历史、收藏偏好等（用于向您推荐可能感兴趣的商品或内容，您可随时关闭该功能）。
          </Text>
          <Text style={styles.content}>
            3.
            设备与日志信息：设备型号、操作系统版本、IP地址、登录时间、使用时长等（用于优化软件性能、保障账号安全）。
          </Text>

          <Text style={styles.subTitle}>（三）信息使用规则</Text>
          <Text style={styles.content}>
            1.
            我们仅在本政策载明的收集目的范围内使用您的个人信息，不得超出合理范围使用。
          </Text>
          <Text style={styles.content}>
            2.
            如需将个人信息用于本政策未约定的其他用途，我们将提前通过弹窗、站内信等方式征求您的单独同意。
          </Text>
          <Text style={styles.content}>
            3.
            对收集的个人信息进行匿名化、去标识化处理后的数据，我们可用于商业分析、服务优化等用途，该等数据不再属于个人信息。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            三、个人信息的共享、转移与公开
          </Text>

          <Text style={styles.subTitle}>1. 共享</Text>
          <Text style={styles.content}>
            我们不会向第三方出售、出租您的个人信息。仅在以下情形下，经您单独同意或依法依规共享：
          </Text>
          <Text style={styles.bulletContent}>
            • 为完成交易所需，向支付机构、物流服务商共享必要的交易及收货信息；
          </Text>
          <Text style={styles.bulletContent}>
            •
            为履行法律法规义务、应对司法机关调查或保护平台及用户合法权益，向有权机关提供相关信息；
          </Text>
          <Text style={styles.bulletContent}>
            • 向关联公司或合作方共享匿名化、去标识化数据，用于联合优化服务。
          </Text>

          <Text style={styles.subTitle}>2. 转移</Text>
          <Text style={styles.content}>
            未经您明确同意，我们不会将个人信息转移给任何第三方，除非因公司合并、收购、破产清算等法定情形，且转移后接收方需继续遵守本隐私政策约定。
          </Text>

          <Text style={styles.subTitle}>3. 公开</Text>
          <Text style={styles.content}>
            仅在您主动公开（如社区发布内容）或法律法规要求公开的情形下，才会公开您的个人信息，且会采取合理措施保护您的权益。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>四、个人信息的存储与保护</Text>

          <Text style={styles.subTitle}>1. 存储期限</Text>
          <Text style={styles.content}>
            仅在实现本政策约定目的所需的最短期限内存储您的个人信息，超出期限后将依法删除或匿名化处理。
          </Text>

          <Text style={styles.subTitle}>2. 存储地点</Text>
          <Text style={styles.content}>
            您的个人信息将存储在中华人民共和国境内，如需跨境存储，将提前获得您的单独同意并符合相关法规要求。
          </Text>

          <Text style={styles.subTitle}>3. 安全保护</Text>
          <Text style={styles.content}>
            我们采取加密存储、访问权限控制、安全审计等技术及管理措施，防范个人信息泄露、丢失、篡改。但您需知晓，网络安全存在固有风险，我们无法完全保证信息绝对安全。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>五、您的个人信息权利</Text>
          <Text style={styles.content}>
            您依法享有以下个人信息相关权利，可通过本软件"我的-设置-隐私管理"或联系客服行使：
          </Text>

          <Text style={styles.subTitle}>1. 查阅、复制权</Text>
          <Text style={styles.content}>
            有权查询、复制您的个人信息（法律法规另有规定的除外）；
          </Text>

          <Text style={styles.subTitle}>2. 更正、补充权</Text>
          <Text style={styles.content}>
            发现个人信息错误或不完整时，有权申请更正或补充；
          </Text>

          <Text style={styles.subTitle}>3. 删除权</Text>
          <Text style={styles.content}>
            符合以下情形的，有权申请删除个人信息：
          </Text>
          <Text style={styles.bulletContent}>
            • 收集目的已实现或无需继续存储；
          </Text>
          <Text style={styles.bulletContent}>• 您撤回同意；</Text>
          <Text style={styles.bulletContent}>
            • 我们违反约定使用或处理信息；
          </Text>

          <Text style={styles.subTitle}>4. 撤回同意权</Text>
          <Text style={styles.content}>
            可随时撤回对非必要信息收集使用的同意，撤回后不影响此前基于同意的信息处理行为；
          </Text>

          <Text style={styles.subTitle}>5. 投诉举报权</Text>
          <Text style={styles.content}>
            如认为我们的信息处理行为侵犯您的合法权益，可通过本政策公示的渠道投诉举报。
          </Text>

          <Text style={styles.highlight}>
            我们将在收到您的权利行使申请后15个工作日内受理并处理，不设置不合理条件阻碍您行使权利。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>六、未成年人保护</Text>
          <Text style={styles.content}>
            1.
            我们不主动向未成年人提供服务，未满18周岁的未成年人应在监护人陪同下使用，且需获得监护人的明确同意。
          </Text>
          <Text style={styles.content}>
            2.
            如发现误收集未成年人个人信息，我们将立即停止处理，并删除相关信息；监护人如需查询、删除未成年人信息，可联系我们并提供有效证明。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>七、隐私政策的更新</Text>
          <Text style={styles.content}>
            1.
            我们可根据法律法规修订或业务调整，对本隐私政策进行更新，更新后的政策将通过软件内公告、弹窗等方式公示，自公示之日起生效。
          </Text>
          <Text style={styles.content}>
            2.
            若更新内容涉及重大权益变更（如收集范围扩大、共享规则调整等），我们将提前30日公示，您继续使用服务即视为同意更新后的政策。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>八、联系我们</Text>
          <Text style={styles.content}>
            如您对本隐私政策有任何疑问、意见或投诉，可通过以下方式联系我们：
          </Text>
          <Text style={styles.contactInfo}>
            客服邮箱：avant.regarde61@gmail.com{"\n"}
            客服微信：Avantregard2025{"\n"}
            联系地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室
          </Text>
          <Text style={styles.content}>
            我们将在收到您的反馈后及时响应并处理。
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 Avant Regard. 保留所有权利。
          </Text>
          <Text style={styles.footerText}>上海南特克实业有限公司</Text>
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
    marginBottom: 4,
  },
  companyInfo: {
    backgroundColor: theme.colors.gray50,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  companyText: {
    fontSize: 13,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 20,
  },
  intro: {
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
    marginBottom: 12,
  },
  warning: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray700,
    lineHeight: 22,
    backgroundColor: theme.colors.gray50,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.black,
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
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletContent: {
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 24,
    marginBottom: 6,
    paddingLeft: 8,
  },
  highlight: {
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    lineHeight: 24,
    marginTop: 12,
    backgroundColor: theme.colors.gray50,
    padding: 12,
    borderRadius: 8,
  },
  contactInfo: {
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray700,
    lineHeight: 26,
    marginVertical: 12,
    backgroundColor: theme.colors.gray50,
    padding: 16,
    borderRadius: 8,
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
    marginBottom: 4,
  },
});

export default PrivacyScreen;
