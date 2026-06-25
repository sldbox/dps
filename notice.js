/* ===== Notice / Announcement ===== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NOTICE_SESSION_DISMISS_KEY = 'gbd_dps_calculator:notice_legacy_preset_dismissed';
  const NOTICE_TABS = [
    { id: 'legacy-preset-update', label: '프리셋 최신화 안내' },
    { id: 'notes', label: '참고사항' },
    { id: 'creator', label: '문의' }
  ];

  const NOTICE_TAB_IDS = new Set(NOTICE_TABS.map((tab) => tab.id));

  const NOTICE_CONTENT = {
    notes: {
      title: '참고사항',
      level: 'note',
      html: `
        <div class="notice-step-card">
          <h3>먼저 알아둘 점</h3>
          <ul>
            <li>입력한 값과 선택한 값은 프리셋에 저장됩니다.</li>
            <li>다만 현재 모드에서 쓰지 않는 항목은 DPS 계산에 반영되지 않습니다.</li>
            <li>프리셋 불러오기와 비교 분석에서는 저장된 값을 그대로 보여주고, 실제 DPS는 현재 모드에 맞는 항목만 사용합니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>개인전</h3>
          <ul>
            <li>내가 입력한 스펙, 특성, 룬, 인첸트 값을 기준으로 계산합니다.</li>
            <li>적 물량은 1배 기준으로 계산합니다.</li>
            <li>협동 인원, 협동 물량, 파워 블레스, 2P/3P 스펙은 개인 DPS에 적용되지 않습니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>협동전</h3>
          <ul>
            <li>협동 가능한 난이도에서만 협동 DPS로 계산합니다.</li>
            <li>협동 DPS표는 2인/3인 적 물량을 기준으로 계산합니다.</li>
            <li>2P, 3P의 스펙은 따로 입력받지 않고 모두 0으로 보고 계산합니다.</li>
            <li>도전의 탑, Abyss road, Deep Abyss에서는 협동 DPS가 적용되지 않습니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>도전의 탑</h3>
          <ul>
            <li>도전의 탑은 목표 라운드가 아니라 도전의탑 층수로 계산합니다.</li>
            <li>고행 단계와 목표 라운드는 저장되지만, 도전의 탑 DPS에는 적용되지 않습니다.</li>
            <li>1층~80층은 정해진 기준값으로 계산합니다.</li>
            <li>81층~90층은 별도 기준값으로 계산합니다.</li>
            <li>층별 적 체력, 실드, 물량 기준을 반영합니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>Abyss road / Deep Abyss</h3>
          <ul>
            <li>침식 스텍과 침식 내성은 Abyss road, Deep Abyss에서 적용됩니다.</li>
            <li>Abyss road는 고행 단계가 적용됩니다.</li>
            <li>Deep Abyss는 고행 단계가 적용되지 않습니다.</li>
            <li>Abyss road, Deep Abyss에서는 협동 DPS가 적용되지 않습니다.</li>
            <li>Deep Abyss에서는 출발 지원 인원수로 늘어나는 팀 특성 배율이 적용되지 않습니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>강화의달인 / 파워 블레스</h3>
          <ul>
            <li>강화의달인 없음: 파워 블레스 없음</li>
            <li>강화의달인 전체활성화: 파워 블레스 20 / 40 / 60</li>
            <li>강화의달인 선택강화: 파워 블레스 30 / 60 / 90</li>
            <li>파워 블레스는 강화의달인 상태에 맞는 값만 계산에 적용됩니다.</li>
          </ul>
        </div>
      `,
      actions: []
    },
    creator: {
      title: '문의',
      level: 'info',
      html: `
        <div class="notice-creator-card">
          <div><span>문의</span><b>회장</b></div>
          <div><span>귓말 코드</span><b>3-S2-1-2461127</b></div>
        </div>
        <p>오류 제보나 사용 문의는 귓말 또는 디스코드로 보내주세요.</p>
        <div class="notice-step-card">
          <h3>문의할 때 알려주면 좋은 내용</h3>
          <ul>
            <li>어떤 프리셋을 사용했는지</li>
            <li>어떤 화면에서 문제가 보였는지</li>
            <li>원래 나와야 하는 값과 실제로 보인 값</li>
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
          <p>이전 버전에서 만든 프리셋을 사용 중입니다.</p>
          <p>현재 화면에서는 사용할 수 있게 맞춰 보여주고 있지만, 새 파일로 다시 저장해 두는 것이 좋습니다.</p>
          <p>아래 <b>[프리셋 내보내기]</b> 버튼을 눌러 최신 프리셋 파일로 보관해 주세요.</p>
          <p class="notice-warning-text">예전 파일만 계속 사용하면 일부 값 표시나 프리셋 비교 결과가 다르게 보일 수 있습니다.</p>
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
