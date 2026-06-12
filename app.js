// [1]  도구 유닛
// [2]  특수 동작
// [3]  특수 조건
// [3-2] 유닛 자체 조합 규칙
// [4]  검색 규칙
// [5]  정수 세팅
// [6]  정렬 우선순위
// [7]  체크리스트 그룹
// [8]  등급·색상
// [9] 종족 탭
// [10] 기초 재료 순서
// [11] 통합 보드 슬롯
// [12] 로컬스토리지 키
// [13] 프리셋
// [14] 파싱 규칙
// [15] 정책

const SYSTEM_CONFIG = {

    // [1] 도구 유닛
    // 조합 재료이지만 1회만 필요한 유닛 (장착형 도구 개념)
    // 형식: "상위유닛": ["도구유닛1", "도구유닛2"]
    tools: {
        "로리스완": ["낮까마귀", "자동포탑"],
        "말라쉬": ["드라켄레이저천공기"]
    },

    // [2] 유닛별 특수 동작
    // presetNoStack: true → 프리셋 실행 시 이미 장바구니에 있으면 중복 추가 방지
    // specialRender: true → 체크리스트에 완료 버튼 없이 "자동 완료됨" 텍스트로만 표시
    // comboSlot:     true → 통합 보드에서 갓오타/메시브 콤보 슬롯으로 표시
    // batch:         N    → specialRender 유닛의 "+ N개 완료" 버튼 단위 수량
    unitBehaviors: {
        "갓오타": { specialRender: true, comboSlot: true, batch: 1 },
        "메시브": { specialRender: true, comboSlot: true, batch: 1 },
        "자동포탑": { specialRender: true, batch: 5 },
        "유물조각": { specialRender: true, batch: 5 },
        "자이언트플라워": { presetNoStack: true },
    },

    // 장바구니·프리셋에 1개만 담기며 수량 스테퍼가 숨겨지는 유닛 목록
    // (슈퍼히든 등급 이상도 코드에서 자동으로 동일하게 처리됨)
    oneTimeIds: ["데하카", "데하카고치", "유물", "드라켄레이저천공기"],

    // [3] 특수 조건
    // 툴팁에 노란 뱃지로 표시될 조건 텍스트
    // 형식: "유닛명": "조건 설명"
    specialConditions: {
        "데하카의오른팔": "100R↓ 저그업 20회, 역전복권 10회, 인생복권 3회"
    },

    // [3-2] 유닛 자체 조합 규칙 (툴팁·도감 카드에 노란 배지로 표시)
    // specialConditions(재료에 붙는 조건)과 달리, 해당 유닛의 조합 방식 자체를 설명
    // 형식: "유닛명": "조건 설명"
    unitConditions: {
        "홀로그램네메시스": "재료 3개 중 1개의 조건만 충족해도 조합 가능"
    },

    // [4] 검색 및 도감 규칙
    search: {
        // 도감·검색에서 완전히 숨길 유닛
        excludeIds: ["데하카고치"],
        // 검색창에서 허용하는 최소 등급
        minGradeForSearch: "레전드",
        // 등급 미달이어도 검색·도감 허용할 유닛
        searchAllowIds: ["자이언트플라워"]
    },

    // [5] 정수(에센스) 세팅
    essence: {
        // 종족 탭 → 정수 종류 매핑
        mapping: { "테바": "코랄", "테메": "코랄", "토바": "아이어", "토메": "아이어", "저그중립": "제루스", "혼종": "혼종" },
        // 통합 보드에 표시할 정수 슬롯 목록
        display: [
            { id: "coral",  color: "#FF6B6B",               name: "코랄" },
            { id: "aiur",   color: "var(--grade-rare)",      name: "아이어" },
            { id: "zerus",  color: "var(--grade-legend)",    name: "제루스" },
            { id: "hybrid", color: "var(--grade-hidden)",    name: "혼종" }
        ]
    },

    // [6] 정렬 우선순위
    // 숫자가 클수록 체크리스트 상단에 배치
    sorting: { order: { "아몬": 100, "나루드": 97, "유물": 96 } },

    // [7] 체크리스트 그룹 정의
    // isCol:      true → 기본 접힘
    // alwaysShow: true → 슬롯 없어도 항상 표시
    // alwaysOpen: true → 슬롯 있으면 항상 펼침
    groupDefs: [
        { id: 'group-target',       pid: 'grid-target',       title: '최종 목표', resetLevel: 5, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '최종 복구' },
        { id: 'group-special',      pid: 'grid-special',      title: '직속 재료', resetLevel: 4, isCol: false, alwaysShow: false, alwaysOpen: true,  resetLabel: '직속 복구' },
        { id: 'group-upper-hidden', pid: 'grid-upper-hidden', title: '상위 재료', resetLevel: 3, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '상위 복구' },
        { id: 'group-basic-hidden', pid: 'grid-basic-hidden', title: '하위 재료', resetLevel: 2, isCol: true,  alwaysShow: false, alwaysOpen: false, resetLabel: '하위 복구' },
        { id: 'group-top',          pid: 'grid-top',          title: '기초 재료', resetLevel: 1, isCol: true,  alwaysShow: true,  alwaysOpen: false, resetLabel: '기초 복구' }
    ],

    // [8] 등급 정의 및 색상
    grades: {
        order: ["매직", "레어", "에픽", "유니크", "헬", "레전드", "히든", "슈퍼히든"],
        colors: {
            "매직": "var(--grade-magic)", "레어": "var(--grade-rare)", "에픽": "var(--grade-epic)", "유니크": "var(--grade-unique)",
            "헬": "var(--grade-hell)", "레전드": "var(--grade-legend)", "히든": "var(--grade-hidden)", "슈퍼히든": "var(--grade-super)"
        },
        // 프리셋 버튼에서 텍스트를 어둡게 강제 적용할 밝은 배경색 목록
        brightColors: ["노랑", "연두", "하늘", "흰색", "금색"]
    },

    // [9] 종족 탭 목록
    tabs: [
        { key: "테바", name: "테바" }, { key: "테메", name: "테메" },
        { key: "토바", name: "토바" }, { key: "토메", name: "토메" },
        { key: "저그중립", name: "저그중립" }, { key: "혼종", name: "혼종" }
    ],

    // [10] 기초 재료 고정 표시 순서 (5열 고정 — 수정 금지)
    topFixedOrder: [
        ["죽음의머리", "검은망치", "광전사석상", "교란기", "라바사우르스"],
        ["악령", "ARES", "정화자사도", "선동자", "브루탈리스크"],
        ["짐레이너", "대천사", "제라툴", "거신", "케리건"],
        ["스투코프", "오딘", "혼종파멸자", "분노수호자", "혼종약탈자"],
        ["공허포격기", "우르사돈수", "우르사돈암", "테이스틀로프", "아토실로프"],
        ["노바", "히페리온", "보라준", "공허의구도자", "거대괴수"],
        ["특공대레이너", "고르곤전투순양함", "아르타니스", "셀렌디스", "원시케리건"],
        ["자이언트플라워", "유물조각", "자동포탑", "갓오타", "메시브"]
    ],

    // [11] 통합 보드 슬롯 목록 (4행 × 5열 = 20슬롯, 마지막 1칸은 갓오타/메시브 콤보)
    dashboardAtoms: [
        "전쟁광", "스파르타중대", "암흑광전사", "암흑파수기", "원시바퀴",
        "저격수", "코브라", "암흑고위기사", "암흑추적자", "변종가시지옥",
        "망치경호대", "공성파괴단", "암흑집정관", "암흑불멸자", "원시히드라리스크",
        "땅거미지뢰", "자동포탑", "우르사돈암", "우르사돈수", "갓오타/메시브"
    ],

    // [12] 로컬스토리지 키
    storageKeys: window.NEXUS_STORAGE_KEYS || {
        saveData:  "nexusSaveData",
        favorites: "nexusFavorites",
        fontScale: "nexusFontScale"
    },

    // [13] 프리셋 버튼 목록
    // hidden: "비활성" 으로 버튼 비활성화 가능
    // oneTime: true → 1회 실행 후 버튼 비활성 (통합 초기화로 재활성)
    presets: [
        // 일반 프리셋
        { label: "불나아", group: "일반 프리셋", command: "불새케리건/나루드/아몬/자이언트플라워*3/유물", tooltip: "불새 나루드 아몬", oneTime: true, 배경색: "보라", 글씨색: "흰색" },
        { label: "불나비", group: "일반 프리셋", command: "불새케리건/나루드/비밀작전노바/자이언트플라워*3/유물", tooltip: "불새 나루드 비밀작전노바", oneTime: true, 배경색: "빨강", 글씨색: "흰색" },
        { label: "불아비", group: "일반 프리셋", command: "불새케리건/아몬/비밀작전노바/자이언트플라워*3/유물", tooltip: "불새 아몬 비밀작전노바", oneTime: true, 배경색: "파랑", 글씨색: "흰색" },
        { label: "땅굴*8", group: "일반 프리셋", command: "땅굴파괴자*8", tooltip: "땅굴파괴자 8마리", oneTime: true, 배경색: "검정", 글씨색: "금색" },

        // 정수 프리셋
        { label: "코랄정수[9종]", group: "정수 프리셋", command: "비밀작전노바/테라트론/아우구스트그라드의자랑/제우스폭격기/창공의분노/마일스블레이즈루이스/핵의원천/광부/드라켄레이저천공기", tooltip: "코랄의정수 9종", oneTime: true, 배경색: "빨강", 글씨색: "흰색" },
        { label: "아이어정수[8종]", group: "정수 프리셋", command: "아몬/아둔의창/하늘군주/정화자감시자/말라쉬/라사라/케이다란초석/모한다르", tooltip: "아이어 정수 8종", oneTime: true, 배경색: "파랑", 글씨색: "흰색" },
        { label: "제루스정수[8종]", group: "정수 프리셋", command: "불새케리건/초월체/알렉산더/아포칼리스크/데하카/땅굴파괴자/포자주둥이/무리군주", tooltip: "제루스 정수 8종", oneTime: true, 배경색: "초록", 글씨색: "흰색" },
        { label: "혼종정수[7종]", group: "정수 프리셋", command: "나루드/혼종종언자/아몬의젤나가피조물/혼종뫼비우스/티라노조르/홀로그램네메시스/유물", tooltip: "혼종 정수 7종", oneTime: true, 배경색: "보라", 글씨색: "흰색" },
        { label: "통합정수[30종]", group: "정수 프리셋", command: "비밀작전노바/테라트론/아우구스트그라드의자랑/제우스폭격기/마일스블레이즈루이스/핵의원천/창공의분노/광부/아몬/아둔의창/하늘군주/정화자감시자/말라쉬/라사라/케이다란초석/초월체/불새케리건/알렉산더/아포칼리스크/데하카/땅굴파괴자/포자주둥이/무리군주/나루드/혼종종언자/아몬의젤나가피조물/혼종뫼비우스/티라노조르/홀로그램네메시스/유물", tooltip: "통합정수 30종", oneTime: true, 배경색: "검정", 글씨색: "흰색" }
    ],

    // [14] 파싱 규칙
    parsing: {
        // recipe/cost 파싱 시 유닛 없음으로 처리할 값 목록
        ignoreValues: ["미발견", "없음", ""]
    },

    // [15] 정책(Policy) — 수치·타이머·안전장치
    // 앱 동작에 영향을 주는 숫자값 모음. 새 상수 추가 시 이곳에 추가.
    policy: {
        // ── 수량 제한 ──
        // 유닛 1종당 최대 담기 수량
        maxUnitCapacity: 16,
        // 혼종 정수 가중치 (1개 = 일반 N개)
        hybridWeight: 3,

        // ── 안전장치 (루프 상한) ──
        // BFS 루프 상한 (무한루프 방지)
        maxLoopQueue: 1000,
        // 완료 역산 재귀 상한
        maxLoopMerge: 30,
        // 유닛 BFS 깊이 상한 (체크리스트 슬롯 배치용)
        maxBfsDepth: 30,

        // ── 등급 기준 ──
        // 체크리스트 표시 최소 등급
        minGradeForChecklist: "레어",
        // oneTime 자동 적용 최소 등급 (이 등급 이상은 1개 고정)
        oneTimeMinGrade: "슈퍼히든",
        // 체크리스트 히든그룹 판정 최소 등급
        hiddenGroupMinGrade: "히든",
        // 히든그룹 내 상위(직속) 판정 깊이 임계값 (이하 = 상위, 초과 = 하위)
        hiddenUpperDepthMax: 2,

        // ── 입력 UX 타이머 (ms) ──
        // 꾹 누르기 가속 시작 간격
        accelInterval: 80,
        // 꾹 누르기 가속 최솟값
        accelMinInterval: 20,
        // 꾹 누르기 가속 감소 단계
        accelDecreaseStep: 5,
        // 꾹 누르기 가속 단계 구간 (N회마다 1단계 상승)
        accelStepUnit: 6,
        // Shift 꾹 누르기 가속 배수
        accelShiftMultiplier: 5,
        // 꾹 누르기 시작 딜레이
        holdStartDelay: 400,
        // 완료 잠금 해제 딜레이
        completeLockDelay: 300,
        // 마우스·터치 중복 방지 간격
        mouseAfterTouchDelay: 500,

        // ── 폰트 조절 ──
        // 꾹 누르기 시작 딜레이
        fontHoldStartDelay: 600,
        // 꾹 누르기 반복 간격
        fontHoldRepeatDelay: 300,
        // 스케일 범위 및 단계
        fontScaleMin: 0.8,
        fontScaleMax: 2.0,
        fontScaleStep: 0.05,
        // 모바일 브레이크포인트 (이 미만은 비활성)
        mobileBreakpoint: 768,
        // 태블릿 세로 최대 너비
        tabletPortraitMax: 1024,

        // ── UI 피드백 타이머 (ms) ──
        // 햅틱 진동 지속시간(ms)
        hapticDuration: 15,
        searchFailFeedbackDelay: 1500,
        // 툴팁 크기 fallback (getBoundingClientRect 실패 시, px)
        tooltipFallbackWidth: 290,
        tooltipFallbackHeight: 150,
        // 툴팁 화면 여백 offset (px)
        tooltipOffset: 15,
        // 툴팁 스크롤 최소 여백 (px)
        tooltipScrollPad: 10,
        // 툴팁 최대 너비 계산 여백 (px)
        tooltipMaxWidthPad: 20,

        // ── 콤보 슬롯 ──
        // 통합 보드 갓오타/메시브 콤보 슬롯 키
        magicComboKey: "갓오타/메시브",

        // ── 체크리스트 표시 ──
        // "완료 숨기기"에서 제외할 그룹
        hideCompletedExcludeGroups: ["최종 목표", "기초 재료"],

        // ── 통합 초기화 버튼 ──
        restoreAllBtn: {
            idBtn: "btnRestoreAll",
            idLabel: "btnRestoreAllLabel",
            labelDefault: "통합 초기화",
            labelDone: "초기화됨 ✓",
            classDone: "reset-btn-done",
            // 완료 표시 유지 시간(ms)
            resetDelay: 1500,
            // 첫 클릭 후 실행까지 대기 시간(ms)
            pendingDelay: 2000
        }
    }
};

