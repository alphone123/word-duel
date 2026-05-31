// ============================================================
// AI 功能模块 - 重构版本
// 依赖：ai-core.js / ai-enhance-games.js / ai-enhance-intelligence.js
// 增强模块在HTML中先于本文件加载，本文件使用 aiOrFallback()
// 实现AI/本地双路径，确保无AI时功能完整
// ============================================================
console.log('[AI Features] 模块已加载');

// 检测增强模块是否已加载
var _hasAICore = typeof isAIEnabled === 'function';
var _hasAIEnhanceGames = typeof aiGetRaceOptions === 'function';
var _hasAIEnhanceIntel = typeof generateAITestPaper === 'function';
if (_hasAICore) console.log('[AI Features] AI-Core 已就绪');
if (_hasAIEnhanceGames) console.log('[AI Features] AI-Games 已就绪');
if (_hasAIEnhanceIntel) console.log('[AI Features] AI-Intel 已就绪');

// ===== 通用工具 =====
function showModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}
function hideModal(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function getAIConfig() {
  try {
    var raw = localStorage.getItem('ai_config');
    return raw ? JSON.parse(raw) : { provider: '', apiKey: '', apiUrl: '', model: '', enabled: false };
  } catch (e) { return { provider: '', apiKey: '', apiUrl: '', model: '', enabled: false }; }
}

function setAIConfig(config) {
  localStorage.setItem('ai_config', JSON.stringify(config));
  updateAIStatus();
}

function updateAIStatus() {
  var config = getAIConfig();
  var badge = document.getElementById('aiStatusBadge');
  var icon = document.getElementById('aiStatusIcon');
  var text = document.getElementById('aiStatusText');
  var quickStatus = document.getElementById('aiQuickStatus');
  if (config.enabled && config.apiKey) {
    if (badge) badge.className = 'ai-settings-status ai-status-connected';
    if (icon) icon.textContent = '🟢';
    if (text) text.textContent = config.provider.toUpperCase() + ' 已连接';
    if (quickStatus) quickStatus.innerHTML = '✅ AI已就绪 - 点击上方功能体验';
  } else {
    if (badge) badge.className = 'ai-settings-status ai-status-disconnected';
    if (icon) icon.textContent = '⚫';
    if (text) text.textContent = '未配置';
    if (quickStatus) quickStatus.innerHTML = '💡 点击上方功能体验AI智能教学（需先配置AI）';
  }
  // 更新预设按钮状态
  var presets = ['deepseek', 'zhipu', 'qwen', 'ernie', 'kimi', 'custom'];
  presets.forEach(function(p) {
    var btn = document.getElementById('preset-' + p);
    if (btn) {
      btn.classList.toggle('active', config.provider === p);
    }
  });
}

async function callAI(prompt, systemPrompt) {
  var config = getAIConfig();
  if (!config.enabled || !config.apiKey) {
    throw new Error('AI未配置，请先在AI设置中配置API');
  }
  var modelName = config.model || 'deepseek-chat';
  var messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  var controller = new AbortController();
  var timeoutId = setTimeout(function() { controller.abort(); }, 30000);

  try {
    var response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('API请求失败 (' + response.status + '): ' + errText.substring(0, 200));
    }
    var data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('API请求超时（30秒）');
    }
    throw e;
  }
}

// ===== AI 设置 =====
function showAISettings() { showModal('aiSettingsModal'); updateAIStatus(); }
function closeAISettings() { hideModal('aiSettingsModal'); }

function selectAIPreset(preset) {
  var presets = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
    zhipu: { name: '智谱GLM', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4' },
    qwen: { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-turbo' },
    ernie: { name: '文心一言', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro', model: 'ernie-4.0-8k' },
    kimi: { name: 'Kimi', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
    custom: { name: '自定义', url: '', model: '' }
  };
  var p = presets[preset];
  if (!p) return;
  document.getElementById('aiApiUrl').value = p.url;
  document.getElementById('aiModel').value = p.model;
  if (preset !== 'custom') {
    document.getElementById('aiApiKey').value = '';
  }
  // 高亮按钮
  document.querySelectorAll('.ai-preset-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('preset-' + preset);
  if (btn) btn.classList.add('active');
}

async function testAIConnection() {
  var config = {
    provider: document.getElementById('aiApiUrl').dataset.provider || '',
    apiUrl: document.getElementById('aiApiUrl').value,
    apiKey: document.getElementById('aiApiKey').value,
    model: document.getElementById('aiModel').value,
    enabled: true
  };
  // 检测provider
  if (config.apiUrl.includes('deepseek')) config.provider = 'deepseek';
  else if (config.apiUrl.includes('bigmodel')) config.provider = 'zhipu';
  else if (config.apiUrl.includes('dashscope')) config.provider = 'qwen';
  else if (config.apiUrl.includes('baidu')) config.provider = 'ernie';
  else if (config.apiUrl.includes('moonshot')) config.provider = 'kimi';
  
  setAIConfig(config);
  
  var statusEl = document.getElementById('aiStatusBadge');
  if (statusEl) statusEl.className = 'ai-settings-status ai-status-testing';
  var iconEl = document.getElementById('aiStatusIcon');
  if (iconEl) iconEl.textContent = '🟡';
  var textEl = document.getElementById('aiStatusText');
  if (textEl) textEl.textContent = '测试中...';

  try {
    var result = await callAI('你好，请用一句话介绍自己。');
    if (statusEl) statusEl.className = 'ai-settings-status ai-status-connected';
    if (iconEl) iconEl.textContent = '🟢';
    if (textEl) textEl.textContent = config.provider.toUpperCase() + ' 连接成功';
    showToast('✅ AI连接成功！', 'success');
  } catch (e) {
    if (statusEl) statusEl.className = 'ai-settings-status ai-status-disconnected';
    if (iconEl) iconEl.textContent = '🔴';
    if (textEl) textEl.textContent = '连接失败';
    showToast('❌ ' + e.message, 'wrong');
  }
}

function saveAISettings() {
  var config = {
    provider: '',
    apiUrl: document.getElementById('aiApiUrl').value,
    apiKey: document.getElementById('aiApiKey').value,
    model: document.getElementById('aiModel').value,
    enabled: true
  };
  // 检测provider
  if (config.apiUrl.includes('deepseek')) config.provider = 'deepseek';
  else if (config.apiUrl.includes('bigmodel')) config.provider = 'zhipu';
  else if (config.apiUrl.includes('dashscope')) config.provider = 'qwen';
  else if (config.apiUrl.includes('baidu')) config.provider = 'ernie';
  else if (config.apiUrl.includes('moonshot')) config.provider = 'kimi';
  
  setAIConfig(config);
  closeAISettings();
  showToast('AI配置已保存', 'success');
}

// ===== AI 薄弱点诊断 =====
function showAIDiagnosis() {
  showModal('aiDiagnosisModal');
  populateDiagFilters();
  // 不自动运行，等用户选好对象后点击"开始诊断"
}
function closeAIDiagnosis() { hideModal('aiDiagnosisModal'); }

// 填充诊断弹窗的班级/学生选择器
function populateDiagFilters() {
  var classSelect = document.getElementById('aiDiagClassFilter');
  var studentSelect = document.getElementById('aiDiagStudentFilter');
  if (!classSelect || !studentSelect) return;

  // 读取班级列表（rollcall_classes_v2 格式: { 班级名: {names:[...], ...} }）
  var classes = {};
  try {
    var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
    var data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // 兼容：检测是否有 classes 包装层
      var src = data;
      if (data.classes && typeof data.classes === 'object') {
        // 旧格式: { classes: [{name, students}] }
        if (Array.isArray(data.classes)) {
          data.classes.forEach(function(c) {
            if (c.name) classes[c.name] = c.students || c.names || [];
          });
        } else {
          src = data.classes;
        }
      }
      // 标准格式: { 班级名: {names:[...]} } 或 { 班级名: ["张三",...] }
      if (src === data || !Array.isArray(data.classes)) {
        Object.keys(src).forEach(function(cls) {
          var val = src[cls];
          if (typeof val === 'object' && val !== null) {
            classes[cls] = val.names || val.students || [];
          } else if (Array.isArray(val)) {
            classes[cls] = val;
          }
        });
      }
    }
  } catch(e) {}

  // 填充班级下拉框
  classSelect.innerHTML = '<option value="">全部班级</option>';
  Object.keys(classes).sort().forEach(function(name) {
    classSelect.innerHTML += '<option value="' + name + '">' + name + '</option>';
  });

  // 班级变化时更新学生列表
  classSelect.onchange = function() {
    var cls = classSelect.value;
    studentSelect.innerHTML = '<option value="">全部学生</option>';
    if (cls && classes[cls]) {
      classes[cls].forEach(function(s) {
        studentSelect.innerHTML += '<option value="' + s + '">' + s + '</option>';
      });
    } else {
      // 全部班级：汇总所有学生
      var allStudents = {};
      Object.keys(classes).forEach(function(c) {
        if (Array.isArray(classes[c])) {
          classes[c].forEach(function(s) { allStudents[s] = true; });
        }
      });
      Object.keys(allStudents).sort().forEach(function(s) {
        studentSelect.innerHTML += '<option value="' + s + '">' + s + '</option>';
      });
    }
  };
  // 初始化学生列表
  classSelect.onchange();
}

async function runDiagnosis() {
  var body = document.getElementById('aiDiagnosisBody');
  if (!body) return;
  body.innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">正在诊断学习薄弱点...</div></div>';

  var config = getAIConfig();
  if (!config.enabled) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.7)">⚠️ 请先在AI设置中配置API密钥</div>';
    return;
  }

  // 读取筛选条件
  var diagClass = '';
  var diagStudent = '';
  var classSelect = document.getElementById('aiDiagClassFilter');
  var studentSelect = document.getElementById('aiDiagStudentFilter');
  if (classSelect) diagClass = classSelect.value || '';
  if (studentSelect) diagStudent = studentSelect.value || '';

  // 构建诊断对象描述
  var targetDesc = '全部学生';
  if (diagStudent) {
    targetDesc = diagStudent + (diagClass ? '（' + diagClass + '）' : '');
  } else if (diagClass) {
    targetDesc = diagClass;
  }

  // 收集错题数据（按筛选条件过滤）
  var wb = getWrongBook ? getWrongBook() : {};
  var errorWords = [];
  if (wb && wb.entries) {
    var wordMap = {};
    wb.entries.forEach(function(e) {
      // 按班级和学生筛选
      if (diagClass && e.className && e.className !== diagClass) return;
      if (diagStudent && e.player && e.player !== diagStudent) return;
      if (e.en) {
        if (!wordMap[e.en]) wordMap[e.en] = { en: e.en, zh: e.zh || '', count: 0, chapters: [] };
        wordMap[e.en].count++;
        if (e.chapter && wordMap[e.en].chapters.indexOf(e.chapter) === -1) wordMap[e.en].chapters.push(e.chapter);
      }
    });
    errorWords = Object.values(wordMap).sort(function(a, b) { return b.count - a.count; }).slice(0, 20);
  }

  if (errorWords.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.7)">📝 ' + targetDesc + '暂无错题数据，请先进行PK练习积累错题</div>';
    return;
  }

  var wordsList = errorWords.map(function(w) { return w.en + ' (' + w.zh + ') - 错误' + w.count + '次'; }).join('\n');

  try {
    // 使用增强模块的prompt（如果可用）
    var systemPrompt = (typeof getDiagnosisSystemPrompt === 'function')
      ? getDiagnosisSystemPrompt()
      : '你是英语教学诊断专家，擅长分析学生的学习薄弱点。';
    var prompt = (typeof getDiagnosisPrompt === 'function')
      ? getDiagnosisPrompt(targetDesc, errorWords)
      : '请分析以下学生（' + targetDesc + '）的英语单词错误模式，给出薄弱点诊断：\n\n' + wordsList + '\n\n请按以下JSON格式回复（只返回JSON）：\n{"weaknesses": ["薄弱点1", "薄弱点2"], "analysis": "总体分析", "suggestions": ["建议1", "建议2"], "priorityWords": ["词汇1", "词汇2"]}';
    var result = await callAI(prompt, systemPrompt);
    var jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var data = JSON.parse(jsonMatch[0]);
      // 保存诊断出的薄弱词汇，供针对性练习使用
      gAdaptiveState.weakWords = data.priorityWords || [];
      gAdaptiveState.diagnosisData = data;
      var html = '<div style="padding:16px;">';
      html += '<h3 style="color:#00e5ff;">📊 诊断分析</h3>';
      html += '<p style="color:rgba(255,255,255,0.8);line-height:1.6;">' + (data.analysis || '暂无分析') + '</p>';
      // 错因类型分布（增强字段）
      if (data.errorTypeBreakdown) {
        html += '<h3 style="color:#ffd700;margin-top:16px;">🔍 错因类型分布</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        var typeNames = { SPELLING_NEAR: '拼写近似', SPELLING_FAR: '拼写错误', WRONG_WORD: '词义混淆', PREFIX_MATCH: '前缀匹配', PARTIAL_MATCH: '部分匹配', UNKNOWN: '其他' };
        Object.keys(data.errorTypeBreakdown).forEach(function(t) {
          html += '<span style="background:rgba(255,215,0,0.15);padding:4px 10px;border-radius:4px;font-size:0.85rem;color:#ffd700;">' + (typeNames[t] || t) + ': ' + data.errorTypeBreakdown[t] + '次</span>';
        });
        html += '</div>';
      }
      // 常见错误模式（增强字段）
      if (data.commonPatterns && data.commonPatterns.length > 0) {
        html += '<h3 style="color:#ff9f43;margin-top:16px;">📋 常见错误模式</h3><ul>';
        data.commonPatterns.forEach(function(p) { html += '<li style="color:rgba(255,255,255,0.7);">' + p + '</li>'; });
        html += '</ul>';
      }
      html += '<h3 style="color:#ff8888;margin-top:16px;">⚠️ 薄弱点</h3><ul>';
      (data.weaknesses || []).forEach(function(w) { html += '<li style="color:rgba(255,255,255,0.7);">' + w + '</li>'; });
      html += '</ul>';
      html += '<h3 style="color:#00ff88;margin-top:16px;">💡 学习建议</h3><ul>';
      (data.suggestions || []).forEach(function(s) { html += '<li style="color:rgba(255,255,255,0.7);">' + s + '</li>'; });
      html += '</ul>';
      html += '<h3 style="color:#c86bff;margin-top:16px;">🎯 优先复习词汇</h3>';
      html += '<p style="color:rgba(255,255,255,0.7);">' + (data.priorityWords || []).join('、') + '</p>';
      html += '<p style="margin-top:12px;color:rgba(255,255,255,0.4);font-size:0.8rem;">点击下方「针对性练习」将针对以上薄弱词汇出题</p>';
      html += '</div>';
      body.innerHTML = html;
    } else {
      body.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,0.8);white-space:pre-wrap;">' + result + '</div>';
    }
  } catch (e) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff8888;">❌ ' + e.message + '</div>';
  }
}

