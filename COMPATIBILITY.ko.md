# 웹 렌더 호환성

판정 기준은 "브라우저에서 오류 없이 그려지는가" 입니다. 픽셀 일치는 보지 않습니다.

_English: [COMPATIBILITY.md](COMPATIBILITY.md)_

## 확인한 컴포넌트

운영 중인 RN 디자인 시스템과 데이터로 갈리는 화면 몇 개로 확인했습니다. 아래 이름은 특정 라이브러리의
API 가 아니라 컴포넌트 종류입니다.

| 컴포넌트 종류         | 상태 | 비고                                                                |
| --------------------- | ---- | ------------------------------------------------------------------- |
| 시맨틱 색상 토큰      | 동작 |                                                                     |
| 아이콘 세트(생성 tsx) | 동작 | 생성된 tsx 라서 svg 변환기가 필요 없음. 크기 3종과 색상 지정 확인   |
| 타이포 토큰           | 동작 |                                                                     |
| 배지                  | 동작 | 타입·색상·크기 변형 확인                                            |
| 콜아웃                | 동작 | 제목 유무·불릿 세 변형 확인                                         |
| 칩                    | 동작 | 판별 union 네 변형. 초안을 손대지 않고 그대로 확인                  |
| 확인 모달             | 동작 | 버튼 하나·둘·위험 세 변형 확인                                      |
| 아코디언 아이템       | 동작 | 접힘 상태의 배치와 typo 변형 확인                                   |
| 하단 고정 버튼        | 동작 | 문구는 children 이라 초안이 빈 칸으로 나옴                          |
| 세그먼티드 컨트롤     | 동작 | 크기 변형 확인. worklet babel 단계가 있어야 뜸                      |
| 탭                    | 동작 | 선택 표시 위치와 폭 변형 확인                                       |
| 텍스트 필드           | 동작 | 기본·focus·비활성 확인                                              |
| 썸네일                | 동작 | 비율 변형 확인. 이미지는 mock URL 이라 빈 칸                        |
| 토스트                | 동작 | 종류별 아이콘·색 확인                                               |
| 데이터로 갈리는 화면  | 동작 | 로딩·빈 상태·조회실패·상태별 확인. 아래 redux·React Query 항목 참고 |
| 바텀시트              | 동작 | 열린 모양 확인. 거동은 아래 reanimated 항목 참고                    |

## 화면 단위 프리뷰

화면은 컴포넌트와 달리 props 가 아니라 데이터로 모습이 갈립니다. `wrappers` 로 Provider 를 씌우고
`states` 로 상태별 서버 응답을 주면 그 조합이 한 줄에 나란히 그려집니다. 단, `states` 는 React Query
캐시를 채우는 수단이므로 그 화면이 React Query 를 쓸 때만 닿습니다(아래 항목 참고).

```tsx
export default definePreview({
    component: SubscriptionScreen,
    variants: { 기본: {} },
    wrappers: ['query', 'navigation'],
    route: { name: 'Subscription', params: {} },
    mockQueries: [{ key: subscriptionQueries.get().queryKey, data: SUBSCRIPTION }],
    states: { 해지예약: [{ key: subscriptionQueries.get().queryKey, data: CANCEL_SCHEDULED }] },
});
```

`navigation` wrapper 는 진짜 navigator 를 세우지 않습니다. 화면이 읽는 것(`useNavigation`·`useRoute`·
`useIsFocused`)만 채웁니다. **이동을 시도하면 아무 일도 일어나지 않습니다.**

safe area 는 `wrappers` 에 없습니다. 기기라면 언제나 있는 값이라 항상 넣습니다. `useSafeAreaInsets`
는 자식 몇 겹 아래에서 불릴 수 있어 선언을 쓰는 사람이 미리 알 수 없고, 빠지면 화면이 통째로
안 뜹니다. inset 은 노치가 있는 375 폭 기기 기준(위 44 · 아래 34)입니다.

`mockQueries` 에 없는 쿼리는 실제로 서버를 부르러 갑니다. 프리뷰에는 인증이 없으므로 대개 에러 화면이
나옵니다. 그것도 봐야 할 상태라 막지 않습니다.

같은 키를 여러 번 적으면 뒤에 온 것이 이깁니다. `states` 가 `mockQueries` 를 덮는 방식입니다.

## 모달·바텀시트

**모양은 그 컴포넌트의 선언으로 봅니다.** props 가 곧 변형이라 비교가 되고, 화면 상태와 무관하게
안정적입니다. 다른 화면에서도 쓰는 시트·모달이면 반드시 이쪽입니다.

