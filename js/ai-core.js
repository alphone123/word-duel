// ============================================================
// ai-core.js - AI基础设施
// 提供：缓存(LRU)、批量预生成、优雅降级包装器
// 依赖：ai-features.js 中的 callAI()、getAIConfig()
// ============================================================
(function() {
  'use strict';
  console.log('[AI-Core] 模块已加载');

  // ===== 调试日志 =====
  function _aiLog(msg) {
    try {
      if (localStorage.getItem('ai_debug_mode') === '1') {
        console.log('[AI-Core] ' + msg);
      }
    } catch(e) {}
  }

  // ===== AI可用性检查 =====
  // 返回 true 当且仅当 AI已启用 且 apiKey已配置
  window.isAIEnabled = function() {
    try {
      if (typeof getAIConfig !== 'function') return false;
      var config = getAIConfig();
      return !!(config && config.enabled && config.apiKey && config.apiKey.length > 0);
    } catch(e) {
      return false;
    }
  };

  // ===== LRU缓存管理 =====
  // 缓存结构: { "prefix:key": { data: ..., ts: 时间戳 }, ... }
  // localStorage key: 'ai_cache'
  // 自动淘汰：7天过期，最多500条

  function _loadCache() {
    try {
      var raw = localStorage.getItem('ai_cache');
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch(e) {
      return {};
    }
  }

  function _saveCache(cache) {
    try {
      localStorage.setItem('ai_cache', JSON.stringify(cache));
    } catch(e) {
      // localStorage 满了，删除一半旧条目
      _evictHalf();
    }
  }

  function _evictHalf() {
    try {
      var cache = _loadCache();
      var keys = Object.keys(cache);
      if (keys.length === 0) return;
      // 按时间戳升序排列(旧的在前)
      keys.sort(function(a, b) {
        return (cache[a].ts || 0) - (cache[b].ts || 0);
      });
      // 删除前半部分(最旧的)
      var removeCount = Math.ceil(keys.length / 2);
      for (var i = 0; i < removeCount; i++) {
        delete cache[keys[i]];
      }
      localStorage.setItem('ai_cache', JSON.stringify(cache));
      _aiLog('缓存淘汰：删除' + removeCount + '条旧记录');
    } catch(e) {
      // 最后的fallback：清空全部缓存
      try { localStorage.removeItem('ai_cache'); } catch(e2) {}
    }
  }

  // 读取缓存，自动处理过期
  window.aiCacheGet = function(key) {
    var cache = _loadCache();
    var entry = cache[key];
    if (!entry || !entry.data) return null;

    // 检查过期（7天 = 604800000ms）
    var now = Date.now();
    var maxAge = 7 * 24 * 60 * 60 * 1000;
    if (now - (entry.ts || 0) > maxAge) {
      delete cache[key];
      _saveCache(cache);
      _aiLog('缓存过期: ' + key);
      return null;
    }

    // 更新时间戳（LRU访问）
    entry.ts = now;
    cache[key] = entry;
    _saveCache(cache);
    _aiLog('缓存命中: ' + key + ', 耗时: 0ms');
    return entry.data;
  };

  // 写入缓存，自动触发LRU淘汰
  window.aiCacheSet = function(key, data) {
    if (!key || data === undefined || data === null) return;
    var cache = _loadCache();
    var keys = Object.keys(cache);

    // LRU淘汰：超过500条时删除最旧的
    if (keys.length >= 500) {
      var oldestKey = null;
      var oldestTs = Infinity;
      for (var k in cache) {
        if (cache.hasOwnProperty(k)) {
          var ts = cache[k].ts || 0;
          if (ts < oldestTs) {
            oldestTs = ts;
            oldestKey = k;
          }
        }
      }
      if (oldestKey) {
        delete cache[oldestKey];
      }
    }

    cache[key] = {
      data: data,
      ts: Date.now()
    };
    _saveCache(cache);
    _aiLog('缓存写入: ' + key);
  };

  // 清除指定前缀的缓存
  window.aiCacheClear = function(prefix) {
    var cache = _loadCache();
    var count = 0;
    for (var k in cache) {
      if (cache.hasOwnProperty(k) && k.indexOf(prefix) === 0) {
        delete cache[k];
        count++;
      }
    }
    _saveCache(cache);
    _aiLog('缓存清除: ' + prefix + ' (' + count + '条)');
    return count;
  };

  // 获取缓存统计
  window.aiCacheStats = function() {
    var cache = _loadCache();
    var keys = Object.keys(cache);
    var prefixes = {};
    keys.forEach(function(k) {
      var p = k.split(':')[0] || 'other';
      if (!prefixes[p]) prefixes[p] = 0;
      prefixes[p]++;
    });
    return { total: keys.length, byPrefix: prefixes };
  };

  // ===== 优雅降级包装器 =====
  // 如果AI可用则调callAI(prompt)，失败/关闭则执行fallbackFn()
  // 返回 Promise（统一异步接口）
  // options: { systemPrompt, cacheKey, parseJSON }
  window.aiOrFallback = function(prompt, fallbackFn, options) {
    options = options || {};
    var systemPrompt = options.systemPrompt || '';
    var cacheKey = options.cacheKey || '';
    var parseJSON = options.parseJSON || false;

    // 步骤1：检查缓存
    if (cacheKey) {
      var cached = window.aiCacheGet(cacheKey);
      if (cached !== null) {
        return Promise.resolve(cached);
      }
    }

    // 步骤2：AI不可用，直接走fallback
    if (!window.isAIEnabled()) {
      _aiLog('AI未启用，使用本地fallback');
      return _wrapFallback(fallbackFn);
    }

    // 步骤3：调用AI
    _aiLog('API调用: ' + prompt.substring(0, 80) + '...');
    var startTime = Date.now();

    // callAI 来自 ai-features.js，是 async 函数
    return callAI(prompt, systemPrompt)
      .then(function(result) {
        var elapsed = Date.now() - startTime;
        _aiLog('API调用完成, 耗时: ' + elapsed + 'ms');

        // 写入缓存
        if (cacheKey) {
          window.aiCacheSet(cacheKey, result);
        }

        // 尝试JSON解析
        if (parseJSON) {
          try {
            var jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
          } catch(e) {
            _aiLog('JSON解析失败，返回原始结果');
          }
        }

        return result;
      })
      .catch(function(e) {
        var elapsed = Date.now() - startTime;
        _aiLog('API调用失败 (' + elapsed + 'ms): ' + e.message + ', 降级到本地fallback');
        return _wrapFallback(fallbackFn);
      });
  };

  // 包装fallback函数为Promise
  function _wrapFallback(fallbackFn) {
    try {
      var result = fallbackFn();
      // 如果fallback返回Promise，保持异步
      if (result && typeof result.then === 'function') {
        return result;
      }
      return Promise.resolve(result);
    } catch(e) {
      return Promise.reject(e);
    }
  }

  // ===== 批量预生成 =====
  // 对一批items调用AI预生成+写入缓存
  // items: [{ cacheSuffix: '...', ... }]
  // promptTemplate: 字符串模板或 function(item) 返回prompt
  // cachePrefix: 缓存键前缀
  // options: { concurrency, systemPrompt, onProgress }
  window.pregenBatch = function(items, promptTemplate, cachePrefix, options) {
    options = options || {};
    var concurrency = options.concurrency || 3;
    var onProgress = options.onProgress || null;
    var systemPrompt = options.systemPrompt || '';

    if (!items || items.length === 0) {
      return Promise.resolve({ total: 0, generated: 0, skipped: 0, failed: 0 });
    }

    if (!window.isAIEnabled()) {
      _aiLog('AI未启用，跳过批量预生成(' + items.length + '项)');
      return Promise.resolve({ total: items.length, generated: 0, skipped: items.length, failed: 0 });
    }

    // 过滤掉已缓存的项
    var pending = [];
    for (var i = 0; i < items.length; i++) {
      var cacheKey = cachePrefix + ':' + (items[i].cacheSuffix || '');
      var cached = window.aiCacheGet(cacheKey);
      if (cached === null) {
        pending.push(items[i]);
      }
    }

    if (pending.length === 0) {
      _aiLog('所有' + items.length + '项已缓存，跳过预生成');
      return Promise.resolve({ total: items.length, generated: 0, skipped: items.length, failed: 0 });
    }

    _aiLog('批量预生成开始: 共' + items.length + '项, 待生成' + pending.length + '项, 并发' + concurrency);

    var totalPending = pending.length;
    var completed = 0;
    var successCount = 0;
    var failCount = 0;

    function buildPrompt(item) {
      if (typeof promptTemplate === 'function') {
        return promptTemplate(item);
      }
      // 简单模板替换
      return promptTemplate.replace(/\{(\w+)\}/g, function(match, key) {
        return (item[key] !== undefined) ? String(item[key]) : match;
      });
    }

    function processBatch() {
      if (pending.length === 0) {
        return Promise.resolve();
      }
      var batch = pending.splice(0, concurrency);
      var batchPromises = [];

      for (var b = 0; b < batch.length; b++) {
        (function(item) {
          var prompt = buildPrompt(item);
          var cacheKey = cachePrefix + ':' + (item.cacheSuffix || '');

          var p = callAI(prompt, systemPrompt)
            .then(function(result) {
              window.aiCacheSet(cacheKey, result);
              successCount++;
              completed++;
              if (onProgress) {
                onProgress(completed, totalPending, successCount, failCount);
              }
              return { item: item, success: true, result: result };
            })
            .catch(function(e) {
              failCount++;
              completed++;
              _aiLog('预生成失败: ' + cacheKey + ', ' + e.message);
              if (onProgress) {
                onProgress(completed, totalPending, successCount, failCount);
              }
              return { item: item, success: false, error: e.message };
            });

          batchPromises.push(p);
        })(batch[b]);
      }

      return Promise.all(batchPromises).then(function() {
        if (pending.length > 0) {
          return processBatch();
        }
        return Promise.resolve();
      });
    }

    return processBatch().then(function() {
      _aiLog('批量预生成完成: ' + successCount + '/' + totalPending + ' 成功, ' + failCount + ' 失败');
      return {
        total: items.length,
        generated: successCount,
        skipped: items.length - totalPending,
        failed: failCount
      };
    });
  };

  // ===== 预生成所有游戏数据（便捷方法） =====
  // 收集VOCAB_DATA中的所有词汇，批量预生成难度、混淆选项、拼写变体
  window.pregenAllGameData = function(onProgress) {
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
              if (!Array.isArray(partData)) return;
              partData.forEach(function(item) {
                if (item.word) {
                  var zhText = (item.meaning || '').replace(/^(n\.|v\.|adj\.|adv\.|pron\.|prep\.|conj\.|interj\.|num\.|det\.|abbr\.|\/.*?\/|\s*[,，].*)/gi, '').trim();
                  allVocab.push({ en: item.word, zh: zhText });
                }
              });
            });
          });
        });
      }
    } catch(e) {}

    if (allVocab.length === 0) {
      return Promise.resolve({ total: 0, message: '无词汇数据' });
    }

    _aiLog('收集到' + allVocab.length + '个词汇用于预生成');

    // 预生成难度分级
    var diffItems = allVocab.map(function(v) {
      return {
        cacheSuffix: (v.en || '').toLowerCase(),
        word: v.en || '',
        meaning: v.zh || ''
      };
    });

    return window.pregenBatch(
      diffItems,
      function(item) {
        return '评估英语词汇"' + item.word + '"(意思:"' + item.meaning + '")的难度，只返回1-5的数字。' +
          '标准：1=小学词汇(3-4字母常见词)，2=初中基础词，3=高中常用词，4=较难词汇(学术/抽象)，5=高难度词汇(罕见/专业)。';
      },
      'difficulty',
      { systemPrompt: '你是英语教学难度评估专家，严格按标准评估。只返回1-5的数字。', concurrency: 3, onProgress: onProgress }
    );
  };

  console.log('[AI-Core] 基础设施就绪 (isAIEnabled/aiOrFallback/aiCacheGet/aiCacheSet/pregenBatch)');
})();
