/* ===== responsive.js | 반응형 레이아웃 / 모바일·태블릿 탭 재배치 ===== */
/* PC·태블릿·모바일 모드를 판정하고, 태블릿·모바일에서 주요 카드를 탭 페이지로 재배치한다. */

(() => {
  'use strict';
  /* ===== 00. 내부 헬퍼 / 레이아웃 상태 ===== */
  const qs = (selector) => document.querySelector(selector);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));
  const MODES = ['is-pc-landscape', 'is-pc-portrait', 'is-tablet', 'is-mobile', 'is-portrait-view', 'is-mobile-device', 'is-tablet-device', 'is-narrow-mobile', 'is-tabbed'];
  const TABBED_PAGES = [
    { key: 'spec', label: '기본 정보', selectors: ['.col-left'] },
    { key: 'damage', label: '스펙 보드', selectors: ['.col-mid'] },
    { key: 'unit', label: '유닛 보드', selectors: ['.col-right'] }
  ];
  const state = {
    tabs: null,
    pages: [],
    restore: new Map(),
    raf: 0,
    arrangedTabbed: false,
    layoutWidth: 0,
    layoutPortrait: null,
    activeIndex: 0,
    activeKey: null,
    resumeTimers: []
  };
  /* ===== 01. 뷰포트 판정 / CSS 변수 동기화 ===== */
  function getViewportSize() {
    const root = document.documentElement;
    return {
      w: root.clientWidth || window.innerWidth || 0,
      h: root.clientHeight || window.innerHeight || 0
    };
  }
  function getMode() {
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const portrait = h > w;
    if (shortSide <= 600) return 'is-mobile';
    if (shortSide <= 1024 && longSide <= 1366) return 'is-tablet';
    if (portrait) return 'is-pc-portrait';
    return 'is-pc-landscape';
  }
  function updateMobileOffsets() {
    const header = qs('.hdr');
    const tabs = qs('.mobile-section-tabs');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const { w, h } = getViewportSize();
    document.documentElement.style.setProperty('--mobile-vw', `${w}px`);
    document.documentElement.style.setProperty('--mobile-header-h', `${headerHeight}px`);
    document.documentElement.style.setProperty('--mobile-tabs-h', `${tabsHeight}px`);
    document.documentElement.style.setProperty('--mobile-vh', `${h}px`);
  }
  function applyMode() {
    const mode = getMode();
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = mode === 'is-mobile' ? 'is-mobile-device' : (mode === 'is-tablet' ? 'is-tablet-device' : '');
    const widthClass = mode === 'is-mobile' && shortSide <= 430 ? 'is-narrow-mobile' : '';
    document.body.classList.remove(...MODES);
    document.documentElement.classList.remove(...MODES);
    document.body.classList.add(mode);
    document.documentElement.classList.add(mode);
    if (mode === 'is-mobile' || mode === 'is-tablet') {
      document.body.classList.add('is-tabbed');
      document.documentElement.classList.add('is-tabbed');
    }
    if (direction) {
      document.body.classList.add(direction);
      document.documentElement.classList.add(direction);
    }
    if (deviceClass) {
      document.body.classList.add(deviceClass);
      document.documentElement.classList.add(deviceClass);
    }
    if (widthClass) {
      document.body.classList.add(widthClass);
      document.documentElement.classList.add(widthClass);
    }
    state.layoutWidth = w;
    state.layoutPortrait = h > w;
    syncTabbedLayout();
    updateMobileOffsets();
  }
  /* ===== 02. 태블릿·모바일 탭 페이지 구성 / 원위치 복원 ===== */
  function rememberPosition(el) {
    if (!el || state.restore.has(el)) return;
    const marker = document.createComment(`mobile-restore:${el.className || el.tagName}`);
    el.parentNode.insertBefore(marker, el);
    state.restore.set(el, marker);
  }
  function getOrCreatePage(key) {
    let page = qs(`.mobile-page[data-mobile-page="${key}"]`);
    if (!page) {
      page = document.createElement('div');
      page.className = `mobile-page mobile-page-${key}`;
      page.dataset.mobilePage = key;
    }
    page.id = `mobilePage-${key}`;
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('tabindex', '0');
    return page;
  }
  function getPageIndexByKey(key) {
    if (!key) return -1;
    return state.pages.findIndex(page => page.key === key);
  }
  function buildTabs(colWork, pages) {
    if (!state.tabs) {
      state.tabs = document.createElement('div');
      state.tabs.className = 'mobile-section-tabs';
      state.tabs.setAttribute('role', 'tablist');
      state.tabs.setAttribute('aria-label', '화면 전환');
      colWork.parentNode.insertBefore(state.tabs, colWork);
    }
    state.tabs.textContent = '';
    pages.forEach((page, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `mobileTab-${page.key}`;
      btn.className = ['mobile-section-tab', page.toneClass].filter(Boolean).join(' ');
      btn.textContent = page.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', page.el.id);
      btn.tabIndex = -1;
      page.el.setAttribute('aria-labelledby', btn.id);
      btn.addEventListener('click', () => showTabbedPage(idx, true));
      state.tabs.appendChild(btn);
    });
    state.tabs.addEventListener('keydown', handleTabKeydown);
  }
  function handleTabKeydown(event) {
    const tabs = Array.from(state.tabs?.querySelectorAll('.mobile-section-tab') || []);
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    showTabbedPage(nextIndex, false);
    tabs[nextIndex]?.focus();
  }
  function setActiveTab(activeIndex) {
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, activeIndex));
    state.activeIndex = nextIndex;
    state.activeKey = state.pages[nextIndex]?.key || state.activeKey;
    if (state.tabs) {
      state.tabs.querySelectorAll('.mobile-section-tab').forEach((btn, idx) => {
        const active = idx === nextIndex;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });
    }
    state.pages.forEach((page, idx) => {
      const active = idx === nextIndex;
      page.el.classList.toggle('active', active);
      page.el.hidden = !active;
      page.el.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
  function showTabbedPage(index, resetPageScroll = false) {
    if (!state.pages.length) return;
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, index));
    setActiveTab(nextIndex);
    if (resetPageScroll) state.pages[nextIndex].el.scrollTop = 0;
    updateMobileOffsets();
  }
  function arrangeTabbed(colWork) {
    const pages = [];
    const keepKey = state.activeKey || state.pages[state.activeIndex]?.key || 'spec';
    TABBED_PAGES.forEach((config) => {
      const elements = config.selectors.map(selector => qs(selector)).filter(Boolean);
      if (!elements.length) return;
      const page = getOrCreatePage(config.key);
      page.textContent = '';
      page.dataset.mobileLabel = config.label;
      elements.forEach((el) => {
        rememberPosition(el);
        page.appendChild(el);
      });
      colWork.appendChild(page);
      pages.push({ ...config, el: page });
    });
    state.pages = pages;
    buildTabs(colWork, pages);
    colWork.classList.add('is-mobile-arranged');
    state.arrangedTabbed = true;
    const keepIndex = getPageIndexByKey(keepKey);
    showTabbedPage(keepIndex >= 0 ? keepIndex : state.activeIndex, false, false);
  }
  function restoreDesktop() {
    if (!state.arrangedTabbed) return;
    state.restore.forEach((marker, el) => {
      if (marker.parentNode) marker.parentNode.insertBefore(el, marker.nextSibling);
    });
    qsa('.mobile-page').forEach(page => page.remove());
    if (state.tabs) state.tabs.remove();
    qs('.col-work')?.classList.remove('is-mobile-arranged');
    state.tabs = null;
    state.pages = [];
    state.arrangedTabbed = false;
  }
  function syncTabbedLayout() {
    const colWork = qs('.col-work');
    if (!colWork) return;
    if (document.body.classList.contains('is-tabbed')) {
      if (!state.arrangedTabbed) arrangeTabbed(colWork);
      else showTabbedPage(getPageIndexByKey(state.activeKey), false, false);
    } else {
      restoreDesktop();
    }
  }
  /* ===== 03. 입력 편의 / 자동 선택 ===== */
  function isTextInput(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes((el.type || '').toLowerCase());
  }
  function bindInputAutoSelect() {
    if (document.documentElement.dataset.inputAutoSelectBound === '1') return;
    document.documentElement.dataset.inputAutoSelectBound = '1';
    document.addEventListener('focusin', (event) => {
      const el = event.target;
      if (!isTextInput(el)) return;
      requestAnimationFrame(() => {
        if(typeof el.select==='function') el.select();
      });
    });
  }
  /* ===== 04. resize/orientation 갱신 ===== */
  function scheduleApply() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      const { w, h } = getViewportSize();
      const portrait = h > w;
      const widthChanged = Math.abs(w - state.layoutWidth) > 1;
      const orientationChanged = state.layoutPortrait !== portrait;
      if (widthChanged || orientationChanged) applyMode();
      else updateMobileOffsets();
    });
  }
  function runResponsiveRefresh() {
    applyMode();
  }
  function scheduleResumeApply() {
    state.resumeTimers.forEach(timer => clearTimeout(timer));
    state.resumeTimers = [];
    requestAnimationFrame(runResponsiveRefresh);
    state.resumeTimers.push(setTimeout(runResponsiveRefresh, 80));
    state.resumeTimers.push(setTimeout(runResponsiveRefresh, 320));
  }
  function markResponsiveReady() {
    window.__dpsResponsiveLayoutReady = true;
    if (typeof window.dpsMarkResponsiveLayoutReady === 'function') {
      window.dpsMarkResponsiveLayoutReady();
    }
  }
  /* ===== 05. 초기화 / 공개 refresh API ===== */
  function init() {
    runResponsiveRefresh();
    bindInputAutoSelect();
    markResponsiveReady();
  }
  window.dpsSyncResponsiveLayout = function(){
    runResponsiveRefresh();
    requestAnimationFrame(updateMobileOffsets);
    markResponsiveReady();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('orientationchange', scheduleApply, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('pageshow', scheduleResumeApply, { passive: true });
  window.addEventListener('focus', scheduleResumeApply, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleResumeApply();
  }, { passive: true });
  window.addEventListener('load', updateMobileOffsets, { once: true });
})();