// ===== AI 智能练习（基于错题本的精准练习） =====
var gAdaptiveState = { questions: [], currentIdx: 0, score: 0, results: [], weakWords: null, fromDiagnosis: false };

function showAIAdaptiveQuiz() { 
  gAdaptiveState.fromDiagnosis = false;
  gAdaptiveState.weakWords = null;
  showModal('aiAdaptiveModal'); 
  buildAdaptiveQuiz(); 
}
function startAIAdaptiveQuiz() { 
  if (!gAdaptiveState.fromDiagnosis && gAdaptiveState.weakWords && gAdaptiveState.weakWords.length > 0) {
    gAdaptiveState.fromDiagnosis = true;
  }
  showModal('aiAdaptiveModal'); 
  buildAdaptiveQuiz(); 
}
function closeAIAdaptive() { hideModal('aiAdaptiveModal'); gAdaptiveState = { questions: [], currentIdx: 0, score: 0, results: [], weakWords: null, fromDiagnosis: false }; }

// 从 VOCAB_DATA 获取所有词汇（用于生成干扰选项）
function _getAllVocabForDistractors() {
  var allVocab = [];
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
            if (Array.isArray(partData)) {
              partData.forEach(function(item) {
                if (item.word && item.meaning) {
                  var zhText = item.meaning.replace(/^(n\.|v\.|adj\.|adv\.|pron\.|prep\.|conj\.|interj\.|num\.|det\.|abbr\.|\/.*?\/|\s*[,，].*)/gi, '').trim();
                  allVocab.push({ en: item.word, zh: zhText });
                }
              });
            }
          });
        });
      });
    }
  } catch(e) {}
  return allVocab;
}

// 构建精准练习题目（不依赖AI出题，答案100%确定）
function buildAdaptiveQuiz() {
  var body = document.getElementById('aiAdaptiveBody');
  if (!body) return;

  // 1. 从错题本收集答错的单词
  var wb = getWrongBook();
  var wrongEntries = (wb && wb.entries) ? wb.entries.filter(function(e) { return e.en && !e.isCorrect; }) : [];
  
  // 如果有诊断传入的薄弱词汇，优先使用
  if (gAdaptiveState.weakWords && gAdaptiveState.weakWords.length > 0) {
    // weakWords 是英文单词列表，从错题本中找对应条目
    var weakSet = {};
    gAdaptiveState.weakWords.forEach(function(w) { weakSet[w.toLowerCase().trim()] = true; });
    var weakEntries = wrongEntries.filter(function(e) { return weakSet[(e.en || '').toLowerCase().trim()]; });
    if (weakEntries.length > 0) wrongEntries = weakEntries;
    gAdaptiveState.weakWords = null; // 使用后清除
  }

  // 去重（相同英文只保留最后一条，保留最新的中文释义）
  var seenEn = {};
  var uniqueWrong = [];
  for (var i = wrongEntries.length - 1; i >= 0; i--) {
    var e = wrongEntries[i];
    if (!seenEn[e.en.toLowerCase()]) {
      seenEn[e.en.toLowerCase()] = true;
      uniqueWrong.unshift(e);
    }
  }

  if (uniqueWrong.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;">' +
      '<div style="font-size:3rem;margin-bottom:10px;">📚</div>' +
      '<div style="color:rgba(255,255,255,0.7);">错题本中没有答错的单词</div>' +
      '<div style="color:rgba(255,255,255,0.5);margin-top:8px;font-size:0.9rem;">先进行PK游戏积累错题，再来练习吧！</div>' +
      '</div>';
    return;
  }

  // 2. 随机抽取最多10个错词
  var shuffled = uniqueWrong.slice().sort(function() { return Math.random() - 0.5; });
  var quizWords = shuffled.slice(0, Math.min(10, shuffled.length));

  // 3. 获取所有词汇用于干扰项
  var allVocab = _getAllVocabForDistractors();
  // 建立去重索引（按小写英文）
  var allVocabMap = {};
  allVocab.forEach(function(v) {
    if (!allVocabMap[v.en.toLowerCase()]) allVocabMap[v.en.toLowerCase()] = v;
  });
  // 补充错题本中的词
  uniqueWrong.forEach(function(e) {
    if (e.en && e.zh && !allVocabMap[e.en.toLowerCase()]) {
      allVocabMap[e.en.toLowerCase()] = { en: e.en, zh: e.zh };
      allVocab.push({ en: e.en, zh: e.zh });
    }
  });

  // 4. 为每个错词生成2道题：英选中 + 中选英
  var questions = [];
  quizWords.forEach(function(word) {
    var correctZh = word.zh || '';
    var correctEn = word.en || '';
    
    // 生成3个干扰项（中文释义不同于正确答案的其他词）
    var zhDistractors = _pickDistractors(allVocab, 'zh', correctZh, 3);
    var enDistractors = _pickDistractors(allVocab, 'en', correctEn, 3);

    // 题型1：看英文选中文释义
    if (correctZh && zhDistractors.length >= 3) {
      var opts1 = [correctZh].concat(zhDistractors);
      opts1 = _shuffleArray(opts1);
      questions.push({
        type: 'en2zh',
        prompt: correctEn,
        promptSub: '请选择正确的中文释义',
        correct: correctZh,
        options: opts1,
        word: word
      });
    }

    // 题型2：看中文选英文
    if (correctEn && enDistractors.length >= 3) {
      var opts2 = [correctEn].concat(enDistractors);
      opts2 = _shuffleArray(opts2);
      questions.push({
        type: 'zh2en',
        prompt: correctZh,
        promptSub: '请选择正确的英文单词',
        correct: correctEn,
        options: opts2,
        word: word
      });
    }
  });

  // 随机打乱题目顺序
  questions = _shuffleArray(questions);

  if (questions.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.7);">词汇数据不足，无法生成干扰选项</div>';
    return;
  }

  gAdaptiveState.questions = questions;
  gAdaptiveState.currentIdx = 0;
  gAdaptiveState.score = 0;
  gAdaptiveState.results = [];

  renderAdaptiveQuestion();
}

// 从词汇库中随机选N个干扰项（排除正确答案）
function _pickDistractors(allVocab, field, correctValue, count) {
  var candidates = allVocab.filter(function(v) {
    return v[field] && v[field] !== correctValue && v[field].length > 0 && v[field].length < 30;
  });
  // 去重
  var seen = {};
  var unique = [];
  candidates.forEach(function(c) {
    if (!seen[c[field]]) {
      seen[c[field]] = true;
      unique.push(c);
    }
  });
  // 随机选
  var shuffled = unique.sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count).map(function(c) { return c[field]; });
}

// 简单的数组随机打乱
function _shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function renderAdaptiveQuestion() {
  var body = document.getElementById('aiAdaptiveBody');
  if (!body || gAdaptiveState.questions.length === 0) return;
  var q = gAdaptiveState.questions[gAdaptiveState.currentIdx];
  if (!q) return;

  var progressPct = Math.round((gAdaptiveState.currentIdx / gAdaptiveState.questions.length) * 100);
  var typeIcon = q.type === 'en2zh' ? '🇬🇧→🇨🇳' : '🇨🇳→🇬🇧';
  var typeLabel = q.type === 'en2zh' ? '英→中' : '中→英';

  var html = '<div style="padding:16px;">';
  // 进度条
  html += '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:4px;margin-bottom:12px;">';
  html += '<div style="background:linear-gradient(90deg,#00e5ff,#00ff88);height:100%;border-radius:4px;width:' + progressPct + '%;transition:width 0.3s;"></div>';
  html += '</div>';
  // 题目信息
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<span style="color:rgba(255,255,255,0.5);font-size:0.85rem;">第 ' + (gAdaptiveState.currentIdx + 1) + '/' + gAdaptiveState.questions.length + ' 题</span>';
  html += '<span style="background:rgba(0,229,255,0.15);padding:2px 8px;border-radius:4px;font-size:0.8rem;color:#00e5ff;">' + typeIcon + ' ' + typeLabel + '</span>';
  html += '<span style="color:#00ff88;font-size:0.9rem;">✓ ' + gAdaptiveState.score + '</span>';
  html += '</div>';
  // 题目
  html += '<div style="font-size:1.4rem;color:#fff;text-align:center;margin:20px 0;font-weight:600;letter-spacing:0.5px;">' + _escapeHtml(q.prompt) + '</div>';
  html += '<div style="text-align:center;color:rgba(255,255,255,0.4);font-size:0.85rem;margin-bottom:16px;">' + q.promptSub + '</div>';
  // 选项（2×2网格）
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  q.options.forEach(function(opt, i) {
    var label = String.fromCharCode(65 + i); // A, B, C, D
    html += '<button class="ai-option-btn" data-idx="' + i + '" onclick="submitAdaptiveAnswer(' + i + ')" style="padding:14px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;cursor:pointer;font-size:0.95rem;text-align:left;transition:all 0.2s;">';
    html += '<span style="color:#00e5ff;font-weight:700;margin-right:8px;">' + label + '</span>';
    html += _escapeHtml(opt);
    html += '</button>';
  });
  html += '</div></div>';
  body.innerHTML = html;
}

function submitAdaptiveAnswer(optionIndex) {
  var q = gAdaptiveState.questions[gAdaptiveState.currentIdx];
  if (!q) return;

  var selectedOption = q.options[optionIndex];
  var correct = selectedOption === q.correct;

  if (correct) gAdaptiveState.score++;

  // 高亮正确/错误
  var btns = document.querySelectorAll('.ai-option-btn');
  btns.forEach(function(btn, i) {
    btn.onclick = null; // 禁止重复点击
    btn.style.cursor = 'default';
    var optText = q.options[i];
    if (optText === q.correct) {
      btn.style.background = 'rgba(0,255,136,0.2)';
      btn.style.borderColor = '#00ff88';
      btn.style.color = '#00ff88';
    } else if (i === optionIndex && !correct) {
      btn.style.background = 'rgba(255,102,102,0.2)';
      btn.style.borderColor = '#ff6666';
      btn.style.color = '#ff6666';
    } else {
      btn.style.opacity = '0.4';
    }
  });

  gAdaptiveState.results.push({ question: q, userAnswer: selectedOption, correct: correct });

  // 1.2秒后自动进入下一题
  setTimeout(function() {
    gAdaptiveState.currentIdx++;
    if (gAdaptiveState.currentIdx >= gAdaptiveState.questions.length) {
      renderAdaptiveResult();
    } else {
      renderAdaptiveQuestion();
    }
  }, 1200);
}

