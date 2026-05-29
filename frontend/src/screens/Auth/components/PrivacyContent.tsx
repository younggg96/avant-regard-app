import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemedStyles, type AppTheme } from "../../../theme";

export const PrivacyContent: React.FC = () => {
  const { i18n } = useTranslation();
  // The app only ever sets "zh" or "en"; default to the English document for
  // any non-Chinese locale to mirror the i18n fallback (fallbackLng: "en").
  if (i18n.language?.startsWith("zh")) return <PrivacyContentZh />;
  return <PrivacyContentEn />;
};

const PrivacyContentZh: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>Avant Regard 隐私政策</Text>
      <Text style={styles.lastUpdated}>更新日期：2026年4月4日</Text>
      <Text style={styles.lastUpdated}>生效日期：2026年4月4日</Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          运营方：上海南特克实业有限公司（统一社会信用代码：9131011877976576X6；注册地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室）
        </Text>
      </View>

      <Text style={styles.intro}>
        欢迎使用 Avant Regard
        产品及服务！我们深知个人信息对您的重要性，将严格遵循《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》等法律法规，秉持合法正当、最小必要、公开透明的原则，保护您的个人信息安全与合法权益。本隐私政策将详细说明我们如何收集、使用、存储、共享您的个人信息，以及您享有的相关权利，尤其针对买手店地图功能的位置信息专属使用规则、用户生成内容（UGC）相关信息处理规则，以及平台为您提供的内容举报、用户屏蔽功能的信息处理规范进行明确说明，建议您仔细阅读并理解。
      </Text>

      <Text style={styles.warning}>
        您下载、安装、注册、登录、使用本软件及服务，或访问/发布本软件内用户生成内容（UGC）、使用买手店地图功能、使用内容举报/用户屏蔽功能的行为，视为您已充分理解并同意本隐私政策的全部内容。若您不同意本政策，应立即停止使用本软件及相关服务。
      </Text>

      {/* 一、适用范围 */}
      <Text style={styles.sectionTitle}>一、适用范围</Text>
      <Text style={styles.content}>
        本隐私政策适用于上海南特克实业有限公司通过 Avant Regard
        移动客户端、小程序、官方网站等所有终端形态提供的二手设计师时装交易、商品展示、鉴定评估、社区互动、秀场与买手店地图等服务，尤其适用于买手店地图功能的位置信息处理、所有UGC内容相关的个人信息收集与使用，以及内容举报、用户屏蔽功能的相关信息处理。
      </Text>
      <Text style={styles.content}>
        本政策不适用于第三方通过本平台提供的服务（如第三方支付、物流配送等），第三方服务的个人信息处理规则由其自行制定，我们建议您仔细阅读第三方的隐私政策。
      </Text>

      {/* 二、个人信息的收集与使用 */}
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
        为提升服务体验，您可自主选择是否提供以下信息，不提供不会影响基础服务使用；其中买手店地图功能的位置信息仅为该功能专属使用，无其他任何用途：
      </Text>
      <Text style={styles.content}>
        1. 个人资料完善：昵称、头像、性别、生日等（用于个性化展示及社区互动）。
      </Text>
      <Text style={styles.content}>2. 功能使用相关：</Text>
      <Text style={styles.bulletContent}>
        • 社区互动：发布内容时上传的文字、图片、视频等（用于展示与分享，相关信息处理遵循本政策约定）；
      </Text>
      <Text style={styles.bulletContent}>
        •
        秀场与买手店地图：您主动上传的秀场信息、买手店地址、门店定位等位置信息，该位置信息仅用于买手店地图功能内的点位展示、地址导航相关服务，不会用于任何其他功能场景，不会与其他个人信息关联使用，不会向任何第三方共享；您也可自主选择是否上传位置信息，拒绝提供不影响买手店地图的基础浏览功能；
      </Text>
      <Text style={styles.bulletContent}>
        •
        个性化推荐：浏览记录、搜索历史、收藏偏好等（用于向您推荐可能感兴趣的商品或内容，您可随时关闭该功能）；
      </Text>
      <Text style={styles.bulletContent}>
        •
        内容举报与用户屏蔽：您使用举报功能时提交的违规内容截图、违规描述，使用屏蔽功能时选择的用户账号标识（以上信息仅用于功能本身的处理，无其他用途）。
      </Text>
      <Text style={styles.content}>
        3.
        设备与日志信息：设备型号、操作系统版本、IP地址、登录时间、使用时长等（用于优化软件性能、保障账号安全，不会单独用于定位或位置追踪）。
      </Text>

      <Text style={styles.subTitle}>（三）信息使用规则</Text>
      <Text style={styles.content}>
        1.
        我们仅在本政策载明的收集目的范围内使用您的个人信息，尤其针对买手店地图位置信息，严格限定在该功能展示、导航的专属用途，不得超出合理范围使用。
      </Text>
      <Text style={styles.content}>
        2.
        如需将个人信息用于本政策未约定的其他用途，我们将提前通过弹窗、站内信等方式征求您的单独同意；买手店地图的位置信息、内容举报/用户屏蔽的相关信息不会变更使用用途，无需另行征求同意。
      </Text>
      <Text style={styles.content}>
        3.
        对收集的个人信息进行匿名化、去标识化处理后的数据，我们可用于商业分析、服务优化等用途，该等数据不再属于个人信息；买手店地图的位置信息、内容举报/用户屏蔽的相关信息经匿名化处理后，仅可用于对应功能的服务优化，不做其他商业使用。
      </Text>
      <Text style={styles.content}>
        4.
        为配合平台UGC内容审核、内容举报/用户屏蔽机制落地，我们可使用您的账号信息、发布的UGC内容相关信息、举报提交的相关材料，用于违规内容甄别、举报审核处理、屏蔽功能生效，该使用行为严格遵循最小必要原则，仅为平台安全运营及保障您的合法权益所需。
      </Text>
      <Text style={styles.content}>
        5.
        您在使用用户屏蔽功能后，我们将仅基于您的选择，在平台内屏蔽被屏蔽用户的内容展示、账号互动，不会收集或使用被屏蔽用户的额外个人信息，也不会将您的屏蔽操作告知被屏蔽用户；您使用内容举报功能提交的所有材料，仅由平台审核人员查看处理，不会向任何第三方泄露，也不会用于除举报审核外的其他场景。
      </Text>

      {/* 二·五、短信通信 / SMS Communications
          说明：该段落同时配套发布在 https://avantregard.com/privacy ，用于满足
          Twilio toll-free verification 对短信 opt-in 披露的合规要求 (CTIA)。
          英文版本必须与 PRD 中的版本逐字一致，请勿改写。 */}
      <Text style={styles.sectionTitle}>二·五、短信通信 / SMS Communications</Text>
      <Text style={styles.content}>
        当您使用手机号注册账号时，您同意接收用于账号身份验证和安全用途的一次性短信验证码。运营商可能收取标准的短信和数据费用。您可以随时通过对任意短信回复 STOP 退订。我们为短信验证收集的手机号将被安全存储，且不会出于营销目的向任何第三方出售、出租或共享。
      </Text>
      <Text style={styles.content}>
        SMS Communications. When you create an account using a mobile phone
        number, you consent to receive one-time SMS verification codes for the
        purpose of account authentication and security. Standard message and
        data rates may apply. You may opt out of SMS communications at any time
        by replying STOP to any message. Phone numbers collected for SMS
        verification are stored securely and are not sold, rented, or shared
        with third parties for marketing purposes.
      </Text>

      {/* 三、个人信息的共享、转移与公开 */}
      <Text style={styles.sectionTitle}>三、个人信息的共享、转移与公开</Text>

      <Text style={styles.subTitle}>1. 共享</Text>
      <Text style={styles.content}>
        我们不会向第三方出售、出租您的个人信息。仅在以下情形下，经您单独同意或依法依规共享，买手店地图的位置信息、内容举报/用户屏蔽的相关信息不会向任何第三方共享：
      </Text>
      <Text style={styles.bulletContent}>
        •
        为完成交易所需，向支付机构、物流服务商共享必要的交易及收货信息（不含买手店地图位置信息、举报/屏蔽相关信息）；
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
        未经您明确同意，我们不会将个人信息转移给任何第三方，买手店地图的位置信息、内容举报/用户屏蔽的相关信息不涉及任何第三方转移；除非因公司合并、收购、破产清算等法定情形，且转移后接收方需继续遵守本隐私政策关于上述信息的专属使用约定。
      </Text>

      <Text style={styles.subTitle}>3. 公开</Text>
      <Text style={styles.content}>
        仅在您主动公开（如社区发布内容、买手店地图功能内主动上传的门店信息）或法律法规要求公开的情形下，才会公开您的相关信息，且会采取合理措施保护您的权益；买手店地图中您主动上传的位置信息仅在该功能内公开展示，内容举报/用户屏蔽的相关操作及信息，不会在任何平台/功能场景公开。
      </Text>

      {/* 四、个人信息的存储与保护 */}
      <Text style={styles.sectionTitle}>四、个人信息的存储与保护</Text>
      <Text style={styles.content}>
        1.
        存储期限：仅在实现本政策约定目的所需的最短期限内存储您的个人信息：买手店地图的位置信息，自您上传之日起至您主动删除或注销账号之日止存储，删除后立即同步清理；内容举报的相关材料，自审核处理完毕后保留6个月（用于合规追溯），期满后自动匿名化处理；用户屏蔽的操作记录，自您设置之日起至您主动取消屏蔽或注销账号之日止存储；超出期限后将依法删除或匿名化处理。
      </Text>
      <Text style={styles.content}>
        2.
        存储地点：您的个人信息将存储在中华人民共和国境内，买手店地图的位置信息、内容举报/用户屏蔽的相关信息仅在境内存储，不涉及跨境存储；如需跨境存储其他个人信息，将提前获得您的单独同意并符合相关法规要求。
      </Text>
      <Text style={styles.content}>
        3.
        安全保护：我们采取加密存储、访问权限控制、安全审计等技术及管理措施，防范个人信息泄露、丢失、篡改；对买手店地图的位置信息采取单独加密存储，对内容举报/用户屏蔽的相关信息设置专人专岗的有限访问权限。但您需知晓，网络安全存在固有风险，我们无法完全保证信息绝对安全。
      </Text>
      <Text style={styles.content}>
        4.
        针对UGC内容相关信息及内容举报/用户屏蔽的操作信息，我们采取专门的安全保护措施，防止您的相关信息被非法获取、篡改，保障您的内容发布、互动及维权操作的信息安全。
      </Text>

      {/* 五、您的个人信息权利 */}
      <Text style={styles.sectionTitle}>五、您的个人信息权利</Text>
      <Text style={styles.content}>
        您依法享有以下个人信息相关权利，可通过本软件"我的-设置-隐私管理"或联系客服行使：
      </Text>
      <Text style={styles.content}>
        1.
        查阅、复制权：有权查询、复制您的个人信息（含买手店地图中您上传的位置信息、您的举报记录、屏蔽列表）；
      </Text>
      <Text style={styles.content}>
        2.
        更正、补充权：发现个人信息错误或不完整时，有权申请更正或补充（含买手店地图中上传的错误位置信息）；
      </Text>
      <Text style={styles.content}>
        3.
        删除权：收集目的已实现或无需继续存储；您撤回同意；我们违反约定使用或处理信息；您主动要求删除买手店地图中的位置信息、UGC内容相关信息，或要求清空举报记录；您可随时通过软件内功能入口自主取消对其他用户的屏蔽；
      </Text>
      <Text style={styles.content}>
        4.
        撤回同意权：可随时撤回对非必要信息收集使用的同意，撤回买手店地图位置信息的使用同意后，我们将立即停止使用并删除该信息；
      </Text>
      <Text style={styles.content}>
        5.
        投诉举报权：如认为我们的信息处理行为侵犯您的合法权益，可通过本政策公示的渠道投诉举报；
      </Text>
      <Text style={styles.content}>
        6.
        您可在本软件内任意UGC内容详情页、用户主页、互动界面，直接使用【举报】功能提交违规内容申诉，或使用【屏蔽】功能一键屏蔽其他用户，相关操作无需额外提供个人信息，且操作结果实时生效。
      </Text>

      <Text style={styles.highlight}>
        我们将在收到您的权利行使申请后15个工作日内受理并处理，不设置不合理条件阻碍您行使权利。
      </Text>

      {/* 六、未成年人保护 */}
      <Text style={styles.sectionTitle}>六、未成年人保护</Text>
      <Text style={styles.content}>
        1.
        我们不主动向未成年人提供服务，未满18周岁的未成年人应在监护人陪同下使用，且需获得监护人的明确同意；未成年人使用买手店地图功能时，监护人应协助其规范上传位置信息；未成年人使用内容举报/用户屏蔽功能时，监护人可协助其甄别违规内容，保障自身网络权益。
      </Text>
      <Text style={styles.content}>
        2.
        如发现误收集未成年人个人信息，我们将立即停止处理，并删除相关信息；监护人如需查询、删除未成年人的信息（含买手店地图位置信息、UGC内容相关信息、举报/屏蔽操作记录），可联系我们并提供有效证明。
      </Text>
      <Text style={styles.content}>
        3.
        针对未成年人发布的UGC内容，我们将采取更严格的信息审核及保护措施；同时为未成年人优化内容举报/用户屏蔽功能的操作路径，方便其快速维权。
      </Text>

      {/* 七、隐私政策的更新 */}
      <Text style={styles.sectionTitle}>七、隐私政策的更新</Text>
      <Text style={styles.content}>
        1.
        我们可根据法律法规修订或业务调整，对本隐私政策进行更新，尤其若涉及买手店地图位置信息、内容举报/用户屏蔽功能的信息使用规则变更，将单独重点公示；更新后的政策将通过软件内公告、弹窗等方式公示，自公示之日起生效。
      </Text>
      <Text style={styles.content}>
        2.
        若更新内容涉及重大权益变更（如收集范围扩大、共享规则调整等），我们将提前30日公示，您继续使用服务即视为同意更新后的政策。
      </Text>

      {/* 八、联系我们 */}
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

      <Text style={styles.footer}>
        © 2026 Avant Regard. 保留所有权利。{"\n"}
        上海南特克实业有限公司
      </Text>
    </View>
  );
};

