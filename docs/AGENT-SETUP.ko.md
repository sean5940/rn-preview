# 에이전트 설치 가이드

코딩 에이전트가 그대로 실행하도록 쓴 절차입니다. 사람이 읽어도 되지만, 각 단계는 **실행할 명령과
통과 조건**으로 되어 있습니다. 통과 조건을 만족하지 못하면 다음 단계로 넘어가지 말고 그 단계의
"막히면"을 따릅니다.

_English: [AGENT-SETUP.md](AGENT-SETUP.md)_

이 도구는 혼자 돌지 않습니다. 대상 React Native 프로젝트를 읽어서 그립니다. 그래서 설치의 절반은
"대상 프로젝트를 어떻게 찾게 할 것인가"입니다.

## 0. 전제 확인

```bash
node -v
git --version
```

통과 조건: node 메이저 버전이 22 이상.

막히면: Node 22 이상을 설치하고 다시 확인합니다. 그 아래에서는 설치가 끝나더라도 나중에 vite 가
기동하면서 깨집니다.

## 1. 대상 프로젝트 경로 확정

대상 프로젝트 경로를 먼저 정합니다. **사용자가 경로를 말하지 않았으면 추측하지 말고 묻습니다.**
엉뚱한 프로젝트를 잡으면 화면은 뜨는데 내용이 다른 상태가 되고, 원인이 한참 뒤에 드러납니다.

경로 후보가 있으면 진짜 RN 프로젝트인지 확인합니다.

```bash
node -e 'const p=require(process.argv[1]+"/package.json");console.log(p.dependencies?.["react-native"]?"OK RN 프로젝트":"RN 프로젝트가 아님")' <대상 경로>
```

통과 조건: `OK RN 프로젝트` 출력.

## 2. 클론과 설치

```bash
git clone https://github.com/sean5940/rn-preview.git
cd rn-preview
npm install
```

통과 조건: `npm install` 이 0 으로 끝나고 `tsconfig.paths.json` 이 생겨 있음.

```bash
test -f tsconfig.paths.json && echo "OK 경로 파일 있음"
```

이 파일은 대상 프로젝트 tsconfig 에서 파생해 만들기 때문에 기계마다 내용이 달라 형상관리에서
빠져 있습니다. `npm install` 의 postinstall 이 빈 파일로 만들어 두고, 개발 서버를 처음 띄울 때
실제 내용으로 다시 써집니다.

막히면: postinstall 이 건너뛰어졌을 수 있습니다. `node scripts/ensurePathsFile.mjs` 를 직접 부릅니다.

## 3. 대상 프로젝트 연결

세 가지 방법이 있습니다. **아래로 갈수록 약합니다** — 매번 주는 쪽이 미리 적어둔 쪽을 이깁니다.

**(a) 명령마다 다른 대상을 본다면 환경변수** `MOBILE_APP_PATH` 를 붙입니다. 워크트리를 여러 개
동시에 다루는 자동화와 편집기 확장이 이 방식입니다. **(b) 를 적어 뒀어도 이쪽이 이깁니다.**

```bash
MOBILE_APP_PATH=<대상 경로> npm run dev
```

**(b) 이 클론에서 늘 같은 대상을 본다면 `rn-preview.local.json`** 을 저장소 루트에 만듭니다.
형상관리에서 제외돼 있어 커밋되지 않습니다.

```bash
cat > rn-preview.local.json <<'EOF'
{
    "projectRoot": "<대상 프로젝트 절대경로 또는 rn-preview 기준 상대경로>"
}
EOF
```

**(c) 아무것도 안 주면 형제 디렉토리를 찾습니다.** `rn-preview` 와 대상 프로젝트가 같은 부모 아래
나란히 있고 그 부모에 `react-native` 를 의존하는 폴더가 **하나뿐일 때만** 씁니다.

워크트리를 옆에 두는 배치라면 이 방법은 거의 못 씁니다. 워크트리도 RN 프로젝트라 후보가 여럿이
되고, 도구는 고르지 않고 목록을 보여주며 멈춥니다. 틀린 프로젝트를 그리는 것보다 나은 동작이지만,
그런 배치라면 (a) 나 (b) 로 미리 지정하는 편이 낫습니다.

