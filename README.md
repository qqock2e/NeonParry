# Neon Parry

**1.2.0 — 프론트엔드·백엔드 분리** · [게임 실행](https://qqock2e.github.io/NeonParry/) · [패치노트](CHANGELOG.md)

한 저장소에서 독립적으로 실행·배포하는 구조입니다. 기존 싱글플레이 게임과 도전과제·발견 기록을 유지했습니다.

| 폴더 | 역할 | 실행/배포 |
| --- | --- | --- |
| `frontend/` | HTML/CSS/SVG 게임 화면, 입력·로컬 게임 로직, 선택적 API 클라이언트 | 정적 서버 / GitHub Pages |
| `backend/` | Node.js 대전방·참가자 토큰·준비 상태·서버 발급 매치 시작 정보 | Node.js 서비스 / Docker |
| `desktop/` | Electron 창·전체화면·점수 복사 연결 | 기존 데스크톱 빌드 |
| `tests/`, `backend/tests/` | 게임·데스크톱·API·실제 HTTP 클라이언트 검사 | `npm test` |
| `build/`, `scripts/` | Electron 패키징·정적 웹 빌드 도구 | GitHub Actions |

## 지금 지원하는 범위

백엔드는 **2인 대전방의 기반**입니다. 방 생성·참가·탈퇴·준비와 서버 발급 매치 ID/시드/시작 시각을 제공합니다. 화면에는 아직 온라인 메뉴를 추가하지 않았으며 **실제 듀얼 전투, 공격 동기화, 승패·서버 판정은 구현하지 않았습니다.** 현재 적 생성·패링·기록은 프론트엔드의 로컬 게임으로 동작합니다. 서버를 설정하지 않아도 기존 모든 모드를 플레이할 수 있습니다.

[구조·배포 안내](docs/ARCHITECTURE.md) · [API 계약](docs/ONLINE_API.md) · [보스 러쉬·도전과제·도감](docs/PROGRESSION.md)

## 로컬 실행

Node.js 22.12 이상, Python 3. 패키지 설치 없이 웹과 백엔드를 각각 실행할 수 있습니다.

```sh
# 터미널 1: 프론트엔드 → http://127.0.0.1:8000
npm run dev:frontend
```

```sh
# 터미널 2: 백엔드 → http://127.0.0.1:8080/health
npm run start:backend
```

개발 API를 연결하려면 로컬 `frontend/config.js`의 `apiBaseUrl`을 `http://127.0.0.1:8080`으로 바꿉니다. 기본값은 빈 문자열(오프라인)입니다. 이 파일에는 비밀번호나 토큰을 넣지 마세요. 프로덕션 빌드는 아래의 환경변수에서 공개 설정 파일을 생성합니다.

```sh
npm test
npm run build:web
```

`_site/`에는 프론트엔드만 생성되며 백엔드·Electron 파일은 포함되지 않습니다. 백엔드만 검사하려면 `npm run test:backend` 또는 `cd backend && npm test`를 실행하세요.

## GitHub 배포와 iPad 작업

GitHub 웹 편집기/github.dev에서 `frontend/` 또는 `backend/`를 수정하고 main에 커밋합니다. GitHub Actions는 백엔드 컨테이너 실행·전체 테스트 후 프론트엔드만 Pages에 배포합니다. `index.html` 루트 진입점도 `frontend/index.html`로 연결합니다.

**GitHub Pages는 백엔드를 실행하지 못합니다.** 백엔드는 별도 Node.js/컨테이너 호스팅에 올립니다. 제공된 `backend/Dockerfile`을 사용할 수 있습니다. 실제 공개 백엔드 서비스는 아직 배포하지 않았습니다.

백엔드 주소를 확보하면:

1. 백엔드 환경변수 `ALLOWED_ORIGINS`에 `https://qqock2e.github.io`를 설정합니다. `/NeonParry/` 경로는 넣지 않습니다.
2. GitHub 저장소 **Settings → Secrets and variables → Actions → Variables**에 `NEON_API_BASE_URL`을 HTTPS 백엔드 주소로 추가합니다. 공개 주소이므로 비밀값을 넣지 않습니다.
3. Pages 워크플로를 다시 실행하면 `_site/config.js`에 연결 주소가 들어갑니다. 값이 없으면 오프라인 상태로 빌드됩니다.

클라우드 localhost는 iPad에서 직접 열 수 없으므로 iPad 플레이는 Pages 주소를 사용합니다. 별도 호스팅 계정/주소가 정해지지 않아 서버 호스팅 선택·비용 발생 작업은 하지 않았습니다.

## 데스크톱

```sh
npm ci
npm start
npm run build:win
# macOS에서는 npm run build:mac
```

출력은 `release/`입니다. Electron의 메인 파일은 `desktop/main.cjs`, 게임 파일은 `frontend/`입니다. 백엔드는 Electron 실행파일에 포함하지 않습니다. 기존 `app://neon-parry/neon-parry.html` origin을 유지하여 로컬 기록 경로를 보존했습니다. 데스크톱의 외부 연결은 여전히 차단되어 있으며, 네이티브 온라인 연결은 추후 허용할 백엔드/CSP/연결 방식을 확정한 뒤 추가합니다.

## 보존 자료

첨부 원본 소스는 `imports/Neon-Parry-Source.zip`, 이전 단일 HTML 버전은 `legacy/single-file/`에 보관합니다. [최초 소스 분석](docs/SOURCE_ANALYSIS.md)은 당시 구조의 기록입니다. `README.txt`도 첨부 원본 안내문이므로 현재 폴더 경로는 이 README를 따르세요.

itch.io 패키징 도구는 새 프론트엔드 구조를 사용합니다. 다운로드 링크는 요청이 있을 때 제공합니다.
