# Neon Parry

**현재 기준: 첨부한 1.5.2 소스** · [GitHub Pages 게임](https://qqock2e.github.io/NeonParry/) · [패치노트](CHANGELOG.md)

PvP(랜덤 1대1·최대 8인 친구방)와 PvE(CPU 연습)가 포함된 새 소스로 업데이트했습니다. 이번에는 소스 이전과 검증·분석을 진행하며, PvE의 규칙·AI·밸런스는 변경하지 않습니다.

**PvE 작동 흐름과 검증 결과:** [1.5.2 PvE 분석](docs/PVE_1_5_2_ANALYSIS.md)

## PvE 바로 실행

GitHub Pages에서 **Play → Duel / 듀얼 → CPU 연습**을 선택합니다. CPU 연습은 서버 주소 설정이나 인터넷 대전 서버가 필요 없습니다. 연습 상대는 입문/대등/숙련입니다.

```sh
# Node.js 22.12 이상, 패키지 설치 없이 통합 개발 서버 실행
npm run dev:duel
```

`http://127.0.0.1:8000`에서 같은 메뉴를 선택하세요. 정적 화면만 필요하면 `npm run dev:frontend`(Python 3)도 사용할 수 있습니다.

방향키/WASD는 패링, Shift+방향은 공격입니다. Space/공격 버튼으로 공격 모드를 선택한 뒤 방향을 입력할 수도 있습니다. 터치는 구역 탭으로 패링, 라인을 따라 스와이프해 공격합니다. 능력은 1~3번 키나 카드를 눌러 고릅니다.

```sh
npm test
npm run build:web
```

## 이번 이전과 검증의 범위

- 제공된 `Neon-Parry-1.5.2-Source.zip`을 `imports/`에 원본 그대로 보존하고 SHA-256 매니페스트를 추가했습니다.
- 이전 기준 `4e6ffe1`은 Git 이력에 남습니다. 첨부 README의 원본은 `imports/README-1.5.2-original.md`에 보관합니다.
- 첨부 파일의 CRLF 개행을 `.editorconfig`에 맞게 LF로 통일하고 현재 저장소의 Pages 출처를 Render/Codespaces 설정에 추가했습니다. 게임 코드는 개행을 제외하면 첨부 소스 그대로입니다.
- 첨부 원본 테스트 169개가 통과했습니다. 두 보스의 종료·전투 재개 검사를 하나 추가하여 현재 검사는 170개입니다. 구체적 브라우저 검증·한계는 분석 문서를 확인하세요.
- 첨부 README의 외부 공개 서버·다른 GitHub 기준 커밋은 제공 파일의 출처 정보이며 이 저장소에서 새로 검증·배포한 서버 주소가 아닙니다. 외부 Render 서비스를 새로 생성하거나 기존 서비스를 조작하지 않았습니다.

## PvP·서버

다른 사람과 대전하려면 모두 같은 공용 서버에 접속해야 합니다. 현재 버전은 랜덤 매칭·2~8인 친구방·서버 판정·SSE 전송을 포함합니다. 이 작업의 수동/브라우저 검증은 PvE 중심이며 공용 인터넷 PvP 품질까지 보증하는 것은 아닙니다.

```sh
ALLOWED_ORIGINS=https://your-game-host.example npm run start:server
```

통합 서버는 게임과 API를 함께 제공하며 기본 `0.0.0.0:8080`, 호스팅의 `PORT`를 사용합니다. 인터넷 공개에는 HTTPS와 계속 실행되는 Node.js/컨테이너 호스트가 필요합니다.

GitHub Pages는 정적 화면만 배포합니다. 별도 서버가 있다면 저장소 Actions Variables의 `NEON_API_BASE_URL`에 HTTPS 주소를 넣고 재배포하거나 듀얼의 접속 설정을 사용합니다. 값이 없어도 CPU 연습은 동작합니다. 자동 검사에서는 Docker의 통합 서버와 API를 실행하여 확인합니다.

[듀얼 규칙](docs/DUEL.md) · [서버 실행](docs/SERVER.md) · [Render](docs/RENDER.md) · [Codespaces](docs/CODESPACES.md) · [API](docs/ONLINE_API.md)

Codespaces는 개발용이며 유휴 시 중지될 수 있습니다. Render 설정 파일을 GitHub에 보관하는 것만으로 새 서버가 운영되지는 않습니다.

## 변경할 파일

| 경로 | 역할 |
| --- | --- |
| `frontend/js/duel.js` | PvE/PvP 실행 생명주기, CPU AI, 입력 연결 |
| `frontend/js/duel-engine.js` | 양쪽이 공유하는 순수 전투 규칙 |
| `frontend/js/duel-boss.js` | 공유 보스 패턴 |
| `frontend/js/duel-view.js`, `frontend/duel.css` | 기존 경기장 재사용, 상대 화면과 전투 UI |
| `frontend/js/game.js` | 기존 싱글플레이·보스 러쉬 |
| `frontend/js/features.js` | 도감·도전과제·듀얼 능력 도움말 |
| `backend/` | PvP 방·매칭·입력 검증·상태 전송 |
| `desktop/`, `build/` | Electron 연결과 Windows/macOS 패키징 |

## 데스크톱

`npm ci` 후 `npm start`로 실행합니다. `npm run build:win` / macOS의 `npm run build:mac` 결과는 `release/`에 생성됩니다. Electron에서는 CPU 연습과 기존 싱글플레이를 사용하고 온라인 대전은 서버 주소를 브라우저에서 엽니다. 이번에는 Windows/macOS 실행파일을 빌드·실행하지 않았습니다.