연결됐는지 확인합니다.

```bash
npm run dev
```

통과 조건: `Local:` 로 시작하는 주소가 출력되고 프로세스가 살아 있음. 확인했으면 종료합니다.

막히면: `RN 프로젝트를 찾지 못했습니다` 가 나오면 아직 대상이 안 잡힌 것입니다. (b) 나 (c) 로
경로를 명시합니다. `형제 디렉토리에서 RN 프로젝트를 여럿 찾았습니다` 는 후보가 여럿이라 고르지
않은 것이니, 출력된 목록 중 하나를 골라 같은 방법으로 지정합니다.

## 4. 선언 디렉토리 정하기

프리뷰는 `*.preview.tsx` 선언을 읽어서 그립니다. 기본 위치는 대상 프로젝트의 `previews/` 입니다.

다른 곳에 두려면 `PREVIEW_DIR` 로 넘기거나 `rn-preview.local.json` 에 `previewRoot` 를 더합니다.
여기도 **환경변수가 셉니다.** `previewRoot` 를 적어 뒀어도 `PREVIEW_DIR` 을 주면 그쪽을 봅니다.
**선언을 팀 저장소에 넣고 싶지 않은 경우**가 여기 해당합니다. 무시되는 디렉토리로 빼고 그 경로를
가리키면 됩니다.

**선언 디렉토리는 이 도구가 쓰는 유일한 자리입니다.** 그 안에 편집기용 `tsconfig.json` 을
만듭니다. 다만 **디렉토리가 이미 있을 때만 만듭니다** — 선언이 하나도 없는 자리에 파일만 남기지
않습니다. 그래서 첫 선언을 만든 다음 실행부터 생깁니다.

선언 디렉토리를 대상 저장소 안에 두기로 했다면 그 경로를 대상 저장소의 `.gitignore` 에 넣으세요.
넣지 않으면 그 생성물이 커밋 후보로 올라옵니다.

```bash
grep -q '^previews/$' <대상 경로>/.gitignore || echo 'previews/' >> <대상 경로>/.gitignore
```

프로젝트마다 다른 설정(대체 모듈, 루트 Provider, 화면을 안 그리는 패키지)은 선언 디렉토리 옆의
`rn-preview.config.json` 이 갖습니다. 대체 구현이 그 프로젝트 사정을 아는 코드라 도구가 아니라
프로젝트 곁에 둡니다. 항목은 [README](../README.ko.md) "프로젝트별 설정"에 있습니다.

## 5. 첫 선언 만들고 그려보기

```bash
npm run preview:new -- <대상 프로젝트의 컴포넌트 파일 경로>
npm run dev
```

통과 조건: 브라우저에서 그 컴포넌트가 격자에 그려짐.

막히면: `X is not exported` 로 멈추면 그 이름을 `src/stubs/nativeStub.ts` 에 더합니다. 화면이 통째로
안 뜨면 앱이 루트에서 늘 씌우는 Provider 가 빠진 경우가 많습니다. `rn-preview.config.json` 의
`rootProviders` 에 더합니다.

## 6. 캡처까지 쓸 경우에만

헤드리스 캡처는 `playwright-core` 로 **시스템 Chrome** 을 부릅니다. 브라우저를 따로 내려받지
않으므로 Chrome 이 없으면 이 기능만 실패합니다.

```bash
node -e 'console.log(require("fs").existsSync("/Applications/Google Chrome.app")?"OK Chrome 있음":"Chrome 없음")'
```

`--name` 이나 `--file` 로 대상을 좁힙니다. **인식하지 못한 플래그는 조용히 무시되고 선언 전체가
캡처되므로**, 오타가 나면 전부 도는 것으로 알아차립니다.

## 설치가 끝났는지 판정

아래가 모두 참이면 끝난 것입니다.

- [ ] `node -v` 가 22 이상
- [ ] `test -f tsconfig.paths.json` 통과
- [ ] `npm run dev` 가 `Local:` 주소를 출력하고 살아 있음
- [ ] 컴포넌트 하나가 브라우저 격자에 그려짐
