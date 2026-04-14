/**
 * 12种人格结果定义
 * 融合灵性觉醒人格图谱 × MBTI × SBTI 恶搞体系
 */

const personalities = {
  mask: {
    name: "精致面具者",
    emoji: "🎭",
    image: "images/mask.png",
    subtitle: "The Masked Virtuoso — 人间高定Cosplay冠军",
    meters: { mask: 92, awake: 25, chill: 30, drama: 85 },
    description: `你就像一台高性能仿生人，切换面具比切换输入法还丝滑。你把正能量、优雅和灵性修行当作最精美的护甲，用来掩盖内心深处对失控、被排斥和终极虚无的恐惧。<br><br>你热衷于与权威进行「自我确认」的交易——汇报深刻的体悟来获取赞美。<strong>你的面具其实做工精良到连你自己都快信了</strong>。人间修行道具大赛，你是永远的MVP。`,
    tags: ["面具大师", "优雅防御", "渴望被认可", "内心戏王者", "灵修外衣"],
    quote: "「她将优雅的表象与静心时的幻相作为精心打造的面具，用来掩盖底层对金钱、安全感和被排斥的恐惧。」\n—— 灵性面具者原型",
    mbti: "最接近 ENFJ（主人公）或 ESFJ（执政官）的表层 × SBTI 中的 <span class='mbti-label'>FAKE 伪人</span>——面具拼凑自我"
  },
  hoard: {
    name: "知识囤积者",
    emoji: "📚",
    image: "images/hoard.png",
    subtitle: "The Dogmatic Librarian — 脑容量超标的理论型囤积狂",
    meters: { mask: 55, awake: 40, chill: 35, drama: 70 },
    description: `你的大脑是一座永不关闭的图书馆，里面的书从叔本华排到了量子力学。你把灵修/心理学/哲学异化为一场智力游戏，用知识为自己建起了铜墙铁壁般的护城河。<br><br>问题是，<strong>你宁可在理论的迷宫里走一辈子，也不愿意让任何真相刺穿你的生活</strong>。追寻多少年了？不过是在为虚假自我挖一个更深更精致的坑。`,
    tags: ["理论派", "永远在学习", "拒绝实践", "概念收集器", "知识即护甲"],
    quote: "「极度依赖外在权威导师的概念架构，脑中塞满教义，死死抓着生命的控制舵不放。多年的追寻只是在为虚假自我挖一个更深的坑。」\n—— 知识囤积者原型",
    mbti: "最接近 INTP（逻辑学家）或 INTJ（架构师）× SBTI 中的 <span class='mbti-label'>THIN-K 思考者</span>——大脑永远在思考不盲从"
  },
  escape: {
    name: "浪漫逃避者",
    emoji: "🦋",
    image: "images/escape.png",
    subtitle: "The Romantic Fugitive — 用修行逃离现实的乌托邦旅客",
    meters: { mask: 60, awake: 20, chill: 40, drama: 75 },
    description: `你把开悟想象成了一个永恒极乐的人间天堂，修行对你来说是一张逃离现实苦难的单程票。你心里住着一个白日梦想家，一直在寻找那个「更好的自己」。<br><br>但说实话，<strong>你追求的不是残忍的真相，而是经过包装的舒适版「轻悟」</strong>。你内在那种觉得自己「有缺陷」的自卑创伤，才是一切修行的真实发动机。`,
    tags: ["乌托邦信徒", "自卑驱动", "追求极乐", "逃避虚无", "玻璃心战士"],
    quote: "「将开悟误认为逃离苦难的人间天堂、永恒的极乐，或试图借此成为更好的人。追求的不是残忍的真相，而是经过包装的舒适轻悟。」\n—— 浪漫逃避者原型",
    mbti: "最接近 INFP（调停者/小蝴蝶）× SBTI 中的 <span class='mbti-label'>LOVE-R 多情者</span>——一生都在寻找灵魂伴侣的吟游诗人"
  },
  rebel: {
    name: "愤世解构者",
    emoji: "🔥",
    image: "images/rebel.png",
    subtitle: "The Angry Deconstructionist — 嘴上骂世界手上拯救世界",
    meters: { mask: 30, awake: 55, chill: 20, drama: 90 },
    description: `你对所有虚假的东西都有一种近乎病态的过敏反应——正能量让你起疹子，心灵鸡汤让你反胃，权威让你想下场单挑。你用解构一切的姿态来表达对世界的深层愤怒。<br><br>但讽刺的是，<strong>你最恐惧的事情恰恰是：万一拆完了所有东西，里面真的什么都没有怎么办？</strong>于是你永远停留在「愤怒的拆解」阶段，不敢触碰最后那个空无。`,
    tags: ["拆台专家", "反骨青年", "怼天怼地", "悲壮反差", "暗夜行者"],
    quote: "「我用嘲讽解构一切神圣，只是为了掩饰内心深处对『万物皆空』的恐惧。」\n—— SBTI·SHIT 愤世者",
    mbti: "最接近 ENTP（辩论家）或 ISTP（鉴赏家）× SBTI 中的 <span class='mbti-label'>SHIT 愤世者</span>——悲壮的反差英雄"
  },
  edge: {
    name: "边缘观察者",
    emoji: "🌑",
    image: "images/edge.png",
    subtitle: "The Alienated Observer — 灵魂外围建起万里长城的独行者",
    meters: { mask: 35, awake: 60, chill: 45, drama: 80 },
    description: `你敏锐地察觉到周围人如同沉睡的躯壳——你不是不合群，而是你的视角天生就和这个世界错位。你能看到柏拉图戏院的影子，但你还处于戏院之中。<br><br><strong>你最大的痛苦不是看不到真相，而是看到了却走不出去。</strong>于是你在书本、理论和自我怀疑中反复横跳，像一只满身尖刺的刺猬——尖刺不是为了伤人，是怕别人受伤。`,
    tags: ["灵魂局外人", "过早觉醒", "刺猬型人格", "自我怀疑", "孤独感知者"],
    quote: "「敏锐地察觉到周遭人群如同沉睡的躯壳，自身因这种非正常的视角而感到强烈的孤立与自我怀疑。」\n—— 边缘觉察者原型",
    mbti: "最接近 INFJ（提倡者/哲学家）或 INTJ（架构师）× SBTI 中的 <span class='mbti-label'>SOLO 孤儿</span>——满身尖刺只是怕你受伤"
  },
  crash: {
    name: "绝望坠落者",
    emoji: "🕳️",
    image: "images/crash.png",
    subtitle: "The Shattered One — 正在自由落体的灵魂拆迁户",
    meters: { mask: 15, awake: 50, chill: 10, drama: 95 },
    description: `你正经历着或者曾经历过一场核爆级的认知失调——你突然看穿了自己多年经营的生活/信仰/关系不过是一场精心编排的谎言。世界观坍塌了，焦虑和混乱的能量正在撕裂你。<br><br>这很痛。但如果有人告诉你这是好事，<strong>请你不要逃跑——这是死而重生的必经之路</strong>。你需要做的不是找安慰，而是停止抗拒，让自己继续往下沉。`,
    tags: ["世界观崩塌", "死而重生", "极度焦虑", "幻象终结者", "深渊潜水员"],
    quote: "「在突然看穿自己多年的灵修只是一场踩水骗局后，世界观坍塌，释放出极度焦虑与压抑不住的混乱能量。」\n—— 绝望坠落者原型",
    mbti: "正在经历心理重组 × SBTI 中的 <span class='mbti-label'>DEAD 死者</span>——删档重开999次的终极贤者（前身）"
  },
  chill: {
    name: "佛系摆烂者",
    emoji: "🧘",
    image: "images/chill.png",
    subtitle: "The Supreme Slacker — 把躺平修到了哲学层面",
    meters: { mask: 20, awake: 35, chill: 95, drama: 15 },
    description: `你是混沌世界里最稳定的存在——不是因为看破了，而是因为你根本懒得去看。你的人生哲学是「万物依本性而存在，与其挣扎抗拒，不如随顺而活」，万物各行其道，你只行你的躺平之道。<br><br>你对满屏的红点消息视而不见，总能在截止时间的边缘，以一种不紧不慢的姿态悠然现身。但别误会，<strong>你的摆烂不是放弃——这是一种极端的、将「无所谓」修炼到极致的另类禅定</strong>。`,
    tags: ["极致摆烂", "佛系统治", "截止日期杀手", "最小能量运动", "躺平禅师"],
    quote: "「看破红尘，个人空间被当做结界，万物各行其道。」\n—— SBTI·MONK 僧人",
    mbti: "最接近 ISTP（鉴赏家）或 INTP（逻辑学家）的躺平态 × SBTI 中的 <span class='mbti-label'>OJBK 无所谓人</span> + <span class='mbti-label'>ZZZZ 装死者</span>"
  },
  clown: {
    name: "社交小丑者",
    emoji: "🤡",
    image: "images/clown.png",
    subtitle: "The Laughing Mask — 用最大的笑声盖住心碎的声音",
    meters: { mask: 70, awake: 20, chill: 55, drama: 65 },
    description: `你是人群中永远的气氛组长、表情包生产机、段子手——你到哪里，哪里就充满笑声。你似乎天生就拥有让一切变得轻松愉快的能力。<br><br>但你知道的——<strong>每一个绝佳的笑点背后，都是你不敢独处的恐惧</strong>。你用幽默作为最坚硬的盔甲，用嬉笑怒骂掩盖着内心某个不愿被触碰的柔软角落。毕竟，让别人笑比让自己哭容易多了。`,
    tags: ["气氛担当", "段子手", "幽默防御", "不敢独处", "笑中带泪"],
    quote: "「社交气氛组长，总是用最大的笑声盖住心碎的声音。」\n—— SBTI·JOKE-R 小丑",
    mbti: "最接近 ESFP（表演者）或 ENFP（快乐小狗）× SBTI 中的 <span class='mbti-label'>JOKE-R 小丑</span> + <span class='mbti-label'>SEXY 尤物</span>"
  },
  mama: {
    name: "操心圣母者",
    emoji: "🫂",
    image: "images/mama.png",
    subtitle: "The Cosmic Mother — 是别人的解药，给自己的总少点",
    meters: { mask: 50, awake: 25, chill: 25, drama: 60 },
    description: `你的共情力强到可以接收全宇宙的wifi信号——别人皱一下眉头，你就已经在心里准备好了安慰、建议和一杯热水。你是所有人的治愈系，是避风港，是永远在线的情感客服。<br><br>但问题来了：<strong>你把全世界都照顾了，唯独忘了照顾自己</strong>。你的付出本质上是为了维串一种「被需要」的安全感——因为你害怕一旦停止给予，就没人会留下来。`,
    tags: ["人间解药", "情感充电宝", "自我牺牲", "被需要成瘾", "治愈系天花板"],
    quote: "「底色温柔，具有超强共情力的治愈系，是别人的解药，给自己的却总是太少。」\n—— SBTI·MUM 妈妈",
    mbti: "最接近 ISFJ（守护者/小护士）或 ENFJ（主人公/教育家）× SBTI 中的 <span class='mbti-label'>MUM 妈妈</span>"
  },
  hustle: {
    name: "极简游离者",
    emoji: "🧊",
    image: "images/hustle.png",
    subtitle: "The Minimalist Wanderer — 剔除一切冗余的情绪极简主义者",
    meters: { mask: 60, awake: 30, chill: 10, drama: 50 },
    description: `你像一块永远保持恒温的冰体，用绝对的理智在这个狂热的世界里保持冷眼旁观。你的人生哲学是「世间万物皆为借用，玩家的最高修养是随时准备空手离场」。<br><br>你不仅是物理上的极简，更是人际关系里的断舍离大师。但冷静想想：<strong>你疯狂地用“理智和疏离”来剥离所有的羁绊，是不是因为你内心深处，其实不敢承受任何失去的重量？</strong>你精明地保全了自我，却也把自己隔绝在了真正的温度之外。`,
    tags: ["绝对理智", "情感断舍离", "人间散客", "恐惧羁绊", "高冷旁观"],
    quote: "「世间万事不过是系统程序的运行，聪明人懂得斩断不必要的进程，永远只做一个冷眼的管理员。」\n—— 极简游离者原型",
    mbti: "最接近 ISTJ（物流师）或 INTJ（架构师）× SBTI 中的 <span class='mbti-label'>CTRL 拿捏者</span> + <span class='mbti-label'>ICE 冰块</span>"
  },
  chaos: {
    name: "混沌野草者",
    emoji: "🌿",
    image: "images/chaos.png",
    subtitle: "The Unkillable Weed — 永远无法被杀死的人形野草",
    meters: { mask: 15, awake: 30, chill: 80, drama: 40 },
    description: `你是一株生长在废墟上的野草——没有人能真正杀死你，因为你从来不给自己设置「必须存活」的条件。你的情绪只有两档：「YEAH」和「OFF」，你的人生哲学是「活着就行，活法随缘」。<br><br>你看透了文明不过是付费游戏的真相，然后选择了<strong>不充值、不退款、不投诉——就这么野生野长</strong>。荒谬吗？荒谬。但你觉得，荒谬本身就是答案。`,
    tags: ["不可被杀死", "荒野求生", "两档情绪", "自由散养", "快乐原住民"],
    quote: "「荒野狼嚎般的人形野草，永远无法被杀死。快乐原住民，灵魂停留在荡秋千时代。」\n—— SBTI·FUCK 草者 × MALO 吗喽",
    mbti: "最接近 ESTP（企业家/挑战者）或 ISFP（探险家）× SBTI 中的 <span class='mbti-label'>FUCK 草者</span> + <span class='mbti-label'>MALO 吗喽</span> + <span class='mbti-label'>WOC! 握草人</span>"
  },
  awake: {
    name: "恒久觉察者",
    emoji: "👁️",
    image: "images/awake.png",
    subtitle: "The Awakened Eye — 已经走出柏拉图戏院的人",
    meters: { mask: 5, awake: 95, chill: 70, drama: 10 },
    description: `你要么已经彻底瓦解了自我结构，要么正走在通往那里的不归路上。你将人类的生活与苦难视为荒谬的电影院，完全脱离了角色的认同。没有占有欲、得失心和道德评判，行事只凭顺势而为的本能。<br><br>听起来很酷？<strong>但代价是：你付出了普通人不愿付出的一切</strong>——身份、安全感、舒适圈、被理解的权利，甚至某种程度上的「人味」。你不是超脱了，你只是把自以为存在的那个人彻底杀掉了。`,
    tags: ["无我状态", "超越恐惧", "顺势而为", "真相极客", "灵魂裸奔"],
    quote: "「将人类的生活与苦难视为荒谬的电影院，完全脱离了角色的认同。他们是剥离了社会面具后的觉察状态。」\n—— 恒久觉察者原型",
    mbti: "超越MBTI类型 × 类似 <span class='mbti-label'>纯粹意志者</span> + <span class='mbti-label'>纯粹交托者</span>——这两条路通往同一处觉醒"
  }
};