function renderAdaptiveResult() {
  var body = document.getElementById('aiAdaptiveBody');
  if (!body) return;
  var total = gAdaptiveState.questions.length;
  var score = gAdaptiveState.score;
  var pct = Math.round(score / total * 100);
  
  var emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '📖';
  var msg = pct >= 80 ? '太棒了！薄弱词汇掌握得很好！' : pct >= 60 ? '不错，继续加油！' : pct >= 40 ? '还需多练习哦！' : '这些词要重点记忆！';

  var html = '<div style="padding:24px;text-align:center;">';
  html += '<div style="font-size:3rem;margin-bottom:10px;">' + emoji + '</div>';
  html += '<div style="font-size:1.3rem;color:#00e5ff;">练习完成！</div>';
  html += '<div style="font-size:2.5rem;color:' + (pct >= 60 ? '#00ff88' : '#ffd700') + ';margin:16px 0;font-weight:700;">' + score + '/' + total + '</div>';
  html += '<div style="color:rgba(255,255,255,0.6);margin-bottom:16px;">正确率 ' + pct + '% · ' + msg + '</div>';

  // 错题回顾
  var wrongResults = gAdaptiveState.results.filter(function(r) { return !r.correct; });
  if (wrongResults.length > 0) {
    html += '<div style="text-align:left;margin-top:16px;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px;">';
    html += '<div style="color:#ff8888;font-size:0.9rem;margin-bottom:8px;">❌ 仍需加强的单词：</div>';
    wrongResults.forEach(function(r) {
      var w = r.question.word || {};
      html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
      html += '<span style="color:#fff;">' + _escapeHtml(w.en || r.question.prompt) + '</span>';
      html += '<span style="color:rgba(255,255,255,0.5);">' + _escapeHtml(w.zh || r.question.correct) + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<button class="ai-btn-adaptive" onclick="startAIAdaptiveQuiz()" style="margin-top:20px;padding:10px 24px;background:linear-gradient(135deg,#00e5ff,#00ff88);border:none;border-radius:10px;color:#000;font-weight:700;cursor:pointer;font-size:1rem;">🔄 再练一次</button>';
  html += '</div>';
  body.innerHTML = html;
}

function _escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== AI 班级报告 =====
// 填充AI出卷/故事的学生选择器
function populateAIStudentFilter(studentSelectId, className) {
  var select = document.getElementById(studentSelectId);
  if (!select) return;
  select.innerHTML = '<option value="">全班</option>';
  if (!className) return;
  try {
    var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
    var data = JSON.parse(raw);
    var names = data[className] ? (data[className].names || []) : [];
    names.forEach(function(name) {
      select.innerHTML += '<option value="' + name + '">' + name + '</option>';
    });
  } catch(e) {}
}

// 根据班级+学生筛选错词（共享逻辑）
function _collectWrongWords(classFilter, studentFilter) {
  var wb = getWrongBook();
  var wrongWords = [];
  if (!wb || !wb.entries) return wrongWords;
  var seen = {};
  wb.entries.slice(-300).forEach(function(e) {
    if (!e.isCorrect && e.en && !seen[e.en.toLowerCase()]) {
      if (classFilter && e.className && e.className !== classFilter) return;
      if (studentFilter && e.player && e.player !== studentFilter) return;
      seen[e.en.toLowerCase()] = true;
      wrongWords.push({ en: e.en, zh: e.zh || '', errorType: e.errorType || '' });
    }
  });
  return wrongWords;
}

// 教师工具箱中 AI出卷/故事打开时初始化班级过滤器
function populateAIStoryClassFilter() {
  var select = document.getElementById('aiStoryClassFilter');
  if (!select || select.options.length > 1) return;
  var classes = new Set();
  try {
    var wb = getWrongBook();
    (wb.entries || []).forEach(function(e) { if (e.className) classes.add(e.className); });
    var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
    var data = JSON.parse(raw);
    Object.keys(data).forEach(function(cls) { classes.add(cls); });
  } catch(e) {}
  Array.from(classes).sort().forEach(function(cls) {
    select.innerHTML += '<option value="' + cls + '">' + cls + '</option>';
  });
}
function showAIClassReport() {
  showModal('aiClassModal');
  populateReportClassFilter();
  // 不自动运行，等用户选好班级后点击"生成报告"
}
function closeAIClass() { hideModal('aiClassModal'); }

// 填充班级报告的班级选择器
function populateReportClassFilter() {
  var classSelect = document.getElementById('aiReportClassFilter');
  if (!classSelect) return;

  var classList = [];
  try {
    var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
    var data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      var src = data;
      // 兼容 classes 包装层
      if (data.classes && typeof data.classes === 'object') {
        if (Array.isArray(data.classes)) {
          data.classes.forEach(function(c) { if (c.name) classList.push(c.name); });
          src = null; // 已处理
        } else {
          src = data.classes;
        }
      }
      // 标准格式: { 班级名: {names:[...]} }
      if (src) {
        Object.keys(src).forEach(function(cls) {
          var val = src[cls];
          // 排除非班级字段（如空字符串、特殊键）
          if (cls && typeof val === 'object') classList.push(cls);
        });
      }
    }
  } catch(e) {}

  classSelect.innerHTML = '<option value="">全部班级</option>';
  classList.sort().forEach(function(name) {
    classSelect.innerHTML += '<option value="' + name + '">' + name + '</option>';
  });

  // 重置内容区
  var body = document.getElementById('aiClassBody');
  if (body) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">👆 请选择班级后点击「生成报告」</div>';
  }
}

async function runClassReport() {
  var body = document.getElementById('aiClassBody');
  if (!body) return;
  body.innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">正在生成班级报告...</div></div>';

  var config = getAIConfig();
  if (!config.enabled) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.7)">⚠️ 请先在AI设置中配置API密钥</div>';
    return;
  }

  // 读取选中的班级
  var reportClass = '';
  var classSelect = document.getElementById('aiReportClassFilter');
  if (classSelect) reportClass = classSelect.value || '';

  var targetDesc = reportClass || '全部班级';

  // 收集数据（按班级筛选）
  var leaderboard = [];
  try { leaderboard = JSON.parse(localStorage.getItem('vocabPKLeaderboard') || '[]'); } catch (e) {}
  var wb = getWrongBook ? getWrongBook() : {};

  var classData = {};
  if (wb && wb.entries) {
    wb.entries.forEach(function(e) {
      // 按班级筛选
      if (reportClass && e.className && e.className !== reportClass) return;
      var cls = e.className || '未知班级';
      if (!classData[cls]) classData[cls] = { total: 0, correct: 0, words: {} };
      classData[cls].total++;
      if (e.isCorrect) classData[cls].correct++;
      if (e.en && !classData[cls].words[e.en]) classData[cls].words[e.en] = { count: 0, correct: 0 };
      if (e.en) {
        classData[cls].words[e.en].count++;
        if (e.isCorrect) classData[cls].words[e.en].correct++;
      }
    });
  }

  // 按班级筛选排行榜
  var filteredLeaderboard = leaderboard;
  if (reportClass) {
    // 尝试从班级学生名单中获取该班级的学生
    var classStudents = {};
    try {
      var cdata = JSON.parse(localStorage.getItem('rollcall_classes_v2') || '{}');
      if (cdata && cdata.classes) {
        cdata.classes.forEach(function(c) {
          if (c.name === reportClass && c.students) {
            c.students.forEach(function(s) { classStudents[s] = true; });
          }
        });
      }
    } catch(e) {}
    if (Object.keys(classStudents).length > 0) {
      filteredLeaderboard = leaderboard.filter(function(e) { return classStudents[e.name]; });
    }
  }

  var allStudentScores = {};
  filteredLeaderboard.forEach(function(e) {
    if (!allStudentScores[e.name]) allStudentScores[e.name] = 0;
    allStudentScores[e.name] += (e.score || 0);
  });

  var studentCount = Object.keys(allStudentScores).length;
  var avgScore = studentCount > 0 ? Object.values(allStudentScores).reduce(function(a,b){return a+b;},0) / studentCount : 0;

  var topErrors = [];
  var wordMap2 = {};
  if (wb && wb.entries) {
    wb.entries.forEach(function(e) {
      if (reportClass && e.className && e.className !== reportClass) return;
      if (e.en && !e.isCorrect) {
        if (!wordMap2[e.en]) wordMap2[e.en] = { en: e.en, zh: e.zh || '', count: 0 };
        wordMap2[e.en].count++;
      }
    });
    topErrors = Object.values(wordMap2).sort(function(a,b){return b.count-a.count;}).slice(0,10);
  }

  var summary = '分析对象：' + targetDesc + '，人数约' + studentCount + '人，平均得分' + avgScore.toFixed(1) + '分。';
  summary += '高频错词：' + topErrors.map(function(w){return w.en;}).join('、') + '。';

  try {
    var systemPrompt = (typeof getClassReportSystemPrompt === 'function')
      ? getClassReportSystemPrompt()
      : '你是教育数据分析专家。';
    var prompt = (typeof getClassReportPrompt === 'function')
      ? getClassReportPrompt(targetDesc, summary)
      : '请根据以下班级数据生成学情报告（' + targetDesc + '）：\n' + summary + '\n\n详细数据已汇总，请基于数据给出分析。返回JSON：{"overview":"总体概述","strengths":["优势1"],"weaknesses":["薄弱点1"],"tips":["教学建议1"],"hotWords":["热点词1"]}';
    var result = await callAI(prompt, systemPrompt);
    var jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var data = JSON.parse(jsonMatch[0]);
      var html = '<div style="padding:16px;">';
      html += '<h3 style="color:#00e5ff;">📊 总体概述</h3><p style="color:rgba(255,255,255,0.8);">' + (data.overview || summary) + '</p>';
      // 趋势分析（增强字段）
      if (data.trendAnalysis) {
        html += '<h3 style="color:#ff9f43;margin-top:16px;">📈 趋势分析</h3><p style="color:rgba(255,255,255,0.7);">' + data.trendAnalysis + '</p>';
      }
      html += '<h3 style="color:#00ff88;margin-top:16px;">✅ 班级优势</h3><ul>';
      (data.strengths || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
      html += '</ul>';
      html += '<h3 style="color:#ff8888;margin-top:16px;">⚠️ 待改进</h3><ul>';
      (data.weaknesses || []).forEach(function(w) { html += '<li>' + w + '</li>'; });
      html += '</ul>';
      html += '<h3 style="color:#c86bff;margin-top:16px;">💡 教学建议</h3><ul>';
      (data.tips || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
      html += '</ul>';
      // 重点关注学生（增强字段）
      if (data.focusStudents && data.focusStudents.length > 0) {
        html += '<h3 style="color:#ff6b6b;margin-top:16px;">🎯 重点关注学生</h3>';
        html += '<p style="color:rgba(255,255,255,0.7);">' + data.focusStudents.join('、') + '</p>';
      }
      html += '</div>';
      body.innerHTML = html;
    } else {
      body.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,0.8);white-space:pre-wrap;">' + result + '</div>';
    }
  } catch (e) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff8888;">❌ ' + e.message + '</div>';
  }
}

function showExportOptions(type) {
  showToast('导出功能开发中...', 'info');
}

// ===== AI 学情分析 =====
function showAIAnalysis() { 
  showModal('aiAnalysisModal');
  var body = document.getElementById('aiAnalysisBody');
  if (body) body.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.7);">请通过"班级报告"或"薄弱点诊断"查看详细分析</div>';
}
function closeAIAnalysis() { hideModal('aiAnalysisModal'); }

// ===== AI 智能出题 =====
function showAIQuiz() { showModal('aiQuizModal'); }
function closeAIQuiz() { hideModal('aiQuizModal'); }
function generateAIQuiz() {
  var body = document.getElementById('aiQuizWords');
  if (body) body.innerHTML = '<span style="color:rgba(255,255,255,0.4);">请先通过AI智能练习功能进行出题练习</span>';
  showToast('请使用"AI智能练习"功能', 'info');
}

// ===== AI 即时讲解 =====
function closeAIExplain() { hideModal('aiExplainModal'); }

// ===== AI 学习建议 =====
function showAISuggestions() { showModal('aiSuggestModal'); }
function closeAISuggest() { hideModal('aiSuggestModal'); }
function applyAISuggestions() { 
  hideModal('aiSuggestModal');
  showToast('建议已应用', 'success');
}

// ===== 全屏切换 =====
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function() {});
  } else {
    document.exitFullscreen().catch(function() {});
  }
}

// ===== 关闭页面 =====
function closePage() {
  if (confirm('确定要关闭页面吗？')) {
    window.close();
  }
}

// ===== 册别选择 =====
function toggleBookSelection(book) {
  // 用于词块PK的教材选择
  if (typeof selectBook === 'function') {
    selectBook(book);
  }
}

