/* ===== Notice / Announcement ===== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NOTICE_SESSION_DISMISS_KEY = 'gbd_dps_calculator:notice_legacy_preset_dismissed';
  const NOTICE_TABS = [
    { id: 'legacy-preset-update', label: '프리셋 최신화 안내' },
    { id: 'notes', label: '참고사항' },
    { id: 'creator', label: '제작자' }
  ];

  const NOTICE_TAB_IDS = new Set(NOTICE_TABS.map((tab) => tab.id));

  const NOTICE_CONTENT = {
    notes: {
      title: '참고사항',
      level: 'note',
      html: `
        <p>계산 로직, 적용 기준, 업데이트 참고사항이 이곳에 추가될 예정입니다.</p>
        <div class="notice-empty-box">추가 안내 준비 중</div>
      `,
      actions: []
    },
    creator: {
      title: '제작자',
      level: 'info',
      html: `
        <div class="notice-creator-card">
          <div><span>제작자</span><b>회장</b></div>
          <div><span>식별 코드</span><b>3-S2-1-2461127</b></div>
        </div>
        <p>각종 버그 제보 및 문의는 제작자에게 귓말 또는 DM으로 보내주세요.</p>
        <div class="notice-step-card">
          <h3>버그 제보 시 포함하면 좋은 내용</h3>
          <ul>
            <li>사용 중인 프리셋 파일</li>
            <li>문제가 발생한 화면 또는 기능</li>
            <li>기대했던 값과 실제 표시된 값</li>
            <li>가능하면 스크린샷</li>
          </ul>
        </div>
        <div class="notice-discord-row">
          <span>개복디 오픈디스코드</span>
          <a href="https://discord.gg/z7DwqvGeB5" target="_blank" rel="noopener noreferrer">입장하기</a>
        </div>
      `,
      actions: []
    }
  };

  let activeTab = 'legacy-preset-update';

  function readPresetVersionStatus() {
    const statusSource = window.DpsTraitPresetVersion?.status;
    if (typeof statusSource !== 'function') return null;
    try {
      const status = statusSource();
      return status && typeof status === 'object' ? status : null;
    } catch (e) {
      return null;
    }
  }

  function hasLegacyPresetStore() {
    return readPresetVersionStatus()?.state === 'legacy';
  }

  function tabHtml(target) {
    return NOTICE_TABS.map((tab) => {
      const active = tab.id === target;
      return `<button type="button" class="notice-tab${active ? ' active' : ''}" data-notice-tab="${tab.id}" aria-selected="${active ? 'true' : 'false'}">${tab.label}</button>`;
    }).join('');
  }

  function currentPresetNoticeStatus() {
    return readPresetVersionStatus() || { state: 'empty', label: '프리셋을 불러와 주세요', hasPreset: false };
  }

  function legacyNoticeContent() {
    const status = currentPresetNoticeStatus();
    if (status.state === 'legacy') {
      return {
        title: '프리셋 최신화 안내',
        level: 'important',
        html: `
          <p>구버전 프리셋을 사용 중입니다.</p>
          <p>현재 프리셋은 최신 구조로 자동 변환되었습니다.</p>
          <p>앞으로 안정적으로 사용하려면 아래 <b>[프리셋 내보내기]</b> 버튼을 눌러 새 파일로 저장해 주세요.</p>
          <p class="notice-warning-text">구버전 파일을 계속 사용하면 일부 값 표시나 비교/분석 기능에서 호환 문제가 생길 수 있습니다.</p>
        `,
        actions: ['export', 'later']
      };
    }
    if (status.state === 'current') {
      return {
        title: '프리셋 최신화 안내',
        level: 'note',
        html: `
          <p>현재 프리셋은 최신버전입니다.</p>
        `,
        actions: []
      };
    }
    return {
      title: '프리셋 최신화 안내',
      level: 'note',
      html: `
        <p>현재 불러온 프리셋이 없습니다.</p>
        <p><b>프리셋을 불러와 주세요.</b></p>
      `,
      actions: []
    };
  }

  function actionHtml(item) {
    const actions = Array.isArray(item.actions) ? item.actions : [];
    if (!actions.length) return '';
    return `<div class="notice-action-row">
      ${actions.includes('later') ? '<button type="button" class="notice-btn notice-btn-subtle" data-notice-close="1">나중에</button>' : ''}
      ${actions.includes('export') ? '<button type="button" class="notice-btn notice-btn-primary" data-notice-export="1">프리셋 내보내기</button>' : ''}
    </div>`;
  }

  function contentHtml(target) {
    const item = target === 'legacy-preset-update' ? legacyNoticeContent() : NOTICE_CONTENT[target];
    return `<section class="notice-content notice-level-${item.level || 'note'}" data-notice-content="${target}">
      <h2>${item.title}</h2>
      <div class="notice-content-body">${item.html}</div>
      ${actionHtml(item)}
    </section>`;
  }

  function renderNoticeInto(root, target = activeTab) {
    if (!root) return;
    activeTab = NOTICE_TAB_IDS.has(target) ? target : 'legacy-preset-update';
    root.innerHTML = `
      <div class="notice-tabs" role="tablist" aria-label="공지사항 탭">${tabHtml(activeTab)}</div>
      <div class="notice-content-mount">${contentHtml(activeTab)}</div>
    `;
  }

  function ensureNoticeModal() {
    let shell = $('noticeModalShell');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.id = 'noticeModalShell';
    shell.className = 'notice-modal-shell';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
      <div class="notice-modal-backdrop" data-notice-close="1"></div>
      <section class="notice-modal" role="dialog" aria-modal="true" aria-labelledby="noticeModalTitle">
        <header class="notice-modal-head">
          <div class="notice-modal-title-wrap">
            <span class="notice-modal-icon" aria-hidden="true">!</span>
            <h2 id="noticeModalTitle">공지사항</h2>
          </div>
          <button type="button" class="notice-modal-close" data-notice-close="1" aria-label="공지사항 닫기">×</button>
        </header>
        <div class="notice-modal-body" id="noticeModalBody"></div>
      </section>
    `;
    document.body.appendChild(shell);
    return shell;
  }

  function openNoticeModal(tab = 'legacy-preset-update') {
    const shell = ensureNoticeModal();
    renderNoticeInto($('noticeModalBody'), tab);
    shell.classList.add('is-open');
    shell.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('notice-modal-open');
    document.body.classList.add('notice-modal-open');
  }

  function closeNoticeModal() {
    const shell = $('noticeModalShell');
    if (shell) {
      shell.classList.remove('is-open');
      shell.setAttribute('aria-hidden', 'true');
    }
    document.documentElement.classList.remove('notice-modal-open');
    document.body.classList.remove('notice-modal-open');
    try { sessionStorage.setItem(NOTICE_SESSION_DISMISS_KEY, '1'); } catch (e) {}
  }


  function isAutoDismissed() {
    try { return sessionStorage.getItem(NOTICE_SESSION_DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  function checkLegacyPresetNotice(options = {}) {
    const legacy = currentPresetNoticeStatus().state === 'legacy';
    document.documentElement.classList.toggle('has-legacy-preset-notice', legacy);
    if (!legacy || isAutoDismissed()) return false;
    if (options.manual) {
      openNoticeModal('legacy-preset-update');
      return true;
    }
    window.setTimeout(() => {
      if (currentPresetNoticeStatus().state !== 'legacy' || isAutoDismissed()) return;
      openNoticeModal('legacy-preset-update');
    }, 350);
    return true;
  }

  function handleNoticeClick(event) {
    const openTarget = event.target.closest('[data-action="openNoticeModal"], [data-notice-open]');
    if (openTarget) {
      event.preventDefault();
      openNoticeModal('legacy-preset-update');
      return;
    }
    const closeTarget = event.target.closest('[data-notice-close]');
    if (closeTarget) {
      event.preventDefault();
      closeNoticeModal();
      return;
    }
    const tabTarget = event.target.closest('[data-notice-tab]');
    if (tabTarget) {
      event.preventDefault();
      activeTab = tabTarget.getAttribute('data-notice-tab') || 'legacy-preset-update';
      const modalBody = $('noticeModalBody');
      if (modalBody && $('noticeModalShell')?.classList.contains('is-open')) renderNoticeInto(modalBody, activeTab);
        return;
    }
    const exportTarget = event.target.closest('[data-notice-export]');
    if (exportTarget) {
      event.preventDefault();
      closeNoticeModal();
      if (typeof window.exportTraitPresets === 'function') window.exportTraitPresets();
    }
  }

  function initNotice() {
    document.addEventListener('click', handleNoticeClick, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('noticeModalShell')?.classList.contains('is-open')) closeNoticeModal();
    });
    window.addEventListener('dps:traitPresetStoreChanged', () => window.setTimeout(() => checkLegacyPresetNotice(), 80));
    checkLegacyPresetNotice();
  }

  window.DpsNotice = {
    open: openNoticeModal,
    close: closeNoticeModal,
    checkLegacyPresetNotice,
    hasLegacyPresetStore
  };
  window.openNoticeModal = openNoticeModal;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotice, { once: true });
  else initNotice();
})();
