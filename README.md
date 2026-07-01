# 충청남도의회 AI의정브레인 챗봇

충청남도의회 의정 업무를 보조하기 위한 웹 기반 챗봇 UI입니다. 재정용어, 관련 법령, 충남도청 및 충청남도교육청 예산/사업설명서 질의를 모델별로 선택해 질문할 수 있습니다.

## 주요 기능

- 로그인 기반 챗봇 화면
- 모델별 빠른 질문 분야 선택
- 채팅 기록 저장 및 사이드바 보기
- 글자 크기/폰트 설정
- 테마 선택
  - 레트로
  - 기본테마
  - 의회 문서
- 모바일 키보드 대응 입력창
- AI 답변 준비 중 로딩 UI

## 파일 구조

```text
static/
├── index.html          # 메인 화면
├── style.css           # 전체 UI/테마 스타일
├── script.js           # 채팅, 테마, 기록, 입력 동작
├── rag_server.py       # Flask 서버
├── auth_store.py       # 사용자/대화 저장 로직
├── llm_gateway.py      # LLM API 연결
├── manifest.webmanifest
└── assets              # 아이콘, 이미지, 폰트
```

## 실행 방법

Python 패키지가 필요합니다.

```bash
pip install flask flask-cors requests pypdf
python3 rag_server.py
```

기본 실행 주소:

```text
http://localhost:3000
```

포트 변경:

```bash
PORT=8080 python3 rag_server.py
```

## 환경 변수

```text
PORT                 서버 포트, 기본값 3000
STATIC_DIR           정적 파일 폴더, 기본값 static
UPLOAD_DIR           업로드 파일 저장 폴더, 기본값 uploads
SECRET_KEY           Flask 세션 키
LLM_BASE_URL         LLM API 주소
LLM_API_KEY          LLM API 키
LLM_MODEL            기본 모델명
LLM_MAX_TOKENS       최대 응답 토큰 수
```

## 테마와 글자 설정

상단 메뉴의 `테마(S)`에서 화면 테마를 변경할 수 있습니다.

- `레트로`: 픽셀/윈도우 스타일 UI
- `기본테마`: 밝고 단정한 기본 업무 UI
- `의회 문서`: 문서 카드와 남색/금색 포인트 UI

상단 메뉴의 `글자 설정(T)`에서 글자 크기와 폰트를 변경할 수 있습니다. 설정값은 브라우저 `localStorage`에 저장됩니다.

## GitHub 배포

현재 저장소는 `static/` 폴더를 기준으로 관리됩니다.

```bash
cd /home/ahye/services/chatbot/static
git status
git add index.html style.css script.js README.md
git commit -m "Update chatbot UI"
git push target main
```
