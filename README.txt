Neon Parry

개발 실행
  Node.js 22.12 이상
  npm ci
  npm start

검사
  npm test

앱 빌드
  npm run build:mac  → Intel·Apple Silicon 겸용 ZIP
  npm run build:win  → Windows 64비트 EXE
  결과는 release/에 생성됩니다. Mac 빌드는 macOS에서 실행하세요.
  배포용 인증서 서명과 Apple 공증은 별도 설정이 필요합니다.

구조
  src/main/main.cjs           앱 창, 파일 제공, 전체 화면, 기록 복사
  src/main/preload.cjs        앱과 게임 사이의 통신
  src/renderer/index.html     화면 마크업
  src/renderer/styles.css     화면 스타일
  src/renderer/js/game.js     게임 진행, 판정, 적, 능력, 기록, 번역
  src/renderer/js/menu.js     메뉴와 모드·난이도·스테이지 선택
  src/renderer/js/desktop.js  전체 화면·기록 복사 버튼의 앱 연결
  src/renderer/assets/       게임 창 아이콘
  build/electron-builder.cjs 패키징 설정
  build/after-pack.cjs        Mac 서명 전 파일 메타데이터 정리
  build/entitlements.mac.plist
  build/icons/               Mac·Windows 앱 아이콘
  tests/                     게임·메뉴·앱 검사
  release/                   실행 파일 (소스 압축과 Git에서 제외)
  backups/                   이전 소스 (소스 압축과 Git에서 제외)

화면 스크립트는 game → menu → desktop 순서로 로드합니다.
게임 화면 주소는 app://neon-parry/neon-parry.html입니다.
주소와 앱 ID는 기존 기록을 계속 사용하도록 유지했습니다.
기록은 앱에 저장되며 브라우저 기록과는 별개입니다.

원본 게임: qqock2e / https://qqock2e.itch.io/neon-parry
