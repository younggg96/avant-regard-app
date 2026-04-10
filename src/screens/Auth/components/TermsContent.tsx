import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../../theme";

export const TermsContent: React.FC = () => {
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

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  mainTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    marginBottom: 4,
  },
  operator: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    marginBottom: 20,
  },
  intro: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray700,
    lineHeight: 22,
    backgroundColor: theme.colors.gray50,
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
    color: theme.colors.black,
    marginTop: 20,
    marginBottom: 10,
  },
  subIndex: {
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.gray600,
  },
  content: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray700,
    lineHeight: 22,
    marginBottom: 8,
  },
  contentHighlight: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.gray700,
    lineHeight: 22,
    marginBottom: 12,
    backgroundColor: theme.colors.gray50,
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  },
  subContent: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray600,
    lineHeight: 20,
    marginBottom: 12,
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.gray200,
  },
  footer: {
    fontSize: 13,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
  },
});
