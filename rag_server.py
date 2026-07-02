"""
충청남도의회 AI의정브레인 - LLM 연결 서버
"""

import os
import uuid
from datetime import timedelta
from functools import wraps

import requests
from flask import Flask, jsonify, request, send_file, send_from_directory, session
from flask_cors import CORS
from werkzeug.utils import secure_filename

from auth_store import (
    create_user,
    delete_conversation,
    delete_user,
    find_user_by_id,
    get_uploaded_file,
    init_db,
    list_conversations,
    list_uploaded_files_by_ids,
    list_users,
    save_uploaded_file,
    update_user,
    upsert_conversation,
    user_public,
    verify_user,
)
from llm_gateway import LLM_BASE_URL, LLM_MODEL, build_messages, call_llm, list_models

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "assembly-ai-change-this-secret")
app.permanent_session_lifetime = timedelta(days=int(os.getenv("AUTO_LOGIN_DAYS", "30")))
CORS(app)
init_db()

PORT = int(os.getenv("PORT", "3000"))
STATIC_DIR = os.getenv("STATIC_DIR", "static")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_CONTEXT_CHARS = int(os.getenv("UPLOAD_CONTEXT_CHARS", "18000"))


os.makedirs(UPLOAD_DIR, exist_ok=True)


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = find_user_by_id(user_id)
    if not row or not row["is_active"]:
        session.clear()
        return None
    return user_public(row)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "로그인이 필요합니다."}), 401
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "로그인이 필요합니다."}), 401
        if user["role"] != "admin":
            return jsonify({"error": "관리자 권한이 필요합니다."}), 403
        return fn(*args, **kwargs)

    return wrapper


def extract_file_text(path, filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(path)
            return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception as e:
            print(f"[PDF 텍스트 추출 오류] {e}")
            return ""

    if ext in (".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml"):
        for encoding in ("utf-8", "cp949", "euc-kr"):
            try:
                with open(path, "r", encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
            except Exception as e:
                print(f"[텍스트 파일 읽기 오류] {e}")
                return ""

    if ext == ".docx":
        try:
            import zipfile
            import xml.etree.ElementTree as ET

            with zipfile.ZipFile(path) as docx:
                xml = docx.read("word/document.xml")
            root = ET.fromstring(xml)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            return "\n".join(node.text or "" for node in root.findall(".//w:t", ns)).strip()
        except Exception as e:
            print(f"[DOCX 텍스트 추출 오류] {e}")
            return ""

    return ""


def build_attachment_context(user_id, attachment_ids):
    rows = list_uploaded_files_by_ids(user_id, attachment_ids)
    if not rows:
        return "", []

    parts = []
    sources = []
    remaining = MAX_CONTEXT_CHARS
    for row in rows:
        text = (row["text_content"] or "").strip()
        excerpt = text[:remaining] if remaining > 0 else ""
        if excerpt:
            parts.append(f"[첨부파일: {row['original_name']}]\n{excerpt}")
            remaining -= len(excerpt)
        sources.append(
            {
                "id": row["id"],
                "title": row["original_name"],
                "url": f"/api/files/{row['id']}",
                "type": "uploaded_file",
            }
        )

    return "\n\n".join(parts), sources


@app.route("/api/session", methods=["GET"])
def get_session():
    return jsonify({"user": current_user()})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))
    try:
        user = verify_user(username, password)
    except Exception as e:
        print(f"[로그인 오류] {e}")
        return jsonify({"error": "로그인 처리 중 오류가 발생했습니다. 서버를 재시작해 주세요."}), 500
    if not user:
        return jsonify({"error": "아이디 또는 비밀번호를 확인해 주세요."}), 401

    session.permanent = remember
    session["user_id"] = user["id"]
    return jsonify({"user": user})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/admin/users", methods=["GET", "POST"])
@admin_required
def admin_users():
    if request.method == "GET":
        return jsonify({"users": list_users()})

    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    display_name = (data.get("display_name") or username).strip()
    role = data.get("role") or "user"

    if not username or not password:
        return jsonify({"error": "아이디와 비밀번호가 필요합니다."}), 400

    try:
        return jsonify({"user": create_user(username, password, display_name, role)})
    except Exception as e:
        return jsonify({"error": "이미 사용 중인 아이디이거나 계정을 만들 수 없습니다.", "detail": str(e)}), 400


@app.route("/api/admin/users/<int:user_id>", methods=["PATCH", "DELETE"])
@admin_required
def admin_user_detail(user_id):
    user = current_user()
    if request.method == "DELETE":
        if user and user["id"] == user_id:
            return jsonify({"error": "현재 로그인한 관리자 계정은 삭제할 수 없습니다."}), 400
        delete_user(user_id)
        return jsonify({"ok": True})

    data = request.json or {}
    updated = update_user(
        user_id,
        display_name=data.get("display_name"),
        role=data.get("role"),
        is_active=data.get("is_active"),
        password=data.get("password"),
    )
    if not updated:
        return jsonify({"error": "사용자를 찾을 수 없습니다."}), 404
    return jsonify({"user": user_public(updated)})


