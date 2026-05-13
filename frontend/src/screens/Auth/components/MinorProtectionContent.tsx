import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemedStyles, type AppTheme } from "../../../theme";

export const MinorProtectionContent: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>
        Avant Regard未成年人个人信息保护规则
      </Text>
      <Text style={styles.lastUpdated}>更新日期：2026年4月4日</Text>
      <Text style={styles.lastUpdated}>生效日期：2026年4月4日</Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          运营方：上海南特克实业有限公司
        </Text>
      </View>

      <Text style={styles.intro}>
        我们始终重视未成年人的网络保护与个人信息安全，严格遵循《中华人民共和国未成年人保护法》《中华人民共和国个人信息保护法》等相关法律法规，结合Avant
        Regard平台二手设计师时装交易、社区互动、秀场与买手店地图等服务特性，制定本规则，专门保护未成年用户的个人信息权益。
      </Text>

      <Text style={styles.warning}>
        本规则为《Avant Regard隐私政策》《Avant
        Regard软件许可及服务协议》的补充条款，适用于所有使用本平台服务的未成年用户（未满18周岁）及未成年用户的监护人。
      </Text>

      <Text style={styles.sectionTitle}>一、适用前提与使用规范</Text>
      <Text style={styles.content}>
        1.
        未满18周岁的未成年用户，不得独立使用本平台服务，需在监护人的陪同、指导下阅读本规则及平台全部协议政策，并在监护人明确同意后，由监护人代为完成注册、登录、交易等所有操作。
      </Text>
      <Text style={styles.content}>
        2.
        监护人应履行监护职责，协助未成年用户规范使用平台功能，引导其远离不适宜的内容及交易行为，避免未成年用户泄露个人信息、进行非必要消费。
      </Text>
      <Text style={styles.content}>
        3.
        若未成年用户未经监护人同意擅自使用本平台服务，监护人可联系平台客服要求终止账号使用，我们将立即配合处理，并删除相关未成年个人信息。
      </Text>

      <Text style={styles.sectionTitle}>二、未成年人个人信息收集与使用原则</Text>
      <Text style={styles.content}>
        1.
        最小必要原则：我们仅在监护人同意的前提下，为保障平台基础服务使用，收集未成年用户的必要个人信息（仅含监护人代为注册的手机号码），不会额外收集未成年用户的姓名、身份证件信息、面部特征、定位信息、学校信息等任何敏感信息，不向未成年用户提供实名认证服务。
      </Text>
      <Text style={styles.content}>
        2.
        专属使用原则：收集的未成年用户相关信息，仅用于账号安全验证、监护人联系，不会用于个性化推荐、商业推广等任何其他用途，不会与任何第三方共享。
      </Text>
      <Text style={styles.highlight}>
        3.
        禁止主动收集：我们不会通过任何形式主动向未成年用户索要、收集个人信息，若发现平台内有疑似未成年用户主动发布个人信息的行为，将立即采取屏蔽、删除措施。
      </Text>

      <Text style={styles.sectionTitle}>三、平台功能使用限制与保护</Text>
      <Text style={styles.content}>
        结合平台服务特性，我们对未成年用户的功能使用进行专属限制，避免其接触不适宜内容及存在信息泄露风险：
      </Text>
      <Text style={styles.content}>
        1.
        社区互动功能：未成年用户仅可在监护人陪同下浏览社区内容，禁止发布任何UGC内容（包括文字、图片、视频、评价等），禁止参与评论、点赞、转发等互动行为。
      </Text>
      <Text style={styles.content}>
        2.
        秀场与买手店地图功能：未成年用户可浏览地图基础内容，禁止上传任何秀场信息、买手店地址、位置定位等信息，平台不会收集未成年用户的任何位置相关数据。
      </Text>
      <Text style={styles.content}>
        3.
        交易与付费功能：禁止未成年用户进行任何商品交易、购买会员服务/鉴定服务等付费操作，若发现疑似未成年用户的付费行为，我们将暂停交易并联系监护人核实，核实后将全额退还相关费用。
      </Text>
      <Text style={styles.content}>
        4.
        举报与屏蔽功能：监护人可协助未成年用户使用平台的内容举报、用户屏蔽功能，若发现平台内有不适宜未成年人的内容或违规用户，可一键举报/屏蔽，我们将在24小时内完成审核处理，保障未成年用户的网络浏览安全。
      </Text>

      <Text style={styles.sectionTitle}>四、未成年人个人信息的存储与保护</Text>
      <Text style={styles.content}>
        1.
        我们对收集的未成年用户个人信息采取单独加密存储，设置专人专岗的有限访问权限，仅平台客服人员因处理监护人咨询、账号问题可查看，且需遵守严格的保密规定。
      </Text>
      <Text style={styles.content}>
        2.
        未成年用户的个人信息存储期限，自账号停止使用之日起7个工作日内全部删除，且不会进行任何备份，删除后无法恢复。
      </Text>
      <Text style={styles.highlight}>
        3.
        若发现误收集未成年用户个人信息，我们将立即停止处理，并在第一时间删除相关信息，无需监护人另行申请。
      </Text>

      <Text style={styles.sectionTitle}>五、监护人的权利与操作指引</Text>
      <Text style={styles.content}>
        未成年用户的监护人享有以下专属权利，可通过平台"我的-设置-隐私管理"或官方客服渠道行使，我们将在15个工作日内响应并处理，不设置任何不合理条件：
      </Text>
      <Text style={styles.bulletContent}>
        1.
        查阅与核实权：监护人有权查询、核实平台收集的未成年用户相关个人信息，我们将提供清晰、完整的信息清单。
      </Text>
      <Text style={styles.bulletContent}>
        2.
        更正与删除权：监护人有权要求更正、删除未成年用户的个人信息，要求删除的，我们将立即执行并反馈处理结果。
      </Text>
      <Text style={styles.bulletContent}>
        3.
        账号终止权：监护人有权要求终止未成年用户的平台账号使用，我们将立即冻结账号，并删除所有相关个人信息。
      </Text>
      <Text style={styles.bulletContent}>
        4.
        投诉与建议权：监护人若发现平台内有侵害未成年人个人信息安全、展示不适宜未成年人内容的行为，有权向平台投诉，我们将优先受理、快速处理，并及时反馈处理结果。
      </Text>

      <Text style={styles.sectionTitle}>六、平台的责任与义务</Text>
      <Text style={styles.content}>
        1.
        我们将对平台内的所有内容进行更严格的审核管控，通过技术自动审核+人工复核的方式，杜绝不适宜未成年人的内容在平台展示。
      </Text>
      <Text style={styles.content}>
        2.
        我们不会向未成年用户推送任何商业广告、商品推荐等信息，确保未成年用户的浏览环境干净、安全。
      </Text>
      <Text style={styles.content}>
        3.
        我们将定期开展未成年人保护相关培训，提升平台工作人员的未成年人信息保护意识，规范未成年人信息处理行为。
      </Text>
      <Text style={styles.content}>
        4.
        若因平台自身原因导致未成年用户个人信息泄露，我们将依法承担相应的法律责任，并采取有效措施弥补监护人及未成年用户的损失。
      </Text>

      <Text style={styles.sectionTitle}>七、规则的更新与告知</Text>
      <Text style={styles.content}>
        1.
        我们可根据法律法规的修订及平台服务的调整，对本规则进行更新，更新后的规则将通过平台公告、弹窗等方式进行公示，自公示之日起生效。
      </Text>
      <Text style={styles.content}>
        2.
        若本规则的更新内容涉及未成年人个人信息保护的重大权益变更，我们将提前30日进行公示，并通过客服渠道提醒监护人，监护人继续使用平台服务即视为同意更新后的规则。
      </Text>

      <Text style={styles.sectionTitle}>八、联系我们</Text>
      <Text style={styles.content}>
        若监护人对未成年用户的个人信息保护、平台功能使用有任何疑问、意见或投诉，可通过以下专属渠道联系我们，我们将为未成年人保护事宜提供优先处理服务：
      </Text>
      <Text style={styles.contactInfo}>
        未成年人保护专属客服邮箱：avant.regarde61@gmail.com（邮件请备注「未成年人保护」）
        {"\n"}
        未成年人保护专属客服微信：Avantregard2025（私信请备注「未成年人保护」）
        {"\n"}
        线下联系地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室
      </Text>
      <Text style={styles.content}>
        我们将在收到监护人的反馈后，第一时间响应并处理，全力守护未成年用户的网络信息安全与身心健康。
      </Text>

      <Text style={styles.footer}>
        © 2026 Avant Regard. 保留所有权利。{"\n"}
        上海南特克实业有限公司
      </Text>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 20,
    },
    mainTitle: {
      fontSize: 20,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    lastUpdated: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      textAlign: "center",
      marginBottom: 4,
    },
    companyInfo: {
      backgroundColor: t.colors.gray50,
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
      marginBottom: 16,
    },
    companyText: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray600,
      lineHeight: 20,
    },
    intro: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 22,
      marginBottom: 12,
    },
    warning: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray700,
      lineHeight: 22,
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.text,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    content: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 22,
      marginBottom: 8,
    },
    bulletContent: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 22,
      marginBottom: 6,
      paddingLeft: 8,
    },
    highlight: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      lineHeight: 22,
      marginTop: 12,
      backgroundColor: t.colors.gray50,
      padding: 12,
      borderRadius: 8,
    },
    contactInfo: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 24,
      marginVertical: 12,
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 8,
    },
    footer: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      textAlign: "center",
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
  });