바텀시트는 `ref.show()` 로 열므로 `openOnMount` 를 켭니다. 칸 크기가 곧 기기 크기라 기본은 375 × 795
입니다.

시트가 최대 높이에 걸리면 실기처럼 시트 안에서 스크롤됩니다. 웹에서는 **높이가 제한돼도 안쪽 래퍼와
스크롤 영역이 내용 높이 그대로 남아** 스크롤되지 않고 잘렸는데, 안쪽을 부모에 맞춰 줄여 고쳤습니다
(`src/PreviewCase.tsx` 의 `enableSheetScroll`).

줄일 지점은 **스크롤 영역에서 위로 올라가며** 찾습니다. 위에서 아래로 "잘린 요소" 를 찾으면 바깥
래퍼가 먼저 걸려서, 정작 줄여야 할 안쪽은 그대로 둔 채 엉뚱한 곳을 건드립니다.

칸에는 안쪽 여백을 두지 않습니다. 시트·모달처럼 절대 배치되는 것이 이 칸을 기기 화면으로 삼기
때문에, 여백이 있으면 그만큼 어긋난 자리에 놓여 아래가 칸 밖으로 나갑니다.

칸을 늘려 전부 한 화면에 보이게 하는 방법도 있지만 그러면 실기에 없는 크기의 시트가 되어 **무엇이
접히는지가 달라집니다.** 접히는 지점까지 보는 것이 이 도구의 일이라 그쪽을 택하지 않았습니다.

```tsx
export default definePreview({
    component: PlanChangeBottomSheet,
    variants: { 기본: { nextBilling: NEXT_BILLING, onReserveChange: () => undefined } },
    wrappers: ['navigation'],
    openOnMount: true,
});
```

**"눌렀을 때 뜨는가" 는 이 도구가 답하지 않습니다.** 그건 모양이 아니라 동작이고, 화면의 분기 로직입니다.

### 위치를 `undefined` 로 지우는 관용구

`[StyleSheet.absoluteFill, { top: undefined }]` 는 "위쪽 고정을 풀고 아래에 붙여라" 라는 뜻으로
이 저장소 곳곳에서 씁니다. 네이티브는 `undefined` 를 지우지만 **react-native-web 은 건너뛰어서
앞 스타일의 `top: 0` 이 남습니다.** 시트 하단 버튼이 위에 붙고 그만큼 내용이 밀려 아래가 넘쳤습니다.

CSS 에서 같은 뜻인 `auto` 로 바꿉니다(`src/rnStyleCompat.ts`). 위치 속성에만 적용합니다.

## 그대로는 안 되는 것

### 디자인 시스템 배럴

배럴로 가져오면 앱 전역 의존이 열립니다. `react-native-branch` 처럼 모듈 최상단에서 네이티브 상수를 읽는
패키지가 줄줄이 딸려오고, 하나를 스텁으로 막으면 tree-shaking 경로가 바뀌면서 다른 것이 새로 등장합니다.
선언 파일은 `@ui/components/badge/Badge` 같은 직접 경로를 씁니다.

`foundation` 안에서 최상위 배럴을 역참조하는 순환(`DropShadow`)은 프리뷰 쪽 해석 단계에서 끊습니다.
설정의 `importRedirects` 로 프로젝트가 적습니다. 대상 프로젝트는 고치지 않습니다.

### 네이티브 모듈

`react-native-web` 은 화면을 그리는 API 만 옮겨왔습니다. 네이티브 모듈 다리는 `src/stubs/reactNative.tsx` 가
채웁니다. `TurboModuleRegistry` 와 `NativeModules` 는 무엇을 물어도 아무 일도 하지 않는 값을 주고,
`requireNativeComponent` 는 빈 `View` 를 줍니다.

따라서 **네이티브 뷰가 들어가는 자리는 프리뷰에서 빈 칸으로 보입니다.** 레이아웃은 유지되고 내용만 비어 있습니다.

`Image.resolveAssetSource` 도 여기에 있습니다. Metro 는 `require('./x.png')` 를 자산 번호로 바꾸고
이 함수가 번호를 URI 로 되돌리는데, 웹에서는 `requireToImport` 가 이미 URL 문자열을 주므로 그것을
감싸서 돌려줍니다. 크기는 알 수 없어 0 입니다.

analytics·푸시·권한·저장소·로그인·공유처럼 화면을 그리지 않는 패키지는 통째로 비웁니다. 무엇을
비울지는 프로젝트마다 다르므로 기본 목록을 두지 않고 설정의 `nonRenderingPackages` 로 받습니다
(README 「프로젝트별 설정」). 그 값으로 분기하는 화면은 실제와 다르게 보일 수 있습니다.

