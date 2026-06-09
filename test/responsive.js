(() => {
  'use strict';

  const MODES = ['is-pc-landscape', 'is-pc-portrait', 'is-tablet', 'is-mobile', 'is-portrait-view', 'is-mobile-device', 'is-tablet-device', 'is-narrow-mobile', 'is-tabbed'];
  const MOBILE_PAGES = [
    { key: 'spec', label: '기본정보', selectors: ['.xp-sp-card'] },
    { key: 'trait', label: '특성보드', selectors: ['.col-right'] },
    { key: 'rune-effect', label: '룬효과', selectors: ['.unit-enhance-card'] },
    { key: 'rune-spec', label: '룬스펙', selectors: ['.clean-rune-card'] },
    { key: 'buff', label: '버프', selectors: ['.two-panel-buff'] },
    { key: 'result', label: '결과', selectors: ['.stat-dps-card'] },
    { key: 'save', label: '저장복구', selectors: ['.sg.priority'] },
    { key: 'extra', label: '기타', selectors: ['.bus-cut-card', '.final-damage-card'] }
  ];

  const state = {
    tabs: null,
    pages: [],
    restore: new Map(),
    raf: 0,
    arrangedMobile: false
  };

  function getMode() {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    const portrait = h > w;

    if (w <= 767 || (h <= 430 && w <= 960)) return 'is-mobile';
    if (portrait && w <= 1024) return 'is-tablet';
    if (portrait) return 'is-pc-portrait';
    return 'is-pc-landscape';
  }

  function updateMobileOffsets() {
    const header = document.querySelector('.hdr');
    const tabs = document.querySelector('.mobile-swipe-tabs');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    document.documentElement.style.setProperty('--mobile-header-h', `${headerHeight}px`);
    document.documentElement.style.setProperty('--mobile-tabs-h', `${tabsHeight}px`);
    document.documentElement.style.setProperty('--mobile-vh', `${viewportHeight}px`);
  }

  function applyMode() {
    const mode = getMode();
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = (w <= 767 || (h <= 430 && w <= 960)) ? 'is-mobile-device' : ((w <= 1024 || (w <= 1368 && h <= 1024)) ? 'is-tablet-device' : '');
    const widthClass = w <= 430 ? 'is-narrow-mobile' : '';

    document.body.classList.remove(...MODES);
    document.documentElement.classList.remove(...MODES);
    document.body.classList.add(mode);
    document.documentElement.classList.add(mode);
    if (mode === 'is-mobile') {
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

    syncMobileLayout();
    updateMobileOffsets();
  }

  function rememberPosition(el) {
    if (!el || state.restore.has(el)) return;
    const marker = document.createComment(`mobile-restore:${el.className || el.tagName}`);
    el.parentNode.insertBefore(marker, el);
    state.restore.set(el, marker);
  }

  function getOrCreatePage(key) {
    let page = document.querySelector(`.mobile-page[data-mobile-page="${key}"]`);
    if (!page) {
      page = document.createElement('div');
      page.className = `mobile-page mobile-page-${key}`;
      page.dataset.mobilePage = key;
    }
    return page;
  }

  function buildTabs(colWork, pages) {
    if (!state.tabs) {
      state.tabs = document.createElement('div');
      state.tabs.className = 'mobile-swipe-tabs';
      state.tabs.setAttribute('aria-label', '모바일 섹션 이동');
      colWork.parentNode.insertBefore(state.tabs, colWork);
    }

    state.tabs.textContent = '';
    pages.forEach((page, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mobile-swipe-tab';
      btn.textContent = page.label;
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      btn.addEventListener('click', () => {
        page.el.scrollTop = 0;
        colWork.scrollTo({ left: page.el.offsetLeft, top: 0, behavior: 'auto' });
        setActiveTab(idx);
        btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      });
      state.tabs.appendChild(btn);
    });
  }

  function setActiveTab(activeIndex) {
    if (!state.tabs) return;
    state.tabs.querySelectorAll('.mobile-swipe-tab').forEach((btn, idx) => {
      const active = idx === activeIndex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function arrangeMobile(colWork) {
    const pages = [];

    MOBILE_PAGES.forEach((config) => {
      const elements = config.selectors.map(selector => document.querySelector(selector)).filter(Boolean);
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
    setActiveTab(0);
    colWork.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    state.arrangedMobile = true;
  }

  function restoreDesktop() {
    if (!state.arrangedMobile) return;

    state.restore.forEach((marker, el) => {
      if (marker.parentNode) marker.parentNode.insertBefore(el, marker.nextSibling);
    });

    document.querySelectorAll('.mobile-page').forEach(page => page.remove());
    if (state.tabs) state.tabs.remove();
    state.tabs = null;
    state.pages = [];
    state.arrangedMobile = false;
  }

  function syncMobileLayout() {
    const colWork = document.querySelector('.col-work');
    if (!colWork) return;

    if (document.body.classList.contains('is-tabbed')) {
      if (!state.arrangedMobile) arrangeMobile(colWork);
    } else {
      restoreDesktop();
    }
  }

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
        try { el.select(); } catch (e) {}
      });
    });
  }

  function bindMobileScroll() {
    const colWork = document.querySelector('.col-work');
    if (!colWork || colWork.dataset.mobileScrollBound === '1') return;
    colWork.dataset.mobileScrollBound = '1';

    colWork.addEventListener('scroll', () => {
      if (!document.body.classList.contains('is-tabbed') || !state.pages.length) return;
      if (state.raf) return;
      state.raf = requestAnimationFrame(() => {
        state.raf = 0;
        let bestIndex = 0;
        let bestDistance = Infinity;
        state.pages.forEach((page, idx) => {
          const distance = Math.abs(page.el.offsetLeft - colWork.scrollLeft);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = idx;
          }
        });
        setActiveTab(bestIndex);
        const activeBtn = state.tabs && state.tabs.querySelectorAll('.mobile-swipe-tab')[bestIndex];
        if (activeBtn) activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      });
    }, { passive: true });
  }

  function scheduleApply() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      applyMode();
    });
  }

  function init() {
    applyMode();
    bindMobileScroll();
    bindInputAutoSelect();
    updateMobileOffsets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('orientationchange', scheduleApply, { passive: true });
  window.addEventListener('load', updateMobileOffsets, { once: true });
})();
