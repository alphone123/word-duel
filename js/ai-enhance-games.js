// ============================================================
// ai-enhance-games.js - 游戏层AI增强
// 消消乐自适应难度、抢答AI混淆选项、拼写AI变体、词块PK AI语境句
// 依赖：ai-core.js + ai-features.js
// ============================================================
(function() {
  'use strict';
  console.log('[AI-Enhance-Games] 模块已加载');

  // ================================================================
  // 一、消消乐自适应难度
  // ================================================================

  // AI评估词汇难度1-5级
  // 返回 Promise<number>
  window.aiGetDifficulty = function(vocabWord) {
    var word = vocabWord.en || vocabWord.word || '';
    var meaning = vocabWord.zh || vocabWord.meaning || '';
    var cacheKey = 'difficulty:' + word.toLowerCase();

    return window.aiOrFallback(
      '评估英语词汇"' + word + '"(意思:"' + meaning + '")的难度，只返回1-5的数字。' +
      '标准：1=小学词汇(3-4字母常见词)，2=初中基础词，3=高中常用词，4=较难词汇，5=高难度词汇。',
      function() {
        // 本地fallback：基于词汇长度和字母组成评估
        var len = word.length;
        var baseScore;
        if (len <= 3) baseScore = 1;
        else if (len <= 5) baseScore = 2;
        else if (len <= 7) baseScore = 3;
        else if (len <= 10) baseScore = 4;
        else baseScore = 5;
        // 包含罕见字母组合（x,q,z开头等）加1级
        var rareStart = 'xqz'.indexOf(word.charAt(0).toLowerCase());
        if (rareStart !== -1 && baseScore < 5) baseScore++;
        return baseScore;
      },
      { cacheKey: cacheKey, systemPrompt: '你是英语教学难度评估专家。只返回1-5的数字。' }
    ).then(function(result) {
      var level = parseInt(String(result).trim(), 10);
      if (isNaN(level) || level < 1) level = 1;
      if (level > 5) level = 5;
      return level;
    });
  };

  // 根据学生水平筛选合适难度的卡片
  // allVocab: [{en, zh}, ...] 或 [{word, meaning}, ...]
  // studentLevel: 1-5，默认3
  // 返回筛选后的词汇数组
  window.aiGetAdaptiveCards = function(allVocab, studentLevel) {
    studentLevel = studentLevel || 3;
    if (studentLevel < 1) studentLevel = 1;
    if (studentLevel > 5) studentLevel = 5;

    if (!allVocab || allVocab.length === 0) return allVocab;

    // 如果没有AI，全部卡片随机出
    if (!window.isAIEnabled()) {
      return allVocab;
    }

    // 从缓存获取难度映射
    var difficultyMap = {};
    try {
      var raw = localStorage.getItem('ai_difficulty_map');
      if (raw) difficultyMap = JSON.parse(raw);
    } catch(e) {}

    var mapKeys = Object.keys(difficultyMap);
    if (mapKeys.length === 0) {
      // 还没有预生成难度数据，全部卡片随机出
      return allVocab;
    }

    // 按难度筛选：允许±1的容忍范围
    var filtered = [];
    for (var i = 0; i < allVocab.length; i++) {
      var v = allVocab[i];
      var wordKey = (v.en || v.word || '').toLowerCase();
      var level = difficultyMap[wordKey];
      if (level === undefined) {
        // 无难度数据的词，估计难度后纳入
        var len = (v.en || v.word || '').length;
        level = len <= 4 ? 1 : len <= 6 ? 2 : len <= 8 ? 3 : len <= 10 ? 4 : 5;
      }
      if (Math.abs(level - studentLevel) <= 1) {
        filtered.push(v);
      }
    }

    // 如果筛选后词汇不够6个，回退到全部
    if (filtered.length < 6) {
      _gameLog('自适应筛选后词汇不足(' + filtered.length + ')，回退到全部词汇(' + allVocab.length + ')');
      return allVocab;
    }

    _gameLog('自适应难度筛选: 级别' + studentLevel + ', ' + allVocab.length + '→' + filtered.length + '个词汇');
    return filtered;
  };

  // 预生成难度分级（存入 ai_difficulty_map）
  window.pregenDifficultyMap = function(vocabList, onProgress) {
    if (!vocabList || vocabList.length === 0) {
      return Promise.resolve({ total: 0, message: '无词汇数据' });
    }

    var items = [];
    for (var i = 0; i < vocabList.length; i++) {
      var v = vocabList[i];
      var word = (v.en || v.word || '').toLowerCase();
      items.push({
        cacheSuffix: word,
        word: v.en || v.word || '',
        meaning: v.zh || v.meaning || ''
      });
    }

    return window.pregenBatch(
      items,
      function(item) {
        return '评估英语词汇"' + item.word + '"(意思:"' + item.meaning + '")的难度，只返回1-5的数字。' +
          '标准：1=小学基础词，2=初中词汇，3=高中常用词，4=较难词汇，5=高难度词汇。';
      },
      'difficulty',
      { systemPrompt: '你是英语教学难度评估专家，只返回1-5的数字。', concurrency: 3, onProgress: onProgress }
    ).then(function(result) {
      // 从缓存重建 difficulty_map
      if (result.generated > 0) {
        var map = {};
        try {
          var raw = localStorage.getItem('ai_difficulty_map');
          if (raw) map = JSON.parse(raw);
        } catch(e) {}

        for (var i = 0; i < items.length; i++) {
          var word = items[i].cacheSuffix;
          var cached = window.aiCacheGet('difficulty:' + word);
          if (cached !== null) {
            var level = parseInt(String(cached).trim(), 10);
            if (!isNaN(level) && level >= 1 && level <= 5) {
              map[word] = level;
            }
          }
        }

        try {
          localStorage.setItem('ai_difficulty_map', JSON.stringify(map));
          _gameLog('难度映射已更新: ' + Object.keys(map).length + '个词汇');
        } catch(e) {}
      }
      return result;
    });
  };

  // ================================================================
  // 二、抢答AI混淆选项
  // ================================================================

  // AI生成3个易混淆的英语干扰选项
  // correctWord: 正确单词(英文)，correctMeaning: 正确词义(中文)
  // 返回 Promise<string[]> 3个混淆单词
  window.aiGetRaceOptions = function(correctWord, correctMeaning) {
    var cacheKey = 'confusables:' + correctWord.toLowerCase().replace(/\s+/g, '_');

    return window.aiOrFallback(
      '为英语单词"' + correctWord + '"(意思是"' + correctMeaning + '")生成3个易混淆的英语干扰选项。\n' +
      '混淆项应与正确词形近(如affect/effect)、或同根词(如adapt/adopt)、或常见认知混淆词。\n' +
      '只返回3个英语单词，用逗号分隔，不要任何解释。\n' +
      '格式示例：effect,infect,defect',
      function() {
        // 本地fallback：从VOCAB_DATA随机取3个不同的英语单词
        return _pickRandomWords(correctWord, 3);
      },
      { cacheKey: cacheKey, systemPrompt: '你是英语词汇专家。只返回3个逗号分隔的英语单词/短语，不要解释。' }
    ).then(function(result) {
      return _parseConfusablesResult(result, correctWord);
    });
  };

  // 解析AI返回的混淆选项结果
  function _parseConfusablesResult(result, correctWord) {
    var text = String(result).trim();
    // 移除常见的格式标记
    text = text.replace(/^[\d.]+\s*/gm, '').replace(/^[-*•]\s*/gm, '');
    // 分割
    var parts = text.split(/[,，、\n]+/);
    var cleaned = [];
    var correctLower = correctWord.toLowerCase();

    for (var i = 0; i < parts.length; i++) {
      var word = parts[i].replace(/[^a-zA-Z\s'-]/g, '').trim();
      if (word && word.toLowerCase() !== correctLower && cleaned.indexOf(word) === -1) {
        cleaned.push(word);
      }
    }

    // 不足3个时用算法补充
    while (cleaned.length < 3) {
      var suffix = cleaned.length + 1;
      var synthetic = _generateSyntheticVariant(correctWord, suffix);
      if (cleaned.indexOf(synthetic) === -1) {
        cleaned.push(synthetic);
      } else {
        cleaned.push('word' + suffix + '_' + correctWord.charAt(0));
      }
    }

    return cleaned.slice(0, 3);
  }

  // 生成合成混淆词
  function _generateSyntheticVariant(word, seed) {
    var lower = word.toLowerCase();
    // 同根词变体
    var suffixes = ['tion', 'ment', 'ness', 'able', 'ible', 'al', 'ive', 'ous', 'ful', 'less'];
    var prefix = lower.length > 3 ? lower.substring(0, lower.length - 2) : lower;
    return prefix + suffixes[(seed * 7) % suffixes.length];
  }

  // 从VOCAB_DATA中随机选取单词（排除正确词）
  function _pickRandomWords(excludeWord, count) {
    var candidates = [];
    try {
      if (typeof VOCAB_DATA !== 'undefined' && VOCAB_DATA) {
        Object.keys(VOCAB_DATA).forEach(function(book) {
          var bookData = VOCAB_DATA[book];
          if (!bookData) return;
          Object.keys(bookData).forEach(function(unit) {
            var unitData = bookData[unit];
            if (!unitData) return;
            Object.keys(unitData).forEach(function(part) {
              var partData = unitData[part];
              if (!Array.isArray(partData)) return;
              partData.forEach(function(item) {
                if (item.word && item.word.toLowerCase() !== excludeWord.toLowerCase()) {
                  candidates.push(item.word);
                }
              });
            });
          });
        });
      }
    } catch(e) {}

    // 去重并打乱
    var unique = [];
    var seen = {};
    for (var i = 0; i < candidates.length; i++) {
      var w = candidates[i].toLowerCase();
      if (!seen[w]) {
        seen[w] = true;
        unique.push(candidates[i]);
      }
    }
    unique.sort(function() { return Math.random() - 0.5; });

    var result = [];
    for (var j = 0; j < Math.min(count, unique.length); j++) {
      result.push(unique[j]);
    }

    // 不足时用预设假词
    var fakePool = ['information', 'education', 'development', 'government', 'experience',
      'opportunity', 'environment', 'technology', 'communication', 'organization'];
    while (result.length < count) {
      var f = fakePool[result.length % fakePool.length];
      if (result.indexOf(f) === -1 && f.toLowerCase() !== excludeWord.toLowerCase()) {
        result.push(f);
      } else {
        result.push('option' + result.length);
      }
    }

    return result.join(',');
  }

  // 预生成抢答混淆选项
  window.pregenConfusables = function(vocabList, onProgress) {
    if (!vocabList || vocabList.length === 0) {
      return Promise.resolve({ total: 0, message: '无词汇数据' });
    }

    var items = [];
    for (var i = 0; i < vocabList.length; i++) {
      var v = vocabList[i];
      var word = (v.en || v.word || '').toLowerCase().replace(/\s+/g, '_');
      items.push({
        cacheSuffix: word,
        en: v.en || v.word || '',
        zh: v.zh || v.meaning || ''
      });
    }

    return window.pregenBatch(
      items,
      function(item) {
        return '为英语单词"' + item.en + '"(意思是"' + item.zh + '")生成3个易混淆选项。' +
          '混淆项应与正确词形近、同根词、或常见认知混淆词。只返回3个英语单词，逗号分隔，不要解释。';
      },
      'confusables',
      { systemPrompt: '你是英语词汇专家。只返回3个逗号分隔的英语单词。', concurrency: 3, onProgress: onProgress }
    );
  };

  // ================================================================
  // 三、拼写AI变体
  // ================================================================

  // AI生成3个拼写错误变体（少字母/多字母/元音替换）
  // 返回 Promise<string[]> 3个错误拼写
  window.aiGetSpellVariants = function(word) {
    var cacheKey = 'spellvars:' + word.toLowerCase();

    return window.aiOrFallback(
      '为英语单词"' + word + '"生成3个常见的拼写错误变体。\n' +
      '每个变体应比原词少1个字母、多1个字母、或替换1个元音/辅音。\n' +
      '只返回3个错误的拼写，用逗号分隔，不要解释。\n' +
      '格式示例：beautifull,beutiful,beatiful',
      function() {
        // 本地fallback：用简单算法生成变体
        return _generateAlgorithmicVariants(word).join(',');
      },
      { cacheKey: cacheKey, systemPrompt: '你是英语拼写专家。只返回3个逗号分隔的错误拼写变体，不要解释。' }
    ).then(function(result) {
      return _parseVariantResult(result, word);
    });
  };

  // 解析AI返回的拼写变体
  function _parseVariantResult(result, correctWord) {
    var text = String(result).trim();
    text = text.replace(/^[\d.]+\s*/gm, '').replace(/^[-*•]\s*/gm, '');
    var parts = text.split(/[,，、\n]+/);
    var cleaned = [];
    var correctLower = correctWord.toLowerCase();

    for (var i = 0; i < parts.length; i++) {
      var v = parts[i].replace(/[^a-zA-Z]/g, '').trim().toLowerCase();
      if (v && v !== correctLower && cleaned.indexOf(v) === -1) {
        cleaned.push(v);
      }
    }

    // 不足3个时算法补充
    var algoVariants = _generateAlgorithmicVariants(correctWord);
    for (var j = 0; j < algoVariants.length && cleaned.length < 3; j++) {
      if (cleaned.indexOf(algoVariants[j]) === -1 && algoVariants[j] !== correctLower) {
        cleaned.push(algoVariants[j]);
      }
    }

    while (cleaned.length < 3) {
      cleaned.push(correctLower + 'x' + cleaned.length);
    }

    return cleaned.slice(0, 3);
  }

  // 算法生成拼写变体（本地fallback）
  function _generateAlgorithmicVariants(word) {
    var variants = [];
    var lower = word.toLowerCase();

    // 变体1：随机删除一个字母
    if (lower.length > 3) {
      var delIdx = Math.floor(Math.random() * lower.length);
      variants.push(lower.substring(0, delIdx) + lower.substring(delIdx + 1));
    } else {
      variants.push(lower + 's');
    }

    // 变体2：随机插入一个字母
    var vowels = 'aeiou';
    var insIdx = Math.floor(Math.random() * (lower.length + 1));
    var insChar = vowels.charAt(Math.floor(Math.random() * 5));
    if (insIdx <= lower.length) {
      variants.push(lower.substring(0, insIdx) + insChar + lower.substring(insIdx));
    }

    // 变体3：替换一个元音
    var vowelPositions = [];
    for (var i = 0; i < lower.length; i++) {
      if ('aeiou'.indexOf(lower.charAt(i)) !== -1) {
        vowelPositions.push(i);
      }
    }
    if (vowelPositions.length > 0) {
      var changePos = vowelPositions[Math.floor(Math.random() * vowelPositions.length)];
      var currentVowel = lower.charAt(changePos);
      var newVowel;
      do {
        newVowel = vowels.charAt(Math.floor(Math.random() * 5));
      } while (newVowel === currentVowel);
      variants.push(lower.substring(0, changePos) + newVowel + lower.substring(changePos + 1));
    } else {
      // 没有元音就替换最后一个字母
      var lastChar = lower.charAt(lower.length - 1);
      var replacement = lastChar === 's' ? 'z' : 's';
      variants.push(lower.substring(0, lower.length - 1) + replacement);
    }

    return variants;
  }

  // 预生成拼写变体
  window.pregenSpellVariants = function(vocabList, onProgress) {
    if (!vocabList || vocabList.length === 0) {
      return Promise.resolve({ total: 0, message: '无词汇数据' });
    }

    var items = [];
    for (var i = 0; i < vocabList.length; i++) {
      var v = vocabList[i];
      var word = (v.en || v.word || '').toLowerCase();
      items.push({
        cacheSuffix: word,
        en: v.en || v.word || ''
      });
    }

    return window.pregenBatch(
      items,
      function(item) {
        return '为英语单词"' + item.en + '"生成3个常见的拼写错误变体。' +
          '每个变体应比原词少1字母/多1字母/替换1字母。只返回3个错误拼写，逗号分隔。';
      },
      'spellvars',
      { systemPrompt: '你是英语拼写专家。只返回3个逗号分隔的错误拼写变体。', concurrency: 3, onProgress: onProgress }
    );
  };

  // ================================================================
  // 四、词块PK AI语境句
  // ================================================================

  // AI生成包含该词块的自然英语句子
  // chunkEn: 英语词块，chunkZh: 中文释义
  // 返回 Promise<string> 包含词块的英语句子
  window.aiGetChunkContext = function(chunkEn, chunkZh) {
    var cacheKey = 'context:' + chunkEn.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    return window.aiOrFallback(
      '为英语词块"' + chunkEn + '"(意思是"' + chunkZh + '")生成一个自然、地道的英语句子。\n' +
      '要求：句子必须包含该词块，长度10-25个单词，适合高中生理解。\n' +
      '句子中的目标词块请用**包围（如**book a ticket**）。\n' +
      '只返回句子本身，不要额外解释。',
      function() {
        // 本地fallback：模板造句
        var templates = [
          'I think it is important to ' + chunkEn + ' in our daily life.',
          'She decided to ' + chunkEn + ' yesterday afternoon.',
          'Can you help me ' + chunkEn + '?',
          'We need to ' + chunkEn + ' before the deadline.',
          'He always tries to ' + chunkEn + ' when facing difficulties.',
          'The teacher asked us to ' + chunkEn + ' as homework.',
          'It is not easy to ' + chunkEn + ' without enough practice.',
          'They have been working hard to ' + chunkEn + ' for the project.'
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      },
      { cacheKey: cacheKey, systemPrompt: '你是英语教学专家，为英语词块提供地道的语境例句。只返回句子本身。' }
    ).then(function(result) {
      // 清理结果
      return String(result).replace(/^["''"]|["''"]$/g, '').trim();
    });
  };

  // 预生成词块语境句
  window.pregenChunkContexts = function(chunkList, onProgress) {
    if (!chunkList || chunkList.length === 0) {
      return Promise.resolve({ total: 0, message: '无词块数据' });
    }

    var items = [];
    for (var i = 0; i < chunkList.length; i++) {
      var c = chunkList[i];
      var chunkEn = c.chunk || c.en || c.word || '';
      var cleanKey = chunkEn.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      items.push({
        cacheSuffix: cleanKey,
        chunkEn: chunkEn,
        chunkZh: c.meaning || c.zh || ''
      });
    }

    return window.pregenBatch(
      items,
      function(item) {
        return '为英语词块"' + item.chunkEn + '"(意思是"' + item.chunkZh + '")生成一个自然、地道的英语句子。' +
          '句子必须包含该词块，长度10-25个单词。只返回句子本身。';
      },
      'context',
      { systemPrompt: '你是英语教学专家，提供地道的语境例句。只返回句子本身。', concurrency: 3, onProgress: onProgress }
    );
  };

  // ================================================================
  // 五、函数替换钩子（在HTML中的游戏逻辑加载后生效）
  // ================================================================

  // 增强版抢答选项生成（替换 generateRaceOptions）
  // correctWord: {en, zh} 词汇对象
  // isEnglish: 题目是否为英文
  // vocab: 词汇数组
  // 返回与原函数兼容的 {options0, options1} 结构（Promise）
  window.enhanceRaceOptions = function(correctWord, isEnglish, vocab) {
    var wordText = isEnglish ? (correctWord.en || correctWord.word || '') : (correctWord.zh || correctWord.meaning || '');
    var meaningText = isEnglish ? (correctWord.zh || correctWord.meaning || '') : (correctWord.en || correctWord.word || '');

    return window.aiGetRaceOptions(wordText, meaningText).then(function(aiConfusables) {
      // 构建与原generateRaceOptions兼容的选项结构
      var options = [];
      var optionLang = isEnglish ? 'zh' : 'en';
      var correctText = correctWord[optionLang];

      // 正确答案
      options.push({ text: correctText, correct: true });

      // AI生成的混淆选项
      for (var i = 0; i < aiConfusables.length && options.length < 4; i++) {
        var confusable = aiConfusables[i];
        // 如果是英文题目(isEnglish=true)，选项是中文→AI返回的是英文混淆词，需转换为中文
        // 如果是中文题目(isEnglish=false)，选项是英文→AI返回的就是英文混淆词
        if (isEnglish) {
          // 英文题→中文选项，需要从vocab中找对应中文
          var foundZh = '';
          for (var j = 0; j < vocab.length; j++) {
            if ((vocab[j].en || '').toLowerCase() === confusable.toLowerCase()) {
              foundZh = vocab[j].zh || vocab[j].meaning || '';
              break;
            }
          }
          if (foundZh && foundZh !== correctText) {
            options.push({ text: foundZh, correct: false });
          }
        } else {
          // 中文题→英文选项，直接使用
          if (confusable !== correctText) {
            options.push({ text: confusable, correct: false });
          }
        }
      }

      // 如果选项不足4个，从词汇库补充
      if (options.length < 4) {
        for (var k = 0; k < vocab.length && options.length < 4; k++) {
          var v = vocab[k];
          var vText = v[optionLang];
          if (!vText) continue;
          if (options.filter(function(o) { return o.text === vText; }).length > 0) continue;
          if (vText === correctText) continue;
          options.push({ text: vText, correct: false });
        }
      }

      // 如果还不够，补充预设假选项
      var fakePool = isEnglish
        ? ['学生', '老师', '学习', '学校', '工作', '生活', '朋友', '家庭', '时间', '地方', '世界', '问题', '方法', '结果']
        : ['student', 'teacher', 'school', 'study', 'work', 'life', 'friend', 'family', 'time', 'place', 'world', 'problem'];

      for (var f = 0; f < fakePool.length && options.length < 4; f++) {
        if (options.filter(function(o) { return o.text === fakePool[f]; }).length > 0) continue;
        if (fakePool[f] === correctText) continue;
        options.push({ text: fakePool[f], correct: false });
      }

      // 只保留4个选项
      options = options.slice(0, 4);

      // 生成两组独立打乱的选项
      var shuffled0 = options.slice().sort(function() { return Math.random() - 0.5; });
      var shuffled1 = options.slice().sort(function() { return Math.random() - 0.5; });

      return { options0: shuffled0, options1: shuffled1, aiEnhanced: true };
    }).catch(function() {
      // 出错时回退到原函数
      if (typeof generateRaceOptions === 'function') {
        return generateRaceOptions(correctWord, isEnglish, vocab);
      }
      return { options0: [], options1: [] };
    });
  };

  // 调试日志
  function _gameLog(msg) {
    try {
      if (localStorage.getItem('ai_debug_mode') === '1') {
        console.log('[AI-Games] ' + msg);
      }
    } catch(e) {}
  }

  console.log('[AI-Enhance-Games] 游戏层AI增强就绪 ' +
    '(aiGetDifficulty/aiGetAdaptiveCards/aiGetRaceOptions/aiGetSpellVariants/aiGetChunkContext)');
})();
