"""Tests for KAWAN PAS AI Assistant (Claude) endpoints + regression."""
import os
import json
import time
import requests
import pytest

def _load_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
_load_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin", "Admin@123")


@pytest.fixture(scope="module")
def supervisor_token():
    return _login("supervisor", "Supervisor@123")


@pytest.fixture(scope="module")
def operator_token():
    return _login("operator1", "Operator@123")


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- Role gating ----
def test_operator_blocked_ai_chat(operator_token):
    r = requests.post(f"{API}/ai/chat", json={"message": "hi"}, headers=_headers(operator_token), timeout=20)
    assert r.status_code == 403


def test_operator_blocked_ai_sessions(operator_token):
    r = requests.get(f"{API}/ai/sessions", headers=_headers(operator_token), timeout=20)
    assert r.status_code == 403


def test_operator_blocked_ai_report(operator_token):
    r = requests.post(f"{API}/ai/report", json={"period": "today"}, headers=_headers(operator_token), timeout=20)
    assert r.status_code == 403


def test_unauth_blocked_ai_chat():
    r = requests.post(f"{API}/ai/chat", json={"message": "hi"}, timeout=20)
    assert r.status_code == 401


# ---- Streaming helpers ----
def _consume_sse(resp, max_seconds=45):
    text_parts, meta, err = [], {}, None
    start = time.time()
    buffer = ""
    for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
        if chunk is None:
            continue
        buffer += chunk
        while "\n\n" in buffer:
            part, buffer = buffer.split("\n\n", 1)
            line = part.strip()
            if not line.startswith("data:"):
                continue
            try:
                obj = json.loads(line[5:].strip())
            except Exception:
                continue
            if "text" in obj:
                text_parts.append(obj["text"])
            if "error" in obj:
                err = obj["error"]
            if obj.get("done"):
                meta = obj
        if time.time() - start > max_seconds:
            break
    return "".join(text_parts), meta, err


# ---- Chat streaming ----
def test_ai_chat_stream_admin(admin_token):
    r = requests.post(
        f"{API}/ai/chat",
        json={"message": "Berapa pemindaian hari ini? Jawab singkat."},
        headers=_headers(admin_token),
        stream=True,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    assert "text/event-stream" in r.headers.get("content-type", "")
    text, meta, err = _consume_sse(r, max_seconds=45)
    assert err is None, f"stream error: {err}"
    assert len(text) > 10, f"empty answer: {text!r}"
    assert meta.get("done") is True
    assert meta.get("session_id")
    # store for next test
    pytest.ai_session_id = meta["session_id"]


def test_ai_sessions_list(admin_token):
    r = requests.get(f"{API}/ai/sessions", headers=_headers(admin_token), timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    sid = getattr(pytest, "ai_session_id", None)
    if sid:
        assert any(s["session_id"] == sid for s in data), "created session not in list"


def test_ai_session_messages(admin_token):
    sid = getattr(pytest, "ai_session_id", None)
    if not sid:
        pytest.skip("no session id")
    r = requests.get(f"{API}/ai/sessions/{sid}/messages", headers=_headers(admin_token), timeout=20)
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 2  # user + assistant
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles


def test_ai_chat_empty_message(admin_token):
    r = requests.post(f"{API}/ai/chat", json={"message": "   "}, headers=_headers(admin_token), timeout=20)
    assert r.status_code == 400


# ---- Report ----
def test_ai_report_today_stream(admin_token):
    r = requests.post(
        f"{API}/ai/report",
        json={"period": "today"},
        headers=_headers(admin_token),
        stream=True,
        timeout=90,
    )
    assert r.status_code == 200, r.text
    text, meta, err = _consume_sse(r, max_seconds=75)
    assert err is None
    assert len(text) > 100, f"report too short: {text!r}"
    assert meta.get("done") is True


# ---- Regression ----
def test_supervisor_can_access_approvals(supervisor_token):
    r = requests.get(f"{API}/activities?status=submitted", headers=_headers(supervisor_token), timeout=20)
    assert r.status_code == 200


def test_activities_export_excel(admin_token):
    r = requests.get(f"{API}/activities/export", headers=_headers(admin_token), timeout=30)
    assert r.status_code == 200
    ctype = r.headers.get("content-type", "")
    assert "spreadsheet" in ctype or "excel" in ctype or "octet-stream" in ctype
