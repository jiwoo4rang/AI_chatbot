# 🏛️ 충청남도의회 AI의정브레인 챗봇

충청남도의회 의정 업무를 보조하기 위한 웹 기반 AI 챗봇 프로젝트입니다. 로그인, 사용자 관리, 대화 기록, 파일 업로드, LLM 질의응답, 문서 인덱싱 기능을 포함합니다.

## ✨ 주요 기능

- 🔐 로그인 및 세션 기반 사용자 인증
- 👤 관리자 계정으로 사용자 생성/수정/삭제
- 💬 LLM 기반 챗봇 질의응답
- 🗂️ 사용자별 채팅 기록 저장
- 📎 PDF, DOCX, TXT, MD 등 파일 업로드 및 첨부 질의
- 🎨 레트로, 기본테마, 의회 문서 테마 UI
- 🔤 글자 크기와 폰트 설정
- 📚 `docs/` PDF 문서 ChromaDB 인덱싱
- 📱 모바일 키보드 대응 채팅 입력창

## 📁 폴더 구조

```text
chatbot/
├── rag_server.py          # Flask API 서버 및 정적 파일 서빙
├── auth_store.py          # 사용자, 대화, 업로드 파일 DB 로직
├── llm_gateway.py         # LLM API 호출 로직
├── index_docs.py          # docs PDF 문서 인덱싱 스크립트
├── assembly_ai.db         # SQLite 사용자/대화/업로드 메타데이터 DB
├── docs/                  # 인덱싱할 원본 PDF 문서
├── chroma_db/             # ChromaDB 벡터 저장소
├── uploads/               # 사용자 업로드 파일 저장소
├── static/                # 실제 웹 UI 정적 파일
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── manifest.webmanifest
│   └── *.svg, *.png
└── new_ui_starter/        # 별도 UI 실험/초기 코드
```

## 🚀 실행 방법

프로젝트 루트에서 실행합니다.

```bash
cd /home/ahye/services/chatbot
python3 rag_server.py
```

기본 접속 주소:

```text
http://localhost:3000
```

포트를 바꿔 실행하려면:

```bash
PORT=8080 python3 rag_server.py
```

## 📦 필요 패키지

서버 실행과 파일 처리에 필요한 기본 패키지입니다.

```bash
pip install flask flask-cors requests pypdf
```

문서 인덱싱까지 사용할 경우 추가 패키지가 필요합니다.

```bash
pip install chromadb FlagEmbedding
```

## 🔑 기본 계정

최초 실행 시 관리자 계정이 자동 생성됩니다.

운영 환경에서는 반드시 환경 변수로 변경해서 실행하세요.

```bash
ADMIN_USERNAME=admin_user ADMIN_PASSWORD=strong_password python3 rag_server.py
```

## ⚙️ 환경 변수

```text
PORT                  서버 포트, 기본값 3000
STATIC_DIR            정적 파일 폴더, 기본값 static
UPLOAD_DIR            업로드 파일 저장 폴더, 기본값 uploads
APP_DB_PATH           SQLite DB 경로, 기본값 assembly_ai.db
SECRET_KEY            Flask 세션 키
ADMIN_USERNAME        최초 관리자 아이디, 기본값 admin
ADMIN_PASSWORD        최초 관리자 비밀번호, 기본값 admin1234
LLM_BASE_URL          LLM API 주소
LLM_API_KEY           LLM API 키
LLM_MODEL             기본 모델명
LLM_MAX_TOKENS        최대 응답 토큰 수
UPLOAD_CONTEXT_CHARS  첨부파일 참고 텍스트 최대 길이
```

## 📚 문서 인덱싱

`docs/` 폴더에 PDF 파일을 넣고 인덱싱 스크립트를 실행합니다.

```bash
python3 index_docs.py
```

인덱싱 결과는 `chroma_db/` 폴더에 저장됩니다.

## 🧩 주요 API

```text
GET  /health                 서버 상태 확인
POST /api/login              로그인
POST /api/logout             로그아웃
GET  /api/session            현재 로그인 세션 확인
GET  /models                 LLM 모델 목록
POST /chat                   챗봇 질의
GET  /api/conversations      대화 목록 조회
POST /api/conversations      대화 저장
POST /api/files              파일 업로드
GET  /api/files/<file_id>    업로드 파일 열기
```

## 🎨 UI

웹 화면은 `static/` 폴더에서 관리합니다.

- `index.html`: 화면 구조
- `style.css`: 전체 스타일과 테마
- `script.js`: 로그인, 대화, 기록, 테마, 파일 업로드 동작

지원 테마:

- 🕹️ 레트로
- 💼 기본테마
- 📄 의회 문서

## 📝 참고

- `uploads/`에는 사용자별 업로드 파일이 저장됩니다.
- `assembly_ai.db`에는 사용자, 대화 기록, 업로드 파일 메타데이터가 저장됩니다.
- `chroma_db/`는 문서 인덱싱 결과이므로 재생성이 가능합니다.
- `static/` 폴더 안에도 과거 실행용 서버 파일이 일부 남아 있을 수 있지만, 현재 루트 기준 실행은 `rag_server.py`를 사용합니다.
