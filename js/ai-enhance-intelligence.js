// ============================================================
// ai-enhance-intelligence.js - 学习/分析/创意层AI增强
// AI出卷、AI故事、AI对战陪练、智能练习出题、复习间隔调整
// 语境猜词优化、弱点诊断深化、班级报告建议、学情画像、AI对话深化
// 依赖：ai-core.js + ai-features.js
// ============================================================
(function() {
  'use strict';
  console.log('[AI-Enhance-Intelligence] 模块已加载');

  // ================================================================
  // 一、AI出卷 - 根据班级错题数据生成测试卷
  // ================================================================

  // 为指定班级生成AI测试卷
  // className: 班级名（可选，空=全部）
  // 返回 Promise<{title, questions: [{type, stem, options, answer}]}>
  window.generateAITestPaper = function(className) {
    var targetDesc = className || '全部学生';
    var wrongWords = _collectWrongWords(className, 15);

    if (wrongWords.length === 0) {
      return Promise.resolve({ error: '暂无足够的错题数据来生成试卷' });
    }

    var wordsList = wrongWords.map(function(w) {
      return w.en + ' (' + w.zh + ') - 错误' + w.count + '次';
    }).join('\n');

    var prompt = '请根据以下学生错题数据（' + targetDesc + '），生成一份英语测试卷。\n' +
      '高频错词：\n' + wordsList + '\n\n' +
      '要求：\n' +
      '1. 生成8道题，包含以下题型：英译中(3题)、中译英(3题)、语境填空(2题)\n' +
      '2. 每题针对1个高频错词\n' +
      '3. 语境填空题给出含空格的句子和4个选项\n' +
      '4. 返回纯JSON格式，不要markdown代码块：\n' +
      '{"title":"试卷标题","questions":[{"type":"en2zh|zh2en|fillblank","stem":"题目","options":["A","B","C","D"],"answer":"正确答案","word":"目标单词"}]}';

    return window.aiOrFallback(
      prompt,
      function() {
        // 本地fallback：基于错词生成简单试卷
        return _buildLocalTestPaper(wrongWords, targetDesc);
      },
      {
        systemPrompt: '你是英语出题专家。只返回JSON格式的试卷数据，不要有任何额外文本。',
        parseJSON: true
      }
    );
  };

  // 本地生成试卷（无AI时的fallback）
  function _buildLocalTestPaper(wrongWords, targetDesc) {
    var questions = [];
    var shuffled = wrongWords.slice().sort(function() { return Math.random() - 0.5; });

    for (var i = 0; i < Math.min(shuffled.length, 8); i++) {
      var w = shuffled[i];
      var qType;
      if (i < 3) qType = 'en2zh';
      else if (i < 6) qType = 'zh2en';
      else qType = 'fillblank';

      var question;
      if (qType === 'en2zh') {
        question = {
          type: 'en2zh',
          stem: '"' + w.en + '" 的中文意思是？',
          options: [w.zh, _randomMeaning(), _randomMeaning(), _randomMeaning()],
          answer: w.zh,
          word: w.en
        };
        question.options.sort(function() { return Math.random() - 0.5; });
      } else if (qType === 'zh2en') {
        question = {
          type: 'zh2en',
          stem: '"' + w.zh + '" 对应的英文单词是？',
          options: [w.en, _randomWord(w.en), _randomWord(w.en), _randomWord(w.en)],
          answer: w.en,
          word: w.en
        };
        question.options.sort(function() { return Math.random() - 0.5; });
      } else {
        question = {
          type: 'fillblank',
          stem: 'The ______ is very important in this context.',
          options: [w.en, _randomWord(w.en), _randomWord(w.en), _randomWord(w.en)],
          answer: w.en,
          word: w.en
        };
        question.options.sort(function() { return Math.random() - 0.5; });
      }
      questions.push(question);
    }

    return {
      title: targetDesc + ' 英语错词测试卷',
      questions: questions,
      _local: true
    };
  }

  // 生成随机干扰词
  function _randomWord(exclude) {
    var pool = ['important', 'different', 'beautiful', 'interesting', 'difficult',
      'environment', 'technology', 'experience', 'government', 'information',
      'opportunity', 'development', 'education', 'relationship', 'communication'];
    var filtered = pool.filter(function(w) { return w !== exclude; });
    return filtered[Math.floor(Math.random() * filtered.length)] || 'unknown';
  }

  function _randomMeaning() {
    var pool = ['重要的', '不同的', '美丽的', '有趣的', '困难的',
      '环境', '技术', '经验', '政府', '信息', '机会', '发展', '教育'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ================================================================
  // 二、AI故事 - 用错词编故事
  // ================================================================

  // 用学生的错词生成一篇有趣的英语短故事
  // wrongWords: [{en, zh, count}, ...]
  // 返回 Promise<string> 故事文本
  window.generateAIStory = function(wrongWords) {
    if (!wrongWords || wrongWords.length === 0) {
      return Promise.resolve('暂无错词，无法生成故事。请先进行PK练习积累错词。');
    }

    var wordsList = wrongWords.map(function(w, i) {
      return (i + 1) + '. ' + w.en + ' (' + w.zh + ')';
    }).join('\n');

    var prompt = '请用以下英语单词编写一个有趣的短故事（150-300词），适合高中生阅读。\n' +
      '必须使用的单词：\n' + wordsList + '\n\n' +
      '要求：\n' +
      '1. 故事连贯有趣，有情节\n' +
      '2. 每个目标单词至少在故事中出现一次\n' +
      '3. 目标单词在文中用**加粗**标记\n' +
      '4. 故事后附上每个目标单词的中文释义';

    return window.aiOrFallback(
      prompt,
      function() {
        // 本地fallback：简单串联句子
        return _buildLocalStory(wrongWords);
      },
      { systemPrompt: '你是英语创意写作老师，擅长为高中生编写有趣的故事。' }
    );
  };

  // 本地生成故事（无AI时的fallback）
  function _buildLocalStory(wrongWords) {
    var story = 'Here is a short story using your vocabulary words:\n\n';
    var shuffled = wrongWords.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 5);

    story += 'Today, I learned some new English words. ';
    for (var i = 0; i < shuffled.length; i++) {
      var w = shuffled[i];
      story += 'The word **' + w.en + '** means "' + w.zh + '". ';
    }
    story += 'I will try to remember all of them for the next test.\n\n';

    story += '--- 词汇表 ---\n';
    wrongWords.forEach(function(w) {
      story += w.en + ' = ' + w.zh + '\n';
    });

    return story;
  }

  // ================================================================
  // 三、AI对战陪练 - 模拟AI对手答题
  // ================================================================

  // AI模拟对手答题行为
  // studentLevel: 1-5 难度级别
  // currentWord: {en, zh} 当前题目词汇
  // 返回 Promise<{answer, confidence, timeMs}> AI对手的答案和反应时间
  window.getAIOpponentAction = function(studentLevel, currentWord) {
    studentLevel = studentLevel || 3;

    var word = currentWord.en || currentWord.word || '';
    var meaning = currentWord.zh || currentWord.meaning || '';

    return window.aiOrFallback(
      '模拟一个英语水平为' + studentLevel + '级（1-5）的学生回答以下题目：\n' +
      '单词：' + word + '，中文意思：' + meaning + '\n' +
      '返回JSON：{"correct": true/false, "confidence": 0.0-1.0, "timeMs": 反应时间毫秒}',
      function() {
        // 本地fallback：基于概率模拟
        var correctProb;
        if (studentLevel <= 2) correctProb = 0.4;
        else if (studentLevel === 3) correctProb = 0.65;
        else if (studentLevel === 4) correctProb = 0.8;
        else correctProb = 0.9;

        var correct = Math.random() < correctProb;
        var confidence = correct ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.4;
        var timeMs = Math.floor(1500 + Math.random() * 3000);

        return { correct: correct, confidence: Math.round(confidence * 100) / 100, timeMs: timeMs };
      },
      {
        systemPrompt: '你是游戏AI对手模拟器。只返回JSON，不要解释。',
        parseJSON: true
      }
    );
  };

  // ================================================================
  // 四、智能练习AI出题 - 为错词出语境填空或辨析题
  // ================================================================

  // 为每个错词出语境填空或辨析题
  // wrongWords: [{en, zh, errorType, count}, ...]
  // 返回 Promise<[{type, stem, options, answer, word, explanation}]>
  window.aiBuildQuizQuestions = function(wrongWords) {
    if (!wrongWords || wrongWords.length === 0) {
      return Promise.resolve([]);
    }

    // 限制最多10个词
    var words = wrongWords.slice(0, 10);
    var wordsInfo = words.map(function(w, i) {
      return (i + 1) + '. ' + w.en + ' (' + w.zh + ') - 错误' + (w.count || 1) + '次';
    }).join('\n');

    var prompt = '为以下英语错词各出1道练习题：\n' + wordsInfo + '\n\n' +
      '要求：\n' +
      '1. 题型包括：语境填空（给出含空格的英语句子和4选项）和词义辨析（给出英语句子和4个中文选项）\n' +
      '2. 每道题4个选项，只有1个正确答案\n' +
      '3. 返回纯JSON数组：\n' +
      '[{"type":"fillblank|discriminate","stem":"题目文本","options":["A","B","C","D"],"answer":"正确答案","word":"目标单词","explanation":"简短解析"}]';

    return window.aiOrFallback(
      prompt,
      function() {
        // 本地fallback：生成简单题目
        return _buildLocalQuizQuestions(words);
      },
      {
        systemPrompt: '你是英语出题专家。只返回JSON数组格式的题目数据，不要有任何额外文本。',
        parseJSON: true
      }
    ).then(function(result) {
      // 确保返回数组
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.questions)) return result.questions;
      return _buildLocalQuizQuestions(words);
    });
  };

  // 本地生成练习题（无AI时的fallback）
  function _buildLocalQuizQuestions(words) {
    var questions = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var distractor1 = _randomWord(w.en);
      var distractor2 = _randomWord(w.en);
      var distractor3 = _randomWord(w.en);

      questions.push({
        type: 'fillblank',
        stem: 'The teacher explained the meaning of ______ in class.',
        options: [w.en, distractor1, distractor2, distractor3],
        answer: w.en,
        word: w.en,
        explanation: w.en + ' = ' + w.zh
      });
    }
    return questions;
  }

  // ================================================================
  // 五、复习间隔调整 - AI建议艾宾浩斯间隔
  // ================================================================

  // AI根据错误历史和错因类型建议复习间隔（天数）
  // word: 英文单词, errorCount: 错误次数, errorType: 错因类型
  // 返回 Promise<number> 建议间隔天数
  window.aiGetReviewInterval = function(word, errorCount, errorType) {
    var cacheKey = 'review_interval:' + word.toLowerCase();

    var prompt = '根据以下信息建议该单词的复习间隔（天数）：\n' +
      '单词：' + word + '\n' +
      '历史错误次数：' + (errorCount || 0) + '\n' +
      '错误类型：' + (errorType || 'UNKNOWN') + '\n\n' +
      '参考标准：首次错误→1天，2次→3天，3次→7天，4+次→1天(重新开始)\n' +
      '错因SPELLING_NEAR→间隔减半，WRONG_WORD→间隔缩短\n' +
      '只返回一个数字（天数）。';

    return window.aiOrFallback(
      prompt,
      function() {
        // 本地fallback：标准艾宾浩斯曲线
        var intervals = [1, 2, 4, 7, 15, 30, 60, 120];
        var idx = Math.min(errorCount || 0, intervals.length - 1);
        var baseInterval = intervals[idx];

        // 根据错误类型调整
        if (errorType === 'SPELLING_NEAR' || errorType === 'SPELLING_FAR') {
          baseInterval = Math.max(1, Math.floor(baseInterval / 2));
        } else if (errorType === 'WRONG_WORD' || errorType === 'UNKNOWN') {
          baseInterval = Math.max(1, Math.floor(baseInterval * 0.7));
        }

        return baseInterval;
      },
      { cacheKey: cacheKey, systemPrompt: '你是学习记忆专家。只返回一个数字（天数），不要解释。' }
    ).then(function(result) {
      var days = parseInt(String(result).trim(), 10);
      if (isNaN(days) || days < 1) days = 1;
      if (days > 180) days = 180;
      return days;
    });
  };

  // ================================================================
  // 六、语境猜词优化 - 提供增强的system prompt
  // ================================================================

  // 获取增强的语境猜词 system prompt
  window.getContextGuessSystemPrompt = function() {
    return '你是英语教学专家，擅长设计语境猜词题目。' +
      '题目要求：句子自然地道、上下文线索充分、' +
      '干扰项有迷惑性但与正确答案有明确区别、' +
      '难度适合高中生。返回JSON格式。';
  };

  // 获取增强的语境猜词 user prompt
  window.getContextGuessPrompt = function(words, difficulty) {
    var wordList = (words && words.length > 0) ? words.slice(0, 10).join(', ') : '常用高中英语词汇';
    return '请出1道英语语境猜词题。' +
      '给出一个包含空白的英文句子（用_____表示空白），让学生根据上下文猜词。\n' +
      '目标词汇范围：' + wordList + '\n' +
      '难度：' + (difficulty || '中等') + '\n' +
      '返回JSON：{"sentence":"含空白的句子","correct":"正确答案","hint":"推理提示(英文)","options":["干扰项1","干扰项2","干扰项3"]}\n' +
      '要求：干扰项必须与正确答案词性相同、长度相近，具有真实迷惑性。';
  };

  // 本地预设语境句（无AI时的fallback）
  window.getContextGuessFallback = function() {
    var presets = [
      { sentence: 'The doctor said I need to _____ more water every day.', correct: 'drink', hint: 'A common health advice', options: ['eat', 'make', 'take'] },
      { sentence: 'She always _____ her homework before watching TV.', correct: 'finishes', hint: 'Complete something first', options: ['starts', 'forgets', 'loses'] },
      { sentence: 'The _____ of the story is that honesty is the best policy.', correct: 'moral', hint: 'The lesson learned', options: ['beginning', 'ending', 'character'] },
      { sentence: 'We should _____ the environment by reducing waste.', correct: 'protect', hint: 'Keep safe from harm', options: ['destroy', 'ignore', 'pollute'] },
      { sentence: 'He _____ a lot of progress in his English study.', correct: 'made', hint: 'Achieved or accomplished', options: ['did', 'took', 'got'] },
      { sentence: 'The meeting was _____ until next Monday due to the weather.', correct: 'postponed', hint: 'Delayed to a later time', options: ['cancelled', 'started', 'continued'] },
      { sentence: 'It is _____ to wear a helmet when riding a bike.', correct: 'necessary', hint: 'Required or essential', options: ['optional', 'dangerous', 'difficult'] }
    ];
    return presets[Math.floor(Math.random() * presets.length)];
  };

  // ================================================================
  // 七、弱点诊断深化 - 增强诊断prompt
  // ================================================================

  // 获取增强的诊断 system prompt（包含错因分析）
  window.getDiagnosisSystemPrompt = function() {
    return '你是英语教学诊断专家，擅长分析学生的学习薄弱点。' +
      '你需要：1)识别常见错误模式 2)归类错因类型(拼写近似/词义混淆/词性误用/完全不会) ' +
      '3)给出针对性的学习建议 4)标注优先复习词汇。返回JSON格式。';
  };

  // 获取增强的诊断 user prompt
  window.getDiagnosisPrompt = function(targetDesc, errorWords) {
    var wordsList = errorWords.map(function(w) {
      return w.en + ' (' + w.zh + ') - 错误' + w.count + '次' +
        (w.errorType ? ' [' + w.errorType + ']' : '');
    }).join('\n');

    return '请分析以下学生（' + targetDesc + '）的英语单词错误模式，给出深度诊断：\n\n' +
      wordsList + '\n\n' +
      '请按以下JSON格式回复（只返回JSON，不要markdown代码块）：\n' +
      '{\n' +
      '  "weaknesses": ["薄弱点1", "薄弱点2"],\n' +
      '  "analysis": "总体分析(100-200字)",\n' +
      '  "suggestions": ["学习建议1", "学习建议2"],\n' +
      '  "priorityWords": ["词汇1", "词汇2"],\n' +
      '  "errorTypeBreakdown": {"SPELLING_NEAR": 5, "WRONG_WORD": 3, "UNKNOWN": 2},\n' +
      '  "commonPatterns": ["常见错误模式描述1", "常见错误模式描述2"]\n' +
      '}';
  };

  // ================================================================
  // 八、班级报告建议 - 增强报告prompt
  // ================================================================

  // 获取增强的班级报告 system prompt
  window.getClassReportSystemPrompt = function() {
    return '你是教育数据分析专家，擅长为教师生成班级学情报告。' +
      '报告应包括：总体概述、班级优势、薄弱环节、教学建议、重点关注学生、' +
      '热点词汇分析。返回JSON格式。';
  };

  // 获取增强的班级报告 user prompt
  window.getClassReportPrompt = function(targetDesc, summary) {
    return '请根据以下班级数据生成详细的学情报告（' + targetDesc + '）：\n' +
      summary + '\n\n' +
      '返回JSON（不要markdown代码块）：\n' +
      '{\n' +
      '  "overview": "总体概述(100-200字)",\n' +
      '  "strengths": ["优势1", "优势2"],\n' +
      '  "weaknesses": ["薄弱点1", "薄弱点2"],\n' +
      '  "tips": ["教学建议1", "教学建议2", "教学建议3"],\n' +
      '  "hotWords": ["热点词1", "热点词2", "热点词3"],\n' +
      '  "focusStudents": ["需要关注的学生名1", "需要关注的学生名2"],\n' +
      '  "trendAnalysis": "学习趋势分析(50-100字)"\n' +
      '}';
  };

  // ================================================================
  // 九、学情画像 - AI分析学习风格和能力画像
  // ================================================================

  // 为指定学生生成AI学习画像
  // studentName: 学生姓名
  // 返回 Promise<{style, strengths, weaknesses, recommendations}>
  window.generateAILearningPortrait = function(studentName) {
    // 收集该学生的答题数据
    var wb = {};
    try {
      if (typeof getWrongBook === 'function') {
        wb = getWrongBook();
      }
    } catch(e) {}

    var entries = (wb && wb.entries) ? wb.entries.filter(function(e) {
      return e.player === studentName;
    }) : [];

    if (entries.length === 0) {
      return Promise.resolve({
        studentName: studentName,
        message: '暂无足够的学习数据来生成画像，请先进行PK练习。',
        style: '未知',
        strengths: [],
        weaknesses: [],
        recommendations: ['多参加PK练习以积累数据']
      });
    }

    var totalQuestions = entries.length;
    var correctCount = entries.filter(function(e) { return e.isCorrect; }).length;
    var accuracy = Math.round(correctCount / Math.max(1, totalQuestions) * 100);

    // 收集错误类型分布
    var errorTypes = {};
    entries.forEach(function(e) {
      if (!e.isCorrect) {
        var t = e.errorType || 'UNKNOWN';
        errorTypes[t] = (errorTypes[t] || 0) + 1;
      }
    });

    // 收集错词
    var wrongWordsMap = {};
    entries.forEach(function(e) {
      if (!e.isCorrect && e.en) {
        if (!wrongWordsMap[e.en]) wrongWordsMap[e.en] = { en: e.en, zh: e.zh || '', count: 0 };
        wrongWordsMap[e.en].count++;
      }
    });
    var topWrong = Object.values(wrongWordsMap).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

    var summary = '学生：' + studentName + '\n' +
      '总答题：' + totalQuestions + '次，正确率：' + accuracy + '%\n' +
      '错误类型分布：' + JSON.stringify(errorTypes) + '\n' +
      '高频错词：' + topWrong.map(function(w) { return w.en + '(' + w.count + '次)'; }).join('、');

    return window.aiOrFallback(
      '请根据以下数据为' + studentName + '生成学情画像：\n' + summary + '\n\n' +
      '返回JSON：\n' +
      '{"style":"学习风格(视觉型/听觉型/动手型/综合型)","strengths":["强项1"],"weaknesses":["弱项1"],"level":"水平等级(初级/中级/高级)","focusAreas":["重点提升方向1"],"studyTips":["学习建议1"]}',
      function() {
        // 本地fallback：基于统计数据的画像
        var style = accuracy >= 70 ? '综合型' : accuracy >= 50 ? '动手型' : '视觉型';
        var level = accuracy >= 80 ? '高级' : accuracy >= 60 ? '中级' : '初级';
        var weaknesses = [];
        if (errorTypes['SPELLING_NEAR'] || errorTypes['SPELLING_FAR']) weaknesses.push('拼写能力需加强');
        if (errorTypes['WRONG_WORD']) weaknesses.push('词义理解需加深');
        if (errorTypes['UNKNOWN']) weaknesses.push('词汇记忆需巩固');
        if (weaknesses.length === 0) weaknesses.push('数据不足，无法准确判断');

        return {
          style: style,
          strengths: accuracy >= 70 ? ['答题准确率较高'] : ['积极参与练习'],
          weaknesses: weaknesses,
          level: level,
          focusAreas: topWrong.slice(0, 3).map(function(w) { return w.en + '相关词汇'; }),
          studyTips: ['建议每日复习' + Math.ceil(topWrong.length / 3) + '个错词', '多用英语写作巩固记忆'],
          studentName: studentName
        };
      },
      {
        systemPrompt: '你是学习分析专家，擅长为学生生成学情画像。只返回JSON。',
        parseJSON: true
      }
    ).then(function(result) {
      result.studentName = studentName;
      return result;
    });
  };

  // ================================================================
  // 十、AI对话深化 - 增强对话prompt
  // ================================================================

  // 获取增强的AI对话 system prompt
  window.getChatSystemPrompt = function() {
    return '你是英语单词学习助手，名叫WordPal。' +
      '你的特点是：1)用英语和学生对话，但必要时可用中文解释 ' +
      '2)根据学生水平调整对话难度 3)在对话中自然融入目标单词 ' +
      '4)鼓励学生用完整句子回答 5)纠正语法错误时语气友好。';
  };

  // 获取增强的AI对话 user prompt
  window.getChatGuessPrompt = function(optionIndex, word, options) {
    var optText = (options && options[optionIndex]) ? options[optionIndex] : '选项' + (optionIndex + 1);
    return '学生选择了"' + optText + '"，当前学习单词是"' + word.en + '"（意思是"' + word.zh + '"）。\n' +
      '请简短评价（1-2句话），并给出一个包含该单词的例句帮助学生理解。用鼓励的语气。';
  };

  // ================================================================
  // 内部工具函数
  // ================================================================

  // 收集指定班级的错词（按错误次数排序）
  function _collectWrongWords(className, limit) {
    limit = limit || 20;
    var wb = {};
    try {
      if (typeof getWrongBook === 'function') {
        wb = getWrongBook();
      } else {
        var raw = localStorage.getItem('vocabPKWrongBook');
        if (raw) wb = JSON.parse(raw);
      }
    } catch(e) {}

    var entries = (wb && wb.entries) ? wb.entries : [];
    var wordMap = {};

    entries.forEach(function(e) {
      if (className && e.className && e.className !== className) return;
      if (!e.isCorrect && e.en) {
        var key = e.en.toLowerCase();
        if (!wordMap[key]) {
          wordMap[key] = { en: e.en, zh: e.zh || '', count: 0, errorType: e.errorType || 'UNKNOWN' };
        }
        wordMap[key].count++;
        // 保留最新的错误类型
        if (e.errorType && e.errorType !== 'UNKNOWN') {
          wordMap[key].errorType = e.errorType;
        }
      }
    });

    var result = Object.values(wordMap);
    result.sort(function(a, b) { return b.count - a.count; });
    return result.slice(0, limit);
  }

  // 调试日志
  function _intelLog(msg) {
    try {
      if (localStorage.getItem('ai_debug_mode') === '1') {
        console.log('[AI-Intel] ' + msg);
      }
    } catch(e) {}
  }

  console.log('[AI-Enhance-Intelligence] 学习/分析/创意层AI增强就绪 ' +
    '(generateAITestPaper/generateAIStory/getAIOpponentAction/aiBuildQuizQuestions/' +
    'aiGetReviewInterval/getContextGuessPrompt/getDiagnosisPrompt/' +
    'getClassReportPrompt/generateAILearningPortrait/getChatPrompt)');
})();