@app.route("/api/conversations", methods=["GET", "POST"])
@login_required
def conversations_api():
    user = current_user()
    if request.method == "GET":
        rows = list_conversations(user["id"])
        for row in rows:
            row["messages"] = __import__("json").loads(row["messages"] or "[]")
        return jsonify({"conversations": rows})

    data = request.json or {}
    conversation = data.get("conversation") or {}
    if not conversation.get("id"):
        return jsonify({"error": "대화 ID가 필요합니다."}), 400

    import json

    upsert_conversation(
        user["id"],
        {
            **conversation,
            "messages": json.dumps(conversation.get("messages") or [], ensure_ascii=False),
        },
    )
    return jsonify({"ok": True})


@app.route("/api/conversations/<conversation_id>", methods=["DELETE"])
@login_required
def conversation_delete_api(conversation_id):
    user = current_user()
    delete_conversation(user["id"], conversation_id)
    return jsonify({"ok": True})


@app.route("/api/files", methods=["POST"])
@login_required
def upload_file_api():
    user = current_user()
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "업로드할 파일이 없습니다."}), 400

    original_name = uploaded.filename
    safe_name = secure_filename(original_name) or "uploaded_file"
    file_id = uuid.uuid4().hex
    stored_name = f"{user['id']}_{file_id}_{safe_name}"
    user_dir = os.path.join(UPLOAD_DIR, str(user["id"]))
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, stored_name)
    uploaded.save(path)

    text_content = extract_file_text(path, original_name)
    save_uploaded_file(
        {
            "id": file_id,
            "user_id": user["id"],
            "original_name": original_name,
            "stored_name": stored_name,
            "content_type": uploaded.content_type,
            "text_content": text_content,
        }
    )

    return jsonify(
        {
            "file": {
                "id": file_id,
                "name": original_name,
                "url": f"/api/files/{file_id}",
                "has_text": bool(text_content.strip()),
            }
        }
    )


@app.route("/api/files/<file_id>", methods=["GET"])
@login_required
def file_open_api(file_id):
    user = current_user()
    row = get_uploaded_file(user["id"], file_id)
    if not row:
        return jsonify({"error": "파일을 찾을 수 없습니다."}), 404
    path = os.path.join(UPLOAD_DIR, str(user["id"]), row["stored_name"])
    if not os.path.exists(path):
        return jsonify({"error": "파일이 서버에 없습니다."}), 404
    return send_file(path, download_name=row["original_name"], as_attachment=False)


@app.route("/chat", methods=["POST"])
@login_required
def chat():
    data = request.json or {}
    user_msg = data.get("message", "").strip()
    model = data.get("model") or LLM_MODEL
    history = data.get("history", [])
    attachment_ids = data.get("attachments") or []

    if not user_msg:
        return jsonify({"error": "message 없음"}), 400

    try:
        user = current_user()
        attachment_context, sources = build_attachment_context(user["id"], attachment_ids)
        messages = build_messages(user_msg, history)
        if attachment_context:
            messages.insert(
                max(len(messages) - 1, 0),
                {
                    "role": "user",
                    "content": (
                        "아래 첨부파일 내용을 이번 질문의 참고자료로 활용해 주세요. "
                        "답변에서는 필요한 경우 첨부파일명을 근거로 언급해 주세요.\n\n"
                        f"{attachment_context}"
                    ),
                },
            )
        reply = call_llm(messages, model=model)
        return jsonify({"reply": reply or "응답 실패", "sources": sources})
    except requests.HTTPError as e:
        detail = e.response.text[:500] if e.response is not None else str(e)
        print(f"[LLM API 응답 오류] {detail}")
        return jsonify({"error": detail}), 502
    except Exception as e:
        print(f"[LLM API 연결 오류] {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/models", methods=["GET"])
@login_required
def get_models():
    try:
        models = list_models()
        return jsonify({"models": models or [{"key": LLM_MODEL, "display_name": LLM_MODEL, "type": "llm"}]})
    except Exception as e:
        print(f"[LLM 모델 목록 오류] {e}")
        return jsonify({"models": [{"key": LLM_MODEL, "display_name": LLM_MODEL, "type": "llm"}]})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "llm_base_url": LLM_BASE_URL, "model": LLM_MODEL})


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    print(f"LLM 연결 서버 시작 (Port: {PORT}, LLM: {LLM_BASE_URL}, Model: {LLM_MODEL}, Static: {STATIC_DIR})")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
