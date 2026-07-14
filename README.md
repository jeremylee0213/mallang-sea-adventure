# 말랑바다 모험단

배를 타고 바다의 일본어 블록을 찾고, 섬에서 수학 보물상자와 친근한 몬스터를 만나는 어린이용 3D 교육 어드벤처 MVP입니다.

- Vite + TypeScript + Three.js
- 기본 도형과 Canvas로 만든 독창적인 블록형 그래픽
- 외부 이미지·유료 에셋·개인정보 수집·광고·결제·채팅 없음
- 진행 상황은 브라우저 `localStorage`에만 저장
- Chrome 최신 버전, 데스크톱 키보드 환경 우선

## 공개 플레이

<https://jeremylee0213.github.io/mallang-sea-adventure/>

## 설치와 실행

Node.js 22 이상을 권장합니다.

```bash
npm install
npm run dev
```

터미널에 표시된 `http://127.0.0.1:5173`을 Chrome에서 엽니다.

## 빌드와 테스트

```bash
npm run test
npm run build
```

GitHub Pages용 경로가 포함된 정적 빌드는 다음 명령으로 만듭니다.

```bash
npm run build:pages
```

개발 서버가 실행 중일 때 실제 브라우저 전체 흐름도 검사할 수 있습니다.

```bash
npm run smoke
```

브라우저 스모크 테스트 결과와 화면은 `output/smoke/`에 생성됩니다.

## 조작법

### 바다 항해

- `W` / `↑`: 전진
- `S` / `↓`: 감속·후진
- `A` / `←`: 왼쪽 회전
- `D` / `→`: 오른쪽 회전
- `Space`: 선택 아이템 사용
- `R`: 현재 일본어 발음 다시 듣기
- `E`: 선착장에서 하선
- `M`: 큰 세계 지도 열기·닫기
- `Esc`: 일시정지·계속하기
- `1`~`4`: 아이템 슬롯 선택

### 섬 탐험

- `WASD` / 방향키: 캐릭터 이동
- `Shift`: 달리기
- `Space`: 점프
- `E`: NPC·상자·표지판·배와 상호작용
- `F` 또는 마우스 왼쪽: 반짝 나무칼 공격
- `1`~`4`: 섬용 아이템 슬롯 선택

섬에서는 아이템 슬롯을 클릭해 선택할 수 있고, 슬롯을 더블클릭하면 사용할 수 있습니다. `Space`는 점프에 사용됩니다.

## 주요 기능

- 시작 화면, 이어하기, 처음부터 시작, 보호자 초기화
- 4단계·30초 이내 튜토리얼
- 관성·부드러운 회전·파도 흔들림이 있는 3인칭 돛단배
- 히라가나, 가타카나, 한국어 뜻, 그림, 발음 문제
- `ja-JP` 우선 SpeechSynthesis 발음과 미지원 환경 안전 처리
- 정답 1개와 중복 없는 오답 블록, 친절한 오답 피드백
- 점수, 첫 시도 보너스, 3연속 콤보, 스테이지 보상
- 정답률 기록과 오답 단어 가중 출제, 직전 문제 반복 방지
- 데이터로 구성된 35개 일본어 콘텐츠와 10개 스테이지
- 별빛 나침반, 순풍 병, 바다 자석, 시간 방울
- 회복 사과, 방패 조개
- 미니맵과 큰 세계 항해도
- 시작섬, 제주 바람섬, 벚꽃 학습섬, 독도 해양 관찰섬
- 미국·유럽의 잠긴 미래 교육 여행 구역
- 하선·승선, 캐릭터 이동·달리기·점프
- 두·세 자리 덧셈/뺄셈, 곱셈, 나머지 없는 나눗셈 보물상자
- 일본 테마섬의 절차 생성 그림 일본어 퀴즈
- 귀여운 몬스터, 반짝 나무칼, 별 파티클 소멸
- 체력 0에서 게임 오버 없이 선착장 복귀
- 오늘 배운 말과 개별 발음 복습
- 버전이 포함된 저장, 손상된 저장 자동 복구
- 스테이지 10 축하 화면과 자유 항해 해금
- 탭 비활성화 시 음성·오디오 정리
- 개발 환경의 `render_game_to_text()`와 `advanceTime(ms)` 브라우저 검증 훅

## 프로젝트 구조

```text
src/
├── core/       # 출제, 수학, 저장, 발음, 아이템, 스테이지 규칙
├── data/       # 일본어 35개, 스테이지 10개, 섬·아이템 설정
├── game/       # GameEngine, 입력, 합성 사운드
├── ui/         # DOM HUD, 메뉴, 미니맵, 세계 지도
├── world/      # 바다, 배, 카메라, 섬, 캐릭터, 몬스터, 충돌, 파티클
├── main.ts     # 앱 시작점
├── styles.css  # 어린이 친화 UI 디자인
└── types.ts    # 공통 데이터 계약
tests/          # Vitest 순수 로직 테스트
scripts/        # Playwright 전체 흐름 스모크 테스트
```

게임 상태는 다음처럼 분리되어 있습니다.

```text
MENU → TUTORIAL → SAILING
SAILING → DOCKING → ISLAND_EXPLORATION
ISLAND_EXPLORATION → QUIZ → ISLAND_EXPLORATION
ISLAND_EXPLORATION → DOCKING → SAILING
SAILING → STAGE_CLEAR → 다음 스테이지
STAGE_CLEAR(10) → 축하 화면 → 자유 항해
```

