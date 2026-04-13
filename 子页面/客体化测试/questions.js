const questions = [
  {
    "id": 1,
    "text": "我觉得自己的价值主要取决于：",
    "options": [
      { "text": "我的存在本身", "score": 0 },
      { "text": "我的内在品质", "score": 1 },
      { "text": "我的能力和成就", "score": 2 },
      { "text": "我能为他人做什么", "score": 3 }
    ]
  },
  {
    "id": 2,
    "text": "当我没有'用处'时，我感到：",
    "options": [
      { "text": "没什么特别感觉", "score": 0 },
      { "text": "有点不安", "score": 1 },
      { "text": "明显焦虑和空虚", "score": 2 },
      { "text": "极度恐慌，觉得没价值", "score": 3 }
    ]
  },
  {
    "id": 3,
    "text": "我需要他人的认可来确认自己有价值：",
    "options": [
      { "text": "完全不需要", "score": 0 },
      { "text": "偶尔需要", "score": 1 },
      { "text": "经常需要", "score": 2 },
      { "text": "总是需要", "score": 3 }
    ]
  },
  {
    "id": 4,
    "text": "当别人批评我时，我会：",
    "options": [
      { "text": "客观评估，不影响自我价值感", "score": 0 },
      { "text": "有些难受，但能恢复", "score": 1 },
      { "text": "严重怀疑自己", "score": 2 },
      { "text": "完全否定自己的价值", "score": 3 }
    ]
  },
  {
    "id": 5,
    "text": "我对自己的评价主要基于：",
    "options": [
      { "text": "我对自己的了解", "score": 0 },
      { "text": "我的内在感受", "score": 1 },
      { "text": "我的表现和成果", "score": 2 },
      { "text": "他人对我的评价", "score": 3 }
    ]
  },
  {
    "id": 6,
    "text": "当我犯错时，我觉得：",
    "options": [
      { "text": "这是学习机会", "score": 0 },
      { "text": "难过但能接受", "score": 1 },
      { "text": "严重怀疑自己的价值", "score": 2 },
      { "text": "我是彻底的失败者", "score": 3 }
    ]
  },
  {
    "id": 7,
    "text": "当我成功时，我认为：",
    "options": [
      { "text": "这是我的努力和能力", "score": 0 },
      { "text": "我做得不错", "score": 1 },
      { "text": "主要是运气或他人帮助", "score": 2 },
      { "text": "我不配，只是侥幸", "score": 3 }
    ]
  },
  {
    "id": 8,
    "text": "关于我自己，我相信：",
    "options": [
      { "text": "我的存在本身就有价值", "score": 0 },
      { "text": "我是有价值的人", "score": 1 },
      { "text": "我需要证明自己的价值", "score": 2 },
      { "text": "我只有有用才有价值", "score": 3 }
    ]
  },
  {
    "id": 9,
    "text": "我能清楚地说出自己的需求：",
    "options": [
      { "text": "总是能", "score": 0 },
      { "text": "大部分时候能", "score": 1 },
      { "text": "有时能，有时不确定", "score": 2 },
      { "text": "很少能，不知道自己要什么", "score": 3 }
    ]
  },
  {
    "id": 10,
    "text": "我说'不'的频率：",
    "options": [
      { "text": "需要时就说，很自然", "score": 0 },
      { "text": "能说，但有些困难", "score": 1 },
      { "text": "很少说，怕得罪人", "score": 2 },
      { "text": "几乎从不说，不敢拒绝", "score": 3 }
    ]
  },
  {
    "id": 11,
    "text": "我的个人边界（时间、空间、隐私）：",
    "options": [
      { "text": "清晰且被尊重", "score": 0 },
      { "text": "比较清晰，偶尔被侵犯", "score": 1 },
      { "text": "模糊，经常被侵犯", "score": 2 },
      { "text": "几乎没有，随时被侵犯", "score": 3 }
    ]
  },
  {
    "id": 12,
    "text": "关于我的重大决定（工作、恋爱、生活）：",
    "options": [
      { "text": "完全由我自己做主", "score": 0 },
      { "text": "我做主，但会参考他人意见", "score": 1 },
      { "text": "他人意见很大程度影响我", "score": 2 },
      { "text": "基本由他人决定", "score": 3 }
    ]
  },
  {
    "id": 13,
    "text": "我的时间安排：",
    "options": [
      { "text": "主要为自己安排", "score": 0 },
      { "text": "自己和他人各占一半", "score": 1 },
      { "text": "大部分被他人需求占据", "score": 2 },
      { "text": "完全被他人需求占据", "score": 3 }
    ]
  },
  {
    "id": 14,
    "text": "当他人侵犯我的边界时，我会：",
    "options": [
      { "text": "立即明确指出", "score": 0 },
      { "text": "委婉表达不满", "score": 1 },
      { "text": "感到不舒服但不敢说", "score": 2 },
      { "text": "认为是正常的，忍受", "score": 3 }
    ]
  },
  {
    "id": 15,
    "text": "关于拒绝，我相信：",
    "options": [
      { "text": "说'不'是我的权利", "score": 0 },
      { "text": "我可以拒绝", "score": 1 },
      { "text": "拒绝会伤害关系", "score": 2 },
      { "text": "拒绝会导致被抛弃", "score": 3 }
    ]
  },
  {
    "id": 16,
    "text": "在冲突中，我的反应通常是：",
    "options": [
      { "text": "表达立场并寻求解决", "score": 0 },
      { "text": "尝试沟通", "score": 1 },
      { "text": "立即道歉和妥协", "score": 2 },
      { "text": "认为都是我的错", "score": 3 }
    ]
  },
  {
    "id": 17,
    "text": "我表达真实情感的频率：",
    "options": [
      { "text": "总是真实表达", "score": 0 },
      { "text": "大部分时候真实", "score": 1 },
      { "text": "经常隐藏真实情感", "score": 2 },
      { "text": "几乎从不表达真实情感", "score": 3 }
    ]
  },
  {
    "id": 18,
    "text": "当我有需求时，我会：",
    "options": [
      { "text": "直接表达", "score": 0 },
      { "text": "暗示或委婉表达", "score": 1 },
      { "text": "压抑需求，等他人发现", "score": 2 },
      { "text": "完全压抑，认为不该有需求", "score": 3 }
    ]
  },
  {
    "id": 19,
    "text": "我的情绪被他人认真对待的程度：",
    "options": [
      { "text": "总是被认真对待", "score": 0 },
      { "text": "大部分时候被重视", "score": 1 },
      { "text": "经常被忽视或轻视", "score": 2 },
      { "text": "几乎总是被忽视或否定", "score": 3 }
    ]
  },
  {
    "id": 20,
    "text": "我为自己的情绪道歉的频率：",
    "options": [
      { "text": "从不，情绪是正常的", "score": 0 },
      { "text": "很少", "score": 1 },
      { "text": "经常说'对不起我太敏感了'", "score": 2 },
      { "text": "总是为自己的情绪道歉", "score": 3 }
    ]
  },
  {
    "id": 21,
    "text": "关于我的需求，我相信：",
    "options": [
      { "text": "我的需求重要且应该被满足", "score": 0 },
      { "text": "我的需求是正常的", "score": 1 },
      { "text": "我的需求不如他人重要", "score": 2 },
      { "text": "我不应该有需求", "score": 3 }
    ]
  },
  {
    "id": 22,
    "text": "我能准确识别自己的感受：",
    "options": [
      { "text": "总是能", "score": 0 },
      { "text": "大部分时候能", "score": 1 },
      { "text": "经常困惑", "score": 2 },
      { "text": "几乎不知道自己在感受什么", "score": 3 }
    ]
  },
  {
    "id": 23,
    "text": "在亲密关系中，我感觉自己是：",
    "options": [
      { "text": "平等的伴侣", "score": 0 },
      { "text": "大部分时候平等", "score": 1 },
      { "text": "经常处于次要地位", "score": 2 },
      { "text": "附属品或工具", "score": 3 }
    ]
  },
  {
    "id": 24,
    "text": "我在关系中的付出与得到：",
    "options": [
      { "text": "基本平衡", "score": 0 },
      { "text": "有时不平衡但可接受", "score": 1 },
      { "text": "我付出明显更多", "score": 2 },
      { "text": "完全单向付出", "score": 3 }
    ]
  },
  {
    "id": 25,
    "text": "他人联系我主要是因为：",
    "options": [
      { "text": "真心想了解我、陪伴我", "score": 0 },
      { "text": "既有真心也有需求", "score": 1 },
      { "text": "大多时候是需要我帮忙", "score": 2 },
      { "text": "只在需要我时才联系", "score": 3 }
    ]
  },
  {
    "id": 26,
    "text": "我感觉自己在关系中是'可替代的'：",
    "options": [
      { "text": "从不这样想", "score": 0 },
      { "text": "偶尔有这种感觉", "score": 1 },
      { "text": "经常这样觉得", "score": 2 },
      { "text": "总是觉得自己可被替换", "score": 3 }
    ]
  },
  {
    "id": 27,
    "text": "我在关系中能做真实的自己：",
    "options": [
      { "text": "完全可以", "score": 0 },
      { "text": "大部分时候可以", "score": 1 },
      { "text": "需要伪装和表演", "score": 2 },
      { "text": "完全不能，必须扮演某个角色", "score": 3 }
    ]
  },
  {
    "id": 28,
    "text": "当关系出现问题时，责任归属：",
    "options": [
      { "text": "双方共同分析和承担", "score": 0 },
      { "text": "主要是我反思", "score": 1 },
      { "text": "几乎都是我的错", "score": 2 },
      { "text": "完全是我的错，我必须改变", "score": 3 }
    ]
  },
  {
    "id": 29,
    "text": "关于爱，我相信：",
    "options": [
      { "text": "我值得被无条件的爱", "score": 0 },
      { "text": "我值得被爱", "score": 1 },
      { "text": "我需要足够好才能被爱", "score": 2 },
      { "text": "我必须满足他人需求才能被爱", "score": 3 }
    ]
  },
  {
    "id": 30,
    "text": "当他人不需要我时，我感到：",
    "options": [
      { "text": "正常，我有自己的生活", "score": 0 },
      { "text": "有点失落但能接受", "score": 1 },
      { "text": "明显的被抛弃感", "score": 2 },
      { "text": "恐慌，觉得自己没有存在价值", "score": 3 }
    ]
  },
  {
    "id": 31,
    "text": "我对'我是谁'的认知：",
    "options": [
      { "text": "非常清晰", "score": 0 },
      { "text": "比较清晰", "score": 1 },
      { "text": "经常困惑", "score": 2 },
      { "text": "完全不知道，只知道自己的角色", "score": 3 }
    ]
  },
  {
    "id": 32,
    "text": "我的兴趣爱好：",
    "options": [
      { "text": "有明确的个人爱好", "score": 0 },
      { "text": "有一些爱好", "score": 1 },
      { "text": "很少，大部分时间在满足他人", "score": 2 },
      { "text": "没有，不知道自己喜欢什么", "score": 3 }
    ]
  },
  {
    "id": 33,
    "text": "我独处时的感受：",
    "options": [
      { "text": "享受，能连接自己", "score": 0 },
      { "text": "舒适", "score": 1 },
      { "text": "不安，不知道做什么", "score": 2 },
      { "text": "恐慌，觉得自己没有价值", "score": 3 }
    ]
  },
  {
    "id": 34,
    "text": "我做决定时主要考虑：",
    "options": [
      { "text": "我真正想要什么", "score": 0 },
      { "text": "我的需求和他人的平衡", "score": 1 },
      { "text": "主要考虑他人的期待", "score": 2 },
      { "text": "完全基于他人的期待和评价", "score": 3 }
    ]
  },
  {
    "id": 35,
    "text": "在工作/家庭中，我感觉自己是：",
    "options": [
      { "text": "独立完整的个体", "score": 0 },
      { "text": "有自己空间的成员", "score": 1 },
      { "text": "主要承担某种功能（工具人）", "score": 2 },
      { "text": "完全被角色定义，没有个人空间", "score": 3 }
    ]
  },
  {
    "id": 36,
    "text": "我的人生目标：",
    "options": [
      { "text": "清晰且基于自己的价值观", "score": 0 },
      { "text": "有一些想法", "score": 1 },
      { "text": "主要是满足他人期待", "score": 2 },
      { "text": "完全不知道，只是活着", "score": 3 }
    ]
  },
  {
    "id": 37,
    "text": "我感到空虚和麻木的频率：",
    "options": [
      { "text": "从不", "score": 0 },
      { "text": "偶尔", "score": 1 },
      { "text": "经常", "score": 2 },
      { "text": "几乎总是", "score": 3 }
    ]
  },
  {
    "id": 38,
    "text": "我感觉自己像在'演戏'或'扮演角色'：",
    "options": [
      { "text": "从不", "score": 0 },
      { "text": "偶尔", "score": 1 },
      { "text": "经常", "score": 2 },
      { "text": "总是，不知道真实的我是什么样", "score": 3 }
    ]
  },
  {
    "id": 39,
    "text": "我对生活的掌控感：",
    "options": [
      { "text": "强烈的掌控感", "score": 0 },
      { "text": "有一定掌控感", "score": 1 },
      { "text": "很弱，觉得被推着走", "score": 2 },
      { "text": "完全没有，像木偶", "score": 3 }
    ]
  },
  {
    "id": 40,
    "text": "当我休息或什么都不做时，我感到：",
    "options": [
      { "text": "放松和恢复", "score": 0 },
      { "text": "还可以", "score": 1 },
      { "text": "内疚，觉得在浪费时间", "score": 2 },
      { "text": "强烈的罪恶感和焦虑", "score": 3 }
    ]
  }
];
