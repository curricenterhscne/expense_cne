# 참학력 온라인 공동교육과정 수업운영비 신청 시스템

충청남도교육청 중등교육과에서 운영하는 **공동교육과정 수업운영비 신청서 수합 시스템**입니다.

## 업무 흐름

1. 교육청이 학기별 강좌 목록을 확정하여 스프레드시트 `강좌목록` 시트에 붙여넣음
2. 각 강좌 담당 교사가 웹 폼에서 신청서를 작성·제출
3. 제출 즉시 신청서 PDF를 내려받아, **공문으로도 별도 제출** (증빙용)
4. 교육청은 공문 PDF로 증빙을 받고, 온라인 데이터로 집계·교부 처리

> 온라인 제출과 공문 제출이 짝을 이룹니다. 담당자가 `접수상태` 열로 이를 관리합니다.

## 디렉터리 구조

```
expense_cne/
├─ CLAUDE.md                   AI 작업 지침
├─ README.md                   이 파일
├─ docs/                       GitHub Pages 공개 대상
│   ├─ index.html              신청 폼 (단일 페이지)
│   ├─ css/
│   │   ├─ style.css           화면용 스타일
│   │   └─ print.css           인쇄(PDF)용 스타일
│   └─ js/
│       ├─ config.js           GAS URL 등 상수
│       ├─ api.js              GAS 통신
│       ├─ auth.js             연락처 뒷 4자리 인증
│       ├─ form.js             폼 렌더·검증
│       ├─ print.js            인쇄 뷰 생성
│       └─ main.js             진입점·화면 전환
├─ gas/                        clasp 관리 (스프레드시트 바인딩)
│   ├─ appsscript.json
│   ├─ Config.gs               설정 시트 읽기
│   ├─ Api.gs                  doGet / doPost 라우팅
│   ├─ Courses.gs              강좌 목록 조회
│   ├─ Auth.gs                 뒷 4자리 검증·잠금
│   ├─ Submit.gs               신청 upsert
│   ├─ Summary.gs              집계표·미제출 목록
│   ├─ Term.gs                 새 학기 시작
│   └─ Menu.gs                 onOpen 메뉴
├─ legacy/                     기존 구현 (참고용, 수정 금지)
│   ├─ code.gs
│   └─ index.html
└─ manual/                     매뉴얼 (교사용·담당자용)
```

## 기술 스택

| 계층 | 기술 |
|---|---|
| 프런트엔드 | 순수 HTML + CSS + Vanilla JS |
| 호스팅 | GitHub Pages (`docs/` 폴더) |
| 백엔드 | Google Apps Script 웹앱 |
| 데이터 | Google 스프레드시트 |
| GAS 배포 | clasp |
| PDF | 브라우저 인쇄 (`window.print()`) |

## 개발 환경 준비

### 1. clasp 설치 및 로그인

```bash
npm i -g @google/clasp
clasp login
```

### 2. GAS 프로젝트 연결

```bash
cd gas
clasp clone <스크립트ID>
```

> `.clasp.json`이 생성됩니다. 이 파일은 스크립트 ID만 포함하므로 커밋 대상입니다.

### 3. 로컬 확인

```bash
cd docs
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`으로 접속합니다.

## 배포 절차

### 프런트엔드 (GitHub Pages)

`main` 브랜치에 push하면 자동 반영됩니다.

- Settings → Pages → Source: `main` / `docs`

### GAS 백엔드

```bash
cd gas
clasp push
```

> **주의:** 웹앱 URL을 유지하려면 `새 배포`가 아니라 **기존 배포 편집 → 버전: 새 버전**을 선택하세요. `새 배포`를 하면 URL이 바뀌어 교사 안내 링크가 무효화됩니다.

## 매 학기 운영 절차

1. 스프레드시트 메뉴에서 **`새 학기 시작`** 실행
   - 현재 데이터를 보관 폴더에 사본으로 저장
   - 신청내역·집계표·미제출 시트 초기화
   - 강좌목록 2행 이하 삭제
2. `설정` 시트에서 학기명·학기코드·신청기간·접수상태 업데이트
3. `강좌목록` 시트에 새 학기 강좌 데이터 붙여넣기
4. 교사에게 신청 링크 안내 (URL 변경 없음)
5. 신청 마감 후 `접수상태`를 `마감`으로 변경
6. 집계표 생성 → 교부 처리

## 문의

충청남도교육청 중등교육과 담당 장학사 041-640-7221
