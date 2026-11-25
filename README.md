# MOVIE FRAME MAKER

이미지에 영화 레터박스, 자막, 필름 효과, 눈·비 효과를 입히는 브라우저 기반 도구입니다.
서버 없이 동작하며, 이미지는 사용자의 브라우저 밖으로 전송되지 않습니다.

배포 주소: https://frypotato-cm.github.io/MovieFrame-maker/

## 파일 구조

```
index.html          화면 구조(HTML), 보안 정책(CSP)
style.css           디자인
config.js           ★ 자주 고치는 설정: 폰트 목록, 프리셋, 홍보 링크, 그라데이션 색 팔레트, 용량 제한
app.js              동작 코드
crepe-logo.png      CREPE 로고
x-logo.svg          X 로고
fonts/ChosunGu.woff (선택) 조선굴림체 파일을 직접 올릴 경우 이 위치에

```

## 자주 하는 수정

| 하고 싶은 일 | 고칠 곳 |
|---|---|
| 커미션 프리셋 값/이름 변경 | `js/config.js` 의 `MY_PRESETS` |
| 자막 스타일 프리셋 추가/수정 | `js/config.js` 의 `ST`, `STYLE_PRESETS` |
| 링크·홍보 문구 변경 | `js/config.js` 의 `PROMO` |
| 폰트 추가 | `js/config.js` 의 `FONTS`, `index.html` 상단의 Google Fonts 주소, 크레딧 문구 |
| 크레딧·유의사항 문구 | `index.html` 의 `크레딧 · 유의사항` 부분 |

## 로컬에서 테스트

`index.html`을 바로 열어도 되지만, 가능하면 폴더에서 간단한 서버를 켜서 확인하세요.

```
python3 -m http.server 8000     # 이후 브라우저에서 http://localhost:8000
```

## 배포 (GitHub Pages)

저장소 Settings → Pages → Branch를 `main` / `(root)`로 선택합니다.
수정 후 커밋·푸시하면 몇 분 안에 반영됩니다. 반영이 안 보이면 브라우저 캐시를 지우고(강력 새로고침) 확인하세요.

## 외부 리소스 (인터넷 연결 필요)

| 리소스 | 용도 | 라이선스 |
|---|---|---|
| Google Fonts (나눔고딕, Noto 계열, Inter, Libre Baskerville, Roboto Mono) | 자막 글꼴 | 각 글꼴의 라이선스(Google Fonts 안내) |
| 조선굴림체 (jsDelivr 경유 웹폰트) | 자막 글꼴 | 제공처 안내 확인 필요 |
| JSZip 3.10.1 (cdnjs) | ZIP 저장 | MIT 또는 GPLv3 |
| gifenc 1.0.3 (jsDelivr) | GIF 저장 | MIT |
| Lucide 아이콘 (코드에 포함) | 서식·정렬·공유 아이콘 | ISC |
| mulberry32 난수 코드 (코드에 포함) | 그레인·눈·비 | 퍼블릭 도메인 |

CREPE, X 로고는 각 서비스의 상표이며 링크 용도로만 사용합니다.

## 보안 메모

- 사용자가 입력한 자막·파일명은 화면에 HTML로 삽입하지 않고 캔버스에만 그립니다. (XSS 위험 낮음)
- `index.html`의 Content-Security-Policy가 허용한 주소 외의 스크립트·리소스를 차단합니다.
  `file:` 항목은 로컬 테스트용이라 배포 시 지워도 됩니다. 이 줄 때문에 기능이 막히면 CSP 줄을 잠시 지우고 원인을 확인하세요.
- 외부 링크는 확인 팝업을 거쳐 `noopener,noreferrer`로 새 탭에서 엽니다. (https 주소만 허용)
- 너무 큰 파일(40MB 초과 또는 1억 2천만 픽셀 초과)은 브라우저 보호를 위해 불러오지 않습니다.
- 더 강하게 하려면 JSZip·gifenc·폰트 파일을 저장소에 직접 올려 `'self'`에서만 불러오도록 바꾸세요. (외부 서비스 장애·변조 위험이 사라지고, Google에 사용자 IP가 전달되지 않습니다.)
- GitHub 계정에 2단계 인증을 켜 두세요. (저장소가 바뀌면 사이트도 바뀝니다.)