const PrivacyContentEn: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>Avant Regard Privacy Policy</Text>
      <Text style={styles.lastUpdated}>
        Last Updated: Saturday, April 4, 2026
      </Text>
      <Text style={styles.lastUpdated}>
        Effective Date: Saturday, April 4, 2026
      </Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          Operator: Avant Regard Inc.{"\n"}
          This Privacy Policy is governed exclusively by the laws of the United
          States.
        </Text>
      </View>

      <Text style={styles.intro}>
        Welcome to Avant Regard products and services. We fully recognize the
        importance of your personal information and strictly comply with
        applicable U.S. federal and state privacy laws, adhering to the
        principles of lawfulness, legitimacy, minimum necessity, openness and
        transparency to protect the security and legitimate rights and interests
        of your personal information. This Privacy Policy sets forth in detail
        how we collect, use, store and share your personal information, as well
        as your rights in relation thereto. It specifically clarifies the
        exclusive rules for location information under the boutique store map
        feature, the processing rules for User Generated Content (UGC), and the
        information processing specifications for platform-provided content
        reporting and user blocking functions. We recommend that you read this
        Privacy Policy carefully.
      </Text>

      <Text style={styles.warning}>
        By downloading, installing, registering for, logging into, and using our
        software and services, accessing or publishing UGC within the platform,
        using the boutique store map feature, or utilizing content reporting and
        user blocking functions, you acknowledge that you have fully understood
        and unconditionally agreed to all terms of this Privacy Policy. If you do
        not agree to this Policy, you shall immediately cease using our software
        and related services.
      </Text>

      {/* 1. Scope of Application */}
      <Text style={styles.sectionTitle}>1. Scope of Application</Text>
      <Text style={styles.content}>
        This Privacy Policy applies to all services provided by Avant Regard
        Inc. via the Avant Regard mobile application, mini-program, official
        website and all other terminal forms, including secondhand designer
        fashion transactions, product display, authentication and evaluation,
        community interaction, fashion show coverage and boutique store map
        services. It specifically governs location information processing for
        the boutique store map feature, personal information collection and use
        related to all UGC, and information processing for content reporting and
        user blocking functions.
      </Text>
      <Text style={styles.content}>
        This Policy does not apply to third-party services provided through our
        platform (such as third-party payment and logistics distribution). Third
        parties shall formulate their own personal information processing rules,
        and we recommend that you review their respective privacy policies.
      </Text>

      {/* 2. Collection and Use of Personal Information */}
      <Text style={styles.sectionTitle}>
        2. Collection and Use of Personal Information
      </Text>

      <Text style={styles.subTitle}>2.1 Mandatory Personal Information</Text>
      <Text style={styles.content}>
        To enable your normal use of core services, we need to collect the
        following mandatory personal information. Refusal to provide such
        information may prevent you from completing account registration or using
        basic functions:
      </Text>
      <Text style={styles.content}>
        1. Account Registration and Management: Mobile phone number (for account
        registration, login verification and security alerts), account password
        set by you. Full name and identity document information may be required
        for real-name authentication to comply with legal requirements and
        anti-fraud risk control.
      </Text>
      <Text style={styles.content}>
        2. Transaction and Performance: Recipient name, contact phone number,
        delivery details, order information (product name, specifications,
        price, transaction status, etc.), and payment-related information (only
        for transaction settlement; we do not store complete payment account
        details).
      </Text>

      <Text style={styles.subTitle}>2.2 Non-Mandatory Personal Information</Text>
      <Text style={styles.content}>
        You may voluntarily choose to provide the following information to
        enhance your service experience, and provision is not required to use
        basic services. Location information collected through the boutique store
        map feature is used exclusively for such feature and shall not be
        utilized for any other purposes:
      </Text>
      <Text style={styles.content}>
        1. Profile Completion: Nickname, avatar, gender, date of birth (for
        personalized display and community interaction).
      </Text>
      <Text style={styles.content}>2. Feature Usage Related Data:</Text>
      <Text style={styles.bulletContent}>
        • Community Interaction: Text, images, videos and other content you
        upload when publishing posts, which shall be displayed and shared in
        accordance with this Policy.
      </Text>
      <Text style={styles.bulletContent}>
        • Fashion Show & Boutique Store Map: Fashion show information, boutique
        store addresses and location positioning actively uploaded by you. Such
        location data is solely used for venue marking and navigation within the
        boutique store map feature only. It will not be applied to any other
        scenarios, associated with other personal data, or shared with any third
        parties. You may choose whether to upload location information, and
        refusal will not affect basic browsing of the boutique store map.
      </Text>
      <Text style={styles.bulletContent}>
        • Personalized Recommendations: Browsing records, search history,
        favorites and preferences (to recommend products and content that may
        interest you; you may disable this feature at any time).
      </Text>
      <Text style={styles.bulletContent}>
        • Content Reporting & User Blocking: Screenshots of violating content and
        violation descriptions submitted via the reporting function, and user
        account identifiers selected for blocking. Such information is used
        solely for the operation of these functions and no other purposes.
      </Text>
      <Text style={styles.content}>
        3. Device and Log Information: Device model, operating system version, IP
        address, login time, usage duration, etc. (for software performance
        optimization and account security assurance; not used independently for
        positioning or location tracking).
      </Text>

      <Text style={styles.subTitle}>2.3 Information Usage Rules</Text>
      <Text style={styles.content}>
        1. We only use your personal information within the purposes specified
        in this Policy. In particular, boutique store map location information is
        strictly limited to display and navigation functions and shall not be
        used beyond reasonable scope.
      </Text>
      <Text style={styles.content}>
        2. If we intend to use your personal information for purposes not
        specified herein, we will obtain your separate prior consent via pop-up
        notifications, in-app messages or other means. The usage purpose of
        boutique store map location information, content reporting and user
        blocking related information will not be changed, and no additional
        consent will be required.
      </Text>
      <Text style={styles.content}>
        3. Anonymized and de-identified data derived from collected personal
        information may be used for business analysis and service optimization
        and shall no longer be deemed personal information. Anonymized boutique
        store map location data, content reporting and user blocking data may
        only be used for corresponding feature optimization and shall not be
        applied for other commercial purposes.
      </Text>
      <Text style={styles.content}>
        4. To support platform UGC content review, content reporting and user
        blocking mechanisms, we may use your account information, published UGC
        data and reporting submissions to identify violating content, process
        reports and activate blocking functions. Such processing strictly
        follows the minimum necessity principle and is solely for platform
        security operation and protection of your legitimate rights.
      </Text>
      <Text style={styles.content}>
        5. After you enable the user blocking function, we will only hide content
        and interactions from blocked users within the platform based on your
        preference. We will not collect additional personal information of
        blocked users nor notify them of your blocking action. All materials
        submitted through content reporting are only reviewed by designated
        platform staff, will not be disclosed to any third parties, and will not
        be used for purposes other than report review.
      </Text>

      {/* SMS Communications — required verbatim for Twilio / CTIA compliance.
          Mirrors https://avantregards.com/privacy. Do not reword. */}
      <Text style={styles.sectionTitle}>SMS Communications</Text>
      <Text style={styles.content}>
        When you create an account using a mobile phone number, you consent to
        receive one-time SMS verification codes for the purpose of account
        authentication and security. Standard message and data rates may apply.
        You may opt out of SMS communications at any time by replying STOP to any
        message. Phone numbers collected for SMS verification are stored securely
        and are not sold, rented, or shared with third parties for marketing
        purposes.
      </Text>

      {/* 3. Sharing, Transfer and Public Disclosure */}
      <Text style={styles.sectionTitle}>
        3. Sharing, Transfer and Public Disclosure of Personal Information
      </Text>

      <Text style={styles.subTitle}>1. Sharing</Text>
      <Text style={styles.content}>
        We will not sell or rent your personal information to any third parties.
        We may only share information with your separate consent or as required
        by applicable laws. Boutique store map location information, content
        reporting and user blocking related data will never be shared with third
        parties under any circumstances:
      </Text>
      <Text style={styles.bulletContent}>
        • Sharing necessary transaction and delivery information with payment
        institutions and logistics providers to complete transactions (excluding
        boutique store map location data and reporting/blocking information).
      </Text>
      <Text style={styles.bulletContent}>
        • Disclosing relevant information to authorized authorities to comply
        with legal obligations, respond to judicial investigations or protect
        the legitimate interests of the platform and users. Any disclosure of
        reporting materials will follow legal procedures and will not expose your
        personal identifiers.
      </Text>
      <Text style={styles.bulletContent}>
        • Sharing anonymized and de-identified data with affiliates and partners
        for joint service optimization (excluding identifiable boutique store map
        location data and reporting/blocking information).
      </Text>

      <Text style={styles.subTitle}>2. Transfer</Text>
      <Text style={styles.content}>
        We will not transfer your personal information to any third party without
        your explicit consent. Boutique store map location information, content
        reporting and user blocking related information will not be involved in
        any third-party transfer, except in statutory circumstances such as
        corporate merger, acquisition or bankruptcy liquidation, where the
        receiving party shall continue to abide by the exclusive usage provisions
        set forth in this Policy.
      </Text>

      <Text style={styles.subTitle}>3. Public Disclosure</Text>
      <Text style={styles.content}>
        Your personal information will only be publicly disclosed if you
        voluntarily make it public (such as publishing community content or
        uploading boutique store information within the map feature) or when
        required by applicable laws. We will take reasonable measures to protect
        your rights. Location information you actively upload to the boutique
        store map will only be displayed publicly within that feature. All
        operations and data related to content reporting and user blocking will
        not be disclosed on any platform or feature.
      </Text>

      {/* 4. Storage and Protection */}
      <Text style={styles.sectionTitle}>
        4. Storage and Protection of Personal Information
      </Text>
      <Text style={styles.content}>
        1. Storage Period: We store your personal information only for the
        shortest period necessary to fulfill the purposes set out in this Policy:
      </Text>
      <Text style={styles.bulletContent}>
        • Boutique store map location information: retained from the date of
        upload until you actively delete it or terminate your account; data will
        be cleared immediately upon deletion.
      </Text>
      <Text style={styles.bulletContent}>
        • Content reporting materials: retained for 6 months after review
        completion for compliance traceability, and automatically anonymized upon
        expiration.
      </Text>
      <Text style={styles.bulletContent}>
        • User blocking records: retained from the setup date until you cancel
        the block or terminate your account. All data will be deleted or
        anonymized legally upon expiry.
      </Text>
      <Text style={styles.content}>
        2. Storage Location: Your personal information will be stored in the
        United States. Boutique store map location information, content reporting
        and user blocking related data are stored exclusively within the United
        States with no cross-border transmission. If cross-border storage of
        other personal information is required, we will obtain your separate
        consent in advance and comply with relevant legal requirements.
      </Text>
      <Text style={styles.content}>
        3. Security Protection: We adopt technical and administrative measures
        including encrypted storage, access control and security auditing to
        prevent personal information leakage, loss and tampering. Boutique store
        map location information is stored with separate encryption. Content
        reporting and user blocking data are restricted to designated authorized
        personnel only, who are bound by strict confidentiality obligations. You
        acknowledge that inherent network security risks exist, and we cannot
        guarantee absolute information security.
      </Text>
      <Text style={styles.content}>
        4. We implement dedicated security measures for UGC-related information
        and content reporting/user blocking operation data to prevent
        unauthorized access and tampering, ensuring information security for your
        content publishing, interaction and rights protection activities.
      </Text>

      {/* 5. Your Rights */}
      <Text style={styles.sectionTitle}>
        5. Your Rights to Personal Information
      </Text>
      <Text style={styles.content}>
        You are entitled to the following rights under applicable U.S. privacy
        laws, which may be exercised via Me - Settings - Privacy Management
        within the application or by contacting customer support. You hold
        exclusive management rights over boutique store map location data and
        content reporting/user blocking records:
      </Text>
      <Text style={styles.content}>
        1. Right to Access and Copy: You may inquire and obtain a copy of your
        personal information, including uploaded boutique store map location
        data, reporting records and blocking lists, subject to legal exceptions.
      </Text>
      <Text style={styles.content}>
        2. Right to Rectify and Supplement: You may request correction or
        supplementation if your personal information is incorrect or incomplete,
        including erroneous location information on the boutique store map.
      </Text>
      <Text style={styles.content}>
        3. Right to Deletion: You may request deletion of your personal
        information if: the collection purpose has been fulfilled or storage is
        no longer required; you withdraw your consent; we violate agreed
        information processing rules; you voluntarily request deletion of
        boutique store map location data, UGC content or clearance of reporting
        records; you may cancel user blocking at any time via in-app functions,
        and relevant blocking records will be cleared immediately upon
        cancellation.
      </Text>
      <Text style={styles.content}>
        4. Right to Withdraw Consent: You may withdraw your consent to the
        collection and use of non-mandatory information at any time. Upon
        withdrawal of consent for boutique store map location data, we will
        immediately cease use and delete such information without affecting your
        basic browsing access to the feature. Withdrawal shall not affect prior
        lawful processing conducted under your original consent.
      </Text>
      <Text style={styles.content}>
        5. Right to File Complaints: If you believe our information processing
        infringes your legitimate rights, you may submit complaints via the
        contact channels specified in this Policy. We will prioritize and
        promptly handle any information leakage issues arising from UGC
        publishing, boutique store map usage, content reporting or user blocking
        functions.
      </Text>
      <Text style={styles.content}>
        6. You may use the Report function on any UGC detail page, user profile
        or interaction interface to submit violation appeals, or use the Block
        function to block other users with one click. No additional personal
        information is required for such operations, which take effect in real
        time.
      </Text>

      <Text style={styles.highlight}>
        We will acknowledge and respond to your rights requests within 15
        business days without imposing unreasonable barriers.
      </Text>

      {/* 6. Minor Protection */}
      <Text style={styles.sectionTitle}>6. Minor Protection</Text>
      <Text style={styles.content}>
        1. We do not intentionally provide services to minors under the age of
        18. Minors shall use our platform under the supervision and explicit
        consent of their legal guardians. Guardians shall assist minors in
        properly uploading location information on the boutique store map to
        avoid unnecessary personal positioning leakage, and guide minors in
        identifying violating content when using reporting and blocking functions
        to protect their online rights.
      </Text>
      <Text style={styles.content}>
        2. If we unintentionally collect minor personal information, we will
        immediately cease processing and delete relevant data. Guardians may
        contact us with valid proof to inquire about or delete minor-related
        information including boutique store map location data, UGC content, and
        reporting/blocking records.
      </Text>
      <Text style={styles.content}>
        3. We apply stricter review and protection measures for UGC published by
        minors, and optimize the operation path of content reporting and user
        blocking functions for minors to facilitate rapid rights protection and
        prevent harm from inappropriate online content and interactions.
      </Text>

      {/* 7. Updates */}
      <Text style={styles.sectionTitle}>7. Updates to This Privacy Policy</Text>
      <Text style={styles.content}>
        1. We may update this Privacy Policy in response to changes in applicable
        laws or business adjustments. Any material changes to the usage rules of
        boutique store map location information, content reporting and user
        blocking data will be prominently notified separately. Updated terms will
        be announced via in-app notices or pop-ups and take effect upon
        publication.
      </Text>
      <Text style={styles.content}>
        2. If updates involve material changes to your legitimate rights and
        interests (such as expanded information collection scope, revised sharing
        rules, or changed usage purposes for boutique store map location data,
        reporting and blocking information), we will provide 30 days' prior
        notice. Your continued use of our services after the update constitutes
        acceptance of the revised Privacy Policy.
      </Text>

      {/* 8. Contact Us */}
      <Text style={styles.sectionTitle}>8. Contact Us</Text>
      <Text style={styles.content}>
        If you have any questions, comments or complaints regarding this Privacy
        Policy, especially concerning the use of boutique store map location
        information, UGC data processing, and information handling for content
        reporting and user blocking functions, please contact us via:
      </Text>
      <Text style={styles.contactInfo}>
        Support Email: Melanie@avantregard.us
      </Text>
      <Text style={styles.content}>
        We will respond and address your feedback in a timely manner upon
        receipt.
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
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    subTitle: {
      fontSize: 15,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 8,
      marginTop: 12,
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
