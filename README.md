# Neon Parry

**현재 버전: 1.0.1 — [패치노트](CHANGELOG.md)**

이 저장소의 업데이트 기준은 첨부한 **Neon-Parry-Source.zip의 Electron 1.0.0 소스**입니다. 단일 HTML 버전이 아니라 `src/` 아래의 분리된 소스를 수정합니다. 원본 ZIP은 보존하고, 이후 수정은 아래 패치노트에 기록합니다.

- [게임 실행](https://qqock2e.github.io/NeonParry/)
- [최신 itch.io 웹 ZIP](https://qqock2e.github.io/NeonParry/NeonParry-itch.zip)
- [패치노트](CHANGELOG.md) — 게임 메인 화면에서도 확인 가능
- [소스 분석·이전 내역·모바일 가능 여부](docs/SOURCE_ANALYSIS.md)
- [첨부 원본 소스 ZIP](imports/Neon-Parry-Source.zip) / [SHA-256 매니페스트](imports/source-manifest.json)
- 이전 버전: `legacy/single-file/` 및 Git 이력의 `6919381`

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/renderer/index.html` | 게임/메뉴 화면 |
| `src/renderer/styles.css` | 디자인·반응형 배치 |
| `src/renderer/js/game.js` | 판정·적·스킬·보스·모드·난이도·기록·번역 |
| `src/renderer/js/menu.js` | 메인 메뉴·설정·스테이지·능력 선택 |
| `src/renderer/js/desktop.js` | Electron용 전체화면·클립보드 연결; 브라우저에서는 비활성 |
| `src/main/main.cjs`, `preload.cjs` | Electron 앱 창·로컬 파일 제공·제한된 IPC |
| `build/` | Windows/macOS 패키징 설정과 아이콘 |
| `tests/` | 게임·보스·스킬·메뉴·데스크톱 연결 테스트 |
| `scripts/package_itch.py` | 렌더러와 모든 웹 자산을 ZIP에 패키징 |
| `README.txt` | 첨부 소스에 포함된 원본 안내문 |

## iPad에서 개발·실행

GitHub 웹 편집기 또는 github.dev에서 `src/renderer/`를 수정하고 main에 커밋합니다. Pages 워크플로가 테스트와 웹 ZIP 생성 후 배포합니다. 기존 Pages 주소를 그대로 사용합니다. ZIP에는 최상단 `index.html`과 CSS/JS/아이콘이 들어가며 **이제 HTML 하나만 업로드하면 동작하지 않습니다.**

데스크톱용 `main.cjs`와 `preload.cjs`는 웹 배포에 포함하지 않습니다. 현재 기본 웹 미리보기는 Electron 전용 기능을 제외한 동일한 렌더러를 사용합니다. iPad Safari와 Android 실기기 확인은 별도입니다.

## 검사·로컬 실행

Node.js 22.12 이상:

```sh
npm test
```

테스트는 Node 내장 기능만 사용하므로 이 명령에는 `npm ci`가 필요하지 않습니다. Electron 자체를 실행하는 테스트가 아니라 게임과 데스크톱 연결의 모의 테스트입니다.

브라우저 미리보기:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory src/renderer
```

`http://127.0.0.1:8000`을 엽니다. 클라우드의 localhost는 iPad에서 직접 접속할 수 없으므로 iPad에서는 Pages 주소를 사용하세요. 저장소 루트의 `index.html`은 로컬 편의를 위한 렌더러 이동 안내입니다.

웹 ZIP:

```sh
python3 scripts/package_itch.py
```

결과: `dist/NeonParry-itch.zip`. itch.io에서 프로젝트 종류 HTML, 해당 ZIP의 **This file will be played in the browser**를 켜세요. 초기 프레임 960 × 720, 모바일 지원·전체화면 버튼을 권장합니다.

## 데스크톱 실행·빌드

```sh
npm ci
npm start
npm run build:win
```

macOS에서는 `npm run build:mac`으로 Intel/Apple Silicon 범용 ZIP을 만듭니다. 서명·공증은 별도 설정이 필요합니다. Windows 빌드는 x64 portable EXE이며 서명하지 않도록 설정되어 있습니다. 출력 `release/`, 의존성 `node_modules/`는 Git에서 제외합니다. 이 이전 작업에서는 데스크톱 의존성 설치·실행파일 빌드를 수행하지 않았습니다.

첨부 Windows EXE는 파일 전송 한도 32MiB를 초과해 다운로드·분석·업로드하지 못했습니다. 이 저장소에는 원본 EXE가 포함되지 않았으며 해당 EXE와 소스의 일치 여부도 검증하지 않았습니다.