// ==========================================================================
// [ 넥서스 앱 (app.js) — config 통합본 ]
//  1. 전역 상태 및 설정      (State & Config)
//  2. 핵심 유틸 및 캐시      (Core Utils)
//  3. 데이터 저장 및 복원    (Storage)
//  4. 로직: 검색 및 커맨드   (Search & Command)
//  5. 로직: 정수 및 코스트   (Calculation)  ← 파싱·계산 헬퍼 포함
//  6. 로직: 완료 및 역산     (Crafting & Restore)
//  7. UI: 대시보드           (Dashboard)
//  8. UI: 체크리스트         (Checklist Board)
//  9. UI: 탭 및 도감 카드    (Tabs & Unit Cards)
// 10. UI: 장바구니           (Cart)
// 11. UI: 프리셋 및 제어     (Presets & Controls)
// 12. UI: 모달 및 툴팁       (Modals & Tooltips)
// 13. 전역 이벤트 위임       (Global Events)
// 14. 앱 초기화 부트스트랩   (Initialization)
// ==========================================================================

(() => {
    // ── [1] 전역 상태 및 설정 ──
    const IGNORE_PARSE_RECIPES = SYSTEM_CONFIG.parsing.ignoreValues;
    const clean = (s) => s ? s.replace(/\s+/g, '').toLowerCase() : '';
    const ATOM_HASH = Object.fromEntries(SYSTEM_CONFIG.dashboardAtoms.map(a => [clean(a), a]));
    const CLEAN_TOOLS_MAP = Object.fromEntries(Object.entries(SYSTEM_CONFIG.tools).map(([k, v]) => [clean(k), v.map(clean)]));
    const CLEAN_EXCLUDE_IDS = new Set(SYSTEM_CONFIG.search.excludeIds.map(clean));
    const CLEAN_SEARCH_ALLOW_IDS = new Set((SYSTEM_CONFIG.search.searchAllowIds || []).map(clean));
    const _behaviors = SYSTEM_CONFIG.unitBehaviors || {};
    const SPECIAL_RENDER_LIST = Object.entries(_behaviors).filter(([, b]) => b.specialRender).map(([id, b]) => ({ id: clean(id), raw: id, batch: b.batch || 1 }));
    const COMBO_SLOT_SET = new Set(Object.entries(_behaviors).filter(([, b]) => b.comboSlot).map(([id]) => clean(id)));
    const COMBO_SLOT_RAWS = Object.entries(_behaviors).filter(([, b]) => b.comboSlot).map(([id]) => id);
    const CLEAN_ONE_TIME_UNITS = new Set((SYSTEM_CONFIG.oneTimeIds || []).map(clean));
    const CLEAN_PRESET_NOSTACK = new Set(Object.entries(_behaviors).filter(([, b]) => b.presetNoStack).map(([id]) => clean(id)));
    const CLEAN_CRAFT_BATCH = Object.fromEntries(SPECIAL_RENDER_LIST.map(e => [e.id, e.batch]));
    const AUTO_COMPLETE_IDS = SPECIAL_RENDER_LIST.filter(e => !COMBO_SLOT_SET.has(e.id)).map(e => e.id);
    const CLEAN_SPECIAL_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.specialConditions).map(([k, v]) => [clean(k), v]));
    const CLEAN_UNIT_CONDITIONS = Object.fromEntries(Object.entries(SYSTEM_CONFIG.unitConditions || {}).map(([k, v]) => [clean(k), v]));
    const GROUP_DEFS = SYSTEM_CONFIG.groupDefs;
    const titleToGridId = Object.fromEntries(GROUP_DEFS.map(g => [g.title, g.pid]));

    // 데이터 맵
    const unitMap = new Map(), activeUnits = new Map(), completedUnits = new Map(), depCache = new Map();
    const completedTargets = new Map(), _unitNativeLevels = new Map();
    const JEWEL_DATABASE = [];
    const PRESET_COLOR_MAP = {
        '빨강':'red', '주황':'orange', '노랑':'yellow', '연두':'lime', '초록':'green', '하늘':'sky',
        '파랑':'blue', '남색':'navy', '보라':'purple', '분홍':'pink', '청록':'cyan', '흰색':'white',
        '검정':'black', '회색':'gray', '금색':'gold'
    };

    // 즐겨찾기
    const FAVORITES_KEY = SYSTEM_CONFIG.storageKeys.favorites;
    const _favorites = new Set((() => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch(e) { return []; } })());
    // UI 상태
    let _activeTabIdx = 0, _currentViewMode = 'codex', _currentHighlight = null, _hideCompleted = false;
    let _cartTab = 'active', _cartCollapsed = false, _jewelPanelOpen = false, _isCodexContentInitialized = false, _previousFocus = null;
    let _presetTab = '일반 프리셋';
    let _fontScale = 1.0;

    // 타이머 및 락 상태
    let repeatTimer = null, repeatDelayTimer = null, _lastInteractionTime = 0, _currentAccelInterval = SYSTEM_CONFIG.policy.accelInterval, _touchHoldCount = 0;
    let updateTimer = null, _completeLock = new Set(), _presetUsed = new Map(), _restoreAllCooldown = false;
    let _fontRepeatTimer = null, _fontRepeatDelayTimer = null;
    let _saveFailCount = 0, _restoreAllPendingTimer = null;
    let _lastCalcResult = null; // 마지막 calculateDeductedRequirements 결과 캐시
    const _depVisiting = new Set();

    // ── [2] 핵심 유틸 및 캐시 ──
    const getEl = (id) => document.getElementById(id);
    const triggerHaptic = () => navigator.vibrate?.(SYSTEM_CONFIG.policy.hapticDuration);
    const virtualUnitIds = new Set(AUTO_COMPLETE_IDS);
    const isToolRequirement = (parent, child) => CLEAN_TOOLS_MAP[parent]?.includes(child);
    const getToolNeed = (parent) => CLEAN_TOOLS_MAP[parent] || [];
    const isSpecialRender = (id) => SPECIAL_RENDER_LIST.some(e => e.id === id);
    const isSearchAllowed = (id) => CLEAN_SEARCH_ALLOW_IDS.has(id);
    const getGradeIndex = (grade) => Math.max(SYSTEM_CONFIG.grades.order.indexOf(grade), -99);
    const isOneTime = (u) => u && (CLEAN_ONE_TIME_UNITS.has(u.id) || getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.oneTimeMinGrade));
    const getUnitId = (rawName) => clean(rawName);
    const calculateTotalCostScore = (u) => u?.parsedCost?.reduce((sum, pc) => sum + (pc.qty || 0), 0) || 0;
    const isBrightColor = (name) => SYSTEM_CONFIG.grades.brightColors.includes(name);

    // ── [3] 데이터 저장 및 복원 ──
    function loadNexusState() {
        const data = localStorage.getItem(SYSTEM_CONFIG.storageKeys.saveData);
        if (!data) return;
        let state;
        try { state = JSON.parse(data); }
        catch(e) { console.warn("[오류] 저장 데이터 파싱 실패 — 초기화합니다.", e); activeUnits.clear(); completedUnits.clear(); completedTargets.clear(); return; }
        try { state.active?.forEach(([k, v]) => unitMap.has(k) && activeUnits.set(k, v)); } catch(e) { console.warn("[오류] active 복원 실패 — 건너뜁니다.", e); }
        try { state.completed?.forEach(([k, v]) => (unitMap.has(k) || COMBO_SLOT_SET.has(k)) && completedUnits.set(k, v)); } catch(e) { console.warn("[오류] completed 복원 실패 — 건너뜁니다.", e); }
        try { state.completedTargets?.forEach(([k, v]) => unitMap.has(k) && completedTargets.set(k, v)); } catch(e) { console.warn("[오류] completedTargets 복원 실패 — 건너뜁니다.", e); }
        try { _cartTab = ['active', 'done'].includes(state.cartTab) ? state.cartTab : 'active'; } catch(e) { /* 기본값 유지 */ }
        try { state.presetUsed?.forEach(([k,v]) => _presetUsed.set(Number(k), v)); } catch(e) { console.warn("[오류] presetUsed 복원 실패 — 건너뜁니다.", e); }
        try { _hideCompleted = !!state.hideCompleted; _cartCollapsed = !!state.cartCollapsed; } catch(e) { /* 기본값 유지 */ }
        completedTargets.forEach((_, uid) => activeUnits.delete(uid));
        completedUnits.forEach((v, k) => v <= 0 && completedUnits.delete(k));
    }

    function saveNexusState() {
        try {
            localStorage.setItem(SYSTEM_CONFIG.storageKeys.saveData, JSON.stringify({ active: [...activeUnits], completed: [...completedUnits], completedTargets: [...completedTargets], cartTab: _cartTab, presetUsed: [..._presetUsed], hideCompleted: _hideCompleted, cartCollapsed: _cartCollapsed }));
            _saveFailCount = 0;
        } catch(e) {
            console.warn("[오류] 데이터 저장 실패", e);
            _saveFailCount++;
            if (_saveFailCount === 1) console.error("[경고] 브라우저 저장공간 부족으로 진행상황이 저장되지 않을 수 있습니다.");
        }
    }

    function saveFavorites() {
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([..._favorites])); } catch(e) {}
    }

    // ── [4] 로직: 검색 및 커맨드 ──
    function setupSearchEngine() {
        const inp = getEl('unitSearchInput');
        if (!inp) return;
        inp.addEventListener('keydown', e => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') { e.preventDefault(); processCommand(e.target.value); inp.blur(); }
        });
    }

    function findUnitFlexible(rawName) {
        let cleaned = clean(rawName);
        if (!cleaned) return null;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || '레전드');
        let best = null, bestScore = -1;
        for (let [id, u] of unitMap) {
            if (CLEAN_EXCLUDE_IDS.has(id) || (getGradeIndex(u.grade) < minGradeIdx && !isSearchAllowed(id))) continue;
            if (id === cleaned) return u;
            if (id.includes(cleaned)) {
                const score = 100 - id.indexOf(cleaned) * 10 - (id.length - cleaned.length);
                if (score > bestScore) { bestScore = score; best = u; }
            }
        }
        return best;
    }

    function processCommand(val, fromPreset = false) {
        if (!val.trim()) return;
        let successCount = 0;
        val.split('/').filter(c => c.trim()).forEach(cmd => {
            let parts = cmd.split('*'), targetName = parts[0].trim();
            if (!targetName) return;
            let qtyRaw = parseInt(parts[1], 10);
            let qty = (isNaN(qtyRaw) || qtyRaw < 1) ? 1 : Math.min(qtyRaw, SYSTEM_CONFIG.policy.maxUnitCapacity);
            const match = findUnitFlexible(targetName);
            if (match) {
                if (fromPreset && CLEAN_PRESET_NOSTACK.has(match.id) && activeUnits.has(match.id)) { successCount++; return; }
                activeUnits.set(match.id, isOneTime(match) ? 1 : Math.min((activeUnits.get(match.id) || 0) + qty, SYSTEM_CONFIG.policy.maxUnitCapacity));
                successCount++;
            }
        });
        if (successCount > 0) {
            debouncedUpdateAllPanels();
            const searchInp = getEl('unitSearchInput');
            if (searchInp) searchInp.value = '';
            if (_currentViewMode === 'deduct') switchLayout('codex');
        } else {
            const inp = getEl('unitSearchInput');
            if (inp) {
                inp.value = '';
                const orig = inp.placeholder;
                inp.placeholder = '유닛을 찾을 수 없습니다.';
                inp.style.transition = 'border-color 0.15s';
                inp.style.borderColor = 'rgba(239,68,68,0.7)';
                setTimeout(() => { inp.placeholder = orig; inp.style.borderColor = ''; }, SYSTEM_CONFIG.policy.searchFailFeedbackDelay);
            }
        }
    }

    // ── [5] 로직: 정수 및 코스트 계산 ──

    // recipe 문자열을 + 구분자로 분리 (괄호 depth 고려)
    function splitRecipe(recipeStr) {
        let parts = [], current = '', depth = 0;
        for (let char of recipeStr) {
            if (char === '(' || char === '[') depth++;
            else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
            if (char === '+' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
            else current += char;
        }
        if (current.trim()) parts.push(current.trim());
        if (depth > 0 && parts.length === 1 && recipeStr.includes('+')) return recipeStr.split('+').map(s => s.trim()).filter(Boolean);
        return parts;
    }

    // unitMap 전체의 parsedRecipe / parsedCost를 초기화 (앱 시작 시 1회 실행)
    function initializeCacheEngine() {
        depCache.clear();
        unitMap.forEach(u => {
            u.parsedCost = [];
            if (u.cost && !IGNORE_PARSE_RECIPES.includes(u.cost)) {
                u.cost.replace(/\//g, '+').split('+').forEach(p => {
                    const m = p.match(/(.+?)\[(\d+)\]/);
                    let cName = clean(m ? m[1].trim() : p.trim()), qty = m ? parseInt(m[2], 10) : 1;
                    let type = 'atom', key = cName;
                    if (COMBO_SLOT_SET.has(cName)) { type = 'special'; }
                    else {
                        const spKey = AUTO_COMPLETE_IDS.find(k => k === cName || cName.includes(k));
                        if (spKey) key = spKey; else key = ATOM_HASH[getUnitId(cName)] || getUnitId(cName);
                    }
                    u.parsedCost.push({ type, key, qty, name: u.name });
                });
            }
            u.parsedRecipe = [];
            if (u.recipe && !IGNORE_PARSE_RECIPES.includes(u.recipe)) {
                splitRecipe(u.recipe).forEach(p => {
                    const m = p.match(/^([^(\[ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
                    if (m) u.parsedRecipe.push({ id: getUnitId(m[1]), qty: m[3] ? parseInt(m[3], 10) : 1, cond: m[2] || '' });
                });
            }
        });
    }

    // 재귀로 트리를 탐색해 히든 이상 유닛 ID를 중복 없이 수집 (유닛당 1회 = 공식 룰)
    function collectHiddenUnitIds(uid, resultSet) {
        if (resultSet.has(uid)) return;
        resultSet.add(uid);
        const u = unitMap.get(uid); if (!u) return;
        u.parsedRecipe?.forEach(pr => pr.id && collectHiddenUnitIds(pr.id, resultSet));
    }

    function getEssenceCount(sourceMap) {
        // 1단계: 관련 유닛 ID를 중복 없이 수집 (같은 유닛이 몇 개든 1회로 처리)
        const uniqueUnitIds = new Set();
        sourceMap.forEach((qty, uid) => { if (uid && qty > 0) collectHiddenUnitIds(uid, uniqueUnitIds); });

        // 2단계: 수집된 유니크 유닛 중 히든 이상만 정수 카운팅
        let counts = {};
        Object.values(SYSTEM_CONFIG.essence.mapping).forEach(v => counts[v] = 0);
        try {
            uniqueUnitIds.forEach(uid => {
                const u = unitMap.get(uid); if (!u) return;
                if (getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade)) {
                    const tEssence = SYSTEM_CONFIG.essence.mapping[u.category];
                    if (tEssence && counts[tEssence] !== undefined) counts[tEssence]++;
                }
            });
        } catch(e) { console.warn('[정수계산 오류]', e); }
        Object.keys(counts).forEach(k => { if (isNaN(counts[k]) || counts[k] < 0) counts[k] = 0; });
        return counts;
    }

    // depCache는 앱 생애주기 동안 unitMap이 불변이므로 영구 캐시가 정상 — 무효화 로직 추가 금지
    function getDependencies(uid) {
        if (depCache.has(uid)) return depCache.get(uid);
        if (_depVisiting.has(uid)) return new Set([uid]);
        _depVisiting.add(uid);
        let deps = new Set([uid]);
        try {
            const u = unitMap.get(uid);
            if (u) {
                u.parsedRecipe?.forEach(child => child.id && getDependencies(child.id).forEach(d => deps.add(d)));
                u.parsedCost?.forEach(pc => COMBO_SLOT_SET.has(pc.key) && deps.add(pc.key));
            }
            depCache.set(uid, deps);
        } finally { _depVisiting.delete(uid); }
        return deps;
    }

    // oneTime 유닛(슈퍼히든 등)은 몇 개가 필요하더라도 최대 1개로 고정 — 공식 룰, 수량 반영으로 변경 금지
    function clampOneTimeQty(uid, qty) {
        return isOneTime(unitMap.get(uid)) ? Math.min(qty, 1) : qty;
    }

    // mergedActive(장바구니에 동시 담긴 상위·하위 유닛) 는 하위가 상위의 재료로 처리되므로
    // 하위 유닛의 completedUnits를 BFS 차감에서 제외 — 상위 완료 흐름으로만 처리되는 것이 정상
    function getEffectiveCompletedQty(uid, mergedActive) {
        return mergedActive.has(uid) ? 0 : (completedUnits.get(uid) || 0);
    }

    // 갓오타/메시브(콤보슬롯)는 recipe가 아닌 parsedCost에 정의되어 있어 BFS 트리에 포함되지 않음
    // 별도로 parsedCost를 순회해 누적하고, 완료 차감도 별도 처리 — 일반 유닛과 계산 경로가 다른 것이 정상
    function accumulateComboSlotRequirements(bfsMap, reqObj) {
        bfsMap.forEach((needed, uid) => unitMap.get(uid)?.parsedCost?.forEach(pc => {
            if (COMBO_SLOT_SET.has(pc.key)) reqObj[pc.key] += pc.qty * needed;
        }));
    }

    function calculateDeductedRequirements() {
        let reqMap = new Map(), baseMap = new Map(), reasonMap = new Map();
        let specialReq = {}, baseSpecialReq = {}, specialReason = {};
        COMBO_SLOT_RAWS.forEach(k => { specialReq[k] = 0; baseSpecialReq[k] = 0; specialReason[k] = new Map(); });

        let mergedActive = new Set();
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedActive.add(pr.id)));

        const calcBFS = (isDeficit) => {
            let map = new Map(), processed = new Map(), queue = [], inQueue = new Set();
            activeUnits.forEach((qty, uid) => { map.set(uid, clampOneTimeQty(uid, qty)); queue.push(uid); inQueue.add(uid); });
            let loopCount = 0; const maxLoop = SYSTEM_CONFIG.policy.maxLoopQueue;
            while(queue.length > 0) {
                if (++loopCount > maxLoop) { console.warn('[안전장치] BFS 루프 한계 도달'); break; }
                let uid = queue.shift(); inQueue.delete(uid);
                let tNeed = map.get(uid) || 0;
                if ((!unitMap.has(uid) && !virtualUnitIds.has(uid)) || tNeed <= 0) continue;
                const completedQty = isDeficit ? getEffectiveCompletedQty(uid, mergedActive) : 0;
                let eNeed = tNeed - Math.min(completedQty, tNeed);
                let delta = eNeed - (processed.get(uid) || 0);
                if (delta <= 0) continue;
                processed.set(uid, eNeed);
                getToolNeed(uid).forEach(tid => {
                    if (eNeed > 0) { const nv = (map.get(tid) || 0) + 1; map.set(tid, nv); if (!inQueue.has(tid)) { queue.push(tid); inQueue.add(tid); } }
                });
                unitMap.get(uid)?.parsedRecipe?.forEach(c => {
                    if (c.id && !isToolRequirement(uid, c.id) && (unitMap.has(c.id) || virtualUnitIds.has(c.id))) {
                        let nv = clampOneTimeQty(c.id, (map.get(c.id) || 0) + (delta * c.qty));
                        map.set(c.id, nv); if (!inQueue.has(c.id)) { queue.push(c.id); inQueue.add(c.id); }
                    }
                });
            }
            return map;
        };

        let baseDeficits = calcBFS(false), deficits = calcBFS(true);
        baseDeficits.forEach((val, k) => val > 0 && baseMap.set(k, val));
        deficits.forEach((val, k) => val > 0 && reqMap.set(k, Math.max(0, val - (completedUnits.get(k) || 0))));

        accumulateComboSlotRequirements(baseDeficits, baseSpecialReq);
        accumulateComboSlotRequirements(deficits, specialReq);
        COMBO_SLOT_RAWS.forEach(k => specialReq[k] = Math.max(0, specialReq[k] - (completedUnits.get(k) || 0)));

        let rootTracking = new Map();
        baseDeficits.forEach((_, uid) => rootTracking.set(uid, new Map()));
        baseDeficits.forEach((needed, uid) => {
            if (needed <= 0) return;
            const uData = unitMap.get(uid); if (!uData) return;
            getToolNeed(uid).forEach(toolId => {
                let cRoots = rootTracking.get(toolId) || new Map();
                let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                cRoots.set(`TOOL_${uid}`, { text: `${uData.name} <span class="tool-badge">[도구]</span>`, cond: '', depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: 1 });
                rootTracking.set(toolId, cRoots);
            });
            uData.parsedRecipe?.forEach(child => {
                if (!child.id || isToolRequirement(uid, child.id) || (!unitMap.has(child.id) && !virtualUnitIds.has(child.id))) return;
                let cRoots = rootTracking.get(child.id) || new Map();
                let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                cRoots.set(`MAT_${uid}`, { text: isDirTarget ? `${uData.name} 직속재료` : `${uData.name} 재료`, cond: child.cond, depth: isDirTarget ? 1 : 2, parentUid: uid, reqQty: child.qty });
                rootTracking.set(child.id, cRoots);
            });
            uData.parsedCost?.forEach(pc => {
                if (COMBO_SLOT_SET.has(pc.key) && (deficits.get(uid) || 0) > 0) {
                    let isDirTarget = activeUnits.has(uid) && !mergedActive.has(uid);
                    specialReason[pc.key].set(`SPEC_${uid}`, { text: isDirTarget ? `${uData.name} 직속재료` : `${uData.name} 재료`, cond: '', depth: isDirTarget ? 1 : 2 });
                }
            });
        });

        rootTracking.forEach((rMap, cId) => {
            let finalMap = new Map();
            const childComp = completedUnits.get(cId) || 0;
            rMap.forEach((info, key) => {
                if (info.parentUid !== undefined) {
                    if (activeUnits.has(info.parentUid) && childComp >= (info.reqQty || 1) * (activeUnits.get(info.parentUid) || 1)) return;
                    else if (!activeUnits.has(info.parentUid)) {
                        if ((reqMap.get(info.parentUid) || 0) <= 0) return;
                        const parentTotalNeeded = baseMap.get(info.parentUid) || 0;
                        if (parentTotalNeeded > 0 && childComp >= (info.reqQty || 1) * parentTotalNeeded) return;
                    }
                }
                finalMap.set(key, info);
            });
            if (activeUnits.has(cId)) finalMap.set('TARGET_' + cId, { text: GROUP_DEFS.find(g => g.pid === 'grid-target')?.title || '', cond: '', depth: 0 });
            reasonMap.set(cId, finalMap);
        });

        return { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason };
    }

    // ── [6] 로직: 완료 및 역산 복구 ──

    // 전역 패널 업데이트 트리거 — 계산→clamp→UI→저장 순서 고정
    function debouncedUpdateAllPanels() {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            const calcResult = calculateDeductedRequirements();
            _lastCalcResult = calcResult;
            clampCompletedUnits(calcResult);
            updateMagicDashboard();
            updateEssence();
            updateTabsUI();
            updateTabContentUI();
            updateDeductionBoard(calcResult);
            updateCartUI();
            updateEmptyMsg();
            saveNexusState();
        }, 16);
    }

    // completedUnits를 baseMap 범위 내로 클램프 (초과 수량 제거)
    function clampCompletedUnits(calcResult) {
        const { baseMap, baseSpecialReq } = calcResult || calculateDeductedRequirements();
        for (let [uid, compQty] of completedUnits.entries()) {
            if (activeUnits.has(uid)) {
                let maxAllow = baseMap.get(uid) || activeUnits.get(uid) || 1;
                if (compQty > maxAllow) completedUnits.set(uid, maxAllow);
                continue;
            }
            let maxAllow = COMBO_SLOT_SET.has(uid) ? (baseSpecialReq[uid] || 0) : (baseMap.get(uid) || 0);
            if (compQty > maxAllow) { if (maxAllow <= 0) completedUnits.delete(uid); else completedUnits.set(uid, maxAllow); }
        }
    }

    function deleteCompletedRecipe(uid, multiplier, _depth = 0) {
        if (_depth > SYSTEM_CONFIG.policy.maxLoopMerge) {
            console.warn("[경고] 완료 역산 루프 제한 도달 — 역산 처리가 중단되었습니다.");
            return;
        }
        const u = unitMap.get(uid); if (!u) return;
        u.parsedRecipe?.forEach(child => {
            if (!child.id) return;
            let needed = child.qty * multiplier, comp = completedUnits.get(child.id) || 0;
            // completedUnits에 있는 만큼만 소비 — 재귀 역산 금지
            // 재귀하면 다른 부모를 위해 완료된 공유 재료까지 차감되는 버그 발생
            let consume = Math.min(needed, comp);
            if (consume > 0) { const newVal = Math.max(0, comp - consume); if (newVal <= 0) completedUnits.delete(child.id); else completedUnits.set(child.id, newVal); }
        });
        u.parsedCost?.forEach(pc => {
            if (COMBO_SLOT_SET.has(pc.key) && !SPECIAL_RENDER_LIST.some(e => e.id === pc.key)) {
                let needed = pc.qty * multiplier, comp = completedUnits.get(pc.key) || 0, consume = Math.min(needed, comp);
                if (consume > 0) { const newVal = Math.max(0, comp - consume); if (newVal <= 0) completedUnits.delete(pc.key); else completedUnits.set(pc.key, newVal); }
            }
        });
    }

    function completeUnit(uid, amount) {
        if (_completeLock.has(uid)) return;
        _completeLock.add(uid);
        const cWrapEl = document.getElementById(`craft-wrap-${uid}`);
        const lockBtns = cWrapEl ? Array.from(cWrapEl.querySelectorAll('button')) : [];
        lockBtns.forEach(b => b.disabled = true);
        try {
            const { reqMap, baseMap, specialReq } = calculateDeductedRequirements();
            const isTarget = activeUnits.has(uid), isSpecial = COMBO_SLOT_SET.has(uid);
            let isMergedSlot = false;
            if (isTarget && !isSpecial) activeUnits.forEach((_, activeId) => { if (activeId !== uid && unitMap.get(activeId)?.parsedRecipe?.some(pr => pr.id === uid)) isMergedSlot = true; });
            const isPureTarget = isTarget && !isMergedSlot && !isSpecial;
            let reqVal = 0;
            if (isPureTarget) reqVal = Math.max(0, (activeUnits.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else if (isSpecial) reqVal = specialReq[uid] || 0;
            else if (isTarget && isMergedSlot) reqVal = Math.max(0, (baseMap.get(uid) || 1) - (completedUnits.get(uid) || 0));
            else reqVal = reqMap.get(uid) || 0;
            const processQty = Math.min(amount !== undefined ? amount : reqVal, reqVal);
            if (processQty > 0) {
                deleteCompletedRecipe(uid, processQty);
                const newComp = (completedUnits.get(uid) || 0) + processQty;
                completedUnits.set(uid, newComp);
                if (isPureTarget) {
                    if (newComp >= (activeUnits.get(uid) || 1)) { completedTargets.set(uid, activeUnits.get(uid) || 1); activeUnits.delete(uid); completedUnits.delete(uid); _cartTab = 'done'; }
                } else if (isTarget && isMergedSlot) {
                    const totalQty = baseMap.get(uid) || 1;
                    if (newComp >= totalQty) {
                        const activeQty = activeUnits.get(uid) || 1, matQty = totalQty - activeQty;
                        completedTargets.set(uid, activeQty);
                        activeUnits.delete(uid);
                        if (matQty > 0) completedUnits.set(uid, matQty); else completedUnits.delete(uid);
                        _cartTab = 'done';
                    }
                }
                toggleHighlight(null); triggerHaptic(); debouncedUpdateAllPanels();
            } else {
                // processQty=0: 완료할 수량 없음 — 비활성화한 버튼 즉시 복구
                lockBtns.forEach(b => b.disabled = false);
            }
        } finally {
            setTimeout(() => { _completeLock.delete(uid); }, SYSTEM_CONFIG.policy.completeLockDelay);
        }
    }

    function restoreUnit(uid) {
        if (!completedTargets.has(uid)) return;
        const qty = completedTargets.get(uid) || 1;
        completedTargets.delete(uid);
        deleteCompletedRecipe(uid, qty);
        completedUnits.delete(uid);
        if (!activeUnits.has(uid)) activeUnits.set(uid, qty);
        if (completedTargets.size === 0) _cartTab = 'active';
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    function restoreAllCompleted() {
        if (_restoreAllCooldown) return;
        const cfg = SYSTEM_CONFIG.policy.restoreAllBtn;
        const btn = getEl(cfg.idBtn), label = getEl(cfg.idLabel);
        if (_restoreAllPendingTimer) {
            clearTimeout(_restoreAllPendingTimer); _restoreAllPendingTimer = null;
            if (label) label.textContent = cfg.labelDefault;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.disabled = false; }
            return;
        }
        if (label) label.textContent = '취소하려면 다시 클릭';
        if (btn) { btn.classList.add('reset-btn-pending'); btn.style.setProperty('--pending-duration', `${cfg.pendingDelay / 1000}s`); }
        _restoreAllPendingTimer = setTimeout(() => {
            _restoreAllPendingTimer = null;
            activeUnits.clear(); completedUnits.clear(); completedTargets.clear();
            _cartTab = 'active'; _presetUsed.clear(); updatePresetBtns(); triggerHaptic(); debouncedUpdateAllPanels();
            _restoreAllCooldown = true;
            if (btn) { btn.classList.remove('reset-btn-pending'); btn.classList.add(cfg.classDone); btn.disabled = true; }
            if (label) label.textContent = cfg.labelDone;
            setTimeout(() => {
                if (label) label.textContent = cfg.labelDefault;
                if (btn) { btn.classList.remove(cfg.classDone); btn.disabled = false; }
                _restoreAllCooldown = false;
            }, cfg.resetDelay);
        }, cfg.pendingDelay);
    }

    function resetGroupCompleted(level) {
        if (level >= 5) {
            completedTargets.forEach((qty, uid) => { deleteCompletedRecipe(uid, qty); completedUnits.delete(uid); activeUnits.set(uid, qty); });
            completedTargets.clear(); _cartTab = 'active'; _presetUsed.clear(); updatePresetBtns();
        } else {
            const uidsToReset = [];
            completedUnits.forEach((_, uid) => { if (activeUnits.has(uid)) return; if ((_unitNativeLevels.get(uid) || 1) <= level) uidsToReset.push(uid); });
            uidsToReset.forEach(uid => completedUnits.delete(uid));
        }
        toggleHighlight(null); debouncedUpdateAllPanels();
    }

    function resetCodex() {
        activeUnits.clear(); completedUnits.clear(); completedTargets.clear();
        toggleHighlight(null); _cartTab = 'active'; _presetUsed.clear(); updatePresetBtns(); debouncedUpdateAllPanels();
    }

    // ── [7] UI: 대시보드 ──
    function updateEssence() {
        let tE = getEssenceCount(activeUnits), cE = getEssenceCount(completedUnits);
        const hybridKey = SYSTEM_CONFIG.essence.display.find(d => d.id === 'hybrid')?.name || '혼종';
        SYSTEM_CONFIG.essence.display.forEach(d => {
            const key = d.id === 'hybrid' ? hybridKey : d.name;
            const base = Math.max(0, (tE[key] || 0) - (cE[key] || 0));
            const el = getEl(`val-essence-${d.id}`);
            if (el) { const v = base > 0 ? String(base) : ''; if (el.innerHTML !== v) el.innerHTML = v; }
            getEl(`slot-essence-${d.id}`)?.classList.toggle('active', base > 0);
        });
    }

    function renderDashboardAtoms() {
        let db = getEl('magicDashboard'); if (!db) return;
        const comboKey = SYSTEM_CONFIG.policy.magicComboKey;
        db.innerHTML = `<div class="cost-slot total-cost" id="slot-total-cost"><div class="cost-val" id="val-total-cost"></div><div class="cost-name">통합 코스트</div></div>` +
            SYSTEM_CONFIG.essence.display.map(d => `<div class="cost-slot is-magic-slot" id="slot-essence-${d.id}"><div class="cost-val" id="val-essence-${d.id}" style="color:${d.color};"></div><div class="cost-name">${d.name}</div></div>`).join('') +
            SYSTEM_CONFIG.dashboardAtoms.map(a => `<div class="cost-slot ${a === comboKey ? 'is-skill-slot' : 'is-magic-slot'}" id="vslot-${clean(a)}"><div class="cost-val"></div><div class="cost-name" id="name-${clean(a)}">${a}</div></div>`).join('');
    }

    function updateMagicDashboard() {
        const tMap = {}, cMap = {}, comboKey = SYSTEM_CONFIG.policy.magicComboKey, specials = COMBO_SLOT_RAWS;
        SYSTEM_CONFIG.dashboardAtoms.forEach(a => {
            if (a === comboKey) { tMap[a] = {}; cMap[a] = {}; specials.forEach(k => { tMap[a][k] = 0; cMap[a][k] = 0; }); }
            else tMap[a] = cMap[a] = 0;
        });
        const flattenUnitToAtoms = (uid, qty, map, path) => {
            if (qty <= 0 || path.has(uid)) return;
            path.add(uid);
            try {
                if (specials.includes(uid)) { map[comboKey][uid] += qty; return; }
                let atomRaw = ATOM_HASH[uid];
                if (atomRaw && atomRaw !== comboKey) { map[atomRaw] = (map[atomRaw] || 0) + qty; return; }
                const u = unitMap.get(uid); if (!u) return;
                if (u.parsedCost?.length) {
                    u.parsedCost.forEach(pc => {
                        if (pc.type === 'special' && specials.includes(pc.key)) map[comboKey][pc.key] += pc.qty * qty;
                        else { let pcRaw = ATOM_HASH[pc.key] || pc.key; if (pcRaw !== comboKey) { if (SYSTEM_CONFIG.dashboardAtoms.includes(pcRaw)) map[pcRaw] = (map[pcRaw] || 0) + pc.qty * qty; else flattenUnitToAtoms(pc.key, pc.qty * qty, map, path); } }
                    });
                    getToolNeed(uid).forEach(toolId => flattenUnitToAtoms(toolId, 1, map, path));
                } else if (u.parsedRecipe?.length) {
                    u.parsedRecipe.forEach(child => { if (!child.id) return; isToolRequirement(uid, child.id) ? flattenUnitToAtoms(child.id, 1, map, path) : flattenUnitToAtoms(child.id, child.qty * qty, map, path); });
                    u.parsedCost?.forEach(pc => specials.includes(pc.key) && (map[comboKey][pc.key] += pc.qty * qty));
                }
            } finally { path.delete(uid); }
        };
        let activePath = new Set(), compPath = new Set();
        activeUnits.forEach((c, k) => c > 0 && flattenUnitToAtoms(k, c, tMap, activePath));
        completedUnits.forEach((c, k) => c > 0 && flattenUnitToAtoms(k, c, cMap, compPath));
        let totalCost = 0;
        SYSTEM_CONFIG.dashboardAtoms.forEach(a => {
            const container = getEl(`vslot-${clean(a)}`), e = container?.querySelector('.cost-val'), nEl = container?.querySelector('.cost-name');
            if (!container || !e || !nEl) return;
            if (a === comboKey) {
                let hasValue = specials.some(k => Math.max(0, tMap[a][k] - cMap[a][k]) > 0);
                if (hasValue) {
                    specials.forEach(k => totalCost += Math.max(0, tMap[a][k] - cMap[a][k]));
                    let spHtml = specials.map(k => `<div class="sp-row"><span class="sp-val-num">${Math.max(0, tMap[a][k] - cMap[a][k])}</span></div>`).join('<div class="sp-divider"></div>');
                    if (e.innerHTML !== spHtml) e.innerHTML = spHtml;
                    nEl.style.display = 'block'; container.classList.add('active');
                } else { if (e.innerHTML !== '') e.innerHTML = ''; nEl.style.display = 'block'; container.classList.remove('active'); }
            } else {
                let fV = Math.max(0, tMap[a] - cMap[a]); totalCost += fV;
                if (fV > 0) { if (e.innerText !== String(fV)) e.innerText = String(fV); nEl.style.display = 'block'; container.classList.add('active'); }
                else { if (e.innerHTML !== '') e.innerHTML = ''; nEl.style.display = 'block'; container.classList.remove('active'); }
            }
        });
        const tcEl = getEl('val-total-cost');
        if (tcEl) { let v = totalCost > 0 ? String(totalCost) : ''; if (tcEl.innerText !== v) tcEl.innerText = v; }
        getEl('slot-total-cost')?.classList.toggle('active', totalCost > 0);
    }

    // ── [8] UI: 체크리스트 보드 ──
    function renderDeductionBoard() {
        const renderSlot = (id, n, g) => `<div class="deduct-slot" id="d-slot-wrap-${id}" data-uid="${id}" style="display:none;"><div class="d-reason-wrap" id="d-reason-${id}"></div><div class="d-slot-main"><div class="d-name" data-action="showRecipeTooltip" data-uid="${id}" data-is-deduction="true"><span class="gtag grade-${g}">${g}</span><span class="d-name-inline">${n}${CLEAN_SPECIAL_CONDITIONS[id]?`<span class="badge-special-cond" style="margin-left:4px; pointer-events:none;">특수조건</span>`:''}</span></div><div id="d-cond-${id}" class="d-cond-inline"></div></div><div id="craft-wrap-${id}" class="craft-wrap"></div></div>`;
        const getGrp = (id, pid, title, resetLevel=0, isCol=false, alwaysShow=false, alwaysOpen=false, resetLabel='완료복구') => `<div class="deduct-group" id="${id}" style="${alwaysShow ? '' : 'display:none;'}" ${alwaysShow ? 'data-always-show="true"' : ''} ${alwaysOpen ? 'data-always-open="true"' : ''}><div class="deduct-group-title" data-action="toggleGroup" data-grid-id="${pid}"><div style="display:flex;align-items:center;gap:7px;pointer-events:none;"><span class="grp-toggle-icon" style="display:inline-block;transition:transform 0.2s;transform:${isCol?'rotate(-90deg)':'rotate(0deg)'};font-size:0.75rem;">▼</span><span class="grp-title-text">${title}</span>${resetLevel > 0 ? `<span class="grp-count-badge" id="grp-count-${pid}" style="margin-left:2px;"></span>` : ''}</div>${resetLevel > 0 ? `<button class="btn-text-link grp-restore-btn" data-action="resetGroup" data-level="${resetLevel}" style="pointer-events:auto;">↩ ${resetLabel}</button>` : ''}</div><div class="deduct-grid" id="${pid}" ${isCol?'style="display:none;"':''}></div></div>`;
        const allUnits = Array.from(unitMap.values());
        const specialSlots = COMBO_SLOT_RAWS.map(k => renderSlot(k, k, '코스트')).join('');
        const unitSlots = allUnits.filter(u => getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForChecklist) && !COMBO_SLOT_SET.has(u.id)).map(u => renderSlot(u.id, u.name, u.grade)).join('');
        const autoSlots = SPECIAL_RENDER_LIST.filter(e => !COMBO_SLOT_SET.has(e.id)).map(e => renderSlot(e.id, e.raw, '코스트')).join('');
        const _exIds = new Set((SYSTEM_CONFIG.policy.hideCompletedExcludeGroups || []).map(t => titleToGridId[t]).filter(Boolean));
        const boardEl = getEl('deductionBoard');
        if (!boardEl) return;
        boardEl.innerHTML = `<div id="deduct-empty-msg" class="empty-msg" style="display:none;"></div><div id="deduct-slot-pool" style="display:none;">${specialSlots}${unitSlots}${autoSlots}</div>` + GROUP_DEFS.map(g => getGrp(g.id, g.pid, g.title, g.resetLevel, g.isCol, g.alwaysShow, g.alwaysOpen, g.resetLabel)).join('');
        boardEl.dataset.excludeGridIds = JSON.stringify([..._exIds]);
    }

    function updateDeductionBoard(calcResult) {
        const { reqMap, baseMap, reasonMap, specialReq, baseSpecialReq, specialReason } = calcResult || calculateDeductedRequirements();
        const mergedSlots = new Set();
        const targetHighlight = _currentHighlight || null;
        const highlightDeps = targetHighlight ? getDependencies(targetHighlight) : null;
        activeUnits.forEach((_, uid) => unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && activeUnits.has(pr.id) && mergedSlots.add(pr.id)));
        const directMaterials = new Set();
        activeUnits.forEach((_, uid) => { if (mergedSlots.has(uid)) return; unitMap.get(uid)?.parsedRecipe?.forEach(pr => pr.id && !activeUnits.has(pr.id) && directMaterials.add(pr.id)); });
        const excludeGridIds = (() => { try { return JSON.parse(getEl('deductionBoard')?.dataset.excludeGridIds || '[]'); } catch(e) { return []; } })();
        const pool = getEl('deduct-slot-pool');
        const grids = { target: getEl('grid-target'), special: getEl('grid-special'), upperHidden: getEl('grid-upper-hidden'), basicHidden: getEl('grid-basic-hidden'), top: getEl('grid-top') };

        const exactDepths = new Map(); let queue = [];
        activeUnits.forEach((_, uid) => { if (!mergedSlots.has(uid)) { exactDepths.set(uid, 0); queue.push(uid); } });
        if (queue.length === 0) activeUnits.forEach((_, uid) => { exactDepths.set(uid, 0); queue.push(uid); });
        let curDepth = 0;
        while(queue.length > 0 && curDepth < SYSTEM_CONFIG.policy.maxBfsDepth) {
            let nextQueue = []; curDepth++;
            for (let uid of queue) {
                const u = unitMap.get(uid); if (!u) continue;
                u.parsedRecipe?.forEach(pr => { if (pr.id && !exactDepths.has(pr.id)) { exactDepths.set(pr.id, curDepth); nextQueue.push(pr.id); } });
                getToolNeed(uid).forEach(toolId => { if (toolId && !exactDepths.has(toolId)) { exactDepths.set(toolId, curDepth); nextQueue.push(toolId); } });
                u.parsedCost?.forEach(pc => { if (COMBO_SLOT_SET.has(pc.key) && !exactDepths.has(pc.key)) { exactDepths.set(pc.key, curDepth); nextQueue.push(pc.key); } });
            }
            queue = nextQueue;
        }

        document.querySelectorAll('.deduct-slot[data-uid]').forEach(el => {
            el.style.display = 'none'; el.classList.remove('is-visible','has-target','is-completed','is-inactive','is-craftable');
            if (pool && el.parentElement !== pool) pool.appendChild(el);
        });
        document.querySelectorAll('.top-row-blank').forEach(el => el.remove());
        document.querySelectorAll('.deduct-slot-ghost').forEach(el => el.remove());

        const topFixedRows = SYSTEM_CONFIG.topFixedOrder.map(row => row.map(clean));
        const topFixedSet = new Set(topFixedRows.flat());
        const ROW_SIZE = Math.max(...topFixedRows.map(r => r.length));

        const processSlot = (id, isTopFixedCall = false) => {
            const slotEl = getEl(`d-slot-wrap-${id}`); if (!slotEl) return null;
            const isSpecialCost = COMBO_SLOT_SET.has(id), isAutoRender = isSpecialRender(id), isAutoApply = isAutoRender || isSpecialCost;
            const isTarget = activeUnits.has(id), isCompletedTarget = !isTarget && !isSpecialCost && completedTargets.has(id);
            const isMergedSlot = isTarget && !isSpecialCost && mergedSlots.has(id);
            let needed = isSpecialCost ? (specialReq[id]||0) : (reqMap.get(id)||0);
            if (isMergedSlot) needed = Math.max(0, (baseMap.get(id)||0) - (completedUnits.get(id)||0));
            else if (isTarget && !isSpecialCost) needed = Math.max(0, (activeUnits.get(id)||1) - (completedUnits.get(id)||0));
            if (isCompletedTarget) needed = 0;
            let baseNeeded = isSpecialCost ? (baseSpecialReq[id]||0) :
                             isTarget && !isSpecialCost ? (isMergedSlot ? (baseMap.get(id)||0) : (activeUnits.get(id)||1)) :
                             isCompletedTarget ? (completedTargets.get(id)||1) : (baseMap.get(id)||0);
            const isInactive = isTopFixedCall && baseNeeded <= 0 && needed <= 0 && !isTarget && !isCompletedTarget;
            if (!isTopFixedCall) {
                if (isSpecialCost && needed <= 0 && baseNeeded <= 0) return null;
                else if (isAutoRender && !baseNeeded && !needed) return null;
                else if (!isAutoRender && !isSpecialCost && !baseNeeded && !isTarget && !isCompletedTarget) return null;
            }
            slotEl.classList.remove('is-inactive');
            if (isInactive) slotEl.classList.add('is-inactive');

            const rCon = slotEl.querySelector(`#d-reason-${id}`);
            if (rCon) {
                let rMap = isSpecialCost ? specialReason[id] : reasonMap.get(id);
                if (!isInactive && rMap && rMap.size > 0 && needed > 0) {
                    let allEntries = [...rMap.entries()];
                    if (isTarget && !isSpecialCost && !isMergedSlot) allEntries = allEntries.filter(([, i]) => i.depth === 0);
                    if (_currentHighlight) {
                        const filtered = allEntries.filter(([, i]) => i.parentUid === targetHighlight || (highlightDeps && highlightDeps.has(i.parentUid)) || i.depth === 0);
                        if (filtered.length > 0) allEntries = filtered;
                    }
                    let sorted = allEntries.sort((a,b)=>(a[1].depth||0)-(b[1].depth||0));
                    rCon.style.display = 'flex'; rCon.style.justifyContent = sorted.length === 1 ? 'center' : 'flex-start';
                    rCon.innerHTML = sorted.map(([rId,i]) => {
                        let qtyText = '';
                        if (i.depth !== 0 && i.reqQty) {
                            const parentQty = i.parentUid ? (reqMap.get(i.parentUid) || activeUnits.get(i.parentUid) || baseMap.get(i.parentUid) || 1) : 1;
                            const displayQty = rId.startsWith('TOOL_') ? 1 : i.reqQty * parentQty;
                            qtyText = ` <span style="opacity:0.75;font-weight:700;">· ${displayQty}개</span>`;
                        }
                        const cleanUid = rId.replace(/^(TARGET_|MAT_|TOOL_|SPEC_)/,'');
                        return `<span class="d-reason-tag ${i.depth===0?'tag-target':i.depth===1?'tag-mat':''}" data-action="toggleHighlight" data-uid="${cleanUid}">${i.text}${qtyText}</span>`;
                    }).join('');
                } else { rCon.style.display='none'; rCon.innerHTML=''; }
            }

            const cEl = slotEl.querySelector(`#d-cond-${id}`);
            if (cEl) {
                let rMap = isSpecialCost ? specialReason[id] : reasonMap.get(id), condMap = new Map();
                if (rMap) {
                    rMap.forEach((info) => {
                        if (!info.cond) return;
                        if (_currentHighlight) {
                            const pUid = info.parentUid;
                            if (pUid !== targetHighlight && (!highlightDeps || !highlightDeps.has(pUid))) return;
                        }
                        let cleanCond = info.cond.replace(/,/g, ' ').trim();
                        if (!cleanCond) return;
                        let parentTotal = info.parentUid ? (reqMap.get(info.parentUid) || activeUnits.get(info.parentUid) || baseMap.get(info.parentUid) || 1) : 1;
                        condMap.set(cleanCond, (condMap.get(cleanCond) || 0) + (info.reqQty || 1) * parentTotal);
                    });
                }
                if (condMap.size > 0) {
                    cEl.style.display = 'flex'; cEl.style.flexDirection = 'column'; cEl.style.gap = '2px';
                    cEl.innerHTML = Array.from(condMap).map(([condStr, qty]) => `<span class="d-cond-tag">${condStr} <span style="color:var(--text-muted);font-weight:800;font-size:0.9em;margin-left:1px;">· ${qty}개</span></span>`).join('');
                } else { cEl.style.display = 'none'; cEl.innerHTML = ''; }
            }

            const cWrap = slotEl.querySelector(`#craft-wrap-${id}`), isCompleted = !isInactive && needed === 0;
            slotEl.classList.toggle('has-target', !isInactive && !isCompleted);
            slotEl.classList.toggle('is-completed', !isInactive && isCompleted);
            if (cWrap) {
                if (isInactive) cWrap.innerHTML = '';
                else if (isAutoApply) cWrap.innerHTML = `<span style="font-size:0.82rem;color:var(--clr-auto);font-weight:bold;display:block;text-align:center;width:100%;">자동 완료됨</span>`;
                else if (!isCompleted) {
                    const bs = CLEAN_CRAFT_BATCH[id] || 1;
                    // 완료 가능 판정: 직속 recipe 재료가 completedUnits에 충분히 쌓인 경우
                    const unitNeeded = isMergedSlot ? (baseMap.get(id) || 1) : (activeUnits.has(id) ? (activeUnits.get(id) || 1) : needed);
                    const uData = unitMap.get(id);
                    const isCraftable = !!(uData?.parsedRecipe?.length) && uData.parsedRecipe
                        .filter(c => !isToolRequirement(id, c.id))
                        .every(c => (completedUnits.get(c.id) || 0) >= c.qty * unitNeeded);
                    slotEl.classList.toggle('is-craftable', isCraftable);
                    const completeLabel = isCraftable ? '완료 가능' : '완료';
                    const addLabel = isCraftable ? `+ ${bs}개 가능` : `+ ${bs}개`;
                    const add1Label = isCraftable ? `+ 1개 가능` : `+ 1개`;
                    cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">${needed}</span><span class="req-label">필요</span></div><div class="craft-wrap-right">${(needed > bs || (bs > 1 && needed > 0)) ? `<button class="pc-btn${isCraftable ? ' is-craftable' : ''}" data-action="addComplete" data-uid="${id}" data-batch="${bs}">${addLabel}</button>` : needed > 1 ? `<button class="pc-btn${isCraftable ? ' is-craftable' : ''}" data-action="addComplete" data-uid="${id}" data-batch="1">${add1Label}</button>` : ''}<button class="btn-complete${isCraftable ? ' is-craftable' : ''}" data-action="completeUnit" data-uid="${id}">${completeLabel}</button></div>`;
                } else cWrap.innerHTML = `<div class="craft-wrap-left"><span class="req-text">0</span><span class="req-label">필요</span></div><div class="craft-wrap-right"><span style="font-size:0.82rem;color:var(--g-dim);font-weight:bold;">완료됨</span></div>`;
            }

            let tGrid = null, sGrid = null, upgradedTitle = "";
            const getGridTitle = (grid) => GROUP_DEFS.find(g => g.pid === grid?.id)?.title || '';
            let isHiddenGroup = getGradeIndex(unitMap.get(id)?.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.hiddenGroupMinGrade);
            let nativeLevel = isHiddenGroup ? ((exactDepths.has(id) ? exactDepths.get(id) : 99) <= SYSTEM_CONFIG.policy.hiddenUpperDepthMax ? 3 : 2) : 1;
            _unitNativeLevels.set(id, nativeLevel);
            let upgradedGrid = null;
            if (!isAutoApply) {
                if (isCompletedTarget) { upgradedGrid = grids.target; upgradedTitle = getGridTitle(grids.target); }
                else if (isMergedSlot) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); }
                else if (isTarget) { upgradedGrid = grids.target; upgradedTitle = getGridTitle(grids.target); }
                else if (directMaterials.has(id)) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); }
                else {
                    const rVals = isSpecialCost ? specialReason[id] : reasonMap.get(id);
                    if (rVals) { for (const i of rVals.values()) { if (i.depth === 1) { upgradedGrid = grids.special; upgradedTitle = getGridTitle(grids.special); break; } } }
                }
            }
            let nativeGrid = grids.top;
            if (!isTopFixedCall && isHiddenGroup) nativeGrid = (nativeLevel === 3) ? grids.upperHidden : grids.basicHidden;
            if (upgradedGrid === grids.target && !isMergedSlot) { tGrid = grids.target; sGrid = isTopFixedCall ? nativeGrid : null; }
            else if (upgradedGrid && upgradedGrid !== nativeGrid) { if (isHiddenGroup && !isTopFixedCall) { tGrid = upgradedGrid; sGrid = null; } else { tGrid = upgradedGrid; sGrid = nativeGrid; } }
            else { tGrid = upgradedGrid || nativeGrid; sGrid = null; }

            let hideT = _hideCompleted && isCompleted && !isInactive && !excludeGridIds.includes(tGrid?.id || '');
            if (tGrid) {
                if (!hideT) slotEl.classList.add('is-visible'); else slotEl.classList.remove('is-visible');
                slotEl.style.display = hideT ? 'none' : 'flex'; tGrid.appendChild(slotEl);
            }
            if (sGrid) {
                let hideS = _hideCompleted && isCompleted && !isInactive && !excludeGridIds.includes(sGrid.id || '');
                const ghost = document.createElement('div'); ghost.className = 'deduct-slot-ghost'; ghost.dataset.ghostFor = id;
                ghost.innerHTML = `<span class="ghost-name">${unitMap.get(id)?.name || id}</span><span class="ghost-label">→ ${upgradedTitle}</span>`;
                ghost.style.display = hideS ? 'none' : ''; sGrid.appendChild(ghost);
            }
            return tGrid;
        };

        COMBO_SLOT_RAWS.filter(k => !topFixedSet.has(k)).forEach(k => processSlot(k));
        AUTO_COMPLETE_IDS.filter(id => !topFixedSet.has(id)).forEach(id => processSlot(id));
        topFixedRows.forEach(row => {
            row.forEach(uid => processSlot(uid, true));
            for (let b = 0; b < ROW_SIZE - row.length; b++) grids.top?.appendChild(Object.assign(document.createElement('div'), {className: 'top-row-blank'}));
        });
        Array.from(activeUnits.keys()).filter(uid => !topFixedSet.has(uid)).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));
        Array.from(completedTargets.keys()).filter(uid => !topFixedSet.has(uid)).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));
        Array.from(unitMap.values()).filter(u => !COMBO_SLOT_SET.has(u.id) && !topFixedSet.has(u.id) && !activeUnits.has(u.id) && !completedTargets.has(u.id) && getGradeIndex(u.grade) >= getGradeIndex(SYSTEM_CONFIG.policy.minGradeForChecklist)).sort((a, b) => getGradeIndex(b.grade) - getGradeIndex(a.grade) || (SYSTEM_CONFIG.sorting.order[b.name]||0) - (SYSTEM_CONFIG.sorting.order[a.name]||0) || a.name.localeCompare(b.name)).forEach(u => processSlot(u.id));

        [grids.target, grids.special].forEach(grid => {
            if (!grid) return;
            const children = Array.from(grid.children);
            children.sort((a, b) => {
                const uidA = a.dataset.uid || a.id.replace('d-slot-wrap-',''), uidB = b.dataset.uid || b.id.replace('d-slot-wrap-','');
                const uA = unitMap.get(uidA), uB = unitMap.get(uidB);
                return getGradeIndex(uB?.grade) - getGradeIndex(uA?.grade) || (SYSTEM_CONFIG.sorting.order[uB?.name]||0) - (SYSTEM_CONFIG.sorting.order[uA?.name]||0) || (uA?.name || uidA).localeCompare(uB?.name || uidB);
            });
            children.forEach(el => grid.appendChild(el));
        });

        Object.values(grids).forEach(g => {
            if (!g) return;
            const grp = g.closest('.deduct-group'), icon = grp?.querySelector('.grp-toggle-icon'); if (!grp) return;
            grp.style.display = 'block';
            const slots = Array.from(g.querySelectorAll('.deduct-slot')).filter(el => !el.classList.contains('is-inactive'));
            const visibleSlots = slots.filter(el => el.style.display !== 'none');
            if (visibleSlots.length === 0 && grp.dataset.alwaysShow !== 'true') { g.style.display = 'none'; grp.classList.add('collapsed'); if (icon) icon.style.transform = 'rotate(-90deg)'; }
            else if (visibleSlots.length > 0 && grp.dataset.alwaysOpen === 'true') { grp.classList.remove('collapsed'); g.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)'; }
            const badge = getEl(`grp-count-${g.id}`); if (!badge) return;
            const total = slots.length, done = slots.filter(el => el.classList.contains('is-completed')).length;
            badge.textContent = total > 0 ? `${done} / ${total}` : '';
        });

        document.querySelectorAll('.deduct-slot').forEach(el => {
            const cleanId = el.id.replace('d-slot-wrap-', '');
            el.classList.toggle('highlighted-tree', !!_currentHighlight && highlightDeps?.has(cleanId));
        });
    }

    function updateEmptyMsg() {
        const msg = getEl('deduct-empty-msg'); if (!msg) return;
        if (activeUnits.size === 0 && completedTargets.size === 0) {
            msg.style.display = 'block';
            msg.innerHTML = `<div class="empty-msg-enhanced"><div class="empty-arrow">↑</div><div class="empty-main">유닛도감에서 목표 유닛을 선택해 보세요</div><div class="empty-sub">상단 <b style="color:var(--g);">유닛도감</b> 탭 → 종족 선택 → 카드 클릭<br>프리셋 버튼으로 빠르게 시작할 수도 있습니다</div></div>`;
        } else msg.style.display = 'none';
    }

    function updateHideCompletedBtn() {
        const btn = getEl('btnHideCompleted'), label = getEl('btnHideCompletedLabel');
        if (!btn || !label) return;
        label.textContent = _hideCompleted ? '숨기는 중' : '완료 숨기기';
        btn.classList.toggle('hide-completed-active', _hideCompleted);
    }

    // ── [9] UI: 탭 및 도감 카드 ──

    // 별 버튼 HTML (즐겨찾기 여부에 따라 채워진 별/빈 별)
    function starBtnHtml(id) {
        const isFav = _favorites.has(id);
        return `<button class="uc-fav-btn${isFav ? ' is-fav' : ''}" data-action="toggleFavorite" data-uid="${id}" title="${isFav ? '즐겨찾기 해제' : '즐겨찾기 등록'}" aria-label="즐겨찾기">${isFav ? '★' : '☆'}</button>`;
    }

    // 카드 공통 빌더
    // prefix: '' = 종족탭, 'fav-{종족}-' = 종족탭 상단 공통 즐겨찾기
    // showRecipe: 조합조건 표시 여부
    function buildCard(item, idx, prefix, showRecipe) {
        const isExc = CLEAN_EXCLUDE_IDS.has(item.id), isOT = isOneTime(item);
        const isFav = _favorites.has(item.id);
        const noRecipeCls = showRecipe ? '' : ' no-recipe';
        return `<div id="card-${prefix}${item.id}" class="unit-card${isExc ? ' is-excluded' : ''}${isFav ? ' is-fav-card' : ''}${noRecipeCls}" data-grade="${item.grade}" style="${idx >= 0 ? `animation-delay:${idx*0.02}s` : ''}" data-action="toggleUnit" data-uid="${item.id}">` +
            `<div class="uc-card-inner">` +
            `${starBtnHtml(item.id)}` +
            `<div class="uc-head${showRecipe ? '' : ' uc-head-slim'}">` +
            `<span class="gtag grade-${item.grade}">${item.grade}</span>` +
            `<div class="uc-name-row" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</div>` +
            `${isExc ? `<span class="badge-excluded" data-action="showExcludedTooltip" data-uid="${item.id}">선택제한</span>` : ''}` +
            `</div>` +
            `${showRecipe ? `<div class="uc-recipe-area">${formatRecipe(item, 1, false)}</div>` : ''}` +
            `${showRecipe && CLEAN_UNIT_CONDITIONS[item.id] ? `<div class="tsc-wrap" style="margin:4px 0 2px;"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[item.id]}</div></div>` : ''}` +
            `${(!isOT && !isExc) ? `<div class="uc-ctrl-area"><div class="smart-stepper active-stepper" id="stepper-${prefix}${item.id}"><button data-action="smartChange" data-uid="${item.id}" data-delta="-1" aria-label="${item.name} 감소">-</button><div class="ss-val" id="val-unit-${prefix}${item.id}" aria-live="polite">-</div><button data-action="smartChange" data-uid="${item.id}" data-delta="1" aria-label="${item.name} 추가">+</button></div></div>` : ''}` +
            `</div></div>`;
    }

    // 종족탭 카드 (조합조건+스테퍼 표시)
    function buildUnitCard(item, idx) {
        return buildCard(item, idx, '', true);
    }

    // 즐겨찾기 공통 섹션 카드 (조합조건+스테퍼 표시)
    function buildFavCard(item, idx, categoryKey) {
        return buildCard(item, idx, `fav-${categoryKey}-`, true);
    }

    function getCodexSort(a, b) {
        return (SYSTEM_CONFIG.sorting.order[b.name] || 0) - (SYSTEM_CONFIG.sorting.order[a.name] || 0) ||
            (isOneTime(a) ? -1 : isOneTime(b) ? 1 : 0) ||
            getGradeIndex(b.grade) - getGradeIndex(a.grade) ||
            calculateTotalCostScore(b) - calculateTotalCostScore(a) ||
            a.name.localeCompare(b.name);
    }

    function getCodexVisibleItems() {
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        return Array.from(unitMap.values()).filter(u =>
            (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !CLEAN_EXCLUDE_IDS.has(u.id)
        );
    }

    function getFavoriteItems() {
        return getCodexVisibleItems().filter(u => _favorites.has(u.id)).sort(getCodexSort);
    }

    function buildFavoriteSection(categoryKey) {
        const favItems = getFavoriteItems();
        if (favItems.length > 0) {
            return `<div class="codex-fav-section">` +
                `<div class="codex-fav-header"><span class="codex-fav-title">⭐ 즐겨찾기</span></div>` +
                `<div class="codex-fav-grid">${favItems.map((item, idx) => buildFavCard(item, idx, categoryKey)).join('')}</div>` +
                `<div class="codex-fav-divider"></div>` +
                `</div>`;
        }
        return `<div class="codex-fav-empty">` +
            `<span class="codex-fav-empty-star">☆</span>` +
            `<span class="codex-fav-empty-text">카드 우측 상단 <b>☆</b>를 누르면 즐겨찾기에 등록됩니다</span>` +
            `</div>`;
    }

    function renderTabs() {
        const t = getEl('codexTabs');
        if (t) {
            t.innerHTML = SYSTEM_CONFIG.tabs.map((c, i) =>
                `<button id="tab-btn-${i}" role="tab" aria-selected="${i===_activeTabIdx}" class="tab-btn" data-action="selectTab" data-tab-idx="${i}"><span>${c.name}</span></button>`
            ).join('');
            updateTabsUI();
        }
    }

    function updateTabsUI() {
        let aCats = new Set([...activeUnits.keys()].map(id => unitMap.get(id)?.category).filter(Boolean));
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        SYSTEM_CONFIG.tabs.forEach((c, i) => {
            let btn = getEl(`tab-btn-${i}`), isActive = (i === _activeTabIdx);
            const has = aCats.has(c.key);
            if (!btn) return;
            if (btn.classList.contains('active') !== isActive) { btn.classList.toggle('active', isActive); btn.setAttribute('aria-selected', isActive ? 'true' : 'false'); }
            if (btn.classList.contains('has-active') !== has) btn.classList.toggle('has-active', has);
        });
        const selectAllBtn = getEl('btnSelectAllTab'), currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        if (selectAllBtn && currentTab) {
            selectAllBtn.disabled = false;
            const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !CLEAN_EXCLUDE_IDS.has(u.id));
            selectAllBtn.innerHTML = (catItems.length > 0 && catItems.every(item => activeUnits.has(item.id))) ? `<span class="btn-select-all-clear-label">✖ ${currentTab.name} 해제</span>` : `✔ ${currentTab.name} 선택`;
        }
    }

    // 종족별 도감 패널 초기화
    // 각 종족 패널마다 공통 즐겨찾기 섹션을 포함한다.
    function initCodexCategoryContents() {
        const tc = getEl('tabContent'); if (!tc) return;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        const favSet = new Set(_favorites);
        tc.innerHTML = SYSTEM_CONFIG.tabs.map(cat => {
            const items = Array.from(unitMap.values()).filter(u =>
                (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) &&
                u.category === cat.key &&
                !CLEAN_EXCLUDE_IDS.has(u.id) &&
                !favSet.has(u.id)
            ).sort(getCodexSort);
            const bodyHtml = !items.length
                ? `<div class="codex-empty-msg">즐겨찾기를 제외하고 표시할 유닛이 없습니다.</div>`
                : items.map((item, idx) => buildUnitCard(item, idx)).join('');
            return `<div id="cat-group-${cat.key}" class="cat-group" role="tabpanel">${buildFavoriteSection(cat.key)}<div class="codex-category-grid">${bodyHtml}</div></div>`;
        }).join('');
        _isCodexContentInitialized = true;
    }

    function renderCurrentTabContent() {
        if (!_isCodexContentInitialized) initCodexCategoryContents();
        SYSTEM_CONFIG.tabs.forEach((c, i) => getEl(`cat-group-${c.key}`)?.classList.toggle('is-visible', i === _activeTabIdx));
        updateTabContentUI();
    }

    function updateTabContentUI() {
        document.querySelectorAll('.unit-card[data-uid]').forEach(card => {
            const uid = card.dataset.uid;
            const item = unitMap.get(uid);
            if (!item) return;
            const isActive = activeUnits.has(uid);
            if (!isOneTime(item)) {
                card.querySelectorAll('.ss-val').forEach(v => {
                    const nv = isActive ? String(activeUnits.get(uid)) : '-';
                    if (v.innerText !== nv) v.innerText = nv;
                });
                card.querySelectorAll('.smart-stepper button').forEach(b => b.disabled = !isActive);
                card.querySelectorAll('.smart-stepper').forEach(stepper => { stepper.style.display = isActive ? '' : 'none'; });
            }
            card.style.display = 'flex';
            card.classList.toggle('active', isActive);
            card.classList.toggle('is-fav-card', _favorites.has(uid));
        });
        document.querySelectorAll('.uc-fav-btn[data-uid]').forEach(btn => {
            const uid = btn.dataset.uid, isFav = _favorites.has(uid);
            btn.classList.toggle('is-fav', isFav);
            btn.textContent = isFav ? '★' : '☆';
            btn.title = isFav ? '즐겨찾기 해제' : '즐겨찾기 등록';
        });
    }

    function toggleSelectAllTab() {
        const currentTab = SYSTEM_CONFIG.tabs[_activeTabIdx];
        if (!currentTab) return;
        const minGradeIdx = getGradeIndex(SYSTEM_CONFIG.search.minGradeForSearch || "레전드");
        const catItems = Array.from(unitMap.values()).filter(u => u.category === currentTab.key && (getGradeIndex(u.grade) >= minGradeIdx || isSearchAllowed(u.id)) && !CLEAN_EXCLUDE_IDS.has(u.id));
        if (!catItems.length) return;
        if (catItems.every(item => activeUnits.has(item.id))) catItems.forEach(item => activeUnits.delete(item.id));
        else catItems.forEach(item => !activeUnits.has(item.id) && activeUnits.set(item.id, 1));
        triggerHaptic(); debouncedUpdateAllPanels();
    }

    function toggleFavorite(id, event) {
        event?.stopPropagation();
        if (_favorites.has(id)) _favorites.delete(id); else _favorites.add(id);
        saveFavorites();
        triggerHaptic();
        initCodexCategoryContents();
        renderCurrentTabContent();
        updateTabsUI();
    }

    function selectTab(idx) { hideRecipeTooltip(); _activeTabIdx = Math.max(0, Math.min(idx, SYSTEM_CONFIG.tabs.length - 1)); updateTabsUI(); renderCurrentTabContent(); if (_jewelPanelOpen) closeJewelPanel(); }
    function toggleUnitSelection(id, forceQty) { if (CLEAN_EXCLUDE_IDS.has(id)) return; if (activeUnits.has(id)) activeUnits.delete(id); else activeUnits.set(id, isOneTime(unitMap.get(id)) ? 1 : Math.min(forceQty || 1, SYSTEM_CONFIG.policy.maxUnitCapacity)); debouncedUpdateAllPanels(); }
    function setUnitQty(id, val) { if (CLEAN_EXCLUDE_IDS.has(id)) return; let q = parseInt(val, 10); if (isNaN(q) || q < 1) return; if (unitMap.get(id) && !isOneTime(unitMap.get(id))) activeUnits.set(id, Math.min(q, SYSTEM_CONFIG.policy.maxUnitCapacity)); debouncedUpdateAllPanels(); }

    function formatRecipe(item, multi = 1, showSep = false) {
        if (!item.recipe || IGNORE_PARSE_RECIPES.includes(item.recipe)) return `<div style="color:var(--text-muted);font-size:0.8rem;">정보 없음</div>`;
        let foundSpecialIds = [];
        let partsHtml = splitRecipe(item.recipe).map(p => {
            const m = p.match(/^([^(\[ ]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?/);
            if (m) {
                const unitId = getUnitId(m[1].trim()), u = unitMap.get(unitId);
                let condHtml = '';
                if (CLEAN_SPECIAL_CONDITIONS[unitId]) { condHtml = `<span class="badge-special-cond" style="pointer-events:none;">특수조건</span>`; if (!foundSpecialIds.includes(unitId)) foundSpecialIds.push(unitId); }
                else if (m[2]) condHtml = `<span class="badge-cond">${m[2].replace(/,/g, ' ')}</span>`;
                const qtyNum = (m[3] ? parseInt(m[3], 10) : 1) * multi;
                if (showSep && m[2] && !CLEAN_SPECIAL_CONDITIONS[unitId]) return `<div class="recipe-badge" style="color:${u ? SYSTEM_CONFIG.grades.colors[u.grade] : "var(--text)"};"><span class="recipe-badge-name">${m[1].trim()}</span><span class="badge-cond" style="margin-left:4px;">${m[2].replace(/,/g, ' ')}</span><span class="badge-qty-wrap"><span class="badge-qty">· ${qtyNum}개</span></span></div>`;
                return `<div class="recipe-badge" style="color:${u ? SYSTEM_CONFIG.grades.colors[u.grade] : "var(--text)"};"><span class="recipe-badge-name">${m[1].trim()}</span><span class="badge-qty-wrap">${condHtml}<span class="badge-qty">· ${qtyNum}개</span></span></div>`;
            }
            return `<div style="color:var(--text-sub); font-size:0.8rem; white-space:nowrap;">${p}</div>`;
        }).join('');
        let specialCondInlineHtml = (!showSep && foundSpecialIds.length > 0) ? `<div class="tsc-wrap" style="margin-top:6px; padding-top:6px;">${foundSpecialIds.map(uid => `<div class="tsc-item" style="margin-top:4px;">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : '';
        return `<div class="${showSep ? '' : 'recipe-vertical'}" ${showSep ? 'style="display:flex; flex-wrap:wrap; gap:5px; align-items:center;"' : ''}>${partsHtml}</div>${specialCondInlineHtml}`;
    }

    // ── [10] UI: 장바구니 ──
    function toggleCartCollapse() {
        _cartCollapsed = !_cartCollapsed;
        const btn = getEl('cartCollapseBtn'); if (btn) btn.textContent = _cartCollapsed ? '▶' : '▼';
        [getEl('cartTabBar'), getEl('cartListArea')].forEach(el => { if (el) el.style.display = _cartCollapsed ? 'none' : ''; });
    }

    function updateCartUI() {
        const cartListArea = getEl('cartListArea'); if (!cartListArea) return;
        const tabBar = getEl('cartTabBar');
        if (tabBar) {
            tabBar.innerHTML = `<button class="cart-tab-btn ${_cartTab === 'active' ? 'active' : ''}" data-action="switchCartTab" data-tab="active">선택 <span class="cart-tab-cnt">${activeUnits.size}</span></button><button class="cart-tab-btn ${_cartTab === 'done' ? 'active' : ''}" data-action="switchCartTab" data-tab="done">완료 <span class="cart-tab-cnt done">${completedTargets.size}</span></button>`;
            tabBar.style.display = _cartCollapsed ? 'none' : '';
        }
        cartListArea.style.display = _cartCollapsed ? 'none' : '';
        if (_cartCollapsed) return;
        if (_cartTab === 'active') {
            if (activeUnits.size === 0) return cartListArea.innerHTML = `<div class="cart-empty-msg">목표 유닛을 선택하면<br>여기에 표시됩니다.</div>`;
            const items = Array.from(activeUnits.keys()).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => (isOneTime(b) ? 1 : 0) - (isOneTime(a) ? 1 : 0) || getGradeIndex(b.grade) - getGradeIndex(a.grade) || (a.name || '').localeCompare(b.name || ''));
            const existingIds = Array.from(cartListArea.querySelectorAll('.cart-item')).map(el => el.id.replace('ci-', '')), newIds = items.map(i => i.id);
            if (existingIds.length !== newIds.length || existingIds.some((id, i) => id !== newIds[i])) {
                cartListArea.innerHTML = items.map(item => `<div class="cart-item" id="ci-${item.id}"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span>${!isOneTime(item) ? `<div class="cart-item-stepper"><button data-action="smartChange" data-uid="${item.id}" data-delta="-1">-</button><span class="ci-val" id="ci-val-${item.id}">${activeUnits.get(item.id) || 1}</span><button data-action="smartChange" data-uid="${item.id}" data-delta="1">+</button></div>` : ''}<button class="cart-item-del" data-action="removeCartItem" data-uid="${item.id}" title="삭제">✕</button></div>`).join('');
            } else items.forEach(item => { const valEl = getEl(`ci-val-${item.id}`); if (valEl) { const qty = activeUnits.get(item.id) || 1; if (valEl.innerText !== String(qty)) valEl.innerText = qty; } });
        } else {
            if (completedTargets.size === 0) return cartListArea.innerHTML = `<div class="cart-empty-msg">완료된 유닛이 없습니다.<br><span style="font-size:0.78rem;color:var(--text-muted);">체크리스트에서 전체완료 시 이곳으로 이동됩니다.</span></div>`;
            cartListArea.innerHTML = Array.from(completedTargets.keys()).map(uid => unitMap.get(uid)).filter(Boolean).sort((a, b) => (isOneTime(b) ? 1 : 0) - (isOneTime(a) ? 1 : 0) || getGradeIndex(b.grade) - getGradeIndex(a.grade) || (a.name || '').localeCompare(b.name || '')).map(item => `<div class="cart-item cart-item-done" id="cid-${item.id}" data-action="restoreUnit" data-uid="${item.id}" title="클릭하면 선택탭으로 복구됩니다"><span class="cart-item-grade"><span class="gtag grade-${item.grade}">${item.grade}</span></span><span class="cart-item-name done-name" style="color:${SYSTEM_CONFIG.grades.colors[item.grade]};">${item.name}</span><span class="ci-onetime done-qty">×${completedTargets.get(item.id) || 1}</span><span class="cart-done-restore-hint always-show">↩ 복구</span></div>`).join('');
        }
    }

    // ── [11] UI: 프리셋 및 제어 ──
    function renderPresetButtons() {
        const tabBar = getEl('presetInlineTabBar'), btnList = getEl('presetInlineBtnList'), wrap = getEl('presetInlineWrap');
        if (!tabBar || !btnList || !wrap) return;
        if (!SYSTEM_CONFIG.presets.length) { wrap.style.display = 'none'; return; }
        const groups = [...new Set(SYSTEM_CONFIG.presets.filter(p => !(p.hidden === true || p.hidden === '비활성')).map(p => p.group || '일반 프리셋'))];
        if (!groups.includes(_presetTab)) _presetTab = groups[0];
        tabBar.style.display = groups.length > 1 ? 'flex' : 'none';
        tabBar.innerHTML = groups.map(g => `<button class="preset-inline-tab-btn${g === _presetTab ? ' active' : ''}" data-action="switchPresetTab" data-tab="${g}">${g}</button>`).join('');
        btnList.innerHTML = SYSTEM_CONFIG.presets.map((p, i) => {
            const isHidden = p.hidden === true || p.hidden === '비활성';
            if (isHidden || (p.group || '일반 프리셋') !== _presetTab) return '';
            const colorKey = PRESET_COLOR_MAP[p.배경색] || 'red', textKey = PRESET_COLOR_MAP[p.글씨색];
            let styleStr = `--btn-color:var(--preset-color-${colorKey})`;
            if (textKey === 'white') styleStr += `;--btn-text-override:#ffffff`;
            else if (textKey === 'black') styleStr += `;--btn-text-override:#111111`;
            else if (textKey) styleStr += `;--btn-text-override:rgb(var(--preset-color-${textKey}))`;
            else if (isBrightColor(p.배경색)) styleStr += ';--btn-text-override:#111111';
            return `<button class="btn-gohaeng" data-action="runPreset" data-preset-idx="${i}" title="${p.tooltip || p.label}" style="${styleStr}">${p.icon ? `<span class="gohaeng-icon">${p.icon}</span>` : ''}<span class="gohaeng-label">${p.label}</span></button>`;
        }).join('');
        btnList.dataset.tab = _presetTab; wrap.style.display = ''; updatePresetBtns();
    }

    function updatePresetBtns() {
        SYSTEM_CONFIG.presets.forEach((p, i) => {
            const btn = document.querySelector(`[data-action="runPreset"][data-preset-idx="${i}"]`), used = p.oneTime && _presetUsed.get(i);
            if (btn) { btn.disabled = !!used; btn.classList.toggle('gohaeng-used', !!used); btn.title = used ? '초기화 버튼으로 재활성화됩니다' : (p.tooltip || p.label); }
        });
    }

    function startSmartChange(id, delta, event) {
        if (event) {
            if (event.type === 'touchstart' || event.type === 'pointerdown') _lastInteractionTime = Date.now();
            else if (event.type === 'mousedown' && Date.now() - _lastInteractionTime < SYSTEM_CONFIG.policy.mouseAfterTouchDelay) { if (event.cancelable) event.preventDefault(); event.stopPropagation?.(); return; }
        }
        stopSmartChange(); triggerHaptic(); _touchHoldCount = 0;
        const action = () => { let accelDelta = delta * (event?.shiftKey ? SYSTEM_CONFIG.policy.accelShiftMultiplier : (Math.floor(++_touchHoldCount / SYSTEM_CONFIG.policy.accelStepUnit) + 1)), current = activeUnits.get(id) || 0; if (current === 0 && accelDelta > 0) toggleUnitSelection(id, accelDelta); else setUnitQty(id, current + accelDelta); };
        action(); _currentAccelInterval = SYSTEM_CONFIG.policy.accelInterval;
        const loop = () => { triggerHaptic(); action(); _currentAccelInterval = Math.max(SYSTEM_CONFIG.policy.accelMinInterval, _currentAccelInterval - SYSTEM_CONFIG.policy.accelDecreaseStep); repeatTimer = setTimeout(loop, _currentAccelInterval); };
        repeatDelayTimer = setTimeout(loop, SYSTEM_CONFIG.policy.holdStartDelay);
    }
    function stopSmartChange() { clearTimeout(repeatDelayTimer); clearTimeout(repeatTimer); _touchHoldCount = 0; }

    function setFontScale(scale) { if (window.innerWidth < SYSTEM_CONFIG.policy.mobileBreakpoint) return; _fontScale = Math.max(SYSTEM_CONFIG.policy.fontScaleMin, Math.min(SYSTEM_CONFIG.policy.fontScaleMax, scale)); document.documentElement.style.setProperty('--fs-scale', _fontScale); const label = getEl('fontSizeLabel'); if (label) label.innerText = `${Math.round(_fontScale * 100)}%`; try { localStorage.setItem(SYSTEM_CONFIG.storageKeys.fontScale, String(_fontScale)); } catch(e) {} }
    function loadFontScale() {
        const ctrl = document.querySelector('.gh-fontsize-ctrl');
        const isTabletPortrait = window.innerWidth >= SYSTEM_CONFIG.policy.mobileBreakpoint && window.innerWidth <= SYSTEM_CONFIG.policy.tabletPortraitMax && window.innerHeight > window.innerWidth;
        if (window.innerWidth < SYSTEM_CONFIG.policy.mobileBreakpoint || isTabletPortrait) { if (ctrl) ctrl.style.display = 'none'; return; }
        try { const saved = localStorage.getItem(SYSTEM_CONFIG.storageKeys.fontScale); if (saved) setFontScale(parseFloat(saved)); } catch(e) {}
    }
    function startFontHold(delta) {
        stopFontHold();
        const action = () => setFontScale(_fontScale + delta);
        action();
        _fontRepeatDelayTimer = setTimeout(() => { const loop = () => { action(); _fontRepeatTimer = setTimeout(loop, SYSTEM_CONFIG.policy.fontHoldRepeatDelay); }; loop(); }, SYSTEM_CONFIG.policy.fontHoldStartDelay);
    }
    function stopFontHold() { clearTimeout(_fontRepeatDelayTimer); clearTimeout(_fontRepeatTimer); }

    function toggleHighlight(uid, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const board = getEl('deductionBoard'); if (!board) return;
        if (!uid || _currentHighlight === uid) { _currentHighlight = null; board.classList.remove('highlight-mode'); }
        else { _currentHighlight = uid; board.classList.add('highlight-mode'); }
        const clearBtn = getEl('btnClearHighlight'); if (clearBtn) clearBtn.hidden = !_currentHighlight;
        const phBtns = document.querySelector('.checklist-ph-btns'); if (phBtns) phBtns.classList.toggle('has-highlight', !!_currentHighlight);
        debouncedUpdateAllPanels();
    }

    // ── [12] UI: 모달 및 툴팁 ──
    function renderJewelMiniGrid() {
        let g = getEl('jewelMiniGrid'); if (!g || g.dataset.rendered) return;
        if (!Array.isArray(JEWEL_DATABASE) || JEWEL_DATABASE.length === 0) return g.innerHTML = `<div style="text-align:center; width:100%; grid-column:1/-1; padding:20px; color:var(--text-sub);">쥬얼 데이터가 로드되지 않았습니다.</div>`;
        g.dataset.rendered = '1';
        g.innerHTML = JEWEL_DATABASE.map(arr => {
            let kr = arr[0];
            const legendLines = arr[1] ? arr[1].split('&').map(p => `<div class="jwm-stat-line">${p.trim()}</div>`).join('') : '';
            const mythicLines = arr[2]?.trim() ? arr[2].split('&').map(p => `<div class="jwm-stat-line">${p.trim()}</div>`).join('') : '';
            return `<div class="jwm-item"><div class="jwm-img-wrap"><img src="https://sldbox.github.io/site/image/jw/${kr}.png" alt="${kr}" loading="lazy" onerror="this.style.opacity='0'"></div><div class="jwm-name">${kr}</div><div class="jwm-stat legend">${legendLines}</div>${mythicLines ? `<div class="jwm-stat mythic">${mythicLines}</div>` : ''}</div>`;
        }).join('');
    }

    function switchLayout(mode) {
        hideRecipeTooltip();
        const layout = getEl('mainLayout'); if (!layout) return;
        _currentViewMode = mode; layout.classList.remove('view-codex', 'view-deduct');
        const btnCodex = getEl('btnViewCodex'), btnDeduct = getEl('btnViewDeduct');
        if (mode === 'deduct') { layout.classList.add('view-deduct'); btnCodex?.classList.remove('active'); btnDeduct?.classList.add('active'); }
        else { layout.classList.add('view-codex'); btnCodex?.classList.add('active'); btnDeduct?.classList.remove('active'); }
    }

    function showTooltipOverlay(tt, event, widthOffset = SYSTEM_CONFIG.policy.tooltipOffset, heightOffset = SYSTEM_CONFIG.policy.tooltipOffset, forceInsideClick = false) {
        let viewWidth = document.documentElement.clientWidth;
        tt.style.maxWidth = `${viewWidth - SYSTEM_CONFIG.policy.tooltipMaxWidthPad}px`;
        const isClickInside = forceInsideClick || (event?.target?.closest('#recipeTooltip') !== null);
        const isAlreadyActive = tt.classList.contains('active');
        if (!isAlreadyActive) { tt.style.left = '-9999px'; tt.style.top = '-9999px'; }
        tt.classList.add('active');
        requestAnimationFrame(() => {
            if (isAlreadyActive && isClickInside) return;
            let x = (event?.clientX || event?.touches?.[0]?.clientX || viewWidth/2) + window.scrollX;
            let y = (event?.clientY || event?.touches?.[0]?.clientY || window.innerHeight/2) + window.scrollY;
            let ttRect = tt.getBoundingClientRect(), ttWidth = ttRect.width || SYSTEM_CONFIG.policy.tooltipFallbackWidth, ttHeight = ttRect.height || SYSTEM_CONFIG.policy.tooltipFallbackHeight;
            const pad = SYSTEM_CONFIG.policy.tooltipScrollPad;
            tt.style.left = `${Math.max(window.scrollX + pad, Math.min(x, viewWidth + window.scrollX - ttWidth - widthOffset))}px`;
            tt.style.top = `${Math.max(window.scrollY + pad, Math.min(y, window.innerHeight + window.scrollY - ttHeight - heightOffset))}px`;
        });
    }

    function showExcludedTooltip(id, event) {
        event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
        const isClickInside = event ? (event.target.closest('#recipeTooltip') !== null) : false;
        const parentUnits = []; unitMap.forEach(pu => pu.parsedRecipe?.some(pr => pr.id === id) && parentUnits.push(pu));
        tt.innerHTML = `<div class="tooltip-header" style="display:flex;align-items:center;gap:6px;"><span class="gtag grade-${u.grade}">${u.grade}</span><span style="color:${SYSTEM_CONFIG.grades.colors[u.grade] || '#fbbf24'};">${u.name}</span><span class="badge-excluded" style="pointer-events:none;margin-left:2px;">선택제한</span></div><div class="tooltip-body" style="font-size:0.82rem;color:var(--text);margin-top:8px;display:flex;flex-direction:column;gap:8px;"><div style="color:var(--text-sub);line-height:1.5;">이 유닛은 아래 상위 유닛의 <b style="color:var(--text);">조합 재료로 자동 포함</b>되므로<br>직접 선택할 수 없습니다.</div>${parentUnits.length > 0 ? `<div style="display:flex;flex-direction:column;gap:4px;">${parentUnits.map(pu => `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;"><span class="gtag grade-${pu.grade}">${pu.grade}</span><span style="color:${SYSTEM_CONFIG.grades.colors[pu.grade] || 'var(--text)'};font-size:0.85rem;font-weight:900;">${pu.name}</span><span style="color:var(--text-muted);font-size:0.75rem;margin-left:auto;">의 하위 재료</span></div>`).join('')}</div>` : ''}</div><div class="tooltip-footer">터치/클릭 또는 ESC로 닫힙니다.</div>`;
        showTooltipOverlay(tt, event, SYSTEM_CONFIG.policy.tooltipOffset, SYSTEM_CONFIG.policy.tooltipOffset, isClickInside);
    }

    function showRecipeTooltip(id, event, isDeduction = false) {
        event?.stopPropagation(); const u = unitMap.get(id), tt = getEl('recipeTooltip'); if (!u || !tt) return;
        const isClickInside = event ? (event.target.closest('#recipeTooltip') !== null) : false;
        let multi = 1;
        if (isDeduction) {
            const { reqMap, baseMap, specialReq } = _lastCalcResult || calculateDeductedRequirements();
            if (COMBO_SLOT_SET.has(id)) multi = specialReq[id] || 0;
            else if (activeUnits.has(id)) multi = reqMap.get(id) || baseMap.get(id) || activeUnits.get(id) || 0;
            else multi = reqMap.get(id) || 0;
        }
        multi = isOneTime(u) ? 1 : Math.max(multi, 1);
        let foundSpecialConds = new Set(); u.parsedRecipe?.forEach(pr => pr.id && CLEAN_SPECIAL_CONDITIONS[pr.id] && foundSpecialConds.add(pr.id));
        tt.innerHTML = `<div class="tooltip-header" style="display:flex;align-items:center;color:${SYSTEM_CONFIG.grades.colors[u.grade]}"><div>${u.name} 조합법 ${multi > 1 ? `<span style="font-size:0.78rem; color:var(--text-sub);">(${multi}개 기준)</span>` : ''}</div></div><div class="tooltip-body">${formatRecipe(u, multi, true)}${foundSpecialConds.size > 0 ? `<div class="tsc-wrap">${Array.from(foundSpecialConds).map(uid => `<div class="tsc-item">${CLEAN_SPECIAL_CONDITIONS[uid]}</div>`).join('')}</div>` : ''}</div>${CLEAN_UNIT_CONDITIONS[u.id] ? `<div class="tsc-wrap" style="margin:6px 8px 2px;"><div class="tsc-item">${CLEAN_UNIT_CONDITIONS[u.id]}</div></div>` : ''}<div class="tooltip-footer"><span class="tooltip-footer-close">터치/클릭 또는 ESC로 닫기</span></div>`;
        showTooltipOverlay(tt, event, SYSTEM_CONFIG.policy.tooltipOffset, SYSTEM_CONFIG.policy.tooltipOffset, isClickInside);
    }

    function hideRecipeTooltip() { getEl('recipeTooltip')?.classList.remove('active'); }

    function toggleJewelPanel() { hideRecipeTooltip(); const modal = getEl('jewelModalOverlay'), btn = getEl('btnJewelToggle'); if (modal?.style.display === 'flex') closeJewelPanel(); else if (modal) { modal.style.display = 'flex'; btn?.setAttribute('aria-expanded', 'true'); btn?.classList.add('is-open'); _jewelPanelOpen = true; renderJewelMiniGrid(); document.body.style.overflow = 'hidden'; modal.focus(); } }
    function closeJewelPanel() { const modal = getEl('jewelModalOverlay'), btn = getEl('btnJewelToggle'); if (modal) modal.style.display = 'none'; btn?.setAttribute('aria-expanded', 'false'); btn?.classList.remove('is-open'); _jewelPanelOpen = false; document.body.style.overflow = ''; }
    function openNoticeModal() { _previousFocus = document.activeElement; const m = getEl('noticeModal'); if (m) { m.style.display = 'flex'; m.focus(); m.addEventListener('keydown', trapModalFocus); } }
    function closeNoticeModal() { const m = getEl('noticeModal'); if (m) { m.style.display = 'none'; m.removeEventListener('keydown', trapModalFocus); } if (_previousFocus) _previousFocus.focus(); }
    function trapModalFocus(e) { if (e.key === 'Escape') closeNoticeModal(); }

    // ── [13] 전역 이벤트 위임 ──
    ['pointerup','pointercancel','touchend','touchcancel','mouseup','contextmenu'].forEach(evt => { document.addEventListener(evt, stopSmartChange); document.addEventListener(evt, stopFontHold); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stopSmartChange(); stopFontHold(); } });

    document.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {
            if (_currentHighlight) toggleHighlight(null);
            if (e.target.id === 'noticeModal') closeNoticeModal();
            if (e.target.id === 'jewelModalOverlay') closeJewelPanel();
            if (getEl('recipeTooltip')?.classList.contains('active') && !e.target.closest('#recipeTooltip')) hideRecipeTooltip();
            return;
        }

        const action = actionEl.dataset.action, uid = actionEl.dataset.uid;
        switch (action) {
            // 레이아웃 및 탭
            case 'switchMainView': switchLayout(actionEl.dataset.view); break;
            case 'selectTab': selectTab(parseInt(actionEl.dataset.tabIdx, 10)); break;
            case 'toggleSelectAllTab': toggleSelectAllTab(); break;

            // 모달
            case 'openNoticeModal': openNoticeModal(); break;
            case 'closeNoticeModal': closeNoticeModal(); break;
            case 'toggleJewelPanel': toggleJewelPanel(); break;
            case 'closeJewelPanel': closeJewelPanel(); break;

            // 프리셋 및 유닛 제어
            case 'runPreset': {
                const idx = parseInt(actionEl.dataset.presetIdx, 10), preset = SYSTEM_CONFIG.presets[idx];
                if (preset && !(preset.oneTime && _presetUsed.get(idx))) { processCommand(preset.command, true); if (preset.oneTime) _presetUsed.set(idx, true); updatePresetBtns(); }
                break;
            }
            case 'switchPresetTab': _presetTab = actionEl.dataset.tab; renderPresetButtons(); break;
            case 'toggleUnit': toggleUnitSelection(uid, 1); break;
            case 'toggleFavorite': e.stopPropagation(); toggleFavorite(uid, e); break;

            // 툴팁 및 하이라이트
            case 'showExcludedTooltip': e.stopPropagation(); showExcludedTooltip(uid, e); break;
            case 'showRecipeTooltip': e.stopPropagation(); showRecipeTooltip(uid, e, actionEl.dataset.isDeduction === 'true'); break;
            case 'toggleHighlight': toggleHighlight(uid, e); break;
            case 'clearHighlight': toggleHighlight(null); break;

            // 장바구니
            case 'switchCartTab': _cartTab = ['active', 'done'].includes(actionEl.dataset.tab) ? actionEl.dataset.tab : 'active'; updateCartUI(); break;
            case 'toggleCartCollapse': toggleCartCollapse(); break;
            case 'removeCartItem': e.stopPropagation(); if (uid) { activeUnits.delete(uid); debouncedUpdateAllPanels(); } break;

            // 체크리스트 (완료 및 복구)
            case 'addComplete': e.stopPropagation(); completeUnit(uid, parseInt(actionEl.dataset.batch || 1, 10)); break;
            case 'completeUnit': e.stopPropagation(); completeUnit(uid); break;
            case 'restoreUnit': e.stopPropagation(); restoreUnit(uid); break;
            case 'resetGroup': e.stopPropagation(); resetGroupCompleted(parseInt(actionEl.dataset.level, 10)); break;
            case 'toggleGroup': {
                const grp = actionEl.closest('.deduct-group'), gridEl = getEl(actionEl.dataset.gridId), icon = actionEl.querySelector('.grp-toggle-icon');
                if (grp) {
                    if (grp.classList.contains('collapsed') || (gridEl && gridEl.style.display === 'none')) { grp.classList.remove('collapsed'); if (gridEl) gridEl.style.display = 'grid'; if (icon) icon.style.transform = 'rotate(0deg)'; }
                    else { grp.classList.add('collapsed'); if (gridEl) gridEl.style.display = 'none'; if (icon) icon.style.transform = 'rotate(-90deg)'; }
                }
                break;
            }
            case 'toggleHideCompleted': _hideCompleted = !_hideCompleted; updateHideCompletedBtn(); debouncedUpdateAllPanels(); break;
            case 'restoreAllCompleted': restoreAllCompleted(); break;
            case 'resetCodex': resetCodex(); break;
        }
    });

    document.addEventListener('pointerdown', e => {
        const actionEl = e.target.closest('[data-action="smartChange"]');
        if (actionEl) { e.stopPropagation(); startSmartChange(actionEl.dataset.uid, parseInt(actionEl.dataset.delta, 10), e); return; }
        if (e.target.closest('[data-action="increaseFont"]')) { e.preventDefault(); startFontHold(SYSTEM_CONFIG.policy.fontScaleStep); return; }
        if (e.target.closest('[data-action="decreaseFont"]')) { e.preventDefault(); startFontHold(-SYSTEM_CONFIG.policy.fontScaleStep); return; }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (getEl('noticeModal')?.style.display === 'flex') return closeNoticeModal();
            if (_jewelPanelOpen) return closeJewelPanel();
            if (_currentHighlight) toggleHighlight(null);
            hideRecipeTooltip();
            const searchInp = getEl('unitSearchInput');
            if (document.activeElement === searchInp) searchInp?.blur();
        }
    });
    window.addEventListener('orientationchange', hideRecipeTooltip);

    // ── [14] 앱 초기화 부트스트랩 ──
    document.addEventListener('DOMContentLoaded', () => {
        try {
            document.documentElement.lang = 'ko';
            if (typeof UNIT_DATABASE === 'undefined' || !Array.isArray(UNIT_DATABASE)) return alert("치명적 오류: data.js의 UNIT_DATABASE를 불러올 수 없습니다.") || console.error("[오류] 데이터베이스 배열 로드 실패");
            UNIT_DATABASE.forEach(kArr => unitMap.set(clean(kArr[0]), { id: clean(kArr[0]), name: kArr[0], grade: kArr[1] || SYSTEM_CONFIG.grades.order[0], category: kArr[2] || SYSTEM_CONFIG.tabs[0]?.key || '테바', recipe: kArr[3], cost: kArr[4] }));
            if (typeof RAW_JEWEL_DATA !== 'undefined' && Array.isArray(RAW_JEWEL_DATA)) { RAW_JEWEL_DATA.forEach(jewel => { JEWEL_DATABASE.push([jewel[0], jewel[1], jewel[2]]); }); }
            initializeCacheEngine();
            loadNexusState();
            loadFontScale();
            renderDashboardAtoms();
            renderDeductionBoard();
            renderTabs();
            selectTab(0);
            debouncedUpdateAllPanels();
            setupSearchEngine();
            switchLayout('codex');
            renderPresetButtons();
            updateHideCompletedBtn();
            if (_cartCollapsed) {
                const btn = getEl('cartCollapseBtn'); if (btn) btn.textContent = '▶';
                [getEl('cartTabBar'), getEl('cartListArea')].forEach(el => { if (el) el.style.display = 'none'; });
            }
        } catch (err) { console.error("[오류] 넥서스 초기화 중 에러 발생:", err); alert("초기화 중 치명적인 오류가 발생했습니다.\n\n" + (err.stack || err.message || String(err))); }
    });
})();
