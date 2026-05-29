import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemedStyles, type AppTheme } from "../../../theme";

export const MinorProtectionContent: React.FC = () => {
  const { i18n } = useTranslation();
  // The app only ever sets "zh" or "en"; default to the English document for
  // any non-Chinese locale to mirror the i18n fallback (fallbackLng: "en").
  if (i18n.language?.startsWith("zh")) return <MinorProtectionContentZh />;
  return <MinorProtectionContentEn />;
};

const MinorProtectionContentZh: React.FC = () => {
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

const MinorProtectionContentEn: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>
        Avant Regard Minor Personal Information Protection Rules
      </Text>
      <Text style={styles.lastUpdated}>Last Updated: April 4, 2026</Text>
      <Text style={styles.lastUpdated}>Effective Date: April 4, 2026</Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          Operator: Avant Regard Inc.{"\n"}
          These Rules shall be governed exclusively by the laws of the United
          States.
        </Text>
      </View>

      <Text style={styles.intro}>
        We always attach great importance to minors' online protection and
        personal information security. In accordance with applicable U.S.
        privacy and minor protection laws, and combined with Avant Regard's
        service features including secondhand designer fashion transactions,
        community interaction, fashion show and boutique store map functions, we
        formulate these Rules specially to protect the personal information
        rights and interests of minor users.
      </Text>

      <Text style={styles.warning}>
        These Rules serve as supplementary terms to the Avant Regard Privacy
        Policy and Avant Regard Software License and Service Agreement. They
        apply to all minor users under the age of 18 who use the Platform
        services, as well as their legal guardians.
      </Text>

      <Text style={styles.sectionTitle}>
        1. Applicable Preconditions & Usage Regulations
      </Text>
      <Text style={styles.content}>
        1. Minor users under the age of 18 shall not use the Platform services
        independently. They shall read these Rules and all Platform agreements
        and policies under the accompaniment and guidance of their guardians.
        Only with the guardian's explicit consent shall the guardian complete
        all operations such as account registration, login and transactions on
        behalf of the minor.
      </Text>
      <Text style={styles.content}>
        2. Guardians shall perform their guardianship duties, assist minors in
        properly using Platform functions, guide them to stay away from
        inappropriate content and risky trading behaviors, and prevent minors
        from disclosing personal information or making unnecessary consumption.
      </Text>
      <Text style={styles.content}>
        3. If a minor uses Platform services without guardian consent, the
        guardian may contact Platform customer service to request account
        termination. We will cooperate promptly and delete all relevant personal
        information of the minor.
      </Text>

      <Text style={styles.sectionTitle}>
        2. Principles for Collection & Use of Minors' Personal Information
      </Text>
      <Text style={styles.content}>
        1. Minimum Necessity Principle: Only with guardian consent and for the
        purpose of providing basic Platform services, we collect only necessary
        personal information of minors, limited to the mobile phone number
        registered by the guardian on their behalf. We will not additionally
        collect any sensitive information of minors such as full name, identity
        document details, facial features, location data or school information,
        and we do not provide real-name authentication services to minors.
      </Text>
      <Text style={styles.content}>
        2. Exclusive Usage Principle: Collected minor-related information is only
        used for account security verification and guardian contact. It will not
        be used for personalized recommendation, commercial promotion or any
        other purposes, and will never be shared with any third parties.
      </Text>
      <Text style={styles.highlight}>
        3. Proactive Collection Prohibition: We will not actively request or
        collect personal information from minors in any form. If we detect minors
        voluntarily posting personal information on the Platform, we will
        immediately block and delete such content.
      </Text>

      <Text style={styles.sectionTitle}>
        3. Platform Function Restrictions & Protection for Minors
      </Text>
      <Text style={styles.content}>
        In consideration of Platform service characteristics, we impose exclusive
        usage restrictions on minor users to avoid exposure to inappropriate
        content and prevent personal information leakage risks:
      </Text>
      <Text style={styles.content}>
        1. Community Interaction: Minors may only browse community content under
        guardian supervision. They are prohibited from publishing any User
        Generated Content (UGC) including texts, images, videos and reviews, and
        shall not participate in commenting, liking, reposting or other
        interactive behaviors.
      </Text>
      <Text style={styles.content}>
        2. Fashion Show & Boutique Store Map: Minors may browse basic map
        content, but are prohibited from uploading any fashion show information,
        boutique store addresses or location positioning data. The Platform will
        not collect any location-related information from minors.
      </Text>
      <Text style={styles.content}>
        3. Transaction & Paid Services: Minors are prohibited from conducting any
        commodity transactions, purchasing membership plans, authentication
        services or any other paid services. If minor-related payment behavior is
        detected, we will suspend the transaction, verify with the guardian, and
        provide a full refund upon confirmation.
      </Text>
      <Text style={styles.content}>
        4. Report & Block Functions: Guardians may assist minors in using the
        Platform's content reporting and user blocking features. Upon discovering
        content inappropriate for minors or violating users, guardians may use
        one-click report or block. We will complete review and handling within 24
        hours to safeguard minors' safe online browsing.
      </Text>

      <Text style={styles.sectionTitle}>
        4. Storage & Protection of Minors' Personal Information
      </Text>
      <Text style={styles.content}>
        1. We adopt independent encrypted storage for collected minors' personal
        information, with restricted access assigned to dedicated staff only.
        Only Platform customer service personnel may access such data when
        handling guardian inquiries and account issues, and are bound by strict
        confidentiality obligations.
      </Text>
      <Text style={styles.content}>
        2. All personal information of minors will be completely deleted within 7
        working days after the account stops being used, with no backup retained
        and no possibility of recovery after deletion.
      </Text>
      <Text style={styles.highlight}>
        3. If minor personal information is collected accidentally, we will
        immediately cease data processing and delete relevant information without
        requiring additional application from the guardian.
      </Text>

      <Text style={styles.sectionTitle}>
        5. Guardians' Rights & Operation Guidelines
      </Text>
      <Text style={styles.content}>
        Legal guardians of minor users enjoy the following exclusive rights,
        which may be exercised via Me – Settings – Privacy Management within the
        Platform or official customer service channels. We will respond and
        resolve requests within 15 working days without imposing unreasonable
        barriers:
      </Text>
      <Text style={styles.bulletContent}>
        1. Right to Access & Verify: Guardians have the right to inquire and
        verify the minor's personal information collected by the Platform, and we
        will provide a clear and complete information list.
      </Text>
      <Text style={styles.bulletContent}>
        2. Right to Rectify & Delete: Guardians may request correction or
        deletion of minors' personal information. Upon deletion request, we will
        execute immediately and feedback the result.
      </Text>
      <Text style={styles.bulletContent}>
        3. Right to Terminate Account: Guardians may request termination of the
        minor's Platform account. We will freeze the account immediately and
        delete all associated personal information.
      </Text>
      <Text style={styles.bulletContent}>
        4. Right to Complain & Suggest: If guardians discover behavior that
        endangers minors' personal information security or inappropriate content
        displayed on the Platform, they have the right to file complaints. We
        will prioritize acceptance, process promptly and feedback the outcome in
        a timely manner.
      </Text>

      <Text style={styles.sectionTitle}>
        6. Platform Responsibilities & Obligations
      </Text>
      <Text style={styles.content}>
        1. We implement stricter content review and management across the
        Platform through automated review combined with manual verification, to
        prevent the display of content inappropriate for minors, including
        violent, vulgar and commercial promotional material.
      </Text>
      <Text style={styles.content}>
        2. We will not push any commercial advertisements or product
        recommendations to minor users, ensuring a clean and safe browsing
        environment.
      </Text>
      <Text style={styles.content}>
        3. We regularly conduct training on minor protection to enhance Platform
        staff's awareness of minor personal information protection and
        standardize related data processing procedures.
      </Text>
      <Text style={styles.content}>
        4. If personal information leakage of minors is caused by the Platform's
        own fault, we shall assume corresponding legal liabilities under
        applicable laws and take effective measures to compensate losses of
        guardians and minors.
      </Text>

      <Text style={styles.sectionTitle}>7. Rules Update & Notification</Text>
      <Text style={styles.content}>
        1. We may update these Rules in response to amendments of applicable laws
        and adjustments of Platform services. Updated Rules will be announced via
        Platform notices and pop-up windows, and take effect upon publication.
      </Text>
      <Text style={styles.content}>
        2. If updates involve material changes affecting minors' personal
        information protection rights, we will publish a 30-day advance notice and
        remind guardians through customer service channels. Continued use of
        Platform services by guardians shall be deemed acceptance of the updated
        Rules.
      </Text>

      <Text style={styles.sectionTitle}>8. Contact Us</Text>
      <Text style={styles.content}>
        If guardians have any questions, comments or complaints regarding minors'
        personal information protection and Platform function usage, please
        contact us through the dedicated channels below. We provide priority
        processing for all minor protection related matters:
      </Text>
      <Text style={styles.contactInfo}>
        Minor Protection Dedicated Email: Melanie@avantregard.us (Please mark
        "Minor Protection" in the email subject)
      </Text>
      <Text style={styles.content}>
        We will respond and handle feedback from guardians promptly, and fully
        protect minor users' online information security and physical and mental
        health.
      </Text>

      <Text style={styles.footer}>
        © 2026 Avant Regard. All rights reserved.{"\n"}
        Avant Regard Inc.
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
