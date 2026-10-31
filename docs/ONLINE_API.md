# Lobby API v1

아직 실제 듀얼 플레이 API가 아닌 **2인 방·매치 준비 단계의 계약**입니다. JSON만 사용하며 버전 접두사는 `/api/v1`입니다.

| 요청 | 인증 | 동작 |
| --- | --- | --- |
| `GET /health` | 없음 | `{status:"ok",apiVersion:1,storage:"memory"}` |
| `POST /api/v1/rooms` | 없음 | `{name}`으로 방 생성 |
| `POST /api/v1/rooms/:code/join` | 없음 | `{name}`으로 두 번째 플레이어 참가 |
| `GET /api/v1/rooms/:code` | Bearer 토큰 | 같은 방의 공개 상태 조회 |
| `POST /api/v1/rooms/:code/ready` | Bearer 토큰 | `{ready:true/false}`로 본인 준비 상태 변경 |
| `DELETE /api/v1/rooms/:code` | Bearer 토큰 | 탈퇴. 진행 중 매치 정보 취소, 남은 플레이어는 대기 상태 |

생성/참가는 HTTP 201과 `{room,playerId,playerToken}`을 반환합니다. 표시 이름은 선택 사항(기본 Player), 공백 제거 후 1~24자이며 제어 문자는 허용하지 않습니다. 다른 플레이어의 토큰은 공개하지 않습니다. 최대 두 명이며 둘 다 준비하면 서버가 `starting` 단계와 같은 매치 정보를 발급합니다. 서버 시작 시각이 되면 조회 상태는 `playing`으로 전환됩니다. 이는 상태 계약이며 실제 전투 루프는 아직 없습니다. 준비 완료 후 취소하려면 탈퇴합니다.

방 상태 예:

```json
{
  "code": "ABC234",
  "hostId": "public-player-id",
  "phase": "starting",
  "revision": 4,
  "players": [
    {"id":"public-player-id","name":"Host","ready":true},
    {"id":"another-player-id","name":"Guest","ready":true}
  ],
  "match": {"id":"server-match-id","seed":12345,"startAt":1800000003000},
  "serverTime":1800000000000
}
```

시각은 서버 Unix epoch milliseconds입니다. `match`는 대기 상태에서 null이며, 상대가 탈퇴하면 취소됩니다. 마지막 사용자가 나가거나 유휴 만료되면 방은 삭제됩니다. 재참가와 플레이어 토큰 재발급/계정 복구는 아직 제공하지 않습니다.

프론트엔드 연결 예(개발자 콘솔/추후 로비 UI):

```js
const api = NeonOnline.createClient(); // config.js의 apiBaseUrl 사용
const host = await api.createRoom('Host');
// 다른 브라우저/기기:
const guest = await api.joinRoom(host.room.code, 'Guest');
await api.setReady(host.room.code, host.playerToken, true);
await api.setReady(host.room.code, guest.playerToken, true);
const state = await api.getRoom(host.room.code, host.playerToken);
await api.leaveRoom(host.room.code, host.playerToken);
```

다른 기기의 콘솔에서는 공유받은 방 코드와 자기 참가 응답의 토큰만 사용합니다. 로비는 적절한 간격으로 상태 조회할 수 있지만, 이 API로 실시간 패링 입력이나 결과를 전송하지 않습니다. API 클라이언트는 기본 10초 타임아웃을 사용하고 오류에 `code`, `status`를 제공합니다. 모듈 로드 시 자동 접속·토큰 저장은 하지 않습니다.

오류 형식: `{"error":{"code":"ROOM_FULL","message":"..."}}`.

- 400: 잘못된 JSON/이름/준비 값
- 401: 토큰 없음·틀림·다른 방 토큰
- 403: 허용되지 않은 Origin
- 404: 방 만료/없음·잘못된 경로
- 409: 만원 또는 이미 매치 시작
- 413: 2 KiB 초과 본문
- 415: JSON이 아닌 Content-Type
- 429: IP 요청 제한(`Retry-After` 포함)
- 503: 방 개수 상한

브라우저는 정확히 허용된 Origin에서만 호출합니다. 토큰은 `Authorization: Bearer ...` 헤더로 보내고 쿼리 문자열에 넣지 않습니다. 이 API는 클라이언트 점수·승패를 수신하지 않습니다.