// ===== Dashboard 管理 =====
function switchDashTab(tab) {
  // 高亮当前标签页
  var tabs = document.querySelectorAll('.dash-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var activeTab = document.getElementById('tab-' + tab);
  if (activeTab) activeTab.classList.add('active');
  // 渲染对应内容
  renderDashboard(tab);
}

function clearDashboardClassData() {
  if (confirm('确定要清除当前班级的所有数据吗？此操作不可逆！')) {
    var className = currentClassName || '';
    if (className) {
      var wb = getWrongBook ? getWrongBook() : {};
      if (wb && wb.entries) {
        wb.entries = wb.entries.filter(function(e) { return e.className !== className; });
        if (typeof saveWrongBook === 'function') saveWrongBook(wb);
        showToast('已清除 ' + className + ' 数据', 'success');
        if (typeof renderDashboard === 'function') renderDashboard('overview');
      }
    } else {
      showToast('请先选择班级', 'wrong');
    }
  }
}

function exportWrongBookData() {
  var wb = getWrongBook ? getWrongBook() : {};
  if (!wb || !wb.entries || wb.entries.length === 0) {
    showToast('暂无错题数据可导出', 'wrong');
    return;
  }
  var csv = '单词,中文,章节,正确,时间\n';
  wb.entries.forEach(function(e) {
    csv += (e.en || '') + ',' + (e.zh || '') + ',' + (e.chapter || '') + ',' + (e.isCorrect ? '是' : '否') + ',' + (e.time || '') + '\n';
  });
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '错题导出_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('错题数据已导出', 'success');
}

// ===== 错题本 =====
function switchWbTab(tab) {
  if (typeof renderWrongBook === 'function') {
    renderWrongBook(tab);
  }
}

function retryWrongWords() {
  // 重试错题 - 启动抢答模式复习错词
  if (typeof startRaceWithWords === 'function') {
    var wb = getWrongBook ? getWrongBook() : {};
    var words = [];
    if (wb && wb.entries) {
      var seen = {};
      wb.entries.forEach(function(e) {
        if (e.en && !seen[e.en]) {
          seen[e.en] = true;
          words.push({ word: e.en, meaning: e.zh || '' });
        }
      });
    }
    if (words.length < 2) {
      showToast('错题不足，至少需要2个词', 'wrong');
      return;
    }
    startRaceWithWords(words);
  } else {
    showToast('该功能需要从主界面启动', 'info');
  }
}

// ===== 复习游戏 =====
var gReviewState = { words: [], currentIdx: 0, score: 0 };

function startReviewGame() {
  var reviewData = getReviewSchedule ? getReviewSchedule() : {};
  gReviewState.words = [];
  gReviewState.currentIdx = 0;
  gReviewState.score = 0;

  Object.keys(reviewData).forEach(function(key) {
    var item = reviewData[key];
    if (item.nextReviewTime && item.nextReviewTime <= Date.now()) {
      gReviewState.words.push({ en: key, zh: item.zh || '', chapter: item.chapter || '' });
    }
  });

  if (gReviewState.words.length === 0) {
    showToast('暂无待复习词汇！', 'info');
    return;
  }

  showScreen('screen-review-game');
  showNextReviewWord();
}

function confirmReviewExit() {
  if (confirm('确定退出复习吗？当前进度将不会保存。')) {
    showScreen('screen-menu');
  }
}

function showNextReviewWord() {
  if (gReviewState.currentIdx >= gReviewState.words.length) {
    // 复习完成
    var body = document.getElementById('reviewResultArea');
    if (body) {
      body.innerHTML = '<div style="text-align:center;padding:40px;">' +
        '<div style="font-size:2rem;">🎉</div>' +
        '<div style="font-size:1.3rem;color:#00e5ff;">复习完成！</div>' +
        '<div style="font-size:2rem;color:#00ff88;">' + gReviewState.score + '/' + gReviewState.words.length + '</div>' +
        '</div>';
    }
    return;
  }

  var word = gReviewState.words[gReviewState.currentIdx];
  var displayEl = document.getElementById('reviewWordDisplay');
  var hintEl = document.getElementById('reviewHint');
  var inputEl = document.getElementById('reviewInput');
  var statusEl = document.getElementById('reviewStatus');

  if (displayEl) displayEl.textContent = word.en;
  if (hintEl) hintEl.textContent = word.chapter || '';
  if (inputEl) { inputEl.value = ''; inputEl.focus(); }
  if (statusEl) statusEl.textContent = '';

  // 绑定回车提交
  if (inputEl) {
    inputEl.onkeydown = function(e) {
      if (e.key === 'Enter') {
        var answer = inputEl.value.trim();
        var isCorrect = answer === word.zh || answer === word.en;
        if (isCorrect) {
          gReviewState.score++;
          if (statusEl) statusEl.innerHTML = '<span style="color:#00ff88;">✅ 正确！</span>';
        } else {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ff6666;">❌ 正确答案：' + word.zh + '</span>';
        }

        // 更新复习记录
        if (typeof markReviewCompleted === 'function') {
          markReviewCompleted(word.en);
        }

        setTimeout(function() {
          gReviewState.currentIdx++;
          showNextReviewWord();
        }, 1500);
      }
    };
  }
}

// ===== AI 对话背单词 =====
var gAIChatState = { words: [], currentIdx: 0, messages: [] };

function endAIChat() {
  if (confirm('确定结束AI对话吗？')) {
    showScreen('screen-menu');
    gAIChatState = { words: [], currentIdx: 0, messages: [] };
  }
}

async function handleChatGuess(optionIndex) {
  var config = getAIConfig();
  if (!config.enabled) {
    showToast('请先配置AI', 'wrong');
    return;
  }

  var word = gAIChatState.words[gAIChatState.currentIdx];
  var statusEl = document.getElementById('chatStatus');
  if (!word) return;

  try {
    var systemPrompt = (typeof getChatSystemPrompt === 'function')
      ? getChatSystemPrompt()
      : '你是英语单词学习助手。';
    var prompt = (typeof getChatGuessPrompt === 'function')
      ? getChatGuessPrompt(optionIndex, word, null)
      : '学生选择了选项 ' + (optionIndex + 1) + '，当前学习的单词是 "' + word.en + '"，意思是"' + word.zh + '"。请简短评价这个选择并鼓励学生。';
    var result = await callAI(prompt, systemPrompt);
    if (statusEl) statusEl.innerHTML = '<span style="color:#00e5ff;">' + result + '</span>';
  } catch (e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#ff8888;">' + e.message + '</span>';
  }
}

function generateWordHint(word) {
  var hints = [];
  if (word && word.en) {
    hints.push('首字母: ' + word.en.charAt(0));
    hints.push('长度: ' + word.en.length + '个字母');
    if (word.zh) hints.push('词性提示');
  }
  return hints.join(' | ');
}

// ===== AI 语境猜词 =====
var gContextGuessState = { words: [], currentIdx: 0, score: 0 };

function endContextGuess() {
  if (confirm('确定结束语境猜词吗？')) {
    showScreen('screen-menu');
    gContextGuessState = { words: [], currentIdx: 0, score: 0 };
  }
}

async function loadNextContextQuestion(difficulty) {
  var config = getAIConfig();
  var body = document.getElementById('contextQuestionBody');
  var statusEl = document.getElementById('contextStatus');

  if (!config.enabled) {
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.7)">⚠️ 请先在AI设置中配置API密钥</div>';
    return;
  }

  if (body) body.innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">正在生成题目...</div></div>';
  if (statusEl) statusEl.textContent = '';

  // 收集错词
  var wb = getWrongBook ? getWrongBook() : {};
  var words = [];
  if (wb && wb.entries) {
    var seen = {};
    wb.entries.forEach(function(e) {
      if (e.en && !seen[e.en]) { seen[e.en] = true; words.push(e.en); }
    });
  }

  try {
    var wordList = words.length > 0 ? words.slice(0, 10).join(', ') : '常用高中英语词汇';
    var systemPrompt = (typeof getContextGuessSystemPrompt === 'function')
      ? getContextGuessSystemPrompt()
      : '你是英语教学专家。';
    var prompt = (typeof getContextGuessPrompt === 'function')
      ? getContextGuessPrompt(words, difficulty)
      : '请出1道英语语境猜词题。给出一个包含空白的英文句子，让学生猜空白处应该填什么词。目标词汇范围：' + wordList + '。难度：' + (difficulty || '中等') + '。返回JSON：{"sentence":"含空白的句子","correct":"正确答案","hint":"提示","options":["干扰项1","干扰项2","干扰项3"]}';
    var result = await callAI(prompt, systemPrompt);
    var jsonMatch = result.match(/\{[\s\S]*\}/);

    if (jsonMatch && body) {
      var data = JSON.parse(jsonMatch[0]);
      var options = (data.options || []).slice();
      options.push(data.correct);
      // 去重
      var uniqueOptions = [];
      var seen2 = new Set();
      options.forEach(function(o) {
        if (!seen2.has(o.toLowerCase())) { seen2.add(o.toLowerCase()); uniqueOptions.push(o); }
      });
      // 打乱
      uniqueOptions.sort(function() { return Math.random() - 0.5; });

      var html = '<div style="padding:16px;">';
      html += '<div style="font-size:1.2rem;color:#00e5ff;margin-bottom:10px;line-height:1.8;">' + (data.sentence || '') + '</div>';
      if (data.hint) {
        html += '<div style="color:rgba(255,255,255,0.4);font-size:0.9rem;margin-bottom:12px;">💡 提示: ' + data.hint + '</div>';
      }
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      uniqueOptions.forEach(function(opt) {
        html += '<button class="ai-option-btn" onclick="submitContextGuess(\'' + opt.replace(/'/g, '\\\'') + '\', \'' + (data.correct || '').replace(/'/g, '\\\'') + '\')">' + opt + '</button>';
      });
      html += '</div></div>';
      body.innerHTML = html;
    } else if (body) {
      body.innerHTML = '<div style="padding:16px;color:rgba(255,255,255,0.8);">AI返回异常，请重试</div>';
    }
  } catch (e) {
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff8888;">❌ ' + e.message + '</div>';
  }
}

function submitContextGuess(answer, correct) {
  var isCorrect = answer === correct;
  var statusEl = document.getElementById('contextStatus');
  if (statusEl) {
    statusEl.innerHTML = isCorrect
      ? '<span style="color:#00ff88;">✅ 正确！答案是: ' + correct + '</span>'
      : '<span style="color:#ff6666;">❌ 正确答案是: ' + correct + '</span>';
  }

  var btn = document.querySelector('#contextQuestionBody button');
  if (btn && !isCorrect) {
    // 禁用所有按钮
    var allBtns = document.querySelectorAll('#contextQuestionBody button');
    allBtns.forEach(function(b) { b.disabled = true; });
    // 高亮正确答案
    allBtns.forEach(function(b) {
      if (b.textContent.trim() === correct) b.style.borderColor = '#00ff88';
    });
  }
}

// ===== 错题本数据管理 =====
function getWrongBook() {
  try {
    var raw = localStorage.getItem('vocabPKWrongBook');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { entries: [] };
}

function saveWrongBook(data) {
  localStorage.setItem('vocabPKWrongBook', JSON.stringify(data || { entries: [] }));
}

function syncGameRecordsToWrongBook(records, className) {
  var wb = getWrongBook();
  if (!wb.entries) wb.entries = [];
  records.forEach(function(r) {
    var entry = {
      en: r.en || r.word || '',
      zh: r.zh || r.meaning || '',
      chapter: r.chapter || '',
      player: r.player || '',
      className: className || '',
      isCorrect: r.correct || false,
      time: new Date().toISOString(),
      errorType: r.errorType || 'UNKNOWN',
      userAnswer: r.userAnswer || '',
      mode: r.mode || ''
    };
    // 扩展字段（AI增强）：记录混淆词和难度
    if (r.confusableWith) entry.confusableWith = r.confusableWith;
    if (r.difficultyLevel) entry.difficultyLevel = r.difficultyLevel;
    if (r.aiExplanation) entry.aiExplanation = r.aiExplanation;
    wb.entries.push(entry);
  });
  // Keep only last 500 records
  if (wb.entries.length > 500) {
    wb.entries = wb.entries.slice(wb.entries.length - 500);
  }
  saveWrongBook(wb);
}

// ===== 艾宾浩斯复习 =====
function getReviewSchedule() {
  try {
    var raw = localStorage.getItem('vocabPKReviewSchedule');
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveReviewSchedule(data) {
  localStorage.setItem('vocabPKReviewSchedule', JSON.stringify(data || {}));
}

var REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120];

function getNextReviewTime(count) {
  if (count >= REVIEW_INTERVALS.length) return Date.now() + 180 * 24 * 3600000;
  return Date.now() + REVIEW_INTERVALS[count] * 24 * 3600000;
}

function recordToReviewSchedule(en, zh, chapter, player, className, isCorrect, userAnswer, errorType) {
  var data = getReviewSchedule();
  var key = en.toLowerCase();
  if (!data[key]) {
    data[key] = {
      en: en,
      zh: zh || '',
      chapter: chapter || '',
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0,
      nextReviewTime: Date.now() + 86400000,
      history: []
    };
  }
  var item = data[key];
  // 兼容旧数据：确保 history 字段存在
  if (!item.history) item.history = [];
  item.reviewCount++;
  if (isCorrect) item.correctCount++;
  else item.wrongCount++;

  // 优先使用AI建议的复习间隔（如果增强模块可用）
  if (typeof aiGetReviewInterval === 'function' && window.isAIEnabled && window.isAIEnabled()) {
    var word = en;
    var errCount = item.wrongCount;
    var errType = errorType || 'UNKNOWN';
    // 异步获取AI建议间隔（不阻塞主流程）
    window.aiGetReviewInterval(word, errCount, errType).then(function(aiDays) {
      item.nextReviewTime = Date.now() + aiDays * 24 * 3600000;
      saveReviewSchedule(data);
    }).catch(function() {
      // AI失败时使用标准间隔
      item.nextReviewTime = getNextReviewTime(item.reviewCount);
      saveReviewSchedule(data);
    });
    // 先用标准间隔作为fallback
    item.nextReviewTime = getNextReviewTime(item.reviewCount);
  } else {
    item.nextReviewTime = getNextReviewTime(item.reviewCount);
  }

  item.history.push({
    time: new Date().toISOString(),
    correct: isCorrect,
    answer: userAnswer || '',
    errorType: errorType || ''
  });
  // Keep last 10 history entries
  if (item.history.length > 10) item.history = item.history.slice(-10);
  saveReviewSchedule(data);
}

function markReviewCompleted(en) {
  var data = getReviewSchedule();
  var key = en.toLowerCase();
  if (data[key]) {
    data[key].reviewCount++;
    data[key].nextReviewTime = getNextReviewTime(data[key].reviewCount);
    saveReviewSchedule(data);
  }
}

function analyzeErrorType(userAnswer, correctAnswer, allWords) {
  if (!userAnswer || !correctAnswer) return 'UNKNOWN';
  var ua = userAnswer.toLowerCase().trim();
  var ca = correctAnswer.toLowerCase().trim();
  if (ua === ca) return 'CORRECT';
  if (ua.length > 0 && ca.indexOf(ua) === 0) return 'PREFIX_MATCH';
  if (ua.length > 0 && ca.indexOf(ua) >= 0) return 'PARTIAL_MATCH';
  var dist = levenshteinDistance(ua, ca);
  if (dist <= 2) return 'SPELLING_NEAR';
  if (dist <= 5) return 'SPELLING_FAR';
  return 'WRONG_WORD';
}

function levenshteinDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) matrix[i] = [i];
  for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function getAllClassesFromWrongBook() {
  var wb = getWrongBook();
  var classes = {};
  if (wb && wb.entries) {
    wb.entries.forEach(function(e) {
      var cls = e.className || '未知班级';
      if (!classes[cls]) classes[cls] = 0;
      classes[cls]++;
    });
  }
  return Object.keys(classes).sort();
}

// ===== Dashboard 班级筛选器 =====
var currentDashboardClass = '';

function updateDashClassFilter() {
  var select = document.getElementById('dashClassFilter');
  if (!select) return;
  
  // 从错题本获取班级
  var classes = new Set(getAllClassesFromWrongBook());
  
  // 从点名系统获取教师添加的班级
  try {
    var raw = localStorage.getItem('rollcall_classes_v2');
    if (raw) {
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function(cls) { classes.add(cls); });
    }
  } catch(e) {}
  
  select.innerHTML = '<option value="">全部班级</option>';
  var sorted = Array.from(classes).sort();
  sorted.forEach(function(cls) {
    var sel = cls === currentDashboardClass ? ' selected' : '';
    select.innerHTML += '<option value="' + cls + '"' + sel + '>' + cls + '</option>';
  });
  select.onchange = function() {
    currentDashboardClass = select.value;
    renderDashboard('overview');
  };
}

