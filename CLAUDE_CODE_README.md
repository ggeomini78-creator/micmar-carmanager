# 카매니저 (Car Manager) — Claude Code 인계 문서

## 프로젝트 개요
자동차 정비일지 및 차계부 웹앱.
백엔드 없이 localStorage만 사용하는 순수 HTML/CSS/JS PWA.
GitHub Pages 배포: https://ggeomini78-creator.github.io/micmar-carmanager/

---

## 파일 구조

```
micmar-carmanager/
├── index.html          # 메인 HTML (모든 페이지 + 모달 포함)
├── manifest.json       # PWA 매니페스트
├── favicon.svg         # 브라우저 탭 아이콘 (SVG)
├── icon-180.png        # iOS 홈화면 아이콘 (apple-touch-icon)
├── icon-192.png        # 안드로이드 홈화면 아이콘
├── icon-512.png        # PWA 고해상도 아이콘
├── css/
│   └── style.css       # 전체 스타일 (테마 CSS 변수 포함)
└── js/
    ├── data.js         # 데이터 CRUD + localStorage 관리
    └── app.js          # UI 로직 + 테마/설정
```

---

## 구현된 기능

### 차량 관리
- 다중 차량 등록 (사이드바 드롭다운 전환)
- 차량 정보 수정 (닉네임, 제조사, 모델, 연식, 차량번호, 주행거리)
- 차량 삭제 (해당 차량 모든 기록 포함 삭제)

### 주유 기록
- 리터 입력 / 금액 입력 토글
- 주유량·단가 → 금액 자동계산 (또는 금액·단가 → 주유량 자동계산)
- 이전 주유 기록 기반 연비 자동계산 및 미리보기
- 수정 / 삭제

### 정비 기록
- 15개 정비 항목 카테고리 (엔진오일, 타이어, 브레이크 등)
- **정비 입력 → 소모품 관리 자동 연동** (8개 항목)
- 수정 / 삭제

### 소모품 교체주기 관리
- 8개 소모품 (엔진오일/타이어/브레이크패드/배터리/에어필터/에어컨필터/와이퍼/냉각수)
- 정비 기록 전체를 자동 스캔해 가장 최근 교체일 반영
- 교체주기 대비 경과 km/일수 게이지바
- 상태: 정상(초록) / 교체 권장 70%(주황) / 교체 필요 90%(빨강)
- 직접 교체 기록 추가도 가능

### 기타 지출
- 카테고리: 보험료, 자동차세, 주차비, 하이패스, 세차, 튜닝/용품, 기타
- 수정 / 삭제

### 대시보드
- 총 주행거리, 평균 연비, 이번달 지출, 정비 횟수 stat 카드
- stat 카드 클릭 → 해당 페이지 이동
- **월별 캘린더** — 기록 있는 날짜에 컬러 점 표시 (주유=주황, 정비=파랑, 지출=오렌지)
- 날짜 클릭 → 그날 기록 팝업
- 소모품 상태 미리보기
- 최근 활동 6건

### 통계
- 월별 지출 스택 바차트
- 카테고리 도넛차트
- 연비 추이 라인차트
- 연간 요약 (총지출, 주유총액, 정비총액, 총주유량, 평균연비)
- 연도 선택 가능

### 설정 (3줄 메뉴)
- **앱 이름 변경** (localStorage 저장, 매니페스트 동적 갱신)
- **테마 색상 7종**: 앰버(기본)/블루/그린/퍼플/레드/틸/라이트
  - 배경·사이드바·카드·테두리·차트까지 전체 적용
  - CSS 변수: --accent, --accent2, --accent-rgb, --bg, --surface, --bg3, --border, --text 등
- 데이터 백업 (JSON 파일 다운로드)
- 데이터 복원 (JSON 파일 업로드)

### PWA / 모바일
- `manifest.json` — 안드로이드 홈화면 아이콘
- `icon-180.png` — iOS apple-touch-icon (PNG, SVG 불가)
- `meta apple-mobile-web-app-capable` — iOS 전체화면 실행
- 모바일: 하단 탭 네비게이션 (6개 탭, safe-area-inset 대응)
- 데스크탑: 좌측 고정 사이드바
- 반응형 768px 기준

---

## 데이터 구조 (localStorage)

### 키
- `carManager_v1` — 차량 + 기록 전체
- `carManager_settings` — 앱 이름, 테마
- `carManager_currentVehicle` — 마지막 선택 차량 ID

### 스키마
```js
// carManager_v1
{
  vehicles: [
    { id, nickname, make, model, year, plate, mileage, createdAt }
  ],
  logs: {
    [vehicleId]: {
      fuel: [{ id, date, mileage, amount, price, total, fuelEff, memo }],
      repair: [{ id, date, category, shop, mileage, cost, memo }],
      expense: [{ id, date, category, name, cost, memo }],
      consumables: {
        engineOil: { lastDate, lastMileage },
        tire: { lastDate, lastMileage },
        // ...
      }
    }
  }
}

// carManager_settings
{ appName: "카매니저", theme: "amber" }
```

---

## 정비→소모품 매핑 (data.js: REPAIR_TO_CONSUMABLE)
```
엔진오일 교환    → engineOil
타이어 교체      → tire
브레이크 패드 교체 → brakePad
배터리 교체      → battery
에어필터 교체    → airFilter
에어컨 필터 교체 → cabinFilter
와이퍼 교체      → wiper
냉각수 교체      → coolant
```

---

## 외부 의존성
- Chart.js 4.4.0 (CDN: cdn.jsdelivr.net)
- Noto Sans KR, Bebas Neue, DM Mono (Google Fonts)
- 그 외 순수 Vanilla JS (프레임워크 없음)

---

## 향후 개선 아이디어 (미구현)
- 주유소 즐겨찾기
- 사진 첨부 (IndexedDB)
- 차량 보험/정기검사 만료일 알림
- 월별 예산 설정
- CSV 내보내기
