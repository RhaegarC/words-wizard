export type Topic = {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  tone: string;
};

export type Word = {
  id: string;
  text: string;
  phonetic: string;
  partOfSpeech: string;
  meaningEn: string;
  meaningZh: string;
  definitionEn: string;
  definitionZh: string;
  exampleEn: string;
  exampleZh: string;
  symbol: string;
  strength: number;
  mastered: boolean;
  topicId: string;
};

export const topics: Topic[] = [
  { id: "craft", title: "Craft & Build", titleZh: "创造与建造", description: "Make, shape, and create new things.", descriptionZh: "学习制作、塑造和创造新事物。", tone: "violet" },
  { id: "explore", title: "Explore & Discover", titleZh: "探索与发现", description: "Journey into curious new places.", descriptionZh: "踏上旅程，发现有趣的新地方。", tone: "blue" },
  { id: "puzzle", title: "Puzzle & Mystery", titleZh: "谜题与神秘", description: "Find clues and solve clever problems.", descriptionZh: "寻找线索，解决有趣的难题。", tone: "yellow" },
  { id: "coop", title: "Co-op Quest", titleZh: "合作任务", description: "Share, help, and succeed together.", descriptionZh: "分享、互助，一起取得成功。", tone: "green" },
  { id: "survive", title: "Battle & Survive", titleZh: "挑战与生存", description: "Be brave, careful, and prepared.", descriptionZh: "勇敢、细心，并做好准备。", tone: "coral" },
];

export const words: Word[] = [
  { id: "discover", text: "discover", phonetic: "/dɪˈskʌvə/", partOfSpeech: "verb", meaningEn: "find something new", meaningZh: "发现", definitionEn: "To find something that you did not know before.", definitionZh: "找到以前不知道的事物。", exampleEn: "We discover a hidden path in the forest.", exampleZh: "我们在森林里发现了一条隐秘的小路。", symbol: "Di", strength: 0.88, mastered: true, topicId: "explore" },
  { id: "brave", text: "brave", phonetic: "/breɪv/", partOfSpeech: "adjective", meaningEn: "ready to face danger", meaningZh: "勇敢的", definitionEn: "Ready to face something difficult without giving up.", definitionZh: "面对困难时不放弃，勇于尝试。", exampleEn: "Mia is brave enough to cross the bridge.", exampleZh: "米娅勇敢地走过了那座桥。", symbol: "Br", strength: 0.76, mastered: false, topicId: "survive" },
  { id: "together", text: "together", phonetic: "/təˈɡeðə/", partOfSpeech: "adverb", meaningEn: "with each other", meaningZh: "一起", definitionEn: "With another person or as a group.", definitionZh: "和另一个人或一群人在一起。", exampleEn: "We solved the puzzle together.", exampleZh: "我们一起解开了谜题。", symbol: "To", strength: 0.62, mastered: false, topicId: "coop" },
  { id: "create", text: "create", phonetic: "/kriˈeɪt/", partOfSpeech: "verb", meaningEn: "make something new", meaningZh: "创造", definitionEn: "To make something that was not there before.", definitionZh: "做出以前不存在的新事物。", exampleEn: "Let’s create a tower from these blocks.", exampleZh: "让我们用这些积木搭一座塔。", symbol: "Cr", strength: 0.94, mastered: true, topicId: "craft" },
  { id: "careful", text: "careful", phonetic: "/ˈkeəfəl/", partOfSpeech: "adjective", meaningEn: "taking care to avoid mistakes", meaningZh: "小心的", definitionEn: "Thinking about what you do so you avoid mistakes.", definitionZh: "做事时认真思考，避免出错。", exampleEn: "Be careful when you carry the glass.", exampleZh: "拿玻璃杯时要小心。", symbol: "Ca", strength: 0.71, mastered: false, topicId: "puzzle" },
  { id: "journey", text: "journey", phonetic: "/ˈdʒɜːni/", partOfSpeech: "noun", meaningEn: "a trip to another place", meaningZh: "旅程", definitionEn: "A trip from one place to another.", definitionZh: "从一个地方到另一个地方的旅行。", exampleEn: "Our journey begins at sunrise.", exampleZh: "我们的旅程从日出时开始。", symbol: "Jo", strength: 0.83, mastered: true, topicId: "explore" },
];

export const practiceWords = words.slice(0, 5);