// ===== Dashboard 渲染 =====
function renderDashboard(tab) {
  if (!tab) tab = 'overview';
  var container = document.getElementById('dashContent');
  console.log('[RENDER] tab=' + tab + ' container=' + !!container);
  if (!container) return;
  
  var wb = getWrongBook();
  var entries = wb.entries || [];
  
  // 如果错题本为空，尝试从旧游戏记录中读取
  if (entries.length === 0) {
    try {
      var oldRecords = JSON.parse(localStorage.getItem('vocabPKGameRecords') || '[]');
      if (oldRecords.length > 0) {
        entries = oldRecords.map(function(r) {
          return {
            en: r.en || r.word || '',
            zh: r.zh || r.meaning || '',
            chapter: r.chapter || '',
            player: r.player || '',
            className: r.className || '默认班级',
            isCorrect: r.correct || false,
            time: r.time || '',
            errorType: r.errorType || ''
          };
        });
      }
    } catch(e) {}
  }
  
  // 获取点名系统中的班级学生名单
  var classStudents = [];
  if (currentDashboardClass) {
    try {
      var raw = localStorage.getItem('rollcall_classes_v2');
      if (raw) {
        var data = JSON.parse(raw);
        if (data[currentDashboardClass]) {
          classStudents = data[currentDashboardClass].names || [];
        }
      }
    } catch(e) {}
    // 筛选错题数据：className匹配或为空(旧数据)
    entries = entries.filter(function(e) { return e.className === currentDashboardClass || (!e.className && currentDashboardClass === '默认班级'); });
  }
  
  var html = '';

  if (tab === 'overview') {
    // 全班概览——先展示点名系统中的所有学生，再合并PK数据
    var studentMap = {};
    // 从点名系统初始化所有学生
    classStudents.forEach(function(name) {
      studentMap[name] = { total: 0, correct: 0 };
    });
    // 合并PK答题数据
    entries.forEach(function(e) {
      var name = e.player || '未知';
      if (!studentMap[name]) studentMap[name] = { total: 0, correct: 0 };
      studentMap[name].total++;
      if (e.isCorrect) studentMap[name].correct++;
    });
    var students = Object.keys(studentMap).sort(function(a, b) {
      return (studentMap[b].correct / Math.max(1, studentMap[b].total)) - (studentMap[a].correct / Math.max(1, studentMap[a].total));
    });
    html = '<h3 style="color:#00e5ff;padding:0 16px;">全班概览</h3>';
    html += '<p style="color:rgba(255,255,255,0.6);padding:0 16px;">共 ' + students.length + ' 名学生，' + entries.length + ' 条答题记录</p>';
    html += '<table style="width:100%;border-collapse:collapse;margin-top:8px;">';
    html += '<tr style="color:rgba(255,255,255,0.5);font-size:0.85rem;border-bottom:1px solid rgba(255,255,255,0.1);"><th style="padding:8px;text-align:left;">学生</th><th>答题数</th><th>正确率</th></tr>';
    students.forEach(function(name) {
      var s = studentMap[name];
      var rate = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:8px;color:#fff;">' + name + '</td><td style="padding:8px;text-align:center;color:rgba(255,255,255,0.6);">' + s.total + '</td><td style="padding:8px;text-align:center;color:' + (rate >= 80 ? '#00ff88' : rate >= 50 ? '#ffd700' : '#ff6666') + ';">' + rate + '%</td></tr>';
    });
    html += '</table>';

  } else if (tab === 'heatmap') {
    // 班级热力图
    var heatStudentMap = {};
    entries.forEach(function(e) {
      var name = e.player || '未知';
      if (!heatStudentMap[name]) heatStudentMap[name] = { total: 0, correct: 0 };
      heatStudentMap[name].total++;
      if (e.isCorrect) heatStudentMap[name].correct++;
    });
    html = '<h3 style="color:#ff8888;padding:0 16px;">班级热力图</h3>';
    Object.keys(heatStudentMap).forEach(function(name) {
      var s = heatStudentMap[name];
      var rate = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
      var color = rate >= 80 ? '#00ff88' : rate >= 60 ? '#ffd700' : rate >= 40 ? '#ff8800' : '#ff4444';
      html += '<div style="margin:6px 16px;display:flex;align-items:center;gap:10px;">';
      html += '<span style="color:#fff;width:60px;">' + name + '</span>';
      html += '<div style="flex:1;background:rgba(255,255,255,0.08);height:24px;border-radius:6px;overflow:hidden;">';
      html += '<div style="background:' + color + ';height:100%;width:' + rate + '%;border-radius:6px;transition:width 0.5s;"></div></div>';
      html += '<span style="color:rgba(255,255,255,0.5);width:50px;text-align:right;">' + rate + '%</span></div>';
    });

  } else if (tab === 'students') {
    // 学生详情
    var studMap = {};
    entries.forEach(function(e) {
      var name = e.player || '未知';
      if (!studMap[name]) studMap[name] = [];
      studMap[name].push(e);
    });
    html = '<h3 style="color:#00e5ff;padding:0 16px;">学生详情</h3>';
    Object.keys(studMap).sort().forEach(function(name) {
      var recs = studMap[name];
      var correct = recs.filter(function(r) { return r.isCorrect; }).length;
      html += '<div style="margin:8px 16px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;">';
      html += '<div style="color:#fff;font-weight:bold;">' + name + '</div>';
      html += '<div style="color:rgba(255,255,255,0.5);font-size:0.85rem;">答题 ' + recs.length + ' 次 | 正确 ' + correct + ' 次 | 正确率 ' + Math.round(correct/Math.max(1,recs.length)*100) + '%</div>';
      html += '</div>';
    });

  } else if (tab === 'words' || tab === 'errors') {
    // 错题词频
    var wordMap = {};
    entries.forEach(function(e) {
      if (!e.isCorrect && e.en) {
        if (!wordMap[e.en]) wordMap[e.en] = { en: e.en, zh: e.zh || '', count: 0 };
        wordMap[e.en].count++;
      }
    });
    var words = Object.values(wordMap).sort(function(a, b) { return b.count - a.count; });
    html = '<h3 style="color:#ff8888;padding:0 16px;">错题词频</h3>';
    words.forEach(function(w) {
      var barWidth = Math.min(100, w.count * 10);
      html += '<div style="margin:4px 16px;">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">';
      html += '<span style="color:#fff;">' + w.en + '</span>';
      html += '<span style="color:rgba(255,255,255,0.4);">' + w.zh + ' (' + w.count + '次)</span></div>';
      html += '<div style="background:rgba(255,255,255,0.1);height:4px;border-radius:2px;">';
      html += '<div style="background:linear-gradient(90deg,#ff4444,#ff8888);height:100%;border-radius:2px;width:' + barWidth + '%;"></div></div></div>';
    });

  } else if (tab === 'errorType') {
    // 错因分析：只针对拼写模式
    var spellErrors = entries.filter(function(e) {
      return !e.isCorrect && e.userAnswer && (e.mode === 'spell' || e.userAnswer.length > 0);
    });
    
    html = '<h3 style="color:#ffd700;padding:0 16px;">✏️ 错因分析（单词拼写）</h3>';
    
    if (spellErrors.length === 0) {
      html += '<div style="padding:20px 16px;text-align:center;color:rgba(255,255,255,0.5);">';
      html += '📝 暂无拼写测试数据<br><span style="font-size:0.85rem;">请进行单词拼写PK后查看拼写错误分析</span>';
      html += '</div>';
    } else {
      // 分析拼写错误
      var vowelMap = {a:1,e:1,i:1,o:1,u:1};
      var errorCategories = {
        '元音混淆': {count:0, examples:[], suggest:[]},
        '辅音错误': {count:0, examples:[], suggest:[]},
        '漏写字母': {count:0, examples:[], suggest:[]},
        '多写字母': {count:0, examples:[], suggest:[]},
        '顺序颠倒': {count:0, examples:[], suggest:[]}
      };
      
      spellErrors.forEach(function(e) {
        var correct = (e.en || '').toLowerCase();
        var wrong = (e.userAnswer || '').toLowerCase();
        if (!correct || !wrong) return;
        
        // 分类错误
        var minLen = Math.min(correct.length, wrong.length);
        var vowelErr = false, consErr = false, missing = false, extra = false, swapped = false;
        
        for (var i = 0; i < minLen; i++) {
          if (correct[i] !== wrong[i]) {
            if (vowelMap[correct[i]] && vowelMap[wrong[i]]) vowelErr = true;
            else if (vowelMap[correct[i]] !== vowelMap[wrong[i]]) consErr = true;
            else consErr = true;
          }
        }
        if (correct.length > wrong.length) missing = true;
        if (wrong.length > correct.length) extra = true;
        
        // 检测字母交换
        for (var j = 0; j < minLen - 1; j++) {
          if (correct[j] === wrong[j+1] && correct[j+1] === wrong[j]) {
            swapped = true; break;
          }
        }
        
        var example = correct + ' → <span style="color:#ff6666;">' + wrong + '</span>';
        
        if (vowelErr) { errorCategories['元音混淆'].count++; errorCategories['元音混淆'].examples.push(example); }
        if (consErr) { errorCategories['辅音错误'].count++; errorCategories['辅音错误'].examples.push(example); }
        if (missing) { errorCategories['漏写字母'].count++; errorCategories['漏写字母'].examples.push(example); }
        if (extra) { errorCategories['多写字母'].count++; errorCategories['多写字母'].examples.push(example); }
        if (swapped) { errorCategories['顺序颠倒'].count++; errorCategories['顺序颠倒'].examples.push(example); }
      });
      
      // 生成相似词建议
      var allWrongWords = spellErrors.map(function(e){return e.en;}).filter(Boolean);
      var vocabSource = getDashboardVocabSource ? getDashboardVocabSource() : [];
      
      function findSimilarWords(target, pool, count) {
        if (!target || !pool.length) return [];
        var scored = pool.map(function(w){
          var score = 0;
          var t = target.toLowerCase(), wt = w.toLowerCase();
          for (var i = 0; i < Math.min(t.length, wt.length); i++) {
            if (t[i] === wt[i]) score++;
          }
          var lenDiff = Math.abs(t.length - wt.length);
          return {word:w, score:score - lenDiff};
        });
        scored.sort(function(a,b){return b.score - a.score;});
        return scored.slice(1, count+1).map(function(s){return s.word;});
      }
      
      html += '<div style="max-height:400px;overflow-y:auto;">';
      Object.keys(errorCategories).forEach(function(cat) {
        var data = errorCategories[cat];
        if (data.count === 0) return;
        html += '<div style="margin:6px 16px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;">';
        html += '<div style="color:#ffd700;font-weight:bold;margin-bottom:4px;">' + cat + ': <span style="color:#fff;">' + data.count + '次</span></div>';
        html += '<div style="color:rgba(255,255,255,0.5);font-size:0.8rem;">';
        data.examples.slice(0,3).forEach(function(ex){ html += ex + '&nbsp;&nbsp;'; });
        html += '</div>';
        
        // 相似词建议
        if (allWrongWords.length > 0 && cat !== '漏写字母' && cat !== '多写字母') {
          var similar = findSimilarWords(allWrongWords[0], vocabSource, 3);
          if (similar.length) {
            html += '<div style="color:rgba(255,255,255,0.4);font-size:0.75rem;margin-top:4px;">⚠️ 可能混淆: ' + similar.join(', ') + '</div>';
          }
        }
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="padding:8px 16px;color:rgba(255,255,255,0.3);font-size:0.7rem;">共分析 ' + spellErrors.length + ' 条拼写错误</div>';
    }

  } else if (tab === 'trend') {
    // 学习趋势
    html = '<h3 style="color:#00e5ff;padding:0 16px;">学习趋势</h3>';
    html += '<p style="color:rgba(255,255,255,0.5);padding:0 16px;">近期答题记录变化</p>';
    var recent = entries.slice(-30);
    for (var i = Math.max(0, recent.length - 10); i < recent.length; i++) {
      var e = recent[i];
      html += '<div style="margin:2px 16px;color:rgba(255,255,255,0.6);font-size:0.85rem;">' + (e.isCorrect ? '✅' : '❌') + ' ' + (e.en || '') + ' - ' + (e.player || '') + '</div>';
    }

  } else if (tab === 'history') {
    // 历史记录
    html = '<h3 style="color:#c86bff;padding:0 16px;">历史记录</h3>';
    html += '<div style="max-height:350px;overflow-y:auto;">';
    entries.slice().reverse().slice(0, 50).forEach(function(e) {
      html += '<div style="margin:2px 16px;padding:6px;border-bottom:1px solid rgba(255,255,255,0.03);">';
      html += '<span style="color:' + (e.isCorrect ? '#00ff88' : '#ff6666') + ';">' + (e.isCorrect ? '✅' : '❌') + '</span> ';
      html += '<span style="color:#fff;">' + (e.en || '') + '</span> ';
      html += '<span style="color:rgba(255,255,255,0.4);">' + (e.zh || '') + '</span> ';
      html += '<span style="color:rgba(255,255,255,0.3);font-size:0.8rem;">' + (e.player || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';

  } else if (tab === 'profile') {
    // 学情画像
    html = '<h3 style="color:#ff9f43;padding:0 16px;">学情画像</h3>';
    html += '<p style="color:rgba(255,255,255,0.5);padding:0 16px;">综合学习能力评估（基于答题数据）</p>';
    var totalQ = entries.length;
    var totalCorrect = entries.filter(function(e){return e.isCorrect;}).length;
    var totalRate = totalQ > 0 ? Math.round(totalCorrect/totalQ*100) : 0;
    html += '<div style="margin:12px 16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;">';
    html += '<div style="color:#fff;">整体正确率: <span style="color:#00ff88;">' + totalRate + '%</span></div>';
    html += '<div style="color:rgba(255,255,255,0.5);font-size:0.85rem;">总答题: ' + totalQ + '次 | 正确: ' + totalCorrect + '次</div></div>';

  } else if (tab === 'data') {
    // 数据管理
    html = '<h3 style="color:#888;padding:0 16px;">数据管理</h3>';
    html += '<div style="margin:8px 16px;">';
    html += '<div style="color:rgba(255,255,255,0.6);margin-bottom:8px;">错题记录: ' + entries.length + ' 条</div>';
    html += '<button onclick="exportWrongBookData()" style="padding:8px 16px;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);border-radius:6px;color:#00e5ff;cursor:pointer;">📤 导出数据</button> ';
    html += '<button onclick="if(confirm(\'确定清除所有看板数据？\')){localStorage.removeItem(\'vocabPKWrongBook\');renderDashboard(\'data\');}" style="padding:8px 16px;background:rgba(255,68,68,0.15);border:1px solid rgba(255,68,68,0.3);border-radius:6px;color:#ff6666;cursor:pointer;">🗑️ 清除数据</button>';
    html += '</div>';
  }

  container.innerHTML = html || '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.5);">暂无数据</div>';
}

// ===== 错题本渲染 =====
function renderWrongBook(tab) {
  var container = document.getElementById('wrongbookContent');
  if (!container) return;
  
  switchWbTab(tab);
  
  var wb = getWrongBook();
  var entries = wb.entries || [];
  
  if (entries.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.5);">暂无错题记录，请先进行PK练习</div>';
    return;
  }
  
  var html = '<div style="padding:16px;">';
  html += '<h3 style="color:#ff8888;">错题记录 (' + entries.length + '条)</h3>';
  html += '<div style="max-height:400px;overflow-y:auto;">';
  var shown = entries.slice(-50).reverse(); // Show last 50
  shown.forEach(function(e) {
    var color = e.isCorrect ? '#00ff88' : '#ff6666';
    html += '<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);">' +
      '<span style="color:' + color + ';">' + (e.isCorrect ? '✅' : '❌') + '</span> ' +
      '<span style="color:#fff;">' + (e.en || '') + '</span> ' +
      '<span style="color:rgba(255,255,255,0.4);">' + (e.zh || '') + '</span> ' +
      '<span style="color:rgba(255,255,255,0.3);font-size:0.8rem;">' + (e.chapter || '') + '</span>' +
      '</div>';
  });
  html += '</div></div>';
  container.innerHTML = html;
}

// ============================================================
// AI增强集成层 - 接通创意层按钮 + 游戏层预生成 + 学情画像
// ============================================================

// ----- 通用工具 -----
function closeAIModal(id) {
  hideModal(id);
}

// ===== AI出卷（增强版：多题型+答案分离+导出） =====
var _testPaperData = null;

function showAITestPaper() {
  showModal('aiTestPaperModal');
  var select = document.getElementById('aiTestPaperClassFilter');
  if (!select) return;
  select.innerHTML = '<option value="">全部班级</option>';
  var classes = getAllClassesFromWrongBook();
  // 也从点名系统获取班级
  try {
    var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
    var data = JSON.parse(raw);
    Object.keys(data).forEach(function(cls) { if (!classes.includes(cls)) classes.push(cls); });
  } catch(e) {}
  classes.sort();
  classes.forEach(function(cls) {
    select.innerHTML += '<option value="' + cls + '">' + cls + '</option>';
  });
  // 重置学生选择器
  var studentSelect = document.getElementById('aiTestPaperStudentFilter');
  if (studentSelect) studentSelect.innerHTML = '<option value="">全班</option>';
}

function _getSelectedTestTypes() {
  var types = [];
  if (document.getElementById('tptype_choice') && document.getElementById('tptype_choice').checked) types.push('选择题');
  if (document.getElementById('tptype_fill') && document.getElementById('tptype_fill').checked) types.push('填空题');
  if (document.getElementById('tptype_translate') && document.getElementById('tptype_translate').checked) types.push('翻译题');
  if (document.getElementById('tptype_spell') && document.getElementById('tptype_spell').checked) types.push('拼写题');
  if (document.getElementById('tptype_cloze') && document.getElementById('tptype_cloze').checked) types.push('完形填空');
  return types.length > 0 ? types : ['选择题'];
}

function doGenerateTestPaper() {
  if (!isAIEnabled()) {
    document.getElementById('aiTestPaperBody').innerHTML = '<div style="text-align:center;padding:40px;color:#ff8888;">⚠️ 请先在AI设置中配置API</div>';
    return;
  }
  
  var body = document.getElementById('aiTestPaperBody');
  var answerArea = document.getElementById('aiTestPaperAnswer');
  body.innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">AI正在分析错题，生成多题型试卷...</div></div>';
  if (answerArea) answerArea.style.display = 'none';
  _testPaperData = null;
  
  // 隐藏所有操作按钮
  ['btnToggleAnswers','btnPrintTestPaper','btnExportWord','btnCopyPaper'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.style.display = 'none';
  });
  
  var select = document.getElementById('aiTestPaperClassFilter');
  var className = select ? select.value : '';
  var studentSelect = document.getElementById('aiTestPaperStudentFilter');
  var studentName = studentSelect ? studentSelect.value : '';
  var questionCount = parseInt(document.getElementById('aiTestPaperCount') ? document.getElementById('aiTestPaperCount').value : '15');
  var types = _getSelectedTestTypes();
  var typesStr = types.join('、');
  
  // 收集错词（按班级+学生筛选）
  var wrongWords = _collectWrongWords(className || '', studentName || '');
  
  var targetDesc = studentName || className || '全部班级';
  
  // 构建高质量prompt
  var prompt = '你是一位资深英语教师。请根据以下学生错题数据，生成一份' + questionCount + '题的英语测试卷。\n\n' +
    '【学生信息】班级：' + targetDesc + '\n\n' +
    '【错词数据】（共' + wrongWords.length + '个错词，重点考查这些词汇）：\n';
  
  wrongWords.slice(0, 20).forEach(function(w, i) {
    prompt += (i + 1) + '. ' + w.en + ' - ' + w.zh + '\n';
  });
  
  prompt += '\n【要求】\n' +
    '1. 题型构成：' + typesStr + '，合理分配比例\n' +
    '2. 难度适配：针对学生错题水平出题\n' +
    '3. 输出格式：严格JSON，结构如下：\n' +
    '{\n' +
    '  "title": "试卷标题（含班级名）",\n' +
    '  "subtitle": "副标题（含题型说明）",\n' +
    '  "questions": [\n' +
    '    {\n' +
    '      "type": "选择题|填空题|翻译题|拼写题|完形填空（仅限这5个中文名称！不要用en2zh/fillblank等英文名）",\n' +
    '      "number": 1,\n' +
    '      "stem": "题干（填空处用____表示，完形填空给出完整短文并留空）",\n' +
    '      "options": ["A选项","B选项","C选项","D选项"],  // 仅选择题和完形填空需要\n' +
    '      "answer": "正确答案",\n' +
    '      "answerDetail": "答案解析（简短说明为什么）"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    '4. 所有题目必须基于提供的错词数据\n' +
    '5. 选择题的干扰项要精心设计，具有迷惑性\n' +
    '6. 词块/短语类题目的答案解析必须包含中文翻译，不能仅写"固定短语"或"固定搭配"等笼统表述';
  
  callAI(prompt, '你是资深英语教师，擅长出题。只输出JSON，不要任何额外文字。').then(function(raw) {
    var json = _parseAIJSON(raw);
    if (!json || !json.questions || !json.questions.length) {
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff6666;">AI返回格式异常，请重试<br><small>' + escapeHtml((raw || '').substring(0,200)) + '</small></div>';
      return;
    }
    _testPaperData = json;
    _renderTestPaper(json);
  }).catch(function(e) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#ff6666;">生成失败: ' + (e.message || 'AI服务异常') + '</div>';
  });
}

function _parseAIJSON(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) {}
  var m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch(e2) {}
  }
  return null;
}