비울 때 export 이름은 진짜 패키지에서 읽어옵니다(`src/stubModules.ts`). 손으로 적으면 패키지를 하나
비울 때마다 새 이름이 나와 끝나지 않았습니다.

### redux

앱 코드는 화면 몇 겹 아래에서도 `useSelector` 를 부릅니다. react-redux 는 Provider 가 없으면 던지므로
**그 화면이 통째로 안 뜨고 원인은 화면에 안 드러납니다.** 선언을 쓰는 사람이 미리 알 수 없는 것이라
`wrappers` 로 고르게 두지 않고, 설정의 `rootProviders` 에 적은 Provider 를 모든 칸에 씌웁니다. 앱의
루트 Provider 를 그대로 가리키므로 store 도 앱과 같은 것입니다.

프리뷰에는 로그인도 부트스트랩도 없어 **상태는 앱 구동 시점의 초기값 그대로입니다.** 전역 상태로
갈리는 화면은 그 초기값에 해당하는 모습만 보입니다.

devtools 다리(`@rozenite/redux-devtools-plugin`)는 프리뷰에서 할 일이 없어 스텁으로 바꿉니다
(`src/stubs/rozeniteReduxDevTools.ts`). 통째로 비우면 그 패키지의 enhancer 자리가 비어 store 생성이
깨지고, 이 계열은 `exports` 의 `development` 조건이 배포에 없는 `src/` 를 가리켜 Vite 가 그 조건을 켜는
곳에서는 하위 의존부터 해석이 막힙니다.

### React Query 를 안 쓰는 화면

`mockQueries`·`states` 는 React Query 캐시를 채우는 수단입니다. `useState` 로 목록을 들고 repository 를
직접 부르는 화면에는 닿지 않아, 그대로 두면 인증이 없어 조회가 실패한 화면만
보입니다.

그 화면이 데이터에 닿는 지점(repository)을 설정의 `moduleOverrides` 로 바꿉니다. 상태를 고르는 축은
그 화면이 실제로 받는 입력(`route.params` 의 조회 조건)이고, 무엇을 어떤 응답에 대응시킬지는 대체
구현이 정합니다.

### RN 스타일 기본값

Yoga 의 `flexShrink` 기본값은 0 이지만 CSS 는 1 입니다. `react-native-web` 이 이것까지 되돌려주지
않아서, 행 안의 짧은 문구가 실기와 달리 줄바꿈될 수 있습니다(내역 목록에서 긴 항목 이름 옆
금액이 두 줄로 접힙니다). 메울 수 있는 차이이고 아직 메우지 않았습니다.

### 폰트

앱은 굵기를 `fontWeight` 가 아니라 family 이름(`Pretendard-SemiBold`)으로 지정합니다. 브라우저에 그
폰트가 없으면 넷이 전부 같은 대체 글꼴이 되어 **굵기 차이가 통째로 사라집니다.** 문구 일부만 굵게
한 곳도 균일하게 그려져서, 구현에는 있는 강조가 프리뷰에서는 빠진 것처럼 보였습니다. 글자 폭도
달라 줄바꿈 지점과 잘림이 실기와 어긋났습니다.

앱이 링크한 폰트를 그대로 올려 메웁니다(`src/appFonts.ts`). 프로젝트의 `ios/fonts` 를 읽어 파일마다
`@font-face` 를 만들고 개발 서버의 `/@fs` 로 가리킵니다. 폰트를 다른 곳에 두는 프로젝트는 설정의
`fontDirs` 로 더합니다. `/@fs` 가 개발 전용 경로라 이 플러그인은 개발 서버에서만 돕니다.

family 이름은 파일명에서 땁니다. RN 이 부르는 이름은 폰트의 PostScript 이름이라 원리상 파일명과
다를 수 있지만, 링크할 때 둘을 맞추는 것이 관례입니다. 어긋나면 그 폰트만 예전처럼 대체 글꼴로
그려집니다.

Android 쪽(`android/app/src/main/res/font`)은 보지 않습니다. 같은 폰트를 소문자 파일명으로 두어 앱이
지정하는 이름과 맞지 않습니다.

### AB 테스트 배정

실기에서는 앱 부트스트랩이 서버 배정을 받아 redux 에 넣습니다. 프리뷰에는 그 단계가 없어 배정
목록이 비어 있고, 앱 selector 는 미배정을 fail-closed 로 `'A'` 로 봅니다. **플래그 뒤에 있는 화면은
그대로 두면 통째로 빈 칸이 되고, 그 이유가 화면에 드러나지 않습니다.**

