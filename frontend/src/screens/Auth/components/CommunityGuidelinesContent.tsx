import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemedStyles, type AppTheme } from "../../../theme";

export const CommunityGuidelinesContent: React.FC = () => {
  const { i18n } = useTranslation();
  // The app only ever sets "zh" or "en"; default to the English document for
  // any non-Chinese locale to mirror the i18n fallback (fallbackLng: "en").
  if (i18n.language?.startsWith("zh")) return <CommunityGuidelinesContentZh />;
  return <CommunityGuidelinesContentEn />;
};

const CommunityGuidelinesContentZh: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>Avant Regard 平台自律公约</Text>
      <Text style={styles.lastUpdated}>更新日期：2026.4.3</Text>
      <Text style={styles.lastUpdated}>生效日期：2026.4.4.</Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          制定方：上海南特克实业有限公司
        </Text>
      </View>

      <Text style={styles.intro}>
        为构建真实、安全、公平、有序的二手设计师时装交易与社区生态，严打异议性、滥用性内容及行为，保障用户内容举报、用户屏蔽的合法维权权利，守护未成年人网络权益，保障全体用户的合法权益，维护
        Avant Regard
        平台（以下简称"平台"）的健康发展，依据国家相关法律法规及平台服务协议、隐私政策，制定本公约。本公约适用于所有使用平台产品及服务的用户（包括买家、卖家、内容发布者等），是平台管理的核心依据，您使用平台服务、发布/访问用户生成内容（UGC）、使用买手店地图功能的行为，即视为同意遵守本公约全部条款，认可平台对违规内容/行为的零容忍态度及管控措施。
      </Text>

      <Text style={styles.sectionTitle}>一、核心原则</Text>
      <Text style={styles.content}>
        1.
        真实诚信：用户应保证身份信息、发布内容、交易信息的真实性，恪守承诺，履行约定，共建信任环境。
      </Text>
      <Text style={styles.content}>
        2.
        合法合规：严格遵守国家法律法规及平台规则，不得利用平台从事违法违规活动，严禁发布/传播异议性、滥用性内容。
      </Text>
      <Text style={styles.content}>
        3.
        平等尊重：交易双方地位平等，社区互动应相互尊重，不得实施歧视、侮辱、人身攻击、网络欺凌等滥用性行为，主动维护文明网络环境。
      </Text>
      <Text style={styles.content}>
        4.
        安全自律：自觉维护平台安全，保护自身及他人的信息安全与财产权益，合理使用内容举报、用户屏蔽功能，不恶意滥用维权权利。
      </Text>
      <Text style={styles.warning}>
        5.
        零容忍原则：对平台内色情、暴力、低俗、歧视、诽谤、侵权等异议性内容，及人身攻击、骚扰、恶意营销等滥用性行为持绝对零容忍态度，一经发现立即从严处理。
      </Text>

      <Text style={styles.sectionTitle}>二、用户行为规范</Text>

      <Text style={styles.subTitle}>（一）身份与账号规范</Text>
      <Text style={styles.content}>
        1.
        完成实名认证及必要的实人认证，提供真实、准确、完整的身份信息，不得使用虚假信息注册账号；未成年人不得独立注册账号，需由监护人代为操作。
      </Text>
      <Text style={styles.content}>
        2.
        账号所有权归平台所有，用户仅享有使用权，严禁赠与、借用、出租、售卖账号，否则平台有权收回账号，并永久冻结该账号的内容发布、社区互动等全部权限。
      </Text>
      <Text style={styles.content}>
        3.
        妥善保管账号密码及验证信息，对账号下的所有行为（包括发布内容、交易操作、互动行为、举报/屏蔽操作）承担全部责任，账号被盗应及时联系平台处理，平台将协助冻结账号并停止相关功能使用。
      </Text>

      <Text style={styles.subTitle}>（二）交易行为规范</Text>
      <Text style={styles.content}>
        1.
        商品发布：仅可发布二手设计师时装及相关合法商品，不得发布假冒伪劣、侵权盗版、违禁品等违规商品；商品描述、图片等UGC内容需真实准确，不得发布虚假宣传、夸大描述的误导性内容。商品信息应真实准确，明确标注品牌、型号、成色、瑕疵等关键信息，不得使用虚假宣传、夸大描述；不得在商品内容中夹带广告、低俗信息等无关内容。
      </Text>
      <Text style={styles.content}>
        2.
        交易履约：遵循平等、自愿、公平原则达成交易，不得强制交易、恶意砍价或设置不合理交易条件；不得通过交易行为实施骚扰、欺诈等滥用性行为。选择平台指定的交易渠道完成交易，遵守支付、发货、收货等流程要求；不得利用交易渠道泄露他人信息、传播违规内容。二手商品除双方另有约定外，不适用七天无理由退换货，卖家应保证商品与描述一致，买家应及时确认收货；交易纠纷应自行友好协商，不得在平台发布辱骂、诋毁等违规内容。
      </Text>
      <Text style={styles.content}>
        3.
        资金安全：平台采用第三方资金托管机制保障交易资金安全，用户应遵守平台资金管理规则，不得参与洗钱、诈骗等违法资金操作；不得利用资金交易进行恶意刷单、刷评等扰乱平台秩序的行为。
      </Text>

      <Text style={styles.subTitle}>（三）社区与内容规范</Text>
      <Text style={styles.content}>
        1. 内容发布（全平台UGC内容通用，含社区、商品描述、买手店地图等）：
      </Text>
      <Text style={styles.bulletContent}>
        •
        发布的文字、图片、视频、评价、秀场/买手店信息等所有内容，应合法合规、文明健康，严禁发布包含色情、暴力、低俗、歧视、诽谤、威胁、恐怖主义、极端主义等异议性内容，及任何涉及人身攻击、网络欺凌的滥用性内容。
      </Text>
      <Text style={styles.bulletContent}>
        •
        尊重知识产权，不得盗图、抄袭他人内容，引用第三方素材需获得合法授权；发布的内容不得侵犯他人肖像权、名誉权、隐私权等合法权益。
      </Text>
      <Text style={styles.bulletContent}>
        •
        在秀场与买手店地图功能上传的内容，需保证真实性与合法性，不得上传虚假定位、虚假门店信息，不得在该功能内发布广告、低俗等无关内容，该行为属于用户独立行为，由用户自行承担全部责任；位置信息仅用于该功能展示，不得泄露他人位置隐私。
      </Text>
      <Text style={styles.bulletContent}>
        •
        不得发布垃圾广告、恶意营销、刷屏等扰乱平台内容秩序的信息，不得利用内容发布功能实施骚扰、诱导交易等行为。
      </Text>

      <Text style={styles.content}>2. 互动行为：</Text>
      <Text style={styles.bulletContent}>
        •
        社区互动应文明用语，尊重他人，不得实施辱骂、诋毁、人身攻击、网络欺凌、人肉搜索等滥用性行为，遇纠纷应理性沟通或通过平台举报功能维权。
      </Text>
      <Text style={styles.bulletContent}>
        •
        不得恶意刷单、刷评、炒作流量，不得发布垃圾广告、骚扰信息；不得组织或参与恶意互评、抹黑他人店铺/商品等不正当竞争行为。
      </Text>
      <Text style={styles.bulletContent}>
        •
        支持同行友好交流，禁止恶意竞争、抹黑他人店铺或商品；合理使用平台提供的内容举报、用户屏蔽功能，不得恶意举报、无故屏蔽其他用户，平台将对恶意维权行为进行反制。
      </Text>

      <Text style={styles.content}>3. 内容举报与用户屏蔽使用规范：</Text>
      <Text style={styles.bulletContent}>
        •
        用户有权对平台内的异议性、滥用性内容进行一键举报，对实施滥用性行为的用户进行一键屏蔽，平台保障用户的合法维权权利，对举报/屏蔽操作快速响应、及时处理。
      </Text>
      <Text style={styles.bulletContent}>
        •
        举报内容时应提交真实、准确的相关证据，不得捏造事实、恶意举报他人；平台将对举报信息严格保密，仅用于审核处理，不向第三方泄露。
      </Text>
      <Text style={styles.bulletContent}>
        •
        屏蔽用户后，被屏蔽用户将无法向您进行私信、评论等互动，其内容也将不再向您展示；不得利用屏蔽功能实施平台内的排斥、孤立等不正当行为。
      </Text>

      <Text style={styles.subTitle}>（四）隐私与信息保护</Text>
      <Text style={styles.content}>
        1.
        不得泄露他人隐私信息，包括但不限于真实姓名、身份证号、电话号码、住址、位置信息、交易记录等；不得在内容中公开他人隐私，不得利用买手店地图功能泄露他人门店/个人定位隐私。
      </Text>
      <Text style={styles.content}>
        2.
        不得非法收集、使用、买卖其他用户的个人信息；不得通过平台互动、交易等渠道套取他人隐私信息。
      </Text>
      <Text style={styles.content}>
        3.
        妥善保护自身个人信息，避免因自身疏忽导致信息泄露；发布内容时应避免泄露自身姓名、位置、联系方式等敏感信息。
      </Text>
      <Text style={styles.content}>
        4.
        平台将对用户举报、屏蔽操作的相关信息严格保密，不得泄露用户的维权操作记录及相关信息。
      </Text>

      <Text style={styles.subTitle}>（五）未成年人保护专属规范</Text>
      <Text style={styles.content}>
        1.
        未成年人不得独立使用平台服务，未满18周岁用户需在监护人陪同、指导下使用，由监护人代为完成注册、交易、内容浏览等所有操作。
      </Text>
      <Text style={styles.content}>
        2.
        禁止未成年人在平台发布任何UGC内容、参与社区互动、进行商品交易及付费操作；监护人应协助未成年人规范使用平台，若发现未成年人擅自发布内容，可联系平台立即删除。
      </Text>
      <Text style={styles.content}>
        3.
        所有用户不得在平台发布不适宜未成年人的内容，不得对未成年人实施骚扰、诱导等行为；发现平台内有侵害未成年人权益的内容/行为，应及时向平台举报，平台将优先受理、从严处理。
      </Text>

      <Text style={styles.subTitle}>（六）买手店地图功能专属规范</Text>
      <Text style={styles.content}>
        1.
        仅可在该功能内发布秀场、买手店的真实相关信息，不得发布与功能无关的广告、低俗、虚假信息，不得上传他人门店的虚假定位或负面恶意信息。
      </Text>
      <Text style={styles.content}>
        2.
        上传的位置信息仅用于该功能内的点位展示、导航服务，不得利用位置信息实施骚扰、跟踪、恶意竞争等行为。
      </Text>
      <Text style={styles.content}>
        3.
        尊重他人门店的知识产权及信息权益，不得盗用他人门店信息、图片等内容发布至该功能。
      </Text>

      <Text style={styles.sectionTitle}>三、违规处理</Text>
      <Text style={styles.content}>
        1.
        平台有权通过技术自动审核+人工复核的方式，对用户行为及发布内容进行全量、实时审核，发现异议性、滥用性内容/行为，将根据情节轻重采取以下措施，且无需提前通知用户：
      </Text>
      <Text style={styles.bulletContent}>
        • 轻微违规：警告提醒、删除违规内容、限制部分功能使用；
      </Text>
      <Text style={styles.bulletContent}>
        •
        中度违规：账号限流、暂停交易/内容发布权限、扣除信用分、清空违规内容；
      </Text>
      <Text style={styles.bulletContent}>
        •
        严重违规：永久封禁账号、清空账号数据、收回账号使用权，涉及违法犯罪的，移交司法机关处理；
      </Text>
      <Text style={styles.bulletContent}>
        •
        对发布异议性/滥用性内容、实施人身攻击/网络欺凌、恶意泄露他人隐私的行为，一律按中/重度违规从严处理，多次违规直接永久封禁。
      </Text>
      <Text style={styles.content}>
        2.
        建立用户信用体系，根据用户履约情况、违规记录、举报/屏蔽使用情况等进行信用评级，信用评级将影响用户在平台的权益；恶意举报、滥用屏蔽功能的用户，将扣除信用分并限制相关维权功能使用。
      </Text>
      <Text style={styles.content}>
        3.
        平台对违规内容的处理结果（如删除、屏蔽）将通过站内信反馈给相关用户；用户对违规处理有异议的，可通过平台申诉渠道提交申诉，平台将在收到申诉后24小时内复核并反馈结果。
      </Text>
      <Text style={styles.content}>
        4.
        因用户违规行为导致平台或其他用户遭受损失的，违规用户应承担全部赔偿责任，平台有权向违规用户全额追偿。
      </Text>

      <Text style={styles.sectionTitle}>四、公约修订与执行</Text>
      <Text style={styles.content}>
        1.
        平台可根据法律法规变化、监管要求及业务发展需要修订本公约，尤其针对异议性/滥用性内容管控、举报/屏蔽功能规则、未成年人保护规范的修订，将单独重点公示；修订后的公约将通过平台公告公示，自公示之日起生效，您继续使用平台服务即视为同意修订后的公约。
      </Text>
      <Text style={styles.content}>
        2.
        本公约未尽事宜，适用平台服务协议、隐私政策、未成年人个人信息保护规则及其他相关规则，平台有权根据公约原则对具体场景进行解释和处理。
      </Text>
      <Text style={styles.content}>
        3.
        平台对本公约的执行，将遵循公平、公正、公开的原则，对所有用户一视同仁，保障合法用户的权益，严厉打击违规行为。
      </Text>

      <Text style={styles.sectionTitle}>五、投诉与反馈</Text>
      <Text style={styles.content}>
        1.
        如发现平台内的异议性、滥用性内容/行为，或遭遇他人骚扰、侵权等情况，可通过平台内内容详情页【举报】按钮、用户主页【屏蔽】按钮进行一键维权，平台将在24小时内完成审核处理并反馈结果。
      </Text>
      <Text style={styles.content}>
        2. 如对平台规则、违规处理、功能使用有相关疑问、建议，可通过以下方式反馈：
      </Text>
      <Text style={styles.contactInfo}>
        客服邮箱：avant.regarde61@gmail.com{"\n"}
        客服微信：Avantregard2025{"\n"}
        平台内"我的-设置-意见反馈"入口
      </Text>
      <Text style={styles.content}>
        3.
        针对未成年人保护、隐私泄露、严重人身攻击等紧急投诉，平台将提供优先处理服务，确保在12小时内响应并处理。
      </Text>

      <Text style={styles.footer}>
        平台将持续完善内容管控、维权保障机制，与全体用户共同打造文明、安全、有序的平台生态，感谢您的遵守与配合！
      </Text>
    </View>
  );
};

