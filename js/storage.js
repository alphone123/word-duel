/**
 * storage.js - 本地/服务器存储统一接口
 * 安全版本：不覆盖 window.localStorage，避免浏览器兼容性问题
 * 用法：window._storage.get(key) / .set(key, value) / .remove(key)
 * 直接 localStorage 调用仍然有效（原生），服务器同步通过 _storage 接口显式调用
 */
(function () {
  'use strict';

  const SERVER_PORT = 18964;
  const BASE = 'http://localhost:' + SERVER_PORT + '/api';

  // 检测是否运行在本地服务器上（端口匹配）
  var IS_SERVER_MODE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    && String(location.port) === String(SERVER_PORT);

  // 保留原生 localStorage 引用
  var _native = window.localStorage;

  // 内存缓存（仅服务器模式使用）
  var _memCache = {};

  // 预热缓存：从服务器拉取最新数据写入 localStorage
  function warmCache() {
    if (!IS_SERVER_MODE) return;

    var KEYS = [
      'vocabPKLeaderboard', 'vocabPKGameRecords', 'vocabPKReviewSchedule',
      'vocabPKWrongBook', 'rollcall_classes_v2', 'vocabPK_autosave',
      'vocabPKAutoBackup'
    ];

    KEYS.forEach(function (key) {
      // 先读本地缓存，避免首次读取阻塞
      try {
        var raw = _native.getItem(key);
        if (raw) _memCache[key] = JSON.parse(raw);
      } catch (e) { /* ignore */ }

      // 异步拉取服务器最新数据
      fetch(BASE + '/' + key)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.data !== undefined && j.data !== null) {
            _memCache[key] = j.data;
            try { _native.setItem(key, JSON.stringify(j.data)); } catch (e) { /* ignore */ }
          }
        })
        .catch(function () { /* ignore */ });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', warmCache);
  } else {
    warmCache();
  }

  // ── 统一存储接口（async）────────────────────────────────────
  async function storageGet(key) {
    if (!IS_SERVER_MODE) {
      try { return JSON.parse(_native.getItem(key)); } catch (e) { return null; }
    }
    // 服务器模式：优先返回内存缓存
    if (_memCache[key] !== undefined) return _memCache[key];
    try {
      var r = await fetch(BASE + '/' + key);
      var j = await r.json();
      _memCache[key] = j.data;
      return j.data;
    } catch (e) {
      try { return JSON.parse(_native.getItem(key)); } catch (_) { return null; }
    }
  }

  async function storageSet(key, value) {
    _memCache[key] = value;
    // 始终写入 localStorage（作为缓存/降级）
    try { _native.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    if (!IS_SERVER_MODE) return;
    try {
      await fetch(BASE + '/' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      });
    } catch (e) {
      console.warn('[storage] 服务器写入失败（已降级 localStorage）:', key);
    }
  }

  async function storageRemove(key) {
    delete _memCache[key];
    _native.removeItem(key);
    if (!IS_SERVER_MODE) return;
    try {
      await fetch(BASE + '/' + key, { method: 'DELETE' });
    } catch (e) { /* ignore */ }
  }

  // ── 读取缓存（同步，不等待服务器）────────────────────────
  function getCache(key) {
    if (_memCache[key] !== undefined) return _memCache[key];
    try { return JSON.parse(_native.getItem(key)); } catch (e) { return null; }
  }

  // ── 暴露到全局────────────────────────────────────────────
  window._storage = {
    get: storageGet,
    set: storageSet,
    remove: storageRemove,
    getCache: getCache,
    isServerMode: IS_SERVER_MODE
  };

  // 日志
  if (IS_SERVER_MODE) {
    console.log(
      '%c[单词PK] 服务器模式：数据将同步到 ./data/ 文件夹',
      'color:#00e5ff;font-weight:bold'
    );
  } else {
    console.log(
      '%c[单词PK] 浏览器模式：数据存储在 localStorage（换电脑不保留）',
      'color:#ffd700;font-weight:bold'
    );
  }

})();