function _renderTestPaper(data) {
  var body = document.getElementById('aiTestPaperBody');
  var answerArea = document.getElementById('aiTestPaperAnswer');
  if (!body) return;
  
  var html = '<div style="padding:16px;color:#fff;">';
  html += '<h3 style="color:#ff8888;text-align:center;margin-bottom:4px;">' + escapeHtml(data.title || 'AI智能出卷') + '</h3>';
  if (data.subtitle) html += '<div style="text-align:center;color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:12px;">' + escapeHtml(data.subtitle) + '</div>';
  
  var typeNames = { '选择题': '📋', '填空题': '✏️', '翻译题': '🌐', '拼写题': '🔤', '完形填空': '📰' };
  
  data.questions.forEach(function(q, i) {
    var qNum = q.number || (i + 1);
    var normalizedType = _normalizeTypeName(q.type);
    var typeEmoji = typeNames[normalizedType] || '❓';
    html += '<div style="margin:10px 0;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid ' + _getTypeColor(normalizedType) + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<span style="color:#ffd700;font-weight:bold;">' + qNum + '. ' + escapeHtml(q.stem || '') + '</span>';
    html += '<span style="font-size:0.7rem;color:rgba(255,255,255,0.3);">' + typeEmoji + ' ' + escapeHtml(normalizedType) + '</span>';
    html += '</div>';
    
    if (q.options && q.options.length) {
      html += '<div style="margin-top:4px;">';
      q.options.forEach(function(o, j) {
        var label = String.fromCharCode(65 + j);
        html += '<div style="margin:2px 0;color:rgba(255,255,255,0.75);font-size:0.9rem;">&nbsp;&nbsp;' + label + '. ' + escapeHtml(o) + '</div>';
      });
      html += '</div>';
    } else if (normalizedType === '填空题' || normalizedType === '拼写题') {
      html += '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;margin-top:4px;">&nbsp;&nbsp;___________</div>';
    } else if (normalizedType === '翻译题') {
      html += '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;margin-top:4px;">&nbsp;&nbsp;____________________</div>';
    }
    html += '</div>';
  });
  
  html += '<div style="text-align:center;padding:12px;color:rgba(255,255,255,0.3);font-size:0.85rem;">—— 本试卷由 AI 根据学生错题数据自动生成 ——</div>';
  html += '</div>';
  body.innerHTML = html;
  
  // 渲染答案区
  var answerHtml = '<div style="padding:16px;color:#fff;"><h4 style="color:#ffd700;margin-bottom:8px;">🔑 参考答案</h4>';
  data.questions.forEach(function(q, i) {
    var qNum = q.number || (i + 1);
    answerHtml += '<div style="margin:4px 0;font-size:0.9rem;">';
    answerHtml += '<span style="color:#00ff88;">' + qNum + '. </span>';
    answerHtml += '<span style="color:#fff;">' + escapeHtml(q.answer || '') + '</span>';
    if (q.answerDetail) {
      answerHtml += ' <span style="color:rgba(255,255,255,0.4);font-size:0.8rem;">(' + escapeHtml(q.answerDetail) + ')</span>';
    }
    answerHtml += '</div>';
  });
  answerHtml += '</div>';
  if (answerArea) answerArea.innerHTML = answerHtml;
  
  // 显示操作按钮
  ['btnToggleAnswers','btnPrintTestPaper','btnExportWord','btnCopyPaper'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.style.display = '';
  });
}

function _getTypeColor(type) {
  var colors = { '选择题': '#00e5ff', '填空题': '#ffd700', '翻译题': '#2ed573', '拼写题': '#ff6b6b', '完形填空': '#da70d6' };
  return colors[type] || '#888';
}

// 题型名标准化映射（AI可能返回各种名称）
function _normalizeTypeName(rawType) {
  if (!rawType) return '选择题';
  var t = rawType.toLowerCase().trim();
  // 英文变体
  if (t === 'en2zh' || t === 'zh2en' || t === 'choice' || t === 'mcq' || t === 'multiple choice' || t.indexOf('选择') >= 0 || t.indexOf('choice') >= 0) return '选择题';
  if (t === 'fillblank' || t === 'fill' || t === 'blank' || t === 'cloze' || t.indexOf('填空') >= 0 || t.indexOf('完形') >= 0) return '填空题';
  if (t === 'translate' || t === 'translation' || t.indexOf('翻译') >= 0) return '翻译题';
  if (t === 'spell' || t === 'spelling' || t.indexOf('拼写') >= 0) return '拼写题';
  if (t === 'cloze' || t === '完形' || t.indexOf('完形') >= 0) return '完形填空';
  // 根据内容判断
  if (t.indexOf('en2') >= 0 || t.indexOf('choose') >= 0 || t.indexOf('option') >= 0) return '选择题';
  return '选择题'; // 默认
}

function toggleTestPaperAnswers() {
  var area = document.getElementById('aiTestPaperAnswer');
  var btn = document.getElementById('btnToggleAnswers');
  if (!area) return;
  if (area.style.display === 'none' || !area.style.display) {
    area.style.display = 'block';
    if (btn) btn.textContent = '🙈 隐藏答案';
  } else {
    area.style.display = 'none';
    if (btn) btn.textContent = '🔑 显示答案';
  }
}

