/**
 * 33道灵魂解剖题
 * 每道题有3-4个选项，每个选项对应不同的人格得分
 * 
 * 12种人格类型代号:
 *   mask    - 精致面具者 (灵性面具者 + FAKE伪人)
 *   hoard   - 知识囤积者 (知识囤积者 + THIN-K思考者)
 *   escape  - 浪漫逃避者 (浪漫逃避者 + LOVE-R多情者)
 *   rebel   - 愤世解构者 (逻辑解构者 + SHIT愤世者)
 *   edge    - 边缘观察者 (边缘觉察者 + SOLO孤儿)
 *   crash   - 绝望坠落者 (绝望坠落者 + DEAD死者)
 *   chill   - 佛系摆烂者 (OJBK无所谓人 + ZZZZ装死者 + MONK僧人)
 *   clown   - 社交小丑者 (JOKE-R小丑 + SEXY尤物 + ESFP表演者)
 *   mama    - 操心圣母者 (MUM妈妈 + ISFJ守护者 + ENFJ主人公)
 *   hustle  - 人间清醒者 (CTRL拿捏者 + BOSS + ENTJ指挥官)
 *   chaos   - 混沌野草者 (FUCK草者 + WOC握草人 + MALO吗喽)
 *   awake   - 恒久观察者 (恒久观察者 + 纯粹意志者)
 */