## 일본어 단어 추가 방법

[`src/data/japaneseContent.ts`](src/data/japaneseContent.ts)의 `JAPANESE_CONTENT` 배열에 항목을 추가합니다.

필수 필드:

```ts
{
  id: 'word-example',
  category: 'food',
  japanese: 'パン',
  reading: '판',
  korean: '빵',
  questionType: ['korean-to-japanese', 'picture-to-japanese', 'audio-to-japanese'],
  imageKey: 'food-bread',
  difficulty: 2,
  region: '일본 테마 구역',
  distractorTags: ['food', 'basic-word'],
}
```

`imageKey`에 새 이름을 쓰면 [`src/ui/UIManager.ts`](src/ui/UIManager.ts)의 `createVoxelIcon`에 해당 아이콘을 기본 도형으로 추가합니다. 별도 이미지 파일 없이 Canvas에서 생성됩니다.

## 새 스테이지 추가·수정 방법

[`src/data/stages.ts`](src/data/stages.ts)의 `STAGES` 배열을 수정합니다.

주요 설정:

- `targetAnswers`: 완료에 필요한 정답 수
- `distractorCount`: 오답 블록 수
- `contentIds`: 사용할 일본어 ID
- `questionTypes`: 허용 문제 유형
- `movingDistractors`: 움직이는 오답 사용 여부
- `mathKinds`: 섬 수학 문제 유형
- `reward`: 아이템·섬·장식 보상 문구
- `monsterCount`: 섬의 최대 몬스터 수

현재 진행 화면은 1~10단계를 전제로 하므로 11단계 이상을 추가할 때는 저장값 상한과 최종 축하 조건도 함께 확장해야 합니다.

## 새 섬 추가 방법

[`src/data/islands.ts`](src/data/islands.ts)의 `ISLANDS` 배열에 설정을 추가합니다.

- `position`: 넓은 바다의 섬 중심 좌표
- `dock`: 배가 접근할 선착장 좌표와 방향
- `radius`: 단순 충돌 반경
- `theme`: 절차 생성 환경 종류
- `explorable`: 실제 방문 가능 여부
- `unlockStage`: 지도 표시 단계
- `peaceful`: 몬스터가 없는 평화 섬 여부
- `content`: NPC, 상자, 수학, 언어 표지판, 해양생물 구성

새로운 시각 테마가 필요하면 [`src/world/IslandManager.ts`](src/world/IslandManager.ts)의 테마 색과 절차 생성 분기를 추가합니다.

## 저장 데이터

키: `mallang-sea-adventure.save.v1`

저장 항목:

- 현재·최고 스테이지
- 보상을 받은 완료 스테이지
- 현재·최고 점수
- 해금한 섬
- 발견한 섬과 이미 받은 NPC·보물상자·섬 퀴즈 보상
- 아이템 수량
- 음량·발음·그림자 설정
- 학습한 일본어와 단어별 정답·오답 횟수
- 튜토리얼 완료, 자유 항해 해금, 마지막 플레이 시점

버전과 타입을 검사한 뒤 안전한 값만 복원합니다. JSON이 깨졌거나 필드 타입이 잘못되면 기본 상태로 복구합니다.

## 자동 테스트 범위

Vitest는 다음을 검증합니다.

1. 모든 수학 문제의 정답
2. 나눗셈의 나머지가 0인지
3. 스테이지 완료 경계
4. 일본어 문제의 정답이 정확히 1개인지
5. 오답과 정답·오답끼리 중복되지 않는지
6. 저장·불러오기 왕복
7. 손상·잘못된 저장 데이터 복구
8. 아이템 수량이 음수가 되지 않는지
9. 직전 문제 반복 방지와 오답 단어 가중치
10. 음성 미지원 환경의 안전 동작과 `ja-JP` 우선 선택

Playwright 스모크 테스트는 실제 키 입력으로 메뉴, 튜토리얼, 항해 정답 충돌, 아이템, 지도, 일시정지, 저장 복원, 제주 하선, 수학 상자, 전투, 승선, 벚꽃섬 그림 퀴즈, 스테이지 10 축하, 자유 항해 저장을 확인합니다.

## 알려진 제한 사항과 후속 확장

- 데스크톱 키보드 우선 MVP이며 터치 조작은 아직 없습니다.
- 브라우저·운영체제에 일본어 음성이 없으면 시각 텍스트만 제공됩니다.
- 고급 물리엔진 대신 원형 섬 충돌과 거리 기반 상호작용을 사용합니다.
- 카메라는 캐릭터 방향을 따라가는 자동 어깨 시점이며 자유 마우스 회전은 후속 범위입니다.
- 화염칼, 별 미사일, 스테이지 10 보스는 확장 인터페이스만 남긴 후속 콘텐츠입니다. 현재 MVP 전투는 반짝 나무칼·회복·방패·별 소멸까지 완성돼 있습니다.
- 배·캐릭터 장식 보상은 문구와 설정 데이터로 존재하며 실제 외형 선택 메뉴는 후속 범위입니다.
- 스테이지 안에서 맞힌 중간 개수는 새로고침 시 초기화됩니다. 현재 스테이지·점수·학습 기록·아이템은 유지됩니다.
- Three.js가 단일 번들에 포함되어 빌드 시 500KB 청크 경고가 나오지만, 실제 gzip 전송 크기는 약 170KB입니다.