function printTestPaper() {
  if (!_testPaperData) return;
  var html = _buildPrintablePaper(false);
  var w = window.open('', '_blank', 'width=800,height=600');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI出卷</title>' +
    '<style>body{font-family:"Times New Roman",SimSun,serif;padding:30px;line-height:2;max-width:700px;margin:0 auto;}' +
    'h3{text-align:center;margin-bottom:4px;}h4{text-align:center;color:#666;font-weight:normal;margin-bottom:20px;}' +
    '.q{margin:14px 0;}.qn{font-weight:bold;}.qtype{color:#999;font-size:12px;}.opt{margin-left:20px;}' +
    '.blank{border-bottom:1px solid #000;min-width:60px;display:inline-block;}' +
    '.footer{text-align:center;color:#999;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:10px;}' +
    '@media print{body{padding:10px;}}</style></head><body>' + html + '</body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

function exportTestPaperWord() {
  if (!_testPaperData) return;
  var html = _buildPrintablePaper(false);
  var wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->' +
    '<style>body{font-family:"Times New Roman",SimSun;padding:30px;line-height:2;}h3{text-align:center;}h4{text-align:center;}' +
    '.q{margin:14px 0;}.qn{font-weight:bold;}.opt{margin-left:20px;}</style></head><body>' + html + '</body></html>';
  var blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (_testPaperData.title || 'AI出卷').replace(/[\\/:*?"<>|]/g,'_') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📄 Word文档已下载', 'success');
}

function copyTestPaper() {
  if (!_testPaperData) return;
  var text = _buildPrintableText(false);
  navigator.clipboard.writeText(text).then(function() {
    showToast('📋 试卷已复制到剪贴板', 'success');
  }).catch(function() {
    showToast('复制失败，请手动复制', 'wrong');
  });
}

function _buildPrintablePaper(includeAnswers) {
  var html = '';
  html += '<h3>' + escapeHtml(_testPaperData.title || '') + '</h3>';
  if (_testPaperData.subtitle) html += '<h4>' + escapeHtml(_testPaperData.subtitle) + '</h4>';
  html += '<div style="margin-bottom:10px;">姓名：__________&nbsp;&nbsp;&nbsp;&nbsp;班级：__________&nbsp;&nbsp;&nbsp;&nbsp;得分：__________</div>';
  
  _testPaperData.questions.forEach(function(q, i) {
    var qNum = q.number || (i + 1);
    html += '<div class="q"><span class="qn">' + qNum + '. </span>' + escapeHtml(q.stem || '');
    html += ' <span class="qtype">[' + escapeHtml(_normalizeTypeName(q.type)) + ']</span></div>';
    if (q.options) {
      q.options.forEach(function(o, j) {
        html += '<div class="opt">' + String.fromCharCode(65 + j) + '. ' + escapeHtml(o) + '</div>';
      });
    } else {
      html += '<div class="opt"><span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>';
    }
  });
  
  if (includeAnswers && _testPaperData.questions && _testPaperData.questions.length) {
    html += '<h3 style="margin-top:30px;border-top:2px dashed #ccc;padding-top:15px;">参考答案</h3>';
    _testPaperData.questions.forEach(function(q, i) {
      html += '<div class="q"><span class="qn">' + (q.number || (i+1)) + '. </span>' + escapeHtml(q.answer || '') + '</div>';
    });
  }
  
  html += '<div class="footer">—— 本试卷由 AI 根据学生错题数据自动生成 ——</div>';
  return html;
}

function _buildPrintableText(includeAnswers) {
  var text = '';
  text += (_testPaperData.title || '') + '\n' + (_testPaperData.subtitle || '') + '\n\n';
  text += '姓名：__________  班级：__________  得分：__________\n\n';
  
  _testPaperData.questions.forEach(function(q, i) {
    text += (q.number || (i+1)) + '. ' + (q.stem || '') + ' [' + _normalizeTypeName(q.type) + ']\n';
    if (q.options) {
      q.options.forEach(function(o, j) {
        text += '   ' + String.fromCharCode(65+j) + '. ' + o + '\n';
      });
    } else {
      text += '   _______________\n';
    }
    text += '\n';
  });
  
  if (includeAnswers) {
    text += '========== 参考答案 ==========\n\n';
    _testPaperData.questions.forEach(function(q, i) {
      text += (q.number || (i+1)) + '. ' + (q.answer || '') + '\n';
    });
  }
  
  text += '\n—— 本试卷由 AI 根据学生错题数据自动生成 ——\n';
  return text;
}

// ===== AI故事（增强版：故事+理解题+词汇表） =====
var _storyData = null;

function showAIStory() {
  showModal('aiStoryModal');
  document.getElementById('aiStoryQuiz').style.display = 'none';
  ['btnToggleQuiz','btnPrintStory','btnExportStoryWord'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.style.display = 'none';
  });
  // 初始化班级过滤器
  var select = document.getElementById('aiStoryClassFilter');
  if (select && select.options.length <= 1) {
    var classes = new Set();
    try {
      var wb = getWrongBook();
      (wb.entries || []).forEach(function(e) { if (e.className) classes.add(e.className); });
      var raw = localStorage.getItem('rollcall_classes_v2') || '{}';
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function(cls) { classes.add(cls); });
    } catch(e) {}
    Array.from(classes).sort().forEach(function(cls) {
      select.innerHTML += '<option value="' + cls + '">' + cls + '</option>';
    });
  }
  // 重置学生选择器
  var studentSelect = document.getElementById('aiStoryStudentFilter');
  if (studentSelect) studentSelect.innerHTML = '<option value="">全班</option>';
}

function doGenerateStory() {
  if (!isAIEnabled()) {
    document.getElementById('aiStoryBody').innerHTML = '<div style="text-align:center;padding:40px;color:#ff8888;">⚠️ 请先在AI设置中配置API</div>';
    return;
  }
  document.getElementById('aiStoryBody').innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">AI正在用错词编织故事...</div></div>';
  document.getElementById('aiStoryQuiz').style.display = 'none';
  _storyData = null;
  ['btnToggleQuiz','btnPrintStory','btnExportStoryWord'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.style.display = 'none';
  });
  
  var classSelect = document.getElementById('aiStoryClassFilter');
  var className = classSelect ? classSelect.value : '';
  var studentSelect = document.getElementById('aiStoryStudentFilter');
  var studentName = studentSelect ? studentSelect.value : '';
  
  var wrongWords = _collectWrongWords(className || '', studentName || '');
  if (wrongWords.length === 0) {
    document.getElementById('aiStoryBody').innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">暂无错题数据，请先完成几次PK练习</div>';
    return;
  }
  
  var wordList = wrongWords.slice(0, 10).map(function(w) { return w.en + '(' + w.zh + ')'; }).join(', ');
  
  var prompt = '你是一位英语教育故事作家。请用以下学生的错词创作一个约200词的英语小故事，并附带理解题和词汇表。\n\n' +
    '【必须使用的错词】：' + wordList + '\n\n' +
    '【要求】：\n' +
    '1. 故事用英语写，难度适合高中生，自然融入所有错词（用**粗体标记**错词）\n' +
    '2. 故事后附3道阅读理解选择题（英文题目+4个英文选项+答案）\n' +
    '3. 最后附词汇表：列出故事中出现的错词及其中文释义\n\n' +
    '【输出格式 - 严格JSON】：\n' +
    '{\n' +
    '  "title": "故事标题",\n' +
    '  "story": "故事正文（错词用**包裹，如**abandon**）",\n' +
    '  "storyZh": "故事中文大意（50字以内）",\n' +
    '  "quiz": [{"question":"问题","options":["A","B","C","D"],"answer":"正确答案","explanation":"解析"}],\n' +
    '  "wordList": [{"en":"单词","zh":"释义","sentence":"故事中的原句"}]\n' +
    '}';
  
  callAI(prompt, '你是英语教育故事作家。只输出JSON，不要任何额外文字。').then(function(raw) {
    var json = _parseAIJSON(raw);
    if (!json) {
      // 如果JSON解析失败，当作纯文本故事显示
      _renderStoryFallback(raw);
      return;
    }
    _storyData = json;
    _renderAIStory(json);
  }).catch(function(e) {
    document.getElementById('aiStoryBody').innerHTML = '<div style="text-align:center;padding:40px;color:#ff6666;">生成失败: ' + (e.message || 'AI服务异常') + '</div>';
  });
}

function _renderStoryFallback(raw) {
  document.getElementById('aiStoryBody').innerHTML = '<div style="padding:16px;color:#fff;line-height:2;font-size:1.05rem;">' + escapeHtml(raw).replace(/\n/g,'<br>') + '</div>';
}

function _renderAIStory(data) {
  var html = '<div style="padding:16px;">';
  
  // 标题
  html += '<h3 style="color:#2ed573;margin-bottom:4px;">' + escapeHtml(data.title || 'AI趣味故事') + '</h3>';
  if (data.storyZh) html += '<div style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:12px;">' + escapeHtml(data.storyZh) + '</div>';
  
  // 故事正文（高亮错词）
  var storyText = data.story || '';
  storyText = escapeHtml(storyText);
  storyText = storyText.replace(/\*\*([^*]+)\*\*/g, '<span style="color:#ffd700;font-weight:bold;background:rgba(255,215,0,0.15);padding:1px 4px;border-radius:3px;">$1</span>');
  html += '<div style="color:#fff;line-height:2;font-size:1rem;margin-bottom:16px;">' + storyText.replace(/\n/g,'<br>') + '</div>';
  
  // 词汇表
  if (data.wordList && data.wordList.length) {
    html += '<div style="margin-top:12px;padding:10px;background:rgba(46,213,115,0.06);border-radius:8px;">';
    html += '<div style="color:#2ed573;font-weight:bold;margin-bottom:6px;">📚 词汇表</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
    data.wordList.forEach(function(w) {
      html += '<div style="color:#fff;font-size:0.85rem;"><span style="color:#ffd700;">' + escapeHtml(w.en || '') + '</span> ' + escapeHtml(w.zh || '') + '</div>';
    });
    html += '</div></div>';
  }
  
  html += '</div>';
  document.getElementById('aiStoryBody').innerHTML = html;
  
  // 渲染理解题
  if (data.quiz && data.quiz.length) {
    var quizHtml = '<div style="padding:16px;color:#fff;"><h4 style="color:#ffd700;margin-bottom:8px;">📝 阅读理解</h4>';
    data.quiz.forEach(function(q, qi) {
      quizHtml += '<div style="margin:8px 0;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;">';
      quizHtml += '<div style="color:#fff;font-weight:bold;">' + (qi+1) + '. ' + escapeHtml(q.question || '') + '</div>';
      if (q.options) {
        q.options.forEach(function(o, oj) {
          var isAnswer = o === q.answer;
          quizHtml += '<div style="margin:2px 0;color:' + (isAnswer ? '#00ff88' : 'rgba(255,255,255,0.6)') + ';font-size:0.9rem;">';
          quizHtml += String.fromCharCode(65+oj) + '. ' + escapeHtml(o) + (isAnswer ? ' ✓' : '') + '</div>';
        });
      }
      if (q.explanation) quizHtml += '<div style="color:rgba(255,255,255,0.4);font-size:0.8rem;margin-top:4px;">' + escapeHtml(q.explanation) + '</div>';
      quizHtml += '</div>';
    });
    quizHtml += '</div>';
    document.getElementById('aiStoryQuiz').innerHTML = quizHtml;
  }
  
  ['btnToggleQuiz','btnPrintStory'].forEach(function(id) {
    var btn = document.getElementById(id); if (btn) btn.style.display = 'inline-block';
  });
}

function toggleStoryQuiz() {
  var area = document.getElementById('aiStoryQuiz');
  var btn = document.getElementById('btnToggleQuiz');
  if (!area) return;
  if (area.style.display === 'none' || !area.style.display) {
    area.style.display = 'block';
    if (btn) btn.textContent = '🙈 隐藏题目';
  } else {
    area.style.display = 'none';
    if (btn) btn.textContent = '📝 查看理解题';
  }
}

