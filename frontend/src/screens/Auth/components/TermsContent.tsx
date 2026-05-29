import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemedStyles, type AppTheme } from "../../../theme";

export const TermsContent: React.FC = () => {
  const { i18n } = useTranslation();
  // The app only ever sets "zh" or "en"; default to the English document for
  // any non-Chinese locale to mirror the i18n fallback (fallbackLng: "en").
  if (i18n.language?.startsWith("zh")) return <TermsContentZh />;
  return <TermsContentEn />;
};

const TermsContentZh: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>Avant Regard 软件许可及服务协议</Text>
      <Text style={styles.lastUpdated}>更新日期：2026年4月3日</Text>
      <Text style={styles.operator}>运营方：上海南特克实业有限公司</Text>

      <Text style={styles.intro}>
        《Avant Regard 软件许可及服务协议》（以下简称"本协议"）是由您与 Avant
        Regard 运营方上海南特克实业有限公司（以下简称"甲方"）就使用 Avant Regard
        产品（以下简称"本软件"）和服务所达成的协议。在您开始使用本软件及相关服务之前，请您务必审慎阅读本协议及甲方公布的《Avant
        Regard 隐私政策》《Avant Regard
        平台自律公约》，并充分理解各条款内容，特别是涉及限制或者免除甲方责任、加重您责任、排除您主要权利的条款，以及针对用户生成内容（UGC）的内容规范、违规处理及平台管控措施的条款。
        {"\n\n"}
        <Text style={styles.boldText}>
          限制、免除责任条款及用户生成内容专项条款将以加粗字体提示您注意，请您务必重点阅读。
        </Text>
      </Text>

      <Text style={styles.content}>
        您确认，您应具备中华人民共和国法律规定的与您行为相适应的民事行为能力，确保有能力对您使用本软件及服务的一切行为独立承担责任。若您为无民事行为能力人或限制民事行为能力人，应在监护人陪同下阅读本协议，并在取得监护人明确同意后使用本软件及服务。
      </Text>

      <Text style={styles.content}>
        如果您对本协议的任何条款有异议，或者无法准确理解本协议任何条款，请不要访问和/或使用本软件及其相关服务。您下载、安装、注册账号、登录使用本软件的行为，将被视为您已充分理解并同意签署本协议，自愿作为协议一方当事人接受本协议的全部约束，尤其认可并遵守本协议中关于用户生成内容的所有禁止性规定和违规处理规则，同意甲方对违规内容和行为采取的管控措施。
      </Text>

      <Text style={styles.content}>
        如有任何疑问，您可以通过本协议公示的联系方式（客服邮箱：avant.regarde61@gmail.com；客服微信：Avantregard2025）或本软件内提供的其他反馈渠道联系我们，我们将尽快为您解答。
      </Text>

      {/* 第1章 协议范围 */}
      <Text style={styles.sectionTitle}>1. 协议范围</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.1</Text>{" "}
        本协议约定了甲方与您之间就使用本软件及相关服务事宜发生的权利义务关系，尤其适用于您在本软件上发布、上传、分享的所有用户生成内容（包括但不限于文字、图片、视频、评价、秀场信息、买手店内容、穿搭分享、商品描述等，以下统称"UGC内容"）相关的权利义务。甲方有权根据业务发展需要，将本协议项下的权利义务全部或部分委托给甲方的关联公司或第三方主体履行，甲方将通过本软件公告页面提前
        30
        日公示委托事项，无需另行单独征得您同意；但若该委托行为将实质性减损您的合法权益，甲方应在委托前通过弹窗、短信等方式单独征求您的书面同意。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.2</Text>{" "}
        甲方：指上海南特克实业有限公司，统一社会信用代码：9131011877976576X6；注册地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室；联络地址：上海市青浦区练塘镇章练塘路588弄15号1幢二层C区2096室
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.3</Text>{" "}
        用户：又称"您"，是指任何以合法方式获取和使用本软件及服务，且同意遵守本协议UGC内容相关规范的自然人、法人或非法人组织。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.4</Text>{" "}
        本软件：指由甲方合法拥有并运营的、标注名称为 Avant Regard
        的移动客户端应用程序（iOS版本）及对应域名的移动网站、公众号等终端与内容形态，甲方有权根据业务需要新增或调整软件终端形态，无需另行通知。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.5</Text>{" "}
        本服务：指甲方依托本软件向您提供的二手设计师时装交易、商品展示、鉴定评估、社区互动、秀场与买手店地图等各项运营服务，包括为您发布UGC内容提供的存储、展示、传播技术服务，以及为管控违规UGC内容、保护用户权益提供的投诉、举报、屏蔽、拉黑等管理服务，甲方有权根据业务发展调整服务内容及形式。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.6</Text>{" "}
        本协议内容同时包括甲方及其关联企业可能不断发布的关于本软件及服务的业务规则、相关协议及其修订版本等内容，其中针对UGC内容的专项管理规则为本协议核心组成部分。上述内容一经正式发布，即为本协议不可分割的组成部分，您同样应当遵守；若您不接受修订后的内容，应立即停止使用本软件及服务。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>1.7</Text>{" "}
        特别申明：您在本软件秀场与买手店地图功能中上传的所有UGC内容（包括但不限于秀场信息、买手店地址、图片、评价等），均属于您的独立行为，甲方仅提供信息存储与展示的技术服务，不对该等内容的真实性、准确性、合法性承担任何责任。因该等上传内容引发的一切纠纷、索赔、诉讼等责任，均由您自行承担，与甲方无涉。但甲方有权依据本协议对该等内容进行审核、管控及违规处理。
      </Text>

      {/* 第2章 产品与服务 */}
      <Text style={styles.sectionTitle}>2. 产品与服务</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.1</Text>{" "}
        您应从甲方官方授权的渠道（如应用商店、甲方官网）下载安装本软件，未经甲方授权的第三方渠道提供的本软件安装包，甲方无法保证其安全性及功能性，您因此遭受的任何损失，甲方不承担任何责任。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.2</Text>{" "}
        甲方授予您一项个人、不可转让、非排他性的许可，允许您为非商业目的在您合法拥有的终端设备上安装、使用本软件。未经甲方书面许可，您不得对本软件进行改编、复制、反向工程、反向汇编、反向编译，或向任何第三方转让、授权使用本软件。甲方保留在您违反本协议约定时，随时收回该使用授权的权利，尤其在您发布违规UGC内容且拒不整改时，甲方有权立即收回使用授权。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.3</Text>{" "}
        为保障本软件的安全性、稳定性及功能完整性，尤其是为提升UGC内容审核和管控效率，甲方有权在无需提前通知您的情况下，对本软件进行更新、升级或调整部分功能效果（包括但不限于UGC内容发布、审核、举报、屏蔽功能）；本软件新版本发布后，旧版本可能无法正常使用，甲方不保证旧版本软件的兼容性及持续可用性，您应及时下载安装最新版本。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.4</Text>{" "}
        您使用本软件及服务过程中产生的数据流量费用、终端设备损耗等成本，均由您自行承担；您理解并同意，甲方为提供服务需要，包括为审核UGC内容、处理UGC内容举报/屏蔽请求，可合理调用您终端设备的处理器、存储、摄像头等硬件资源。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.5</Text>{" "}
        您注册账号或使用特定服务时，应按照法律法规及甲方要求提供真实、准确、完整的信息（如手机号码、身份信息等）；若您提供的信息不真实、不完整，甲方有权拒绝为您提供相关服务，或暂停、终止您的账号使用权限，同时将限制您发布UGC内容的所有功能，由此造成的一切后果由您自行承担。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.6</Text>{" "}
        您明确知晓并同意：甲方已采取合理的技术措施保护您的个人信息及交易数据安全，同时采取技术和人工相结合的方式对UGC内容进行审核管控，但因不可抗力、黑客攻击、电信运营商故障、您自身操作失误等非甲方可控因素导致的信息泄露、丢失、篡改，甲方不承担任何责任。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.7</Text>{" "}
        您在使用本软件及服务时，须自行承担以下甲方不可掌控的风险：
      </Text>
      <Text style={styles.subContent}>
        2.7.1
        因终端设备型号与本软件不兼容、系统版本过低等原因导致的软件无法运行、功能异常，包括UGC内容发布、举报、屏蔽功能失效；
        {"\n"}
        2.7.2
        您通过本软件跳转至第三方网站、应用时，因第三方服务瑕疵、内容违规导致的任何损失；
        {"\n"}
        2.7.3 您发布的UGC内容被他人转发、分享后产生的侵权、纠纷等风险；{"\n"}
        2.7.4
        因网络信号不稳定、带宽不足等原因导致的登录失败、交易延迟、数据同步不完整等问题，包括UGC内容发布失败、举报信息提交延迟等。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.8</Text>{" "}
        您在本软件平台发布商品信息（属于UGC内容）、达成交易的行为，均为您与交易相对方的自主民事行为，甲方仅提供信息展示、交易撮合的技术服务，不对交易双方的履约能力、商品真实性、质量状况承担任何担保责任；您与交易相对方发生的任何纠纷，应自行协商解决，与甲方无关。甲方有权对违规的商品UGC内容进行审核处理。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.9</Text>{" "}
        您在本软件购买的会员服务、鉴定服务等虚拟产品，一经支付完成，不予退款；您明确知晓并同意，虚拟产品的服务期限自购买成功之日起计算，不因您未实际使用而延长，会员所享有的UGC内容专属发布功能也随服务期限终止而失效。
      </Text>

      {/* 第3章 账号与用户行为 */}
      <Text style={styles.sectionTitle}>3. 账号与用户行为</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.1</Text>{" "}
        账号使用规则：本软件账号的所有权归属甲方，您完成注册后仅获得账号的使用权，且该使用权仅属于初始申请注册人，严禁赠与、借用、出租、售卖账号。甲方有权在发现账号转让、共享时，立即暂停或终止该账号的使用权限，清空账号内数据，同时永久冻结该账号发布UGC内容的权利，由此造成的损失由您自行承担。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.2</Text>{" "}
        账号安全责任：您应妥善保管账号密码及身份验证信息，对您账号下的所有操作行为承担全部责任，包括发布的所有UGC内容及相关违规行为；若您的账号被盗、冒用，应立即通知甲方，甲方在收到您的有效申请后，可协助您冻结账号，同时冻结被盗账号的UGC内容发布功能，但对账号被盗用期间产生的损失不承担责任。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.3</Text>{" "}
        账号回收规则：您注册账号后，若连续 180
        日未进行任何登录及使用行为，甲方有权视为您主动放弃账号使用权，无需通知即可回收该账号，账号内的所有数据将被清空且无法恢复，该账号下发布的所有UGC内容将被甲方统一清理。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.4</Text>{" "}
        UGC内容发布责任：您明确同意：您在本软件上发布的所有UGC内容，均为您独立创作并承担全部法律责任，仅代表您个人立场和观点，与甲方无关；因您发布的UGC内容侵犯第三方合法权益（如知识产权、肖像权、名誉权等）或违反法律法规、本协议约定导致的纠纷、诉讼、赔偿，均由您自行承担全部责任，甲方因此遭受损失的，有权向您全额追偿。甲方有权对违规UGC内容采取删除、屏蔽、下架等措施，无需另行通知您。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.5</Text>{" "}
        严格禁止的行为：甲方对本软件内的违法、违规、不良及滥用性UGC内容和用户行为持零容忍态度，您不得利用本软件及服务从事任何违法违规、损害甲方或其他用户利益，或发布、传播违规UGC内容的行为，包括但不限于：
      </Text>
      <Text style={styles.subContent}>
        3.5.1
        发布假冒伪劣、侵权盗版的设计师时装商品信息，或发布虚假、误导性的商品UGC内容；
        {"\n"}
        3.5.2
        恶意刷单、刷评、操纵交易价格，扰乱平台正常交易秩序，或发布虚假好评、恶意差评等违规评价类UGC内容；
        {"\n"}
        3.5.3
        使用外挂、脚本等非法工具干扰软件正常运行，包括利用非法工具批量发布UGC内容、恶意刷取UGC内容点赞/转发；
        {"\n"}
        3.5.4
        传播病毒、木马程序，危害平台及其他用户的信息安全，或发布包含病毒、木马链接的UGC内容；
        {"\n"}
        3.5.5
        未经甲方许可，在平台内发布广告、推广信息等商业内容类UGC内容；
        {"\n"}
        3.5.6
        发布任何具有侮辱、诽谤、威胁、暴力、色情、低俗、歧视、恐怖主义、极端主义等性质的不良/违法UGC内容；
        {"\n"}
        3.5.7
        利用UGC内容进行人身攻击、网络欺凌、骚扰其他用户的滥用性行为；
        {"\n"}
        3.5.8 发布侵害未成年人合法权益、违反公序良俗的UGC内容；{"\n"}
        3.5.9
        其他违反法律法规、本协议约定，或损害平台生态、其他用户合法权益的UGC内容发布及使用行为。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.6</Text>{" "}
        UGC内容审核与违规处理：您在本软件发布的所有UGC内容需严格遵守国家法律法规、本协议约定及平台自律公约，不得包含任何本协议禁止的异议性、滥用性内容。甲方有权通过技术自动审核+人工复核的方式，对您发布的所有UGC内容进行全量、实时审核，且无需向您说明审核依据。对违规UGC内容，甲方有权立即采取删除、屏蔽、限制展示、下架等措施；对发布违规UGC内容的用户，甲方有权根据违规情节轻重，单独或合并采取警告、限制UGC内容发布功能、限制账号互动功能、暂停账号使用、永久封禁账号等处罚，且无需提前通知您。若您多次发布违规UGC内容，甲方将直接永久封禁您的账号，且不接受任何解封申请。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.7</Text>{" "}
        UGC内容举报与用户屏蔽机制：为保护所有用户的合法权益，甲方为您提供便捷的UGC内容举报功能和用户屏蔽功能，您可通过本软件内的专属入口，对平台内的异议性、滥用性UGC内容进行一键举报，对发布违规内容、实施滥用行为的用户进行一键屏蔽：
      </Text>
      <Text style={styles.subContent}>
        3.7.1
        UGC内容举报：您在浏览本软件内任何UGC内容时，可点击内容详情页的【举报】按钮，选择违规类型（如色情低俗、人身攻击、虚假信息、侵权等）并提交举报，甲方将在24小时内对举报内容进行审核处理，并将处理结果通过站内信反馈给您；
        {"\n"}
        3.7.2
        用户屏蔽：您在浏览用户主页、UGC内容评论区或与其他用户互动时，可点击【屏蔽】按钮，永久屏蔽该用户的UGC内容展示、私信、评论、点赞等所有互动行为，屏蔽后该用户将无法向您发布任何信息，其发布的UGC内容也将不再向您展示。
      </Text>

      {/* 第4章 知识产权与内容使用授权 */}
      <Text style={styles.sectionTitle}>4. 知识产权与内容使用授权</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.1</Text>{" "}
        甲方是本软件的知识产权权利人，本软件的著作权、商标权、专利权、商业秘密等知识产权，以及与本软件相关的所有信息内容（包括但不限于界面设计、文字、图片、视频、数据等）均受中华人民共和国法律法规及国际条约保护，未经甲方书面许可，任何人不得擅自使用。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.2</Text>{" "}
        您保证在本软件上传、发布的所有UGC内容均为您合法拥有或已获得合法授权，不会侵犯任何第三方的知识产权；若第三方就您发布的UGC内容主张权利，您应自行处理相关纠纷，并承担全部责任，甲方因此遭受损失的，有权向您追偿。若您发布的UGC内容涉嫌知识产权侵权，甲方有权立即下架该内容并对您的账号采取管控措施。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>4.3</Text>{" "}
        您在本软件上传、发布任何UGC内容，即视为您无偿授予甲方一项非独占、永久性、可转让、可再授权的全球范围内使用许可，甲方有权在本软件及甲方关联平台、合作渠道中，对您发布的UGC内容进行展示、传播、改编、剪辑、汇编等操作，无需另行向您支付任何费用。若该UGC内容被认定为违规，甲方有权随时终止上述使用许可并删除该内容。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.4</Text>{" "}
        关于用户帖子征用：甲方有权根据业务发展需要（如平台推广、品牌宣传、活动运营等），征用您在本软件发布的合规UGC帖子（包括文字、图片、视频等内容）。甲方征用前，将通过本软件站内信的方式提前
        7
        个工作日向您发出书面通知，明确征用内容、使用范围、使用期限；您在收到通知后
        7
        个工作日内未提出书面异议的，视为同意甲方征用；若您提出异议，甲方将停止征用行为，且不会因此对您的账号进行任何不利处理。违规UGC内容不在甲方征用范围内。
      </Text>

      {/* 第5章 个人信息保护 */}
      <Text style={styles.sectionTitle}>5. 个人信息保护</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.1</Text> 甲方将按照《Avant Regard
        隐私政策》的规定，合法、合规收集、使用、存储和保护您的个人信息；甲方不会将您的个人信息出售、出租给任何第三方，除非获得您的明确同意，或法律法规另有规定。甲方收集的个人信息仅用于本软件运营、UGC内容审核、处理举报/屏蔽请求等合法用途。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.2</Text>{" "}
        您应加强个人信息保护意识，妥善保管您的账号密码、身份信息、交易信息等敏感数据，切勿向任何第三方泄露；因您自身疏忽导致的信息泄露，甲方不承担任何责任。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.3</Text>{" "}
        未成年人使用本软件及服务，应在监护人陪同下进行，并由监护人代为处理注册、交易等相关事宜；甲方将根据法律法规要求，采取措施保护未成年人的个人信息安全，同时对未成年人发布的UGC内容进行更严格的审核管控，禁止未成年人发布任何不适宜的内容。
      </Text>

      {/* 第6章 服务的变更、中断与终止 */}
      <Text style={styles.sectionTitle}>6. 服务的变更、中断与终止</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.1</Text>{" "}
        甲方有权根据业务发展需要，调整、暂停或终止本软件的部分或全部服务，包括UGC内容相关的发布、审核、举报、屏蔽功能，甲方将通过本软件公告页面提前
        30
        日公示相关变更事项；因服务调整、中断、终止给您造成的损失（包括但不限于未使用的会员权益、账号内虚拟资产等），甲方不承担赔偿责任。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.2</Text>{" "}
        因不可抗力（如自然灾害、战争、政策调整等）、黑客攻击、系统故障等非甲方过错导致的服务中断，包括UGC内容服务暂时无法使用，甲方不承担责任，但应在能力范围内尽快恢复服务，并及时通知您。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.3</Text>{" "}
        您违反本协议约定，尤其是发布违规UGC内容、实施滥用性行为，甲方有权暂停或终止您的账号使用权限，且无需退还您已支付的任何费用；账号终止后，您账号内的所有数据将被清空且无法恢复，您发布的所有UGC内容将被甲方永久删除。
      </Text>

      {/* 第7章 免责条款 */}
      <Text style={styles.sectionTitle}>7. 免责条款</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.1</Text>{" "}
        甲方仅提供技术服务平台，不对用户行为及交易结果承担任何责任。用户之间因交易产生的任何纠纷，包括但不限于商品质量、退换货、货款支付等问题，均由交易双方自行解决，甲方不承担任何调解、担保或赔偿责任。但甲方有权根据本协议对纠纷相关的UGC内容进行审核处理。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.2</Text>{" "}
        因用户发布的UGC内容、交易行为违反法律法规或本协议约定，导致甲方被行政机关处罚、被第三方索赔的，用户应全额赔偿甲方因此遭受的损失（包括但不限于罚款、赔偿金、律师费、诉讼费等）。该赔偿责任包括甲方因处理用户违规UGC内容产生的所有合理费用。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.3</Text>{" "}
        甲方对本软件的运行稳定性、功能完整性不作任何明示或默示的保证，因软件漏洞、版本更新等原因导致的功能异常、数据丢失，甲方不承担赔偿责任。但甲方将及时修复UGC内容审核、举报、屏蔽功能的漏洞，保障用户相关权益。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.4</Text>{" "}
        本软件中展示的商品价格、库存、描述等UGC内容均由用户自行提供，甲方不对其真实性、准确性、及时性承担任何责任；因商品信息错误导致的交易纠纷，由发布信息的用户承担全部责任。甲方有权对虚假的商品UGC内容进行删除和处罚。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.5</Text>{" "}
        因电信运营商调整网络服务、第三方支付平台故障等非甲方可控因素导致的交易失败、支付延迟等问题，甲方不承担责任。
      </Text>

      {/* 第8章 违约处理 */}
      <Text style={styles.sectionTitle}>8. 违约处理</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.1</Text>{" "}
        您违反本协议约定的，尤其是发布本协议禁止的异议性、滥用性UGC内容，或实施相关滥用性行为，甲方有权根据违规情节，采取删除违规内容、限制账号功能（尤其是UGC内容相关功能）、暂停账号使用、永久封禁账号等措施，并可将您的违规行为在平台内公示，以警示其他用户。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.2</Text>{" "}
        您违反本协议约定，给甲方或其他用户造成损失的，应承担全部赔偿责任；甲方有权从您的账号余额、交易款项中直接扣除相应赔偿金额，不足部分有权向您追偿。该损失包括其他用户因您的滥用性UGC内容遭受的精神损害、财产损失等。
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.3</Text>{" "}
        甲方因处理您的违规行为而支出的合理费用（包括但不限于律师费、诉讼费、鉴定费等），尤其是因处理您的违规UGC内容引发的纠纷产生的费用，均由您承担。
      </Text>

      {/* 第9章 其他条款 */}
      <Text style={styles.sectionTitle}>9. 其他条款</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.1</Text>{" "}
        本协议的订立、执行、解释及争议解决，均适用中华人民共和国法律；若您与甲方发生争议，应首先通过友好协商解决；协商不成的，任何一方均有权向甲方所在地有管辖权的人民法院提起诉讼。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.2</Text>{" "}
        甲方有权根据法律法规及业务发展需要，尤其是根据用户生成内容的监管要求，修改本协议条款；修改后的协议将通过本软件公告页面发布，自发布之日起生效；您继续使用本软件及服务的，视为同意修改后的协议内容。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.3</Text>{" "}
        本协议中的标题仅为阅读方便，不具有任何法律意义。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.4</Text>{" "}
        本协议未尽事宜，可由双方另行签订补充协议；补充协议与本协议具有同等法律效力，补充协议中关于UGC内容的条款为本协议的重要补充。
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.5</Text>{" "}
        若本协议的任何条款被认定为无效或不可执行，不影响其他条款的效力，尤其是关于UGC内容零容忍、审核管控、举报屏蔽的条款。
      </Text>

      {/* 联系方式 */}
      <Text style={styles.sectionTitle}>联系我们</Text>
      <Text style={styles.content}>
        如有任何疑问，请通过以下方式联系我们：{"\n\n"}
        客服邮箱：avant.regarde61@gmail.com{"\n"}
        客服微信：Avantregard2025
      </Text>

      <Text style={styles.footer}>
        © 2026 Avant Regard. 保留所有权利。{"\n"}
        上海南特克实业有限公司
      </Text>
    </View>
  );
};