const CommunityGuidelinesContentEn: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>
        Avant Regard Platform Self-Discipline Convention
      </Text>
      <Text style={styles.lastUpdated}>Last Updated: April 3, 2026</Text>
      <Text style={styles.lastUpdated}>Effective Date: April 4, 2026</Text>

      <View style={styles.companyInfo}>
        <Text style={styles.companyText}>
          Formulator: Avant Regard Inc.{"\n"}
          This Convention shall be governed exclusively by the laws of the United
          States.
        </Text>
      </View>

      <Text style={styles.intro}>
        To build a genuine, safe, fair and orderly secondhand designer fashion
        trading and community ecosystem, severely crack down on inappropriate and
        abusive content and behaviors, protect users' legitimate rights to report
        content and block other users, safeguard minors' online rights and
        interests, defend the lawful interests of all users, and maintain the
        healthy development of the Avant Regard platform (hereinafter referred to
        as the "Platform"), this Convention is formulated in accordance with
        applicable U.S. laws and regulations, the Platform's Service Agreement
        and Privacy Policy.
      </Text>
      <Text style={styles.intro}>
        This Convention applies to all users who access and use the Platform's
        products and services (including buyers, sellers and content
        publishers). It serves as the core basis for Platform management. Your
        use of Platform services, publishing or browsing User Generated Content
        (UGC), and use of the boutique store map feature shall be deemed your
        full acceptance of all terms herein, as well as your recognition of the
        Platform's zero-tolerance policy and regulatory measures against
        violating content and improper conduct.
      </Text>

      <Text style={styles.sectionTitle}>1. Core Principles</Text>
      <Text style={styles.content}>
        1. Authenticity and Integrity: Users shall ensure the truthfulness of
        their identity information, published content and transaction
        information, abide by commitments and fulfill agreements to jointly build
        a trustworthy environment.
      </Text>
      <Text style={styles.content}>
        2. Compliance with Laws and Rules: Strictly abide by applicable laws and
        Platform rules. Users shall not use the Platform to engage in illegal
        activities or publish/disseminate any inappropriate or abusive content.
      </Text>
      <Text style={styles.content}>
        3. Equality and Respect: All transaction parties enjoy equal status.
        Mutual respect shall be maintained in community interactions.
        Discrimination, insult, personal attack, cyber bullying and other abusive
        behaviors are prohibited, and a civilized online environment shall be
        actively upheld.
      </Text>
      <Text style={styles.content}>
        4. Self-Discipline and Security: Consciously maintain Platform security,
        protect personal and others' information and property rights, properly
        use the content reporting and user blocking functions, and refrain from
        malicious abuse of rights protection channels.
      </Text>
      <Text style={styles.warning}>
        5. Zero-Tolerance Principle: The Platform adopts an absolute
        zero-tolerance attitude toward pornographic, violent, vulgar,
        discriminatory, defamatory and infringing content, as well as abusive
        behaviors including personal attack, harassment and malicious marketing.
        Any violation will be dealt with strictly once detected.
      </Text>

      <Text style={styles.sectionTitle}>2. User Code of Conduct</Text>

      <Text style={styles.subTitle}>2.1 Identity and Account Rules</Text>
      <Text style={styles.content}>
        1. Complete real-name verification and necessary identity authentication,
        and provide true, accurate and complete identity information. Registration
        with false information is prohibited. Minors shall not register
        independently and must be assisted by their legal guardians.
      </Text>
      <Text style={styles.content}>
        2. All Platform accounts remain the property of the Platform. Users only
        obtain personal usage rights. Gifting, lending, renting or selling
        accounts are strictly prohibited. The Platform reserves the right to
        reclaim such accounts and permanently suspend all privileges including
        content publishing and community interaction.
      </Text>
      <Text style={styles.content}>
        3. Properly keep your account password and verification credentials, and
        bear full responsibility for all activities under your account, including
        content publication, transaction operations, interactions, reporting and
        blocking actions. Immediately contact the Platform if your account is
        compromised; the Platform may assist with account freezing and suspend
        related functions.
      </Text>

      <Text style={styles.subTitle}>2.2 Transaction Code of Conduct</Text>
      <Text style={styles.content}>1. Product Publication</Text>
      <Text style={styles.bulletContent}>
        • Only secondhand designer fashion and other legal goods may be posted.
        Counterfeit, pirated, infringing and prohibited items are forbidden. All
        UGC including product descriptions and images must be true and accurate;
        false promotion and exaggerated misleading statements are not allowed.
      </Text>
      <Text style={styles.bulletContent}>
        • Product information shall clearly mark brand, model, condition, flaws
        and other key details. Irrelevant advertisements or vulgar content shall
        not be attached to product postings.
      </Text>
      <Text style={styles.content}>2. Transaction Performance</Text>
      <Text style={styles.bulletContent}>
        • Conduct transactions on the principles of equality, voluntariness and
        fairness. Forced transactions, malicious bargaining and unreasonable
        transaction terms are prohibited. Harassment and fraud through transaction
        conduct are forbidden.
      </Text>
      <Text style={styles.bulletContent}>
        • Complete transactions via designated Platform payment channels and
        comply with payment, shipment and receiving procedures. Do not disclose
        others' private information or spread violating content through
        transaction channels.
      </Text>
      <Text style={styles.bulletContent}>
        • Secondhand goods do not support seven-day no-reason return unless
        otherwise agreed by both parties. Sellers shall ensure goods match
        descriptions; buyers shall confirm receipt in a timely manner.
        Transaction disputes shall be resolved through friendly negotiation;
        abusive or defamatory postings on the Platform are prohibited.
      </Text>
      <Text style={styles.content}>
        3. Fund Security: The Platform adopts third-party fund escrow to protect
        transaction funds. Users shall comply with Platform fund management rules
        and refrain from money laundering, fraud or other illegal financial
        activities. Malicious order brushing and fake reviews that disrupt
        Platform order are prohibited.
      </Text>

      <Text style={styles.subTitle}>2.3 Community and Content Rules</Text>
      <Text style={styles.content}>
        1. Content Publication (Applicable to all UGC across the Platform,
        including community posts, product descriptions and boutique store map)
      </Text>
      <Text style={styles.bulletContent}>
        • All published texts, images, videos, reviews, fashion show and boutique
        store information must be legal, compliant and civilized. Publishing
        pornographic, violent, vulgar, discriminatory, defamatory, threatening,
        terrorist or extremist content is strictly prohibited, as well as any
        content involving personal attack and cyber bullying.
      </Text>
      <Text style={styles.bulletContent}>
        • Respect intellectual property rights. Unauthorized image theft and
        content plagiarism are forbidden; third-party materials must be legally
        authorized before use. Published content shall not infringe others'
        portrait rights, reputation rights, privacy rights or other legitimate
        interests.
      </Text>
      <Text style={styles.bulletContent}>
        • Content uploaded to the fashion show and boutique store map must be true
        and legal. False positioning, fake store information, advertisements and
        irrelevant vulgar content are prohibited. Such postings are independent
        user conduct for which the user bears full legal responsibility. Location
        information is only used for in-feature display and shall not expose
        others' geographic privacy.
      </Text>
      <Text style={styles.bulletContent}>
        • Spam advertisements, malicious marketing and screen-spamming content
        that disrupt Platform order are prohibited. Do not use content publishing
        functions to harass others or induce improper transactions.
      </Text>

      <Text style={styles.content}>2. Interactive Conduct</Text>
      <Text style={styles.bulletContent}>
        • Use civilized language in community interactions and respect other
        users. Insult, defamation, personal attack, cyber bullying and doxxing
        are forbidden. Resolve disputes rationally or use the Platform reporting
        function for rights protection.
      </Text>
      <Text style={styles.bulletContent}>
        • Malicious order brushing, fake reviews and traffic manipulation are
        prohibited. Spam advertisements and harassing messages shall not be
        posted. Organizing or participating in malicious mutual reviews and
        smearing other stores or products constitutes unfair competition and is
        forbidden.
      </Text>
      <Text style={styles.bulletContent}>
        • Friendly peer communication is encouraged; malicious competition and
        unfair smearing of other merchants or products are prohibited. Properly
        use the Platform's reporting and blocking functions; malicious reporting
        and unreasonable blocking of other users are not allowed, and the Platform
        will impose sanctions on such abuse.
      </Text>

      <Text style={styles.content}>
        3. Rules for Using Reporting and Blocking Functions
      </Text>
      <Text style={styles.bulletContent}>
        • Users have the right to one-click report inappropriate or abusive
        content and one-click block users engaging in abusive behavior. The
        Platform guarantees users' legitimate rights protection and responds
        promptly to all reports and blocking requests.
      </Text>
      <Text style={styles.bulletContent}>
        • Submit genuine and accurate evidence when reporting; fabricating facts
        and malicious reporting against others are prohibited. The Platform keeps
        all reporting information strictly confidential and only uses it for
        review and handling without disclosure to any third party.
      </Text>
      <Text style={styles.bulletContent}>
        • After blocking a user, the blocked party cannot send you private
        messages, comments or other interactions, and their UGC will no longer be
        displayed to you. Do not misuse the blocking function to exclude or
        isolate other users on the Platform.
      </Text>

      <Text style={styles.subTitle}>2.4 Privacy and Information Protection</Text>
      <Text style={styles.content}>
        1. Do not disclose others' private information, including without
        limitation real name, ID number, phone number, residential address,
        location data and transaction records. Publicly revealing others' privacy
        in content postings or disclosing store/personal positioning via the
        boutique store map is prohibited.
      </Text>
      <Text style={styles.content}>
        2. Illegal collection, use or trading of other users' personal
        information is forbidden. Do not obtain others' private information
        through Platform interactions or transactions.
      </Text>
      <Text style={styles.content}>
        3. Properly protect your own personal information and avoid leakage caused
        by personal negligence. Refrain from publishing sensitive personal
        details such as real name, location and contact information in your
        postings.
      </Text>
      <Text style={styles.content}>
        4. The Platform maintains strict confidentiality of user reporting and
        blocking records and will not disclose any rights-protection operation
        data to external parties.
      </Text>

      <Text style={styles.subTitle}>2.5 Special Protection Rules for Minors</Text>
      <Text style={styles.content}>
        1. Minors under the age of 18 shall not use Platform services
        independently. They may only use the Platform under the accompaniment and
        guidance of legal guardians, who shall complete all registration,
        transaction and content browsing procedures on their behalf.
      </Text>
      <Text style={styles.content}>
        2. Minors are prohibited from publishing UGC, participating in community
        interactions, conducting transactions or making paid purchases on the
        Platform. Guardians shall supervise minor usage and may contact the
        Platform for immediate removal of unauthorized minor postings.
      </Text>
      <Text style={styles.content}>
        3. All users are prohibited from posting content inappropriate for minors
        or engaging in harassment and inducement toward minors. Any content or
        behavior infringing minor rights shall be reported promptly, and the
        Platform will prioritize and strictly handle such cases.
      </Text>

      <Text style={styles.subTitle}>
        2.6 Exclusive Rules for Boutique Store Map Feature
      </Text>
      <Text style={styles.content}>
        1. Only genuine information related to fashion shows and boutique stores
        may be published within this feature. Irrelevant advertisements, vulgar
        content and false information are prohibited. Uploading fake positioning
        or malicious negative information about third-party stores is forbidden.
      </Text>
      <Text style={styles.content}>
        2. Uploaded location information is solely used for in-feature venue
        marking and navigation services. Do not misuse location data for
        harassment, stalking or malicious competition.
      </Text>
      <Text style={styles.content}>
        3. Respect the intellectual property and information rights of other store
        operators, and do not misappropriate other stores' information or images
        for publication within this feature.
      </Text>

      <Text style={styles.sectionTitle}>3. Violation Handling</Text>
      <Text style={styles.content}>
        1. The Platform may conduct full real-time review of user conduct and
        published content via automated technology combined with manual
        verification. Upon detecting inappropriate or abusive content/behavior,
        the Platform may adopt the following measures based on severity, without
        prior notice:
      </Text>
      <Text style={styles.bulletContent}>
        • Minor Violations: warning reminders, deletion of violating content,
        restriction of partial function usage;
      </Text>
      <Text style={styles.bulletContent}>
        • Moderate Violations: account traffic restriction, suspension of
        transaction/content publishing privileges, deduction of credit points,
        clearance of violating content;
      </Text>
      <Text style={styles.bulletContent}>
        • Serious Violations: permanent account ban, clearance of account data,
        reclamation of account usage rights; cases involving illegal or criminal
        conduct will be referred to judicial authorities;
      </Text>
      <Text style={styles.bulletContent}>
        • Publishing inappropriate/abusive content, committing personal
        attacks/cyber bullying, or maliciously disclosing others' privacy will be
        strictly handled as moderate/serious violations. Repeated violations will
        result in immediate permanent ban.
      </Text>
      <Text style={styles.content}>
        2. The Platform establishes a user credit system, rating users based on
        performance records, violation history and reporting/blocking usage.
        Credit ratings affect user privileges on the Platform. Users who
        maliciously report or abuse the blocking function will have credit points
        deducted and related rights-protection functions restricted.
      </Text>
      <Text style={styles.content}>
        3. Results of violation handling (such as deletion or blocking) will be
        notified to relevant users via in-app messages. Users who object to
        violation handling may submit an appeal through the Platform appeal
        channel, and the Platform will review and provide feedback within 24
        hours of receiving the appeal.
      </Text>
      <Text style={styles.content}>
        4. If user violations cause losses to the Platform or other users, the
        violating user shall bear full compensation liability, and the Platform
        reserves the right to full recovery from the violating user.
      </Text>

      <Text style={styles.sectionTitle}>
        4. Convention Revision and Enforcement
      </Text>
      <Text style={styles.content}>
        1. The Platform may revise this Convention in response to changes in laws
        and regulations, regulatory requirements and business development needs.
        Revisions concerning the control of inappropriate/abusive content,
        reporting/blocking function rules and minor protection standards will be
        prominently announced separately. The revised Convention will be
        published via Platform announcements and take effect upon publication.
        Your continued use of Platform services constitutes acceptance of the
        revised Convention.
      </Text>
      <Text style={styles.content}>
        2. Matters not covered by this Convention shall be governed by the
        Platform Service Agreement, Privacy Policy, Minor Personal Information
        Protection Rules and other relevant rules. The Platform reserves the
        right to interpret and handle specific scenarios in accordance with the
        principles of this Convention.
      </Text>
      <Text style={styles.content}>
        3. The Platform enforces this Convention based on the principles of
        fairness, justice and transparency, treating all users equally,
        safeguarding the rights of compliant users and strictly cracking down on
        violations.
      </Text>

      <Text style={styles.sectionTitle}>5. Complaints and Feedback</Text>
      <Text style={styles.content}>
        1. If you discover inappropriate or abusive content/behavior on the
        Platform, or encounter harassment, infringement or similar situations,
        you may protect your rights with one click via the Report button on the
        content detail page or the Block button on a user profile. The Platform
        will complete review and provide feedback within 24 hours.
      </Text>
      <Text style={styles.content}>
        2. If you have questions or suggestions regarding Platform rules,
        violation handling or function usage, you may provide feedback via:
      </Text>
      <Text style={styles.contactInfo}>
        Support Email: Melanie@avantregard.us{"\n"}
        Support WeChat: Avantregard2025{"\n"}
        In-app "Me - Settings - Feedback" entry
      </Text>
      <Text style={styles.content}>
        3. For urgent complaints concerning minor protection, privacy leakage or
        serious personal attacks, the Platform provides priority processing and
        will respond and handle the matter within 12 hours.
      </Text>

      <Text style={styles.footer}>
        The Platform will continuously improve its content control and
        rights-protection mechanisms, and work with all users to build a
        civilized, safe and orderly platform ecosystem. Thank you for your
        compliance and cooperation!
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
    // Warning callout keeps brand red literals; the surface flips to a
    // theme-aware tinted card so it still reads as a warning in dark mode.
    warning: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: "#C41E3A",
      lineHeight: 22,
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: "#C41E3A",
      marginBottom: 8,
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