function printAIStory() {
  if (!_storyData) return;
  var html = _buildPrintableStory();
  var w = window.open('', '_blank', 'width=800,height=600');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI趣味故事</title>' +
    '<style>body{font-family:"Times New Roman",SimSun,serif;padding:30px;line-height:2;max-width:700px;margin:0 auto;}' +
    'h3{text-align:center;color:#333;}.vocab{font-weight:bold;color:#b8860b;}' +
    '@media print{body{padding:10px;}}</style></head><body>' + html + '</body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

function exportAIStoryWord() {
  if (!_storyData) return;
  var html = _buildPrintableStory();
  var wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->' +
    '<style>body{font-family:"Times New Roman",SimSun;padding:30px;line-height:2;}h3{text-align:center;}h4{text-align:center;}' +
    '.vocab{font-weight:bold;color:#b8860b;}table{border-collapse:collapse;}td,th{border:1px solid #ccc;padding:6px;}</style></head><body>' + html + '</body></html>';
  var blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (_storyData.title || 'AI趣味故事').replace(/[\\/:*?"<>|]/g,'_') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📝 Word文档已下载', 'success');
}

function _buildPrintableStory() {
  var html = '';
  html += '<h3>' + escapeHtml(_storyData.title || 'AI趣味故事') + '</h3>';
  if (_storyData.storyZh) html += '<div style="text-align:center;color:#666;">' + escapeHtml(_storyData.storyZh) + '</div>';
  
  var story = (_storyData.story || '').replace(/\*\*([^*]+)\*\*/g, '<span class="vocab">$1</span>');
  html += '<div style="margin:20px 0;">' + story.replace(/\n/g,'<br>') + '</div>';
  
  if (_storyData.wordList && _storyData.wordList.length) {
    html += '<h4>词汇表</h4><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">';
    html += '<tr><th>单词</th><th>释义</th></tr>';
    _storyData.wordList.forEach(function(w) {
      html += '<tr><td>' + escapeHtml(w.en || '') + '</td><td>' + escapeHtml(w.zh || '') + '</td></tr>';
    });
    html += '</table>';
  }
  
  if (_storyData.quiz && _storyData.quiz.length) {
    html += '<h4>阅读理解</h4>';
    _storyData.quiz.forEach(function(q, qi) {
      html += '<div style="margin:8px 0;"><b>' + (qi+1) + '. ' + escapeHtml(q.question || '') + '</b></div>';
      if (q.options) q.options.forEach(function(o, oj) {
        html += '<div>' + String.fromCharCode(65+oj) + '. ' + escapeHtml(o) + '</div>';
      });
    });
  }
  
  return html;
}

// ===== AI陪练 =====
var _aiOpponentLevel = 'medium';
var _aiOpponentTimer = null;

// 从错题本获取所有出现的词汇用于相似词推荐
function getDashboardVocabSource() {
  var words = [];
  var wb = getWrongBook();
  if (wb && wb.entries) {
    var seen = {};
    wb.entries.forEach(function(e) {
      if (e.en && !seen[e.en.toLowerCase()]) {
        seen[e.en.toLowerCase()] = true;
        words.push(e.en);
      }
    });
  }
  return words;
}

function showAIOpponent() {
  showModal('aiOpponentModal');
}

function startAIOpponent(level) {
  _aiOpponentLevel = level;
  hideModal('aiOpponentModal');
  
  var correctRate = level === 'easy' ? 0.6 : (level === 'medium' ? 0.8 : 0.95);
  var delayMin = level === 'easy' ? 1500 : (level === 'medium' ? 800 : 400);
  var delayMax = level === 'easy' ? 3500 : (level === 'medium' ? 2500 : 1200);
  
  window._aiOpponentActive = true;
  window._aiOpponentRate = correctRate;
  window._aiOpponentDelayMin = delayMin;
  window._aiOpponentDelayMax = delayMax;
  
  // 强制切换到抢答模式（设置全局变量 selectedGameMode）
  selectedGameMode = 'race';
  
  // 初始化抢答模式状态
  gameState.mode = 'race';
  gameState.race = gameState.race || {};
  gameState.race.transitioning = false;
  gameState.race.questionTimer = null;
  gameState.race.questionAnswered = [false, false];
  
  // 调用标准startGame——它会读取selectedGameMode走抢答分支
  startGame();
  
  // 更新UI标识（等UI渲染完）
  setTimeout(function() {
    var p2Label = document.getElementById('p2Label');
    if (p2Label) {
      var names = { easy: 'AI初级', medium: 'AI中级', hard: 'AI高级' };
      p2Label.textContent = '🤖 ' + (names[level] || 'AI陪练');
    }
    var p1Label = document.getElementById('p1Label');
    if (p1Label) p1Label.textContent = '👤 你';
  }, 500);
}

// 停止AI陪练
function stopAIOpponent() {
  window._aiOpponentActive = false;
  clearTimeout(_aiOpponentTimer);
  _aiOpponentTimer = null;
  gameState.aiOpponent = null;
}
var _origRenderRaceQuestion = null;

// AI自动答题hook - 在字体渲染后延迟执行
function _aiOpponentPlay() {
  if (!window._aiOpponentActive) return;
  if (!gameState || !gameState.race || gameState.race.transitioning) return;
  if (gameState.race.questionAnswered && gameState.race.questionAnswered[1]) return;
  
  var options2 = gameState.race.options2 || gameState.race.currentOptions || [];
  if (!options2.length) return;
  
  // 找到正确答案索引（在P2的shuffled选项中）
  var correctIndex = -1;
  for (var i = 0; i < options2.length; i++) {
    if (options2[i].correct) { correctIndex = i; break; }
  }
  if (correctIndex === -1) return;
  
  // 决定AI是否答对
  var willBeCorrect = Math.random() < window._aiOpponentRate;
  var chosenIndex;
  
  if (willBeCorrect) {
    chosenIndex = correctIndex;
  } else {
    // 随机选一个错误选项
    var wrongIndices = [];
    for (var j = 0; j < options2.length; j++) {
      if (j !== correctIndex) wrongIndices.push(j);
    }
    chosenIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
  }
  
  // 随机延迟后点击
  var minD = window._aiOpponentDelayMin || 800;
  var maxD = window._aiOpponentDelayMax || 2500;
  var delay = minD + Math.random() * (maxD - minD);
  
  _aiOpponentTimer = setTimeout(function() {
    if (!window._aiOpponentActive) return;
    if (gameState.race.transitioning) return;
    if (gameState.race.questionAnswered[1]) return; // P2 already answered
    
    // 调用handleRaceAnswer来模拟点击
    if (typeof handleRaceAnswer === 'function') {
      handleRaceAnswer(chosenIndex, 1);
    }
  }, delay);
}

// After: renderRaceQuestion is called, trigger AI opponent play
// We'll hook this in the game override section

// ===== 游戏层预生成触发 =====
// 保存原始函数引用
var _origStartGame = startGame;
var _origGenerateRaceOptions = typeof generateRaceOptions === 'function' ? generateRaceOptions : null;
var _origGenerateChunkQuestion = typeof generateChunkQuestion === 'function' ? generateChunkQuestion : null;
var _origRenderChunkQuestion = typeof renderChunkQuestion === 'function' ? renderChunkQuestion : null;

// 重写startGame: 在游戏开始时触发背景预生成
startGame = function() {
  // 调用原始startGame
  var result = _origStartGame.apply(this, arguments);
  
  // 背景预生成（不阻塞游戏）
  if (typeof pregenAllGameData === 'function' && isAIEnabled()) {
    setTimeout(function() {
      _gameLog('开始后台预生成AI游戏数据...');
      pregenAllGameData(function(info) {
        _gameLog('预生成进度: ' + (info.current || '') + '/' + (info.total || '') + ' ' + (info.status || ''));
      }).then(function() {
        _gameLog('预生成完成，后续游戏将使用AI增强数据');
      }).catch(function() {
        _gameLog('预生成部分失败，游戏使用本地数据');
      });
    }, 200);
  }
  
  return result;
};

// 重写endGame: AI陪练清理 + 容错保护
if (typeof endGame === 'function') {
  var _origEndGame = endGame;
  endGame = function() {
    // 清理AI陪练状态（安全调用）
    try { stopAIOpponent(); } catch(e) {}
    // 调用原始endGame
    try {
      return _origEndGame.apply(this, arguments);
    } catch(e) {
      console.error('[AI-Features] endGame error:', e);
      // 即使原始endGame失败，也尝试显示结果屏幕并填充基本信息
      try {
        if (!gameState.gameOver) gameState.gameOver = true;
        var p1Name = gameState.p1Name || (selectedPlayers && selectedPlayers[0]) || '选手1';
        var p2Name = gameState.p2Name || (selectedPlayers && selectedPlayers[1]) || '选手2';
        var p1Score = gameState.p1Score || 0;
        var p2Score = gameState.p2Score || 0;
        var rp1 = document.getElementById('resultP1Name');
        var rp2 = document.getElementById('resultP2Name');
        var rs1 = document.getElementById('resultP1Score');
        var rs2 = document.getElementById('resultP2Score');
        var wn = document.getElementById('winnerName');
        var ws = document.getElementById('winnerScore');
        if (rp1) rp1.textContent = p1Name;
        if (rp2) rp2.textContent = p2Name;
        if (rs1) rs1.textContent = p1Score.toFixed(1);
        if (rs2) rs2.textContent = p2Score.toFixed(1);
        var p1Win = p1Score > p2Score;
        if (wn) wn.textContent = p1Win ? p1Name : (p2Score > p1Score ? p2Name : '平局！');
        if (ws) ws.textContent = (p1Win || p2Score > p1Score) ? Math.max(p1Score, p2Score).toFixed(1) + ' 分' : '双方 ' + p1Score.toFixed(1) + ' 分';
        showScreen('screen-result');
      } catch(e2) {}
    }
  };
}

// generateRaceOptions: 直通原始函数
if (_origGenerateRaceOptions) {
  generateRaceOptions = _origGenerateRaceOptions;
}

// renderRaceQuestion: 直通原始函数
if (_origRenderRaceQuestion) {
  renderRaceQuestion = _origRenderRaceQuestion;
}

// renderChunkQuestion + handleRaceAnswer: 直通原始函数
if (_origRenderChunkQuestion) {
  renderChunkQuestion = _origRenderChunkQuestion;
}

// 增强学情画像 - 接入AI
var _origRenderDashboard = typeof renderDashboard === 'function' ? renderDashboard : null;
if (_origRenderDashboard) {
  renderDashboard = function(tab) {
    _origRenderDashboard(tab);
    // 如果切换到学情画像tab且有AI，加载AI分析
    if (tab === 'profile' && isAIEnabled() && typeof generateAILearningPortrait === 'function') {
      setTimeout(function() {
        var container = document.getElementById('dashContent');
        if (!container) return;
        var loadingDiv = document.createElement('div');
        loadingDiv.id = 'aiPortraitLoading';
        loadingDiv.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(255,255,255,0.5);">🤖 AI正在分析学情画像...</div>';
        container.appendChild(loadingDiv);
        
        var entries = (getWrongBook().entries || []);
        var players = {};
        entries.forEach(function(e) {
          var p = e.player || '未知';
          if (!players[p]) players[p] = { total: 0, correct: 0 };
          players[p].total++;
          if (e.isCorrect) players[p].correct++;
        });
        var playerNames = Object.keys(players).sort(function(a,b) { return players[b].total - players[a].total; });
        if (playerNames.length > 0) {
          generateAILearningPortrait(playerNames[0]).then(function(portrait) {
            var el = document.getElementById('aiPortraitLoading');
            if (el) {
              el.innerHTML = '<div style="margin:12px 16px;padding:12px;background:rgba(255,159,67,0.08);border:1px solid rgba(255,159,67,0.25);border-radius:8px;color:rgba(255,255,255,0.85);line-height:1.8;font-size:0.9rem;">' + portrait.replace(/\n/g, '<br>') + '</div>';
            }
          }).catch(function() {
            var el = document.getElementById('aiPortraitLoading');
            if (el) el.innerHTML = '';
          });
        }
      }, 100);
    }
  };
}

// 增强智能练习 - 接入AI出题
var _origShowAIAdaptiveQuiz = typeof showAIAdaptiveQuiz === 'function' ? showAIAdaptiveQuiz : null;
if (_origShowAIAdaptiveQuiz) {
  showAIAdaptiveQuiz = function() {
    // 如果AI可用且有增强模块，使用AI出题
    if (isAIEnabled() && typeof aiBuildQuizQuestions === 'function') {
      showModal('aiAdaptiveModal');
      var body = document.getElementById('aiAdaptiveBody');
      if (!body) return;
      body.innerHTML = '<div class="ai-analysis-loading"><div class="ai-loading-spinner"></div><div class="ai-loading-text">AI正在分析错题，生成个性化练习...</div></div>';
      
      var wb = getWrongBook();
      var wrongWords = [];
      if (wb && wb.entries) {
        var seen = {};
        wb.entries.slice(-100).forEach(function(e) {
          if (!e.isCorrect && e.en && !seen[e.en.toLowerCase()]) {
            seen[e.en.toLowerCase()] = true;
            wrongWords.push({ en: e.en, zh: e.zh || '' });
          }
        });
      }
      if (wrongWords.length === 0) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">暂无错题，请先进行PK练习</div>';
        return;
      }
      
      aiBuildQuizQuestions(wrongWords.slice(0, 10)).then(function(questions) {
        _renderAIAdaptiveQuiz(questions);
      }).catch(function(e) {
        // AI失败→回退本地出题
        if (_origShowAIAdaptiveQuiz) _origShowAIAdaptiveQuiz();
      });
      return;
    }
    // 无AI时走原流程
    if (_origShowAIAdaptiveQuiz) _origShowAIAdaptiveQuiz();
  };
}

// 渲染AI增强的智能练习题
var _adaptiveQuizQuestions = [];
var _adaptiveQuizIndex = 0;
var _adaptiveQuizScore = 0;

function _renderAIAdaptiveQuiz(questions) {
  _adaptiveQuizQuestions = questions;
  _adaptiveQuizIndex = 0;
  _adaptiveQuizScore = 0;
  _renderAdaptiveQuestionAI();
}

function _renderAdaptiveQuestionAI() {
  var body = document.getElementById('aiAdaptiveBody');
  if (!body) return;
  if (_adaptiveQuizIndex >= _adaptiveQuizQuestions.length) {
    _renderAdaptiveResultAI();
    return;
  }
  var q = _adaptiveQuizQuestions[_adaptiveQuizIndex];
  var html = '<div style="padding:16px;">';
  html += '<div style="color:rgba(255,255,255,0.5);font-size:0.8rem;margin-bottom:8px;">第 ' + (_adaptiveQuizIndex + 1) + '/' + _adaptiveQuizQuestions.length + ' 题</div>';
  html += '<div style="color:#fff;font-size:1.1rem;margin-bottom:16px;line-height:1.6;">' + (q.stem || q.question || '') + '</div>';
  if (q.options && q.options.length) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    q.options.forEach(function(opt, i) {
      var label = String.fromCharCode(65 + i);
      html += '<button onclick="submitAdaptiveAnswerAI(' + i + ')" style="padding:12px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);border-radius:8px;color:#fff;cursor:pointer;text-align:left;font-size:0.95rem;">' + label + '. ' + opt + '</button>';
    });
    html += '</div>';
  }
  if (q.explanation) {
    html += '<div id="adaptiveExplainArea" style="display:none;margin-top:12px;padding:10px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:8px;color:#ffd700;font-size:0.9rem;line-height:1.6;"></div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

function submitAdaptiveAnswerAI(optionIndex) {
  var q = _adaptiveQuizQuestions[_adaptiveQuizIndex];
  if (!q) return;
  var isCorrect = (q.answerIndex === optionIndex) || (q.answer === q.options[optionIndex]);
  
  if (isCorrect) {
    _adaptiveQuizScore++;
  }
  
  // 高亮正确/错误
  var buttons = document.getElementById('aiAdaptiveBody').querySelectorAll('button');
  buttons.forEach(function(btn, i) {
    btn.disabled = true;
    if (i === optionIndex) {
      btn.style.background = isCorrect ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)';
      btn.style.borderColor = isCorrect ? '#00ff88' : '#ff4444';
    }
    if (q.answerIndex !== undefined && i === q.answerIndex) {
      btn.style.background = 'rgba(0,255,136,0.1)';
      btn.style.borderColor = '#00ff88';
    }
  });
  
  // 显示解释
  if (q.explanation) {
    var explainArea = document.getElementById('adaptiveExplainArea');
    if (explainArea) {
      explainArea.style.display = 'block';
      explainArea.textContent = (isCorrect ? '✅ 回答正确！' : '❌ ') + q.explanation;
    }
  }
  
  // 自动下一题
  _adaptiveQuizIndex++;
  setTimeout(function() { _renderAdaptiveQuestionAI(); }, 1500);
}

function _renderAdaptiveResultAI() {
  var body = document.getElementById('aiAdaptiveBody');
  if (!body) return;
  var total = _adaptiveQuizQuestions.length;
  var pct = total > 0 ? Math.round(_adaptiveQuizScore / total * 100) : 0;
  var html = '<div style="padding:16px;text-align:center;">';
  html += '<div style="font-size:3rem;margin-bottom:8px;">' + (pct >= 80 ? '🎉' : (pct >= 60 ? '👍' : '💪')) + '</div>';
  html += '<div style="color:#fff;font-size:1.5rem;margin-bottom:4px;">' + _adaptiveQuizScore + '/' + total + '</div>';
  html += '<div style="color:rgba(255,255,255,0.5);margin-bottom:16px;">正确率 ' + pct + '%</div>';
  // 仍需加强的单词
  var stillWeak = [];
  _adaptiveQuizQuestions.forEach(function(q) {
    if (q.word && stillWeak.indexOf(q.word) === -1) stillWeak.push(q.word);
  });
  if (stillWeak.length > 0) {
    html += '<div style="color:rgba(255,255,255,0.6);font-size:0.85rem;">需继续加强: ' + stillWeak.slice(0,10).join('、') + '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

// ===== 调试日志 =====
function _gameLog(msg) {
  try {
    if (localStorage.getItem('ai_debug_mode') === '1') {
      console.log('[AI-Features-Game] ' + msg);
    }
  } catch(e) {}
}

console.log('[AI Features] 增强集成层已加载（AI出卷/故事/陪练 + 游戏预生成 + 学情画像 + 智能练习AI出题）');

// ===== 初始化 =====
(function init() {
  updateAIStatus();
})();