const questions = [
  {
    id: 1,
    text: "朋友圈有人发了一条极度悲观的长文，你的第一反应是什么？",
    options: [
      { label: "A", text: "赶紧发一段「你很棒、要爱自己、活在当下」的小作文去温暖他", scores: { mama: 3, mask: 1 } },
      { label: "B", text: "截图存到收藏夹，把它当作原生家庭分析的新素材", scores: { hoard: 3, rebel: 1 } },
      { label: "C", text: "觉得这人终于撕下了面具，展示了人类面对虚无时的真实模样", scores: { edge: 2, awake: 2 } },
      { label: "D", text: "「哦，又来了」，然后继续刷下一条", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 2,
    text: "把「活在当下」「非二元觉知」这种词挂嘴边的人，你怎么看？",
    options: [
      { label: "A", text: "我就是其中之一，这些词让我感觉自己正走在正确的道路上", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "这些概念很有意思，我收藏了不少相关资料但还没来得及验证", scores: { hoard: 3, chill: 1 } },
      { label: "C", text: "我对这些糖衣包装的安眠药嗤之以鼻", scores: { rebel: 3, awake: 1 } },
      { label: "D", text: "默默祝福就好了", scores: { mama: 2, escape: 2 } }
    ]
  },
  {
    id: 3,
    text: "聚会上有位「大师」在滔滔不绝地传播智慧，你会——",
    options: [
      { label: "A", text: "跟着附和赞美，还趁机汇报自己的体悟，期待被夸", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "默默在脑中检索他说的理论漏洞，准备事后写一篇反驳", scores: { hoard: 2, rebel: 2 } },
      { label: "C", text: "当场拆台：「你卖的不过是游乐场里的廉价镇静剂」", scores: { rebel: 3, chaos: 1 } },
      { label: "D", text: "趁大家听入迷的时候偷偷去拿自助餐", scores: { clown: 2, chill: 2 } }
    ]
  },
  {
    id: 4,
    text: "周末突然全城断网、手机也没电了，你的状态是？",
    options: [
      { label: "A", text: "极度焦虑！我大脑的控制面板突然黑屏了", scores: { hustle: 2, mask: 2 } },
      { label: "B", text: "太好了，可以在脑中构建关于人类意识演化的宏大理论", scores: { hoard: 3, escape: 1 } },
      { label: "C", text: "内心毫无波澜，没有任何问题需要解决", scores: { awake: 3, chill: 1 } },
      { label: "D", text: "直接躺平，终于有理由什么都不干了", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 5,
    text: "朋友扛不住了来找你哭，说「活着没意思」，你会——",
    options: [
      { label: "A", text: "赶紧灌鸡汤、端上热水，把爱的力量全部释放出去", scores: { mama: 3, mask: 1 } },
      { label: "B", text: "在安慰的同时内心其实也开始慌了——他的绝望让我想起自己", scores: { crash: 3, edge: 1 } },
      { label: "C", text: "「别抗拒了，继续往下沉，到底了就好了」", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "安慰并帮她分析问题", scores: { mama: 2, hustle: 2 } }
    ]
  },
  {
    id: 6,
    text: "你觉得周围人每天操心的事情就像NPC在走程序，你会——",
    options: [
      { label: "A", text: "强迫自己「包容众生」，在心里念十遍「万物皆佛」", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "感到强烈的孤独和自我怀疑，拼命在书本里找同类", scores: { edge: 3, crash: 1 } },
      { label: "C", text: "接受这就是人类沉睡的常态，只想远离他们", scores: { edge: 3, awake: 2 } },
      { label: "D", text: "管他呢，NPC也有NPC的快乐，我也做快乐NPC", scores: { chaos: 2, chill: 2 } }
    ]
  },
  {
    id: 7,
    text: "你长期坚持的一个习惯/修行法门突然被打断了：",
    options: [
      { label: "A", text: "极度焦虑——那是我用来建立安全感的核心堡垒", scores: { mask: 2, hustle: 2 } },
      { label: "B", text: "立刻将其升级为「万物皆修行」，为自己找到新的概念框架", scores: { hoard: 3, escape: 1 } },
      { label: "C", text: "毫无波澜——我早就知道一切坚持都是虚假游戏", scores: { awake: 2, chill: 2 } },
      { label: "D", text: "正好省事了！多一个不用做的事", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 8,
    text: "拼命赚了一笔大钱/完成了大项目，兴奋过后你感觉到的是——",
    options: [
      { label: "A", text: "立刻制定下一个KPI，用成就感填满每一秒", scores: { hustle: 3, mask: 1 } },
      { label: "B", text: "陷入存在主义危机：「然后呢？人生的意义到底是什么？」", scores: { edge: 2, crash: 2 } },
      { label: "C", text: "无论怎么满足，生命的本质依然是一场荒谬的肥皂剧", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "钱到手就花呗！享受当下才是正经事", scores: { clown: 2, chaos: 2 } }
    ]
  },
  {
    id: 9,
    text: "有人当面说「你的所有成就不过是逃避死亡恐惧的伪装」：",
    options: [
      { label: "A", text: "勃然大怒！用我的社会责任和奉献精神反击他", scores: { mama: 2, mask: 2 } },
      { label: "B", text: "掏出一堆哲学文献来进行严谨的学术辩驳", scores: { hoard: 3, rebel: 1 } },
      { label: "C", text: "世界观开始塌方，压抑不住的混乱能量涌上来……", scores: { crash: 3, edge: 1 } },
      { label: "D", text: "「嗯嗯你说得对」，然后继续做自己的事", scores: { chill: 2, chaos: 2 } }
    ]
  },
  {
    id: 10,
    text: "你的书架/收藏夹画风是什么样的？",
    options: [
      { label: "A", text: "塞满深奥的灵性/哲学书籍——它们让我感到知识上的优越", scores: { hoard: 3, mask: 1 } },
      { label: "B", text: "以自我提升和心理学为主，在努力成为「更好的自己」", scores: { hustle: 2, mask: 2 } },
      { label: "C", text: "啥都有，但基本没翻过，摆着好看的", scores: { chill: 2, clown: 2 } },
      { label: "D", text: "空的，或者准备清空", scores: { chill: 2, awake: 2 } }
    ]
  },
  {
    id: 11,
    text: "遇到一个会彻底摧毁你现有信仰体系的真相，你——",
    options: [
      { label: "A", text: "用「爱与正能量」筑起防护墙，拒绝让任何东西动摇我的舒适圈", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "死死抓住控制舵不放——必须在理论上找到可控的解释", scores: { hoard: 2, hustle: 2 } },
      { label: "C", text: "不计代价地「破窗跳楼」，宁毁信仰不做骗子", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "先放在一边吧，等哪天心情好了再说", scores: { chill: 3, escape: 1 } }
    ]
  },
  {
    id: 12,
    text: "你参加某些课程/社群/圈子，内心深处的真实驱动力是？",
    options: [
      { label: "A", text: "觉得自己是局外人、有缺陷，想要被接纳", scores: { escape: 3, crash: 1 } },
      { label: "B", text: "想成为那个「很厉害的人」，建立知识的话语权", scores: { hoard: 2, hustle: 2 } },
      { label: "C", text: "纯粹是凑热闹和社交需求，热闹完就散", scores: { clown: 3, chill: 1 } },
      { label: "D", text: "曾经如此，但现在看穿了大家都在「踩水」", scores: { edge: 2, awake: 2 } }
    ]
  },
  {
    id: 13,
    text: "对「世界可以变得更好」这种话，你的真实反应：",
    options: [
      { label: "A", text: "当然可以！只要每个人都充满爱与环保意识就行了", scores: { mama: 2, mask: 2 } },
      { label: "B", text: "理论上可行，我正在研究集体意识进化的路径", scores: { hoard: 3, escape: 1 } },
      { label: "C", text: "纯属幻想——觉醒是一场个人碾碎虚假自我的作战", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "世界好不好跟我没关系，我先吃饱再说", scores: { chaos: 2, chill: 2 } }
    ]
  },
  {
    id: 14,
    text: "「你要爱自己」「感恩一切」——听到这类话你的反应是：",
    options: [
      { label: "A", text: "眼睛发光✨ 这就是宇宙传递给我的讯息！", scores: { mask: 2, escape: 2 } },
      { label: "B", text: "觉得空洞可笑，但社交场合我会戴上这副面具", scores: { clown: 2, edge: 2 } },
      { label: "C", text: "极度反感——这不过是用来掩饰现实痛苦的廉价麻醉剂", scores: { rebel: 3, awake: 1 } },
      { label: "D", text: "行吧行吧，你说什么都对", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 15,
    text: "如果觉醒的代价是：失去存款、人设崩塌、亲人不理解——",
    options: [
      { label: "A", text: "我绝对不接受！如果不能带来幸福极乐，要这破觉醒有何用", scores: { escape: 3, mask: 1 } },
      { label: "B", text: "光想想就感到不安，于是立刻潜入书本里去寻找某种可控感", scores: { hoard: 2, edge: 2 } },
      { label: "C", text: "宁可承受最惨烈的代价，也要走上觉醒之路", scores: { awake: 3, crash: 1 } },
      { label: "D", text: "我连存款都没有，还怕啥（笑）", scores: { chaos: 3, clown: 1 } }
    ]
  },
  {
    id: 16,
    text: "你是否觉得「好员工/好伴侣」这个人设只是一副戏服？",
    options: [
      { label: "A", text: "不！我发自内心地想照顾好身边的每一个人", scores: { mama: 3, mask: 1 } },
      { label: "B", text: "我知道有些荒谬，但我选择继续穿着戏服混日子", scores: { chill: 2, chaos: 2 } },
      { label: "C", text: "绝对是的，我正在一层层剥离对社会标签的认同", scores: { awake: 2, rebel: 2 } },
      { label: "D", text: "我连戏服都演不好，就别提脱不脱了……", scores: { crash: 2, edge: 2 } }
    ]
  },
  {
    id: 17,
    text: "在人群中突然觉得一切毫无意义、极度空虚的时候：",
    options: [
      { label: "A", text: "迅速回到人群中，用最大的笑声压过心碎的声音", scores: { clown: 3, mask: 1 } },
      { label: "B", text: "有一瞬间的清醒，但很快又沉睡回去了", scores: { edge: 2, hoard: 2 } },
      { label: "C", text: "绝不退缩！准备一无所有地去追那个真相", scores: { awake: 3, crash: 1 } },
      { label: "D", text: "「虚无就虚无呗，来，先干了这杯」", scores: { chaos: 3, chill: 1 } }
    ]
  },
  {
    id: 18,
    text: "人生遭遇暴击（如失恋/失业/至亲去世），你的第一反应？",
    options: [
      { label: "A", text: "疯狂找人倾诉，或者扎进信仰/宗教里寻求庇护", scores: { escape: 2, mama: 2 } },
      { label: "B", text: "把痛苦转化成素材——拍视频/写文字记录这段「成长」", scores: { mask: 2, clown: 2 } },
      { label: "C", text: "世界观直接崩塌了，痛哭到无法呼吸", scores: { crash: 3, edge: 1 } },
      { label: "D", text: "视为「生命起床号」，誓要搞清楚人生为什么会这样", scores: { awake: 3, rebel: 1 } }
    ]
  },
  {
    id: 19,
    text: "你读到一个颠覆性的哲学观点，你的习惯是——",
    options: [
      { label: "A", text: "把它作为日常小领悟，转手推荐给朋友「你应该读读这个」", scores: { mask: 2, mama: 2 } },
      { label: "B", text: "用逻辑思维去严密拆解它，但必须经过权威的验证才敢采纳", scores: { hoard: 3, hustle: 1 } },
      { label: "C", text: "直接把它当作凌迟自我的武器——痛，但有效", scores: { awake: 2, rebel: 2 } },
      { label: "D", text: "看完「哇好厉害」然后就忘了", scores: { chill: 2, chaos: 2 } }
    ]
  },
  {
    id: 20,
    text: "你追求自我提升的最核心驱动力其实是——",
    options: [
      { label: "A", text: "想成为「更好的人」，因为潜意识里觉得现在的自己不够好", scores: { escape: 3, mask: 1 } },
      { label: "B", text: "纯粹的知识快感——学到新东西让我多巴胺飙升", scores: { hoard: 3, hustle: 1 } },
      { label: "C", text: "为了彻底消灭那个「自以为是的“我”」", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "别人都在提升，我不提升的话很容易落后吧", scores: { clown: 2, chill: 2 } }
    ]
  },
  {
    id: 21,
    text: "别人说「一切都是命运最好的安排」来安慰你时：",
    options: [
      { label: "A", text: "感到被治愈了——这让我能继续做美梦", scores: { escape: 3, mask: 1 } },
      { label: "B", text: "表面微笑接受，大脑在疯狂给这句话打标签归类", scores: { hoard: 2, edge: 2 } },
      { label: "C", text: "毫不留情地击碎它——盲目信仰是必须被丢弃的垃圾", scores: { rebel: 3, awake: 1 } },
      { label: "D", text: "「嗯嗯是的呢」（敷衍+1）", scores: { chill: 3, clown: 1 } }
    ]
  },
  {
    id: 22,
    text: "选一个词来形容你在工作/学业中的常态：",
    options: [
      { label: "A", text: "人形效率机器——不在工作就在工作的路上", scores: { hustle: 3, mask: 1 } },
      { label: "B", text: "默默付出的老黄牛——别人开心我就值了", scores: { mama: 3, escape: 1 } },
      { label: "C", text: "看似摸鱼实则在进行深度哲学思考", scores: { hoard: 2, edge: 2 } },
      { label: "D", text: "严重拖延症——直到截止期限前一刻才开始疯狂赶工", scores: { chill: 2, chaos: 2 } }
    ]
  },
  {
    id: 23,
    text: "你在社交场合更像哪一种存在？",
    options: [
      { label: "A", text: "气氛组长！我在的地方不允许冷场", scores: { clown: 3, chaos: 1 } },
      { label: "B", text: "万能充——所有人都来找我充电、诉苦、求安慰", scores: { mama: 3, mask: 1 } },
      { label: "C", text: "角落里默默观察一切的「局外人」", scores: { edge: 3, hoard: 1 } },
      { label: "D", text: "来了、签到了、提前走了", scores: { chill: 3, awake: 1 } }
    ]
  },
  {
    id: 24,
    text: "发现自己崇拜已久的信仰/偶像是个谎言时：",
    options: [
      { label: "A", text: "太痛苦了，强行欺骗自己维持现有的平静与优雅", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "脑中塞满相关知识，却迟迟不敢脱下自己的身份面具", scores: { hoard: 2, edge: 2 } },
      { label: "C", text: "完美！终于看破恐惧，又碎了一层幻象", scores: { awake: 3, rebel: 1 } },
      { label: "D", text: "「又骗我感情QAQ」然后三天后继续追下一个偶像", scores: { chaos: 2, clown: 2 } }
    ]
  },
  {
    id: 25,
    text: "你内心戏最多的场景是？",
    options: [
      { label: "A", text: "在脑中彩排过无数次辞职/表白/大闹一场的画面，但从没行动", scores: { escape: 2, edge: 2 } },
      { label: "B", text: "一个人的时候脑子里在开哲学研讨会", scores: { hoard: 3, rebel: 1 } },
      { label: "C", text: "脑子里像在播放日常琐事的走马灯，有很多细碎的念头", scores: { escape: 2, chill: 1 } },
      { label: "D", text: "极少有杂乱的念头，大部分时候内心平静", scores: { awake: 3, chill: 1 } }
    ]
  },
  {
    id: 26,
    text: "如果明天是地球最后一天，你此刻的状态：",
    options: [
      { label: "A", text: "极度恐慌，试图用最后的时间「拯救他人」来减轻焦虑", scores: { mama: 2, crash: 2 } },
      { label: "B", text: "像观赏一部肥皂剧大结局一样，完全平静", scores: { awake: 3, chill: 1 } },
      { label: "C", text: "终于可以不用上班了！狂欢到最后一秒！", scores: { chaos: 3, clown: 1 } },
      { label: "D", text: "装死。反正也改变不了什么", scores: { chill: 3, crash: 1 } }
    ]
  },
  {
    id: 27,
    text: "你潜意识里最害怕的事情大概是——",
    options: [
      { label: "A", text: "失去金钱、地位和他人的认可", scores: { hustle: 2, mask: 2 } },
      { label: "B", text: "几十年积累的知识储备被证明毫无用处", scores: { hoard: 3, crash: 1 } },
      { label: "C", text: "获得了一切之后，生命的底色依然是虚无", scores: { edge: 2, awake: 2 } },
      { label: "D", text: "害怕不知不觉间虚度了一生，最后什么也没留下", scores: { crash: 2, hustle: 2 } }
    ]
  },
  {
    id: 28,
    text: "面对那些天天宣扬正能量的社群/群聊，你——",
    options: [
      { label: "A", text: "我就是发起人或最活跃的一个", scores: { mama: 2, mask: 2 } },
      { label: "B", text: "用俯视的逻辑去拆解他们，认为他们是智力上的弱者", scores: { rebel: 3, hoard: 1 } },
      { label: "C", text: "看穿他们只是在寻找心理镇静剂，默默退群", scores: { edge: 2, awake: 2 } },
      { label: "D", text: "进群抢红包，从不说话", scores: { chill: 2, chaos: 2 } }
    ]
  },
  {
    id: 29,
    text: "选一个最接近你的日常口头禅：",
    options: [
      { label: "A", text: "「没事的，一切都会好起来的～」", scores: { mama: 2, escape: 2 } },
      { label: "B", text: "「等等，让我想想这个逻辑对不对」", scores: { hoard: 3, hustle: 1 } },
      { label: "C", text: "「无所谓，随便吧」", scores: { chill: 3, chaos: 1 } },
      { label: "D", text: "「WOC / 我靠！」（感叹一切的万能语气词）", scores: { chaos: 3, clown: 1 } }
    ]
  },
  {
    id: 30,
    text: "你做这份人格测试的终极动机其实是——",
    options: [
      { label: "A", text: "想获取一个有趣的标签去发朋友圈炫", scores: { mask: 2, clown: 2 } },
      { label: "B", text: "分析题干背后的心理学逻辑，权当做一种智力上的消遣", scores: { hoard: 3, edge: 1 } },
      { label: "C", text: "用绝对的诚实来亲身见证自我的崩塌", scores: { awake: 3, crash: 1 } },
      { label: "D", text: "就是无聊嘛，打发时间", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 31,
    text: "有人突然说「你其实是个很假的人」，你的内心活动：",
    options: [
      { label: "A", text: "破防！开始反思自己的面具到底有多少层", scores: { mask: 2, crash: 2 } },
      { label: "B", text: "「假的又怎样？在座各位谁不是在演？」", scores: { clown: 2, chaos: 2 } },
      { label: "C", text: "毫无波澜——因为「我」本来就不存在", scores: { awake: 3, chill: 1 } },
      { label: "D", text: "「真的谢谢你提醒我！」开始拉着他分析人格理论", scores: { hoard: 2, mama: 2 } }
    ]
  },
  {
    id: 32,
    text: "以下哪种生活最让你向往？",
    options: [
      { label: "A", text: "在一个充满爱与光的社区里互相疗愈", scores: { escape: 3, mama: 1 } },
      { label: "B", text: "身无分文地在寒冬中流浪，与万物融为一体", scores: { awake: 3, crash: 1 } },
      { label: "C", text: "坐拥权力和效率，掌控一方天地", scores: { hustle: 3, mask: 1 } },
      { label: "D", text: "以上都太累了，找个角落躺着就好", scores: { chill: 3, chaos: 1 } }
    ]
  },
  {
    id: 33,
    text: "最后一题：如果这个测试的结果跟你想的完全不—样，你会——",
    options: [
      { label: "A", text: "不开心！重新做一遍直到出一个我满意的结果", scores: { mask: 3, escape: 1 } },
      { label: "B", text: "质疑算法的科学性，写一篇文章批判它", scores: { hoard: 2, rebel: 2 } },
      { label: "C", text: "笑了——结果本身就是幻象，重要的是过程", scores: { awake: 3, chill: 1 } },
      { label: "D", text: "截图发群，大家一起乐呵乐呵", scores: { clown: 3, chaos: 1 } }
    ]
  }
];