AB 배정 selector 를 프리뷰 전용 구현으로 바꿔 배정을 선언에서 읽습니다. 적지 않은 실험은 노출군
(`'B'`)으로 봅니다. 프리뷰로 보려는 것이 대개 플래그 뒤에 만들고 있는 쪽이기 때문입니다.
반대쪽을 보려면 선언에 적습니다.

```tsx
abTestGroups: { checkout_redesign: 'A' },
```

### 플랫폼

`Platform.OS` 는 `'web'` 입니다. RN 생태계가 웹 구현을 고르는 기준이 그것이라 바꾸지 않습니다.
그래서 `isIos`·`isAndroid` 는 둘 다 false 이고, **플랫폼별로 갈리는 스타일은 어느 쪽도 아닌 기본값으로
그려집니다.**

앱 코드 중 ios·android 만 있다고 보고 던지는 곳(플랫폼 설정 모듈, `isProduction` 헬퍼)은 설정의
`moduleOverrides` 로 프리뷰 전용 구현으로 바꿉니다(`src/mobileAppOverrides.ts`). 대상 프로젝트는
고치지 않습니다.

### Metro 전용 문법

`require('./x.png')` 같은 자산 참조와 `.svg` import 는 Metro 가 다루는 것이라 웹 번들러에는 없습니다.
`src/requireToImport.ts` 가 `require` 를 import 로 바꾸고, `src/svgComponents.ts` 가 `.svg` 를
react-native-svg 컴포넌트로 바꿉니다. 조건 안에 있던 `require` 도 항상 로드된다는 차이가 있습니다.

### 그래디언트

`react-native-linear-gradient` 는 CSS 그래디언트로 대신합니다(`src/stubs/linearGradient.tsx`).
네이티브는 뷰의 실제 비율까지 반영하므로 **대각선 그래디언트의 각도가 조금 다를 수 있습니다.**
수직·수평은 같습니다.

### 창 크기와 측정 좌표

브라우저에서 `useWindowDimensions` 와 `measureInWindow` 는 브라우저 창(폭 1440, 칸은 창 구석에서
떨어져 있음)을 기준으로 답합니다. 화면 가장자리를 기준으로 위치를 잡는 코드는 칸 밖에 그려졌습니다.
툴팁이 `right = 화면폭 - pageX - 폭` 으로 계산되어 x = -704 에 그려진 것이 실측 사례입니다.

`src/stubs/reactNative.tsx` 가 둘 다 칸 기준으로 바꿉니다. `useWindowDimensions`·`Dimensions.get` 은
기기 크기를, `measure`·`measureInWindow` 는 칸 왼쪽 위를 원점으로 한 좌표를 줍니다.

**기기 크기는 선언 종류로 갈립니다.** 화면 선언(route·데이터·상태·시트)은 칸이 곧 기기라 칸 크기를
씁니다. 컴포넌트 선언의 칸은 컴포넌트 상자(343 카드, 295 다이얼로그)일 뿐 그 컴포넌트는 여전히
375 기기 위에 있으므로 375 × 795 를 씁니다. `창 폭 - 80` 으로 폭을 정하는 다이얼로그가 기기처럼
295 로 그려집니다.

`Dimensions.get` 은 렌더 중에 불리면(컴포넌트 본문, `useMemo`, `useState` 초기화) 그 칸의 기기를
돌려줍니다. React 개발 빌드가 알려 주는 렌더 중 컴포넌트에서 칸 컨텍스트까지 거슬러 올라갑니다. 렌더
밖(모듈 최상단, 이펙트, 이벤트 처리)에서는 어느 칸인지 알 수 없어 첫 번째 폭의 기기를 돌려줍니다.

### 절대 배치 상자의 폭

폭이 없고 양쪽에 고정되지 않은 `position: absolute` 상자를 Yoga 는 부모가 가로(row)면 내용 폭으로
재고, 부모가 세로(column)일 때만 부모 폭에 맞춥니다(`AbsoluteLayout.cpp` `layoutAbsoluteChild`).
브라우저는 늘 감싼 상자 폭으로 줄입니다. 그래서 좁은 가로 상자(헤더 버튼) 안의 툴팁이 한 글자씩
세로로 접혔습니다.

칸은 그 조건의 상자에 `width: max-content` 를 줍니다(`src/yogaAbsoluteWidth.ts`). 폭을 지정한
상자(`r-width-*` 클래스나 인라인 `width`)와 양쪽에 고정된 상자는 건드리지 않습니다. 마운트 뒤에
붙는 요소도 따라가며 맞춥니다.

