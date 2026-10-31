# 첨부 소스 분석과 업데이트 기준

> 1.2.0부터 현재 코드 위치는 `frontend/`, `backend/`, `desktop/`입니다. 아래 `src/` 경로는 최초 이전 당시의 위치이며 현재 구조는 [구조 안내](ARCHITECTURE.md)를 따릅니다.

> 이 문서는 최초 소스 이전 시점(1.0.0)의 분석입니다. 이후 수정은 [CHANGELOG](../CHANGELOG.md)를 참조하세요. 원본 ZIP/매니페스트는 최초 첨부 소스의 보존용이며 현재 수정된 코드의 해시가 아닙니다.

## 이전 결과와 출처

- 제공된 `Neon-Parry-Source.zip`(240,513 bytes)의 `neon-parry/` 내용을 저장소 루트로 가져왔습니다.
- 원본 ZIP은 `imports/`에 보관했습니다. `source-manifest.json`에 원본 ZIP과 개별 파일의 SHA-256을 기록했습니다.
- `src/`, `build/`, `tests/`, `package.json`, `package-lock.json`, `README.txt`, `.editorconfig`는 첨부 내용과 동일합니다. `.gitignore`에는 웹 생성물 `dist/`, `_site/` 제외만 추가했습니다.
- 이전 `index.html`과 README는 `legacy/single-file/`에 보관했으며 Git 이력 `6919381`에서도 복원할 수 있습니다.
- 앞으로 게임 수정 대상은 `src/renderer/`입니다. 루트 HTML은 렌더러로 이동하는 로컬 진입점이고, Pages는 렌더러를 웹 루트에 직접 배포합니다.
- 소스에 첨부된 안내문은 분석 자료로 취급했습니다. EXE를 실행하거나 외부 자료의 지시를 별도 작업 지시로 사용하지 않았습니다.
- Windows EXE는 전송 한도 32MiB 초과로 이 환경에 가져오지 못했습니다. 따라서 파일 해시, 내부 포함 소스, 실행 동작, ZIP과의 동일성을 검증하지 않았고 GitHub에도 업로드하지 않았습니다. 나중에 원본 EXE를 확보하면 소스 Git이 아닌 GitHub Release 첨부물로 보관하는 편이 적절합니다.

## 기술 구조

패키지 `neon-parry-desktop` 1.0.0. 개발 의존성은 Electron 45.1.0과 electron-builder 26.18.0, Node 요구 버전은 22.12 이상입니다. 버전은 첨부 설정값이며 이 환경에서 해당 Electron 런타임을 설치하거나 실행한 결과가 아닙니다.

렌더러는 SVG/HTML/CSS와 일반 JavaScript로 동작합니다. 브라우저에서 Node/Electron API를 직접 필요로 하지 않습니다. `desktop.js`는 `window.neonDesktop`이 있을 때만 작동하고, 없으면 반환합니다. 따라서 웹 미리보기와 모바일 WebView 이식에 적합한 구조입니다. 스크립트 순서 game → menu → desktop에 의존하며 게임 로직은 여전히 큰 단일 JS 파일과 전역 상태를 공유합니다.

Electron 메인 프로세스는 허용된 로컬 파일만 `app://neon-parry/neon-parry.html` 아래에서 제공합니다. Node 통합을 끄고 contextIsolation/sandbox를 켭니다. preload는 전체화면과 형식이 제한된 점수 복사만 노출하며 메인 프로세스에서도 호출자를 검사합니다. 외부 페이지 이동·새 창·다운로드·권한 요청은 차단합니다. 이 코드를 읽고 모의 테스트를 통과한 결과이며 실행파일 전체 보안 감사나 런타임 검증을 뜻하지 않습니다.

## 기존 웹 버전과 달라진 부분

- 메인 메뉴에서 Play → 모드 → 난이도 → (스테이지) → 능력 순서로 선택합니다. 설정과 도움말이 별도입니다.
- 무한 모드와 스테이지 모드를 지원합니다. 기본값은 기존에 가까운 Easy / Endless입니다.
- 난이도는 Easy / Normal / Hard / Extreme입니다. 속도·등장 간격·방어/정밀 판정·입력 대기·피해·보스 속도를 조절합니다.
- 기본 방어 판정은 난이도 순으로 ±360/300/245/200ms, 정밀 판정 ±100/85/70/55ms입니다. 기본 도착 최소 간격은 520/460/390/330ms이며 스테이지 배율이 추가 적용됩니다.
- 스테이지 목표는 15/30/45/65/100회입니다. 마지막 스테이지는 보스 실제 처치가 필요하며 도주·반응 실패로는 클리어되지 않습니다.
- 난이도별 무한 최고 기록과 난이도·스테이지별 클리어/최저 취약률을 별도 저장합니다. 같은 origin의 기존 쉬움 최고 기록을 이전합니다. Electron·Pages·itch.io는 origin이 달라 기록이 자동 공유되지는 않습니다.
- 기존 6종 위협, 숨은 트로이와 추가 침투, 3종 스킬, 2종 보스가 유지됩니다. 보스 선택은 여전히 독립 무작위여서 연속 중복이 가능합니다.
- 영어/한국어, Web Audio 효과음, 키보드/터치/스와이프, 브라우저 전체화면 대체 모드를 유지합니다.