const TermsContentEn: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>
        Avant Regard UGC and Service Agreement
      </Text>
      <Text style={styles.lastUpdated}>Last Updated: April 3, 2026</Text>
      <Text style={styles.operator}>Operator: Avant Regard Inc.</Text>
      <Text style={styles.operator}>
        This Agreement shall be governed exclusively by the laws of the United
        States.
      </Text>

      <Text style={styles.intro}>
        This Avant Regard Software License and Service Agreement (hereinafter
        referred to as this "Agreement") is entered into between you and Avant
        Regard Inc. (hereinafter referred to as "Party A") regarding your use of
        the Avant Regard product (hereinafter referred to as the "Software") and
        related services. Before using the Software and relevant services, you
        shall carefully read this Agreement, together with the Avant Regard
        Privacy Policy and Avant Regard Platform Self-Discipline Convention
        published by Party A, and fully understand all terms. Special attention
        shall be paid to clauses that limit or exempt Party A's liability,
        increase your obligations, exclude your major rights, as well as
        provisions governing User Generated Content (UGC) specifications,
        violation handling and platform management measures.
        {"\n\n"}
        <Text style={styles.boldText}>
          Terms limiting or exempting liability and special UGC provisions are
          marked in bold for your emphasis and careful review.
        </Text>
      </Text>

      <Text style={styles.content}>
        You confirm that you possess full civil capacity under applicable U.S.
        laws to independently assume legal responsibilities for all your
        activities using the Software and services. If you are a minor or person
        with limited civil capacity, you shall read this Agreement under the
        supervision of your legal guardian and use the Software and services
        only after obtaining the guardian's explicit consent.
      </Text>

      <Text style={styles.content}>
        If you object to any clause of this Agreement or fail to fully
        understand any provision, you must not access or use the Software and
        its related services. By downloading, installing, registering an
        account, logging in and using the Software, you shall be deemed to have
        fully understood, agreed to and accepted all binding terms of this
        Agreement. You specifically acknowledge and comply with all prohibitions
        and violation rules concerning UGC, and consent to all platform
        management measures adopted by Party A against illegal content and
        improper conduct.
      </Text>

      <Text style={styles.content}>
        If you have any questions, you may contact us via the official contact
        channel stated herein:{"\n\n"}
        Support Email: Melanie@avantregard.us{"\n"}
        Support WeChat: Avantregard2025{"\n\n"}
        Or through other feedback channels provided within the Software, and we
        will respond to your inquiries as soon as possible.
      </Text>

      {/* 1. Scope of Agreement */}
      <Text style={styles.sectionTitle}>1. Scope of Agreement</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.1</Text> This Agreement governs the
        rights and obligations between you and Party A in connection with your
        use of the Software and related services. It applies specifically to all
        User Generated Content you publish, upload or share on the platform,
        including without limitation texts, images, videos, reviews, fashion
        show information, boutique store postings, outfit sharing, product
        descriptions (collectively referred to as "UGC Content"). Party A may
        entrust all or part of its rights and obligations under this Agreement
        to its affiliates or third-party service providers for performance based
        on business needs. Party A shall publicly announce such entrustment
        matters on the Software announcement page 30 days in advance without
        requiring your separate consent. However, if such entrustment
        substantially impairs your legitimate rights and interests, Party A
        shall obtain your written separate consent via pop-up notifications, SMS
        or other means prior to arrangement.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.2</Text> Party A: means Avant Regard
        Inc.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.3</Text> User (also referred to as
        "you"): any natural person, legal entity or unincorporated organization
        that legally accesses and uses the Software and services and agrees to
        abide by the UGC specifications set forth in this Agreement.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.4</Text> Software: the officially
        operated mobile application of Avant Regard (iOS version), together with
        corresponding mobile websites, official accounts and other terminal
        forms owned and operated legally by Party A. Party A may add or adjust
        Software terminal forms at its discretion without prior notice.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.5</Text> Services: all operational
        services provided by Party A via the Software, including secondhand
        designer fashion transactions, product display, authentication and
        evaluation, community interaction, fashion show and boutique store map
        functions. Services include technical support for UGC storage, display
        and distribution, as well as management functions such as content
        reporting, user blocking and blacklisting for regulating improper UGC
        and protecting user rights. Party A reserves the right to adjust service
        content and forms as business needs evolve.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>1.6</Text> This Agreement also includes
        continuously updated business rules, supplementary agreements and
        revised terms published by Party A and its affiliates relating to the
        Software and services. Special UGC management rules constitute an
        integral core part of this Agreement. All officially released
        supplementary terms shall be deemed binding as part of this Agreement.
        If you do not accept revised provisions, you shall immediately cease
        using the Software and services.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>1.7</Text> Special Statement: All UGC you
        upload in the fashion show and boutique store map features (including
        without limitation show information, boutique store details, images and
        reviews) are your independent voluntary conduct. Party A only provides
        technical services for information storage and display and assumes no
        liability for the authenticity, accuracy or legality of such content.
        You shall bear full legal responsibility for all disputes, claims or
        litigation arising from your uploaded content, and Party A shall not be
        held liable in any such matters. Party A nevertheless reserves the right
        to review, regulate and impose penalties on such content in accordance
        with this Agreement.
      </Text>

      {/* 2. Products and Services */}
      <Text style={styles.sectionTitle}>2. Products and Services</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.1</Text> You shall download and install
        the Software only through officially authorized channels such as
        official app stores and Party A's official website. Party A cannot
        guarantee the security or functionality of installation packages
        obtained from unauthorized third-party channels, and shall not be liable
        for any losses incurred therefrom.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.2</Text> Party A grants you a personal,
        non-transferable, non-exclusive license to install and use the Software
        on your legally owned devices for non-commercial purposes. Without Party
        A's prior written consent, you shall not modify, reproduce, reverse
        engineer, disassemble, decompile the Software, nor transfer or
        sublicense it to any third party. Party A reserves the right to revoke
        this license at any time if you breach this Agreement, especially when
        you publish violating UGC and refuse rectification.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.3</Text> To ensure the Software's
        security, stability and functional integrity — particularly to improve
        UGC review and management efficiency — Party A may update, upgrade or
        adjust Software functions (including UGC publishing, review, reporting
        and blocking features) without prior notice. After a new version is
        released, older versions may cease to function normally. Party A does
        not guarantee compatibility or continuous availability of outdated
        versions, and you shall promptly install the latest release.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.4</Text> You shall independently bear
        all costs incurred during your use of the Software, including data
        traffic fees and device wear and tear. You acknowledge and agree that
        Party A may reasonably utilize your device's processor, storage, camera
        and other hardware resources for service provision, UGC review and
        processing of reporting/blocking requests.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.5</Text> When registering an account or
        using specific services, you shall provide true, accurate and complete
        information (such as mobile phone number and identity details) in
        compliance with applicable laws and Party A's requirements. If your
        provided information is false or incomplete, Party A may refuse service,
        suspend or terminate your account access, and restrict all your UGC
        publishing privileges. You shall bear all consequences arising
        therefrom.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.6</Text> You acknowledge and agree that
        Party A has adopted reasonable technical measures to protect your
        personal information and transaction data, and implements combined
        automated and manual review for UGC content. Party A shall not be liable
        for information leakage, loss or tampering caused by circumstances
        beyond its reasonable control, including force majeure, hacker attacks,
        telecom operator failures or your own operational errors.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>2.7</Text> You shall independently bear
        the following uncontrollable risks when using the Software and services:
      </Text>
      <Text style={styles.subContent}>
        2.7.1 Software malfunction or abnormal features caused by device
        incompatibility or outdated system versions, including failure of UGC
        publishing, reporting and blocking functions;
        {"\n"}
        2.7.2 Any losses arising from defective third-party services or illegal
        content when you jump to external websites or applications via the
        platform;
        {"\n"}
        2.7.3 Infringement disputes and legal risks arising from third-party
        forwarding or sharing of your published UGC;
        {"\n"}
        2.7.4 Login failure, transaction delay and incomplete data
        synchronization caused by unstable network signals or insufficient
        bandwidth, including failed UGC posting and delayed report submission.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.8</Text> Publishing product information
        (classified as UGC) and completing transactions on the platform
        constitute independent civil conduct between you and the counterparty.
        Party A only provides technical services for information display and
        transaction matching, and assumes no guarantee liability for the
        parties' performance capability, product authenticity or quality. All
        transaction disputes shall be resolved independently by the involved
        parties without liability to Party A. Party A retains the right to
        review and penalize non-compliant product UGC content.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>2.9</Text> Paid virtual services purchased
        on the platform such as membership and authentication services are
        non-refundable upon completion of payment. Service validity commences
        upon successful purchase and shall not be extended due to non-use.
        Exclusive UGC publishing privileges for members shall expire
        automatically upon membership termination.
      </Text>

      {/* 3. Account and User Conduct */}
      <Text style={styles.sectionTitle}>3. Account and User Conduct</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.1</Text> Account Usage Rules: All
        Software accounts remain the property of Party A. Upon registration, you
        only obtain personal usage rights exclusively for the original
        registrant. Account gifting, lending, rental or resale are strictly
        prohibited. Party A may immediately suspend or terminate account access,
        clear account data, and permanently freeze UGC publishing privileges if
        account transfer or sharing is detected. All resulting losses shall be
        borne solely by you.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.2</Text> Account Security
        Responsibility: You shall properly safeguard your account password and
        verification credentials, and take full responsibility for all
        activities conducted under your account, including all published UGC and
        related violations. If your account is stolen or misused, you shall
        promptly notify Party A. Upon valid application, Party A may assist in
        account freezing and suspend UGC publishing functions for the
        compromised account, but shall not be liable for any losses incurred
        during unauthorized use.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.3</Text> Account Recovery Rules: If your
        account remains inactive with no login or usage activity for 180
        consecutive days, Party A reserves the right to reclaim the account
        without prior notice. All account data will be permanently cleared and
        unrecoverable, and all UGC published under the account will be removed
        by Party A.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.4</Text> UGC Publishing Liability: You
        explicitly agree that all UGC published by you on the platform is
        independently created by you, represents solely your personal views, and
        you bear full legal responsibility therefor, separate from Party A. You
        shall fully compensate for all disputes, litigation and damages arising
        from UGC that infringes third-party rights (intellectual property,
        portrait rights, reputation rights, etc.) or violates applicable laws
        and this Agreement. If Party A suffers losses due to your improper UGC
        conduct, Party A reserves the right to full indemnification from you.
        Party A may delete, block or remove violating UGC content without prior
        notice.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.5</Text> Prohibited Conduct: Party A
        adopts a zero-tolerance policy against illegal, improper, harmful and
        abusive UGC and user conduct. You shall not use the Software and
        services to engage in illegal activities, harm the interests of Party A
        or other users, or publish/disseminate violating UGC, including without
        limitation:
      </Text>
      <Text style={styles.subContent}>
        3.5.1 Posting counterfeit, infringing or pirated designer fashion
        information, or false/misleading product UGC;
        {"\n"}
        3.5.2 Malicious order brushing, fake reviews, price manipulation
        disrupting platform order, or publishing false positive/malicious
        negative review content;
        {"\n"}
        3.5.3 Using plug-ins, scripts or other unauthorized tools to interfere
        with normal Software operation, including bulk UGC posting and
        artificial liking/reposting manipulation;
        {"\n"}
        3.5.4 Spreading viruses or malware endangering platform and user
        security, or publishing UGC containing malicious links;
        {"\n"}
        3.5.5 Posting commercial advertisements or promotional content without
        Party A's permission;
        {"\n"}
        3.5.6 Publishing insulting, defamatory, threatening, violent,
        pornographic, vulgar, discriminatory, terrorist or extremist UGC;
        {"\n"}
        3.5.7 Engaging in personal attacks, cyber bullying or harassment of
        other users via UGC;
        {"\n"}
        3.5.8 Publishing UGC infringing minor rights or violating public
        morality;
        {"\n"}
        3.5.9 Any other UGC publishing or usage conduct violating applicable
        laws, this Agreement or platform ecological interests.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.6</Text> UGC Review and Violation
        Handling: All UGC published on the platform must comply with applicable
        laws, this Agreement and platform self-discipline rules, and shall not
        contain prohibited or abusive content. Party A conducts full real-time
        review via automated technology combined with manual verification
        without obligation to disclose review standards. For violating UGC,
        Party A may immediately delete, block, restrict display or remove
        content. Depending on the severity of violations, Party A may issue
        warnings, restrict UGC publishing/interactive functions, suspend account
        access or permanently ban accounts without prior notice. Repeated
        violations will result in permanent account ban with no appeal for
        reinstatement.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>3.7</Text> UGC Reporting and User Blocking
        Mechanism: To protect all users' legitimate rights and interests, Party
        A provides convenient UGC reporting and user blocking functions. You may
        use dedicated in-platform entries to report inappropriate or abusive UGC
        with one click, and block users who publish violating content or engage
        in abusive behavior:
      </Text>
      <Text style={styles.subContent}>
        3.7.1 UGC Reporting: When browsing any UGC content, you may click the
        Report button on the content detail page, select violation type
        (pornographic vulgarity, personal attack, false information,
        infringement, etc.) and submit a report. Party A will review and process
        reports within 24 hours and notify you of results via in-app messages.
        {"\n"}
        3.7.2 User Blocking: When browsing user profiles, UGC comment sections
        or interacting with other users, you may click the Block button to
        permanently shield all content display, private messages, comments and
        likes from the selected user. After blocking, the blocked user cannot
        send you messages, and their UGC will no longer be displayed to you.
      </Text>

      {/* 4. Intellectual Property and Content License */}
      <Text style={styles.sectionTitle}>
        4. Intellectual Property and Content License
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.1</Text> Party A retains all
        intellectual property rights in the Software, including copyright,
        trademark, patent and trade secrets. All platform content such as
        interface design, texts, images, videos and data are protected by U.S.
        and international intellectual property laws. No unauthorized use is
        permitted without Party A's written consent.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.2</Text> You warrant that all UGC
        uploaded and published by you is legally owned or fully authorized, and
        does not infringe third-party intellectual property rights. You shall
        independently resolve any third-party rights claims and bear full
        liability. If Party A incurs losses due to your infringing UGC, you
        shall provide full compensation. Party A may immediately remove suspected
        infringing UGC and impose account restrictions.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>4.3</Text> By uploading or publishing any
        UGC on the platform, you irrevocably grant Party A a free, non-exclusive,
        perpetual, transferable and sub-licensable global license to display,
        distribute, adapt, edit and compile your UGC on the Software, affiliated
        platforms and partner channels without additional payment to you. If
        your UGC is deemed violating, Party A may terminate this license and
        delete the content at any time.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>4.4</Text> Official Content Reposting
        Authorization: Party A may repost compliant UGC posts (texts, images,
        videos) for platform promotion, brand marketing and operational
        activities. Party A will send written notice via in-app message 7
        working days in advance, specifying content scope and usage period. If
        you do not raise written objection within 7 working days, you shall be
        deemed to consent to reposting. Objections will be respected without any
        adverse impact on your account. Violating UGC is excluded from official
        reposting authorization.
      </Text>

      {/* 5. Personal Information Protection */}
      <Text style={styles.sectionTitle}>
        5. Personal Information Protection
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.1</Text> Party A shall collect, use,
        store and protect your personal information lawfully in accordance with
        the Avant Regard Privacy Policy. Party A will not sell or rent your
        personal information to any third party unless with your explicit
        consent or required by applicable laws. Collected personal information
        is solely used for platform operation, UGC review and processing of
        reporting/blocking requests and other legitimate purposes.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.2</Text> You shall maintain awareness of
        personal information protection and properly safeguard your account
        credentials, identity data and transaction details, and shall not
        disclose sensitive information to third parties. Party A shall not be
        liable for information leakage caused by your own negligence.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>5.3</Text> Minors shall use the Software
        and services under guardian supervision, with guardians assisting in
        registration and transaction matters. Party A shall adopt protective
        measures for minor personal information in compliance with laws,
        implement stricter UGC review for minors, and prohibit minors from
        publishing inappropriate content.
      </Text>

      {/* 6. Service Modification, Suspension and Termination */}
      <Text style={styles.sectionTitle}>
        6. Service Modification, Suspension and Termination
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.1</Text> Party A reserves the right to
        adjust, suspend or terminate part or all platform services (including
        UGC publishing, review, reporting and blocking functions) based on
        business needs. Material service changes will be announced on the
        Software notice page 30 days in advance. Party A shall not be liable for
        any losses arising from service adjustment, suspension or termination,
        including unused membership benefits and virtual assets.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.2</Text> Party A shall not be liable for
        service interruption (including temporary unavailability of UGC
        functions) caused by circumstances beyond its reasonable control such as
        force majeure, war, policy adjustment, hacker attacks or system failure.
        Party A shall restore services as soon as practicable and notify users
        promptly.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>6.3</Text> If you breach this Agreement,
        especially by publishing violating UGC or engaging in abusive conduct,
        Party A may suspend or terminate your account access without refunding
        any paid fees. Upon account termination, all account data will be
        permanently cleared and unrecoverable, and all your published UGC will
        be permanently deleted by Party A.
      </Text>

      {/* 7. Disclaimer */}
      <Text style={styles.sectionTitle}>7. Disclaimer</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.1</Text> Party A only provides a
        technical platform and assumes no liability for user conduct or
        transaction outcomes. All transaction disputes between users concerning
        product quality, returns, payment and related matters shall be resolved
        independently by the involved parties. Party A undertakes no mediation,
        guarantee or compensation obligation, but retains the right to review
        and handle related UGC content per this Agreement.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.2</Text> If Party A is subject to
        administrative penalties or third-party claims due to your violating UGC
        or improper conduct breaching laws or this Agreement, you shall fully
        indemnify Party A for all losses including fines, compensation, attorney
        fees and litigation costs. Such indemnification covers all reasonable
        expenses incurred by Party A in handling your violating UGC matters.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.3</Text> Party A makes no express or
        implied warranty regarding Software operational stability or functional
        completeness, and shall not be liable for malfunction or data loss
        caused by system vulnerabilities or version updates. Party A shall
        nevertheless promptly repair flaws in UGC review, reporting and blocking
        functions to protect user rights.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.4</Text> All product prices, inventory
        and descriptions displayed on the platform are provided independently by
        users. Party A assumes no liability for their authenticity, accuracy or
        timeliness. All transaction disputes caused by false product information
        shall be borne entirely by the publishing user. Party A may delete and
        penalize false product UGC content.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>7.5</Text> Party A shall not be liable for
        transaction failure or payment delay caused by factors beyond its
        control such as telecom network adjustment and third-party payment
        platform malfunctions.
      </Text>

      {/* 8. Breach Liability */}
      <Text style={styles.sectionTitle}>8. Breach Liability</Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.1</Text> If you breach this Agreement,
        particularly by publishing prohibited/abusive UGC or engaging in
        improper conduct, Party A may delete violating content, restrict account
        functions (especially UGC-related features), suspend account access or
        permanently ban accounts according to violation severity. Party A may
        also publicly disclose violation records on the platform as a warning to
        other users.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.2</Text> If your breach causes losses to
        Party A or other users, you shall bear full compensation liability.
        Party A may directly deduct compensation amounts from your account
        balance or transaction proceeds, and pursue recovery for any shortfall.
        Compensation covers property loss and mental damages suffered by other
        users due to your abusive UGC.
      </Text>

      <Text style={styles.contentHighlight}>
        <Text style={styles.subIndex}>8.3</Text> All reasonable expenses
        incurred by Party A in handling your violations, including attorney
        fees, litigation costs and appraisal fees — especially expenses arising
        from disputes related to your violating UGC — shall be borne by you.
      </Text>

      {/* 9. Miscellaneous Provisions */}
      <Text style={styles.sectionTitle}>9. Miscellaneous Provisions</Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.1</Text> The formation, performance,
        interpretation and dispute resolution of this Agreement shall be
        governed exclusively by the laws of the United States. Any dispute shall
        first be resolved through friendly negotiation; if negotiation fails,
        either party may file litigation with the court of competent
        jurisdiction.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.2</Text> Party A may revise this
        Agreement in response to legal updates, regulatory requirements for UGC
        management and business development. Revised terms shall take effect upon
        official publication on the Software notice page. Your continued use of
        the Software and services constitutes acceptance of the revised
        Agreement.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.3</Text> Section headings are for
        reading convenience only and have no legal binding effect.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.4</Text> Matters not covered by this
        Agreement may be supplemented by separate supplementary agreements,
        which shall have equal legal effect with this Agreement. Supplementary
        provisions regarding UGC shall constitute an important part of this
        Agreement.
      </Text>

      <Text style={styles.content}>
        <Text style={styles.subIndex}>9.5</Text> If any clause of this Agreement
        is deemed invalid or unenforceable, the validity of remaining clauses
        shall not be affected; in particular, provisions concerning UGC zero
        tolerance, review control, reporting and blocking shall remain fully
        enforceable.
      </Text>

      {/* Contact */}
      <Text style={styles.sectionTitle}>Contact Us</Text>
      <Text style={styles.content}>
        If you have any questions, please contact us via:{"\n\n"}
        Support Email: Melanie@avantregard.us{"\n"}
        Support WeChat: Avantregard2025
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
    operator: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray500,
      textAlign: "center",
      marginBottom: 20,
    },
    intro: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 22,
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 8,
      marginBottom: 12,
    },
    boldText: {
      fontFamily: "PlayfairDisplay-Bold",
      fontWeight: "bold",
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    subIndex: {
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray600,
    },
    content: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray700,
      lineHeight: 22,
      marginBottom: 8,
    },
    contentHighlight: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray700,
      lineHeight: 22,
      marginBottom: 12,
      backgroundColor: t.colors.gray50,
      padding: 12,
      borderRadius: 6,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.accent,
    },
    subContent: {
      fontSize: 13,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray600,
      lineHeight: 20,
      marginBottom: 12,
      marginLeft: 16,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.gray200,
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