### 캡처 순간의 CSS 애니메이션

스피너(react-native-web `ActivityIndicator`)는 무한 CSS 애니메이션으로 돕니다. 페이지 시계는 CSS 를
움직이지 않아서 찍는 순간의 각도가 실행마다 달랐고, 회전한 그래픽의 외곽 상자도 따라 흔들렸습니다
(연속 두 번에 41.7 대 40.7). 캡처는 찍기 직전에 무한 애니메이션을 시작 상태로 되돌리고 유한
애니메이션은 끝 상태로 보냅니다. Playwright `animations: 'disabled'` 와 같은 규칙이고 그림과 기하에
함께 적용합니다. 선언 64개를 두 번 찍어 기하는 모두 같았습니다. 그림은 11개가 눈에 안 보이는
수준(채널 차 합 30 이하)으로만 달랐습니다.

### 컴포넌트 안 `useState` 분기

props 와 응답으로 닿지 않는 분기(탭·펼침·선택)는 선언의 `interactions` 로 캡처 직전에 눌러 만듭니다
(README 「조작 뒤 상태」). 실측: 선택 카드가 두 장인 바텀시트에서 한 카드를 누르면 `--geometry` 의 `texts` 에서
주 버튼 문구가 바뀌었고 누르지 않은 열은 그대로였습니다. 단어가 줄바꿈에 끊기지 않게 앱이 글자 사이에 넣는
U+2060 은 문구 비교에서 무시합니다. `onTextLayout` 의 `lines` 가 비는 rn-web 특성상, 줄 수를 재서 `더보기` 를
띄우는 컴포넌트는 눌러 볼 버튼이 그려지지 않아 대상이 될 수 없습니다.

### Lottie

`lottie-react-native` 는 lottie-web SVG 렌더러로 대신합니다(`src/stubs/lottieView.tsx`). 패키지의 웹
구현은 RN `style` 을 읽지 않고(`webStyle` 만 읽음) 설치되지 않은 optional peer 로 그려서, 블록이 기기
크기를 잃었습니다(스피너 칸 실측: 프리뷰 162, 기기 192). 대신 구현은 `style` 을 그대로 받아 블록
크기가 기기와 같습니다(스피너 칸 194 = 192 + 칸 테두리 2, 퍼널 인트로 110 × 110).

기본은 **마지막 프레임에 멈춥니다.** 매 캡처가 같은 그림을 내고, 등장 연출이 있는 애니메이션은 첫
프레임이 비어 있기 때문입니다. 선언의 `lottieFrame` 으로 `'first'`·`'middle'`·프레임 번호·`'play'` 를
고릅니다. `'play'` 는 페이지 시계로 재생하므로 `timeline` 과 함께 쓰면 시점마다 같은 프레임이 찍힙니다.

로드 실패는 화면에 알리지 않습니다. 애니메이션이 실패하면 인트로를 건너뛰는 화면이 도구 때문에
상태를 바꾸면 안 되기 때문입니다. 실패한 블록에는 `data-lottie-error` 가 붙습니다.

**렌더러가 네이티브와 다릅니다.** 매트·이펙트가 다르게 그려질 수 있으니 애니메이션 내부의 픽셀
차이는 결함 근거로 쓰지 않고 블록의 크기와 위치만 봅니다.

### `react-native-reanimated`

`useAnimatedStyle(() => ...)` 은 문법이 아니라 **빌드 단계에 기대는 API** 입니다. reanimated 의 babel
플러그인이 콜백에서 참조하는 값을 찾아 의존성 배열로 넣어주는데, Metro 가 아닌 Vite 에는 그 단계가
없어 reanimated 가 던지고 화면이 통째로 안 뜹니다. worklet 을 쓰는 파일만 골라 대상 프로젝트의 그
플러그인을 babel 로 돌립니다(`src/reanimatedWorklets.ts`).

이 단계를 넣은 뒤 위 표의 컴포넌트가 전부 그려집니다. **그려지는 것과 거동은 다릅니다.**
드래그·스냅·애니메이션은 gesture-handler 가 웹에서 다르게 도는 만큼 실기와 다릅니다. 열린 모양은
봐도 손으로 끌었을 때는 믿지 않습니다.

## 검사

`npx tsc --noEmit` 은 대상 프로젝트 소스까지 따라갑니다. 그쪽은 자기 tsconfig 기준으로 쓰였으므로
`@resources/*.svg` 나 RN 전용 lib 에서 오류가 남습니다. rn-preview 자체 파일에는 오류가 없습니다.

```bash
npx tsc --noEmit 2>&1 | grep -v '^\.\./my-rn-app'
```