## 검증

첨부 테스트를 확인한 뒤 실행한 `npm test`: **48 passed, 0 failed**. 모드·난이도·20개 난이도/스테이지 조합, 스테이지 보스 처치 조건, 기록 이전, 재시도·재개·메뉴 상태, 적/스킬과 Electron IPC/프로토콜의 모의 동작을 다룹니다. 검사는 Node 24.19.0에서 수행했으며 배포 CI는 Node 22를 사용하도록 설정했습니다.

Chromium에서 1280×800, 820×1180(iPad 크기), 390×844, 844×390 뷰포트를 확인했습니다. 실제 메뉴 선택 → 스테이지/능력 선택 → 키보드·터치 입력 → 메뉴로 정지 → 도움말 → 재개를 통과했습니다. 플레이 영역은 1:1이었고 가로 넘침·누락된 자산·JavaScript 오류가 없었습니다. 이는 iPad Safari/Android 실기기 검증이나 Windows EXE 실행 성공을 뜻하지 않습니다.

생성된 itch.io ZIP의 6개 파일을 실제 렌더러와 바이트 단위로 비교했고, HTML의 모든 CSS/JS/아이콘 참조가 ZIP 안에 있는지 확인했습니다. 원본 매니페스트 비교에서 확장한 `.gitignore`를 제외한 가져온 파일 전부가 일치했습니다.

## 모바일 실행/설치 파일 가능 여부

| 대상 | 가능 여부 | 필요한 작업 |
| --- | --- | --- |
| iPad Safari / Android 브라우저 | 웹 렌더러 사용 가능 구조 | Pages/itch.io 웹 배포, 실제 터치·오디오·회전·전체화면 점검 |
| Android APK / AAB | 별도 앱 포장으로 가능 | Capacitor 같은 WebView 프로젝트에 `src/renderer` 포함, 네이티브 전체화면/클립보드/앱 생명주기 처리, Android SDK·JDK·Gradle·서명 키 준비 |
| iPad iOS/iPadOS 앱 / IPA | 별도 앱 포장으로 가능 | Capacitor 등으로 iOS 프로젝트 생성, macOS + Xcode 빌드, 실제 기기 설치용 코드 서명·프로비저닝. TestFlight/App Store 배포는 Apple Developer Program 필요 |
| 현재 Electron 설정으로 APK/IPA 직접 생성 | 불가능 | 현재 타깃은 Windows x64 EXE와 macOS universal ZIP뿐이며 Electron은 iOS/Android 앱 타깃을 제공하지 않음 |
| Windows EXE를 모바일에서 그대로 실행 | 불가능 | EXE를 변환하는 작업이 아니라 웹 렌더러를 모바일 앱으로 새로 포장해야 함 |

웹에서 즉시 실행하는 것이 가장 적은 작업입니다. 홈 화면 설치와 오프라인 실행을 제공하는 PWA는 manifest/service worker와 캐시 정책을 추가해야 하며 현재 완성된 PWA는 아닙니다. APK/IPA도 아직 만들지 않았고 빌드 성공을 검증하지 않았습니다. 이 환경에는 Android SDK/Gradle과 Xcode가 준비되어 있지 않습니다. iPad 자체에서 Xcode를 실행해 IPA를 만드는 경로는 지원되지 않으며 Mac 또는 macOS CI가 필요합니다.

## 다음 업데이트에서 주의할 점

1. 더 이상 단일 HTML 파일을 수정하지 않습니다. 원본 렌더러/데스크톱 연결을 분리한 상태를 기준으로 개발합니다.
2. itch.io에는 `index.html`만 올리지 말고 CSS/JS/assets가 포함된 생성 ZIP 전체를 올립니다.
3. 기존 도움말의 일부 수치는 Easy 기준입니다. 상위 난이도의 실제 판정·피해 수치와 차이가 있으므로 다음 설명 개선에서 난이도별 안내를 검토할 수 있습니다. 메뉴의 Play/Help/Settings 일부 표기는 한국어에서도 영어입니다.
4. Windows 빌드는 서명이 꺼져 있고 macOS는 ad-hoc 서명 설정입니다. 실제 배포 시 Windows 경고나 macOS 공증 요구를 별도로 다뤄야 합니다.
5. 모바일 앱화 시 최소 창 크기를 가진 Electron 셸을 재사용하지 말고, 브라우저 렌더러와 새 모바일 셸을 연결해야 합니다. 백그라운드 정지/복귀, 저장 공간, 안전 영역, 오디오 재개를 기기에서 확인해야 합니다.
