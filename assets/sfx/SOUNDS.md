# AI TRACE 효과음 목록·출처

모든 원본은 **Kenney (www.kenney.nl) — CC0 1.0 (퍼블릭 도메인)**. 개인·교육·상업 이용 자유, 출처 표기 의무 없음.
- Interface Sounds (1.0) — https://kenney.nl/assets/interface-sounds
- Sci-fi Sounds — https://kenney.nl/assets/sci-fi-sounds

원본을 그대로 쓰지 않고 ffmpeg로 **음을 낮추고(피치 0.6~0.9배) 고음을 깎아** 건조하고 낮은 소리로 다듬었다. Web Audio로 합성한 소리는 없다.

| trigger (코드) | 파일 | 원본 | 쓰는 곳 |
|---|---|---|---|
| case_open | case_open.mp3 | Interface/bong_001 | 인트로 "SEARCH RESULT DETECTED" |
| ui_hover | ui_hover.mp3 | Interface/tick_002 | 마우스를 올렸을 때 (아주 작게, 터치 기기에선 안 남) |
| ui_click | ui_click.mp3 | Interface/click_002 | 일반 누르기, 중립 피드백 |
| evidence_found | evidence_found.mp3 | Interface/select_002 | 단서 문장 수집, 대사 등장, 증거 조사 |
| evidence_register | evidence_register.mp3 | Interface/back_002 | 단서 칩·발견 목록·보고서 조각 등록 |
| photo_focus | photo_focus.mp3 | Interface/tick_004 | TRACE 02 사진 영역 포착 |
| scan | scan.mp3 | Sci-fi/computerNoise_001 (0.35초 잘라냄) | TRACE 02 분석 프레임 스캔 |
| remove_information | remove_information.mp3 | Interface/minimize_008 | 후보 제외, TRACE 03 정보 삭제 |
| sensitive_information | sensitive_information.mp3 | Interface/minimize_006 | TRACE 03 비밀번호 삭제 (더 무겁게) |
| connection | connection.mp3 | Interface/switch_005 (앞 0.25초) | 단서 대조, 경로 연결 |
| identity_match | identity_match.mp3 | Interface/maximize_008 + 잔향 | IDENTITY MATCH, TRACE 02 발견 문장 |
| trace_unlock | trace_unlock.mp3 | Interface/maximize_006 | TRACE 카드 등록 |
| impact | impact.mp3 | Sci-fi/impactMetal_001 | TRACE 04 SHARING PATH CONFIRMED |
| case_resolved | case_resolved.mp3 | Sci-fi/impactMetal_000 + Interface/maximize_006 | CASE #01 RESOLVED |
| (ambience) | ambience.mp3 | Sci-fi/spaceEngineLow_004 (350Hz 아래만) | 배경 저음. 아주 작게 반복, 중요한 순간엔 줄여서 정적을 만든다 |

## 음악 (시작·엔딩 화면에만, v2.3)
둘 다 **OpenGameArt.org — CC0 1.0 (퍼블릭 도메인)**. 게임 중에는 음악이 없다.

| 쓰는 곳 | 파일 | 원곡 · 작가 | 주소 |
|---|---|---|---|
| 시작 화면 | music_title.mp3 | First Light Particles · Yoiyami | https://opengameart.org/content/first-light-particles-–-cc0-atmospheric-pianoambient-track |
| 엔딩 | music_ending.mp3 | Calm Ambient 3 (Lifewave 2k) · cynicmusic (The Cynic Project) | https://opengameart.org/content/calm-ambient-3-lifewave-2k |

- ffmpeg로 앞부분만 잘라(시작 80초·엔딩 96초) 앞뒤를 페이드하고 음량을 낮게 맞췄다 (약 −25 LUFS). 반복 재생한다.
- 코드에서 다시 0.35배로 줄여 효과음보다 작게 깐다. 음량은 `js/sound.js`의 `MUSIC.gain`.
- **음악을 빼려면** `js/sound.js`의 `MUSIC`에서 `on: true`를 `on: false`로 바꾼다. 시작도 한 번 누르기로 돌아간다.
- 곡을 바꾸려면 같은 이름의 mp3로 덮어쓴다.

소리를 바꾸려면 같은 이름의 mp3로 덮어쓰면 된다. 음량은 `js/sound.js`의 `SOUNDS`의 gain 값으로 조절한다.
