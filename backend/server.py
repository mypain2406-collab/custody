import os
import io
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import bcrypt
import jwt
import qrcode
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="SIMAPAN API")
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_MINUTES = 60 * 12

logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def clean_user(u: dict) -> dict:
    u = dict(u)
    u.pop("_id", None)
    u.pop("hashed_password", None)
    return u


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan atau nonaktif")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity": now_iso()}})
    return clean_user(user)


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return user
    return dep


async def log_audit(user: dict, entity_type: str, entity_id: str, action: str,
                    changes: Optional[dict] = None, request: Optional[Request] = None):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "username": user.get("username"),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "changes_json": changes or {},
        "ip_address": request.client.host if request and request.client else None,
        "device_info": request.headers.get("user-agent") if request else None,
        "timestamp": now_iso(),
    }
    await db.audit_log.insert_one(doc)


# ---------------- Settings ----------------

DEFAULT_SETTINGS = {
    "key": "app_settings",
    "app_title": "SIMAPAN",
    "app_subtitle": "Sistem Monitoring Aktivitas Warga Binaan",
    "institution_name": "Lembaga Pemasyarakatan",
    "activity_categories": [
        {"key": "keagamaan", "label": "Pembinaan Keagamaan"},
        {"key": "keterampilan", "label": "Pembinaan Keterampilan"},
        {"key": "kesehatan", "label": "Layanan Kesehatan"},
        {"key": "pendidikan", "label": "Pendidikan & Pelatihan"},
        {"key": "olahraga", "label": "Olahraga & Rekreasi"},
        {"key": "keamanan", "label": "Titik Keamanan"},
        {"key": "lainnya", "label": "Lainnya"},
    ],
    "location_types": [
        {"key": "religious", "label": "Keagamaan"},
        {"key": "skills", "label": "Keterampilan"},
        {"key": "health", "label": "Kesehatan"},
        {"key": "education", "label": "Pendidikan"},
        {"key": "sports", "label": "Olahraga"},
        {"key": "security", "label": "Keamanan"},
        {"key": "other", "label": "Lainnya"},
    ],
    "inmate_conditions": [
        {"key": "baik", "label": "Baik"},
        {"key": "sakit", "label": "Sakit"},
        {"key": "perlu_perhatian", "label": "Perlu Perhatian"},
    ],
}


async def get_settings_doc() -> dict:
    s = await db.settings.find_one({"key": "app_settings"})
    if not s:
        s = dict(DEFAULT_SETTINGS)
        await db.settings.insert_one(s)
    s.pop("_id", None)
    return s


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc()


@api_router.put("/settings")
async def update_settings(payload: dict, request: Request,
                          user: dict = Depends(require_roles("admin"))):
    allowed = ["app_title", "app_subtitle", "institution_name",
               "activity_categories", "location_types", "inmate_conditions"]
    before = await get_settings_doc()
    update = {k: payload[k] for k in allowed if k in payload}
    await db.settings.update_one({"key": "app_settings"}, {"$set": update}, upsert=True)
    after = await get_settings_doc()
    await log_audit(user, "settings", "app_settings", "update",
                    {"before": before, "after": after}, request)
    return after


# ---------------- Auth ----------------

class LoginPayload(BaseModel):
    username: str
    password: str
    device_info: Optional[str] = None


@api_router.post("/auth/login")
async def login(payload: LoginPayload, response: Response, request: Request):
    user = await db.users.find_one({"username": payload.username.strip().lower()})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Akun nonaktif. Hubungi admin.")
    token = create_access_token(user["id"], user["role"])
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "last_login": now_iso(),
        "last_activity": now_iso(),
        "last_device_info": payload.device_info or request.headers.get("user-agent"),
    }})
    response.set_cookie(key="access_token", value=token, httponly=True,
                        samesite="lax", max_age=ACCESS_MINUTES * 60, path="/")
    await log_audit(clean_user(user), "users", user["id"], "login", {}, request)
    return {"token": token, "user": clean_user(user)}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------- Users ----------------

class UserPayload(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    assigned_location: Optional[str] = None
    device_name: Optional[str] = None
    role: str = "operator"
    password: Optional[str] = None
    status: str = "active"
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@api_router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    users = await db.users.find().sort("created_at", -1).to_list(500)
    return [clean_user(u) for u in users]


@api_router.post("/users")
async def create_user(payload: UserPayload, request: Request,
                      user: dict = Depends(require_roles("admin"))):
    username = payload.username.strip().lower()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password wajib diisi")
    doc = payload.model_dump()
    doc.pop("password")
    doc.update({
        "id": new_id(),
        "username": username,
        "hashed_password": hash_password(payload.password),
        "last_login": None,
        "last_activity": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.users.insert_one(doc)
    await log_audit(user, "users", doc["id"], "create", {"after": clean_user(doc)}, request)
    return clean_user(doc)


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserPayload, request: Request,
                      user: dict = Depends(require_roles("admin"))):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    username = payload.username.strip().lower()
    clash = await db.users.find_one({"username": username, "id": {"$ne": user_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    update = payload.model_dump()
    pw = update.pop("password", None)
    if pw:
        update["hashed_password"] = hash_password(pw)
    update["username"] = username
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user_id}, {"$set": update})
    after = await db.users.find_one({"id": user_id})
    await log_audit(user, "users", user_id, "update",
                    {"before": clean_user(existing), "after": clean_user(after)}, request)
    return clean_user(after)


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request,
                      user: dict = Depends(require_roles("admin"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    await db.users.delete_one({"id": user_id})
    await log_audit(user, "users", user_id, "delete", {"before": clean_user(existing)}, request)
    return {"ok": True}


# ---------------- Inmates ----------------

class InmatePayload(BaseModel):
    full_name: str
    registration_number: Optional[str] = None
    identity_number: Optional[str] = None
    photo_url: Optional[str] = None
    status: str = "active"
    date_entry: Optional[str] = None
    estimated_release_date: Optional[str] = None
    cell_block: Optional[str] = None
    crime_category: Optional[str] = None
    medical_alert: Optional[str] = None
    barcode_data: Optional[str] = None


@api_router.get("/inmates")
async def list_inmates(search: Optional[str] = None, status: Optional[str] = None,
                       cell_block: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if cell_block:
        q["cell_block"] = cell_block
    if search:
        q["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"registration_number": {"$regex": search, "$options": "i"}},
            {"identity_number": {"$regex": search, "$options": "i"}},
        ]
    inmates = await db.inmates.find(q, {"_id": 0}).sort("full_name", 1).to_list(2000)
    return inmates


@api_router.post("/inmates")
async def create_inmate(payload: InmatePayload, request: Request,
                        user: dict = Depends(require_roles("admin", "supervisor"))):
    reg = (payload.registration_number or "").strip()
    if not reg:
        count = await db.inmates.count_documents({})
        reg = f"WB-{datetime.now().year}-{count + 1:04d}"
    if await db.inmates.find_one({"registration_number": reg}):
        raise HTTPException(status_code=400, detail="Nomor registrasi sudah digunakan")
    doc = payload.model_dump()
    doc["registration_number"] = reg
    if not doc.get("barcode_data"):
        doc["barcode_data"] = reg
    doc.update({"id": new_id(), "created_at": now_iso(), "updated_at": now_iso()})
    await db.inmates.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "inmates", doc["id"], "create", {"after": doc}, request)
    return doc


@api_router.get("/inmates/lookup/{code}")
async def lookup_inmate(code: str, user: dict = Depends(get_current_user)):
    inmate = await db.inmates.find_one(
        {"$or": [{"barcode_data": code}, {"registration_number": code}]}, {"_id": 0})
    if not inmate:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan")
    return inmate


@api_router.get("/inmates/{inmate_id}")
async def get_inmate(inmate_id: str, user: dict = Depends(get_current_user)):
    inmate = await db.inmates.find_one({"id": inmate_id}, {"_id": 0})
    if not inmate:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan")
    return inmate


@api_router.put("/inmates/{inmate_id}")
async def update_inmate(inmate_id: str, payload: InmatePayload, request: Request,
                        user: dict = Depends(require_roles("admin", "supervisor"))):
    existing = await db.inmates.find_one({"id": inmate_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan")
    update = payload.model_dump()
    if update.get("registration_number"):
        clash = await db.inmates.find_one({
            "registration_number": update["registration_number"],
            "id": {"$ne": inmate_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Nomor registrasi sudah digunakan")
    if not update.get("barcode_data"):
        update["barcode_data"] = update.get("registration_number") or existing["registration_number"]
    update["updated_at"] = now_iso()
    await db.inmates.update_one({"id": inmate_id}, {"$set": update})
    after = await db.inmates.find_one({"id": inmate_id}, {"_id": 0})
    existing.pop("_id", None)
    await log_audit(user, "inmates", inmate_id, "update",
                    {"before": existing, "after": after}, request)
    return after


@api_router.delete("/inmates/{inmate_id}")
async def delete_inmate(inmate_id: str, request: Request,
                        user: dict = Depends(require_roles("admin"))):
    existing = await db.inmates.find_one({"id": inmate_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan")
    await db.inmates.delete_one({"id": inmate_id})
    await log_audit(user, "inmates", inmate_id, "delete", {"before": existing}, request)
    return {"ok": True}


def make_qr_png(data: str) -> bytes:
    img = qrcode.make(data, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@api_router.get("/inmates/{inmate_id}/barcode")
async def inmate_barcode(inmate_id: str, download: bool = False,
                         user: dict = Depends(get_current_user)):
    inmate = await db.inmates.find_one({"id": inmate_id})
    if not inmate:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan")
    png = make_qr_png(inmate.get("barcode_data") or inmate["registration_number"])
    headers = {}
    if download:
        fname = f"barcode_{inmate['registration_number']}.png"
        headers["Content-Disposition"] = f'attachment; filename="{fname}"'
    return StreamingResponse(io.BytesIO(png), media_type="image/png", headers=headers)


# ---------------- Locations ----------------

class LocationPayload(BaseModel):
    location_name: str
    location_type: str = "other"
    gps_coordinates: Optional[str] = None
    description: Optional[str] = None


@api_router.get("/locations")
async def list_locations(user: dict = Depends(get_current_user)):
    return await db.locations.find({}, {"_id": 0}).sort("location_name", 1).to_list(500)


@api_router.post("/locations")
async def create_location(payload: LocationPayload, request: Request,
                          user: dict = Depends(require_roles("admin"))):
    if await db.locations.find_one({"location_name": payload.location_name.strip()}):
        raise HTTPException(status_code=400, detail="Nama lokasi sudah digunakan")
    doc = payload.model_dump()
    doc["location_name"] = doc["location_name"].strip()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.locations.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "locations", doc["id"], "create", {"after": doc}, request)
    return doc


@api_router.put("/locations/{location_id}")
async def update_location(location_id: str, payload: LocationPayload, request: Request,
                          user: dict = Depends(require_roles("admin"))):
    existing = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    update = payload.model_dump()
    update["location_name"] = update["location_name"].strip()
    clash = await db.locations.find_one({
        "location_name": update["location_name"], "id": {"$ne": location_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Nama lokasi sudah digunakan")
    await db.locations.update_one({"id": location_id}, {"$set": update})
    after = await db.locations.find_one({"id": location_id}, {"_id": 0})
    await log_audit(user, "locations", location_id, "update",
                    {"before": existing, "after": after}, request)
    return after


@api_router.delete("/locations/{location_id}")
async def delete_location(location_id: str, request: Request,
                          user: dict = Depends(require_roles("admin"))):
    existing = await db.locations.find_one({"id": location_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    await db.locations.delete_one({"id": location_id})
    await log_audit(user, "locations", location_id, "delete", {"before": existing}, request)
    return {"ok": True}


@api_router.get("/locations/{location_id}/barcode")
async def location_barcode(location_id: str, download: bool = False,
                           user: dict = Depends(get_current_user)):
    loc = await db.locations.find_one({"id": location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    png = make_qr_png(f"LOC:{location_id}")
    headers = {}
    if download:
        fname = f"barcode_lokasi_{loc['location_name'].replace(' ', '_')}.png"
        headers["Content-Disposition"] = f'attachment; filename="{fname}"'
    return StreamingResponse(io.BytesIO(png), media_type="image/png", headers=headers)


# ---------------- Activities ----------------

class ActivityPayload(BaseModel):
    inmate_id: Optional[str] = None
    barcode_code: Optional[str] = None
    location_id: Optional[str] = None
    scan_location: Optional[str] = None
    activity_category: Optional[str] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    inmate_condition: str = "baik"
    scan_timestamp: Optional[str] = None
    status: str = "submitted"
    photos: List[str] = []


async def activity_out(a: dict) -> dict:
    a.pop("_id", None)
    return a


@api_router.get("/activities")
async def list_activities(status: Optional[str] = None, category: Optional[str] = None,
                          location_id: Optional[str] = None, inmate_id: Optional[str] = None,
                          date_from: Optional[str] = None, date_to: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if category:
        q["activity_category"] = category
    if location_id:
        q["location_id"] = location_id
    if inmate_id:
        q["inmate_id"] = inmate_id
    if user["role"] == "operator":
        q["operator_user_id"] = user["id"]
    if date_from or date_to:
        q["scan_timestamp"] = {}
        if date_from:
            q["scan_timestamp"]["$gte"] = date_from
        if date_to:
            q["scan_timestamp"]["$lte"] = date_to + "T23:59:59+00:00" if len(date_to) == 10 else date_to
    items = await db.activities.find(q, {"_id": 0}).sort("scan_timestamp", -1).to_list(5000)
    return items


@api_router.post("/activities")
async def create_activity(payload: ActivityPayload, request: Request,
                          user: dict = Depends(require_roles("admin", "supervisor", "operator"))):
    inmate = None
    if payload.inmate_id:
        inmate = await db.inmates.find_one({"id": payload.inmate_id})
    elif payload.barcode_code:
        inmate = await db.inmates.find_one({"$or": [
            {"barcode_data": payload.barcode_code},
            {"registration_number": payload.barcode_code}]})
    if not inmate:
        raise HTTPException(status_code=404, detail="Warga binaan tidak ditemukan dari kode tersebut")
    if inmate.get("status") != "active":
        raise HTTPException(status_code=400, detail=f"Warga binaan berstatus {inmate.get('status')}, tidak dapat discan")

    location_name = payload.scan_location
    if payload.location_id:
        loc = await db.locations.find_one({"id": payload.location_id})
        if loc:
            location_name = loc["location_name"]
    if not location_name and user.get("assigned_location"):
        loc = await db.locations.find_one({"id": user["assigned_location"]})
        if loc:
            location_name = loc["location_name"]
            payload.location_id = loc["id"]

    settings = await get_settings_doc()
    cat_label = next((c["label"] for c in settings["activity_categories"]
                      if c["key"] == payload.activity_category), payload.activity_category)

    doc = {
        "id": new_id(),
        "inmate_id": inmate["id"],
        "inmate_name": inmate["full_name"],
        "inmate_reg": inmate["registration_number"],
        "operator_user_id": user["id"],
        "operator_name": user["full_name"],
        "scan_timestamp": payload.scan_timestamp or now_iso(),
        "scan_location": location_name,
        "location_id": payload.location_id,
        "activity_category": payload.activity_category,
        "activity_category_label": cat_label,
        "duration_minutes": payload.duration_minutes,
        "description": payload.description,
        "inmate_condition": payload.inmate_condition,
        "photos": payload.photos or [],
        "status": payload.status if payload.status in ("draft", "submitted") else "submitted",
        "approval_user_id": None,
        "approval_user_name": None,
        "approval_timestamp": None,
        "rejection_reason": None,
        "device_info": request.headers.get("user-agent"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.activities.insert_one(doc)
    await log_audit(user, "activities", doc["id"], "create",
                    {"after": {k: v for k, v in doc.items()}}, request)
    doc.pop("_id", None)
    return doc


@api_router.get("/activities/export")
async def export_activities(status: Optional[str] = None, category: Optional[str] = None,
                            location_id: Optional[str] = None,
                            date_from: Optional[str] = None, date_to: Optional[str] = None,
                            request: Request = None,
                            user: dict = Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    if category:
        q["activity_category"] = category
    if location_id:
        q["location_id"] = location_id
    if user["role"] == "operator":
        q["operator_user_id"] = user["id"]
    if date_from or date_to:
        q["scan_timestamp"] = {}
        if date_from:
            q["scan_timestamp"]["$gte"] = date_from
        if date_to:
            q["scan_timestamp"]["$lte"] = date_to + "T23:59:59+00:00" if len(date_to) == 10 else date_to
    items = await db.activities.find(q, {"_id": 0}).sort("scan_timestamp", -1).to_list(20000)

    wb = Workbook()
    ws = wb.active
    ws.title = "Aktivitas"
    headers = ["No", "Waktu Scan", "No. Registrasi", "Nama Warga Binaan", "Lokasi",
               "Kategori Aktivitas", "Durasi (menit)", "Kondisi", "Status",
               "Operator", "Disetujui Oleh", "Waktu Persetujuan", "Alasan Penolakan", "Deskripsi"]
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="0A0A0A")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(vertical="center")
        ws.column_dimensions[get_column_letter(col)].width = max(14, len(h) + 4)
    status_map = {"draft": "Draf", "submitted": "Menunggu", "approved": "Disetujui", "rejected": "Ditolak"}
    cond_map = {"baik": "Baik", "sakit": "Sakit", "perlu_perhatian": "Perlu Perhatian"}
    for i, a in enumerate(items, 1):
        ws.append([
            i, a.get("scan_timestamp"), a.get("inmate_reg"), a.get("inmate_name"),
            a.get("scan_location"), a.get("activity_category_label") or a.get("activity_category"),
            a.get("duration_minutes"), cond_map.get(a.get("inmate_condition"), a.get("inmate_condition")),
            status_map.get(a.get("status"), a.get("status")), a.get("operator_name"),
            a.get("approval_user_name"), a.get("approval_timestamp"),
            a.get("rejection_reason"), a.get("description"),
        ])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"laporan_aktivitas_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    await log_audit(user, "activities", "-", "export",
                    {"filters": {"status": status, "category": category,
                                 "location_id": location_id, "date_from": date_from,
                                 "date_to": date_to}, "count": len(items)}, request)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@api_router.get("/activities/{activity_id}")
async def get_activity(activity_id: str, user: dict = Depends(get_current_user)):
    a = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Aktivitas tidak ditemukan")
    return a


@api_router.get("/activities/{activity_id}/history")
async def activity_history(activity_id: str, user: dict = Depends(get_current_user)):
    items = await db.approvals.find({"activity_id": activity_id}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return items


async def change_status(activity_id: str, new_status: str, user: dict, request: Request,
                        reason: Optional[str] = None):
    a = await db.activities.find_one({"id": activity_id})
    if not a:
        raise HTTPException(status_code=404, detail="Aktivitas tidak ditemukan")
    old_status = a["status"]
    update = {"status": new_status, "updated_at": now_iso()}
    if new_status == "approved":
        update.update({"approval_user_id": user["id"], "approval_user_name": user["full_name"],
                       "approval_timestamp": now_iso(), "rejection_reason": None})
    elif new_status == "rejected":
        update.update({"approval_user_id": user["id"], "approval_user_name": user["full_name"],
                       "approval_timestamp": now_iso(), "rejection_reason": reason})
    await db.activities.update_one({"id": activity_id}, {"$set": update})
    await db.approvals.insert_one({
        "id": new_id(), "activity_id": activity_id, "old_status": old_status,
        "new_status": new_status, "approved_by_user_id": user["id"],
        "approved_by_name": user["full_name"], "reason": reason, "timestamp": now_iso(),
    })
    await log_audit(user, "activities", activity_id,
                    "approve" if new_status == "approved" else new_status,
                    {"before": {"status": old_status}, "after": {"status": new_status},
                     "reason": reason}, request)
    return await db.activities.find_one({"id": activity_id}, {"_id": 0})


class ApprovePayload(BaseModel):
    comment: Optional[str] = None


class RejectPayload(BaseModel):
    reason: str


@api_router.post("/activities/{activity_id}/approve")
async def approve_activity(activity_id: str, payload: ApprovePayload, request: Request,
                           user: dict = Depends(require_roles("admin", "supervisor"))):
    return await change_status(activity_id, "approved", user, request, payload.comment)


@api_router.post("/activities/{activity_id}/reject")
async def reject_activity(activity_id: str, payload: RejectPayload, request: Request,
                          user: dict = Depends(require_roles("admin", "supervisor"))):
    if not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Alasan penolakan wajib diisi")
    return await change_status(activity_id, "rejected", user, request, payload.reason)


@api_router.post("/activities/{activity_id}/submit")
async def submit_activity(activity_id: str, request: Request,
                          user: dict = Depends(get_current_user)):
    a = await db.activities.find_one({"id": activity_id})
    if not a:
        raise HTTPException(status_code=404, detail="Aktivitas tidak ditemukan")
    if user["role"] == "operator" and a["operator_user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return await change_status(activity_id, "submitted", user, request)


@api_router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, request: Request,
                          user: dict = Depends(require_roles("admin"))):
    a = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Aktivitas tidak ditemukan")
    await db.activities.delete_one({"id": activity_id})
    await log_audit(user, "activities", activity_id, "delete", {"before": a}, request)
    return {"ok": True}


# ---------------- Audit ----------------

def _strip_ids(obj):
    if isinstance(obj, dict):
        return {k: _strip_ids(v) for k, v in obj.items() if k != "_id"}
    if isinstance(obj, list):
        return [_strip_ids(v) for v in obj]
    try:
        from bson import ObjectId
        if isinstance(obj, ObjectId):
            return str(obj)
    except Exception:
        pass
    return obj


@api_router.get("/audit-logs")
async def list_audit(entity_type: Optional[str] = None, action: Optional[str] = None,
                     limit: int = 300, user: dict = Depends(require_roles("admin"))):
    q = {}
    if entity_type:
        q["entity_type"] = entity_type
    if action:
        q["action"] = action
    items = await db.audit_log.find(q, {"_id": 0}).sort("timestamp", -1).to_list(min(limit, 1000))
    return [_strip_ids(i) for i in items]


# ---------------- Dashboard ----------------

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    total_inmates = await db.inmates.count_documents({})
    active_inmates = await db.inmates.count_documents({"status": "active"})
    scans_today = await db.activities.count_documents({"scan_timestamp": {"$gte": today}})
    total_scans = await db.activities.count_documents({})
    pending = await db.activities.count_documents({"status": "submitted"})
    locations = await db.locations.count_documents({})
    operators = await db.users.count_documents({"role": "operator", "status": "active"})

    cat_pipeline = [
        {"$match": {"scan_timestamp": {"$gte": today}}},
        {"$group": {"_id": "$activity_category_label", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_category = await db.activities.aggregate(cat_pipeline).to_list(20)
    loc_pipeline = [
        {"$match": {"scan_timestamp": {"$gte": today}}},
        {"$group": {"_id": "$scan_location", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_location = await db.activities.aggregate(loc_pipeline).to_list(20)
    recent = await db.activities.find({}, {"_id": 0}).sort("scan_timestamp", -1).to_list(8)

    inmate_statuses = {}
    for s in ["active", "leave", "released", "transferred"]:
        inmate_statuses[s] = await db.inmates.count_documents({"status": s})

    return {
        "total_inmates": total_inmates,
        "active_inmates": active_inmates,
        "scans_today": scans_today,
        "total_scans": total_scans,
        "pending_approvals": pending,
        "locations": locations,
        "operators": operators,
        "by_category_today": [{"label": c["_id"] or "Lainnya", "count": c["count"]} for c in by_category],
        "by_location_today": [{"label": l["_id"] or "-", "count": l["count"]} for l in by_location],
        "recent_activities": recent,
        "inmate_statuses": inmate_statuses,
    }


@api_router.get("/")
async def root():
    return {"message": "SIMAPAN API aktif"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed():
    await db.users.create_index("username", unique=True)
    await db.inmates.create_index("registration_number", unique=True)
    await db.activities.create_index("inmate_id")
    await db.activities.create_index("status")
    await db.activities.create_index("scan_timestamp")
    await db.audit_log.create_index("timestamp")

    await get_settings_doc()

    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    existing = await db.users.find_one({"username": admin_username})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "username": admin_username, "email": admin_email,
            "phone": None, "full_name": "Administrator", "position": "Kepala Administrasi",
            "assigned_location": None, "device_name": None, "role": "admin",
            "hashed_password": hash_password(admin_password), "status": "active",
            "start_date": None, "end_date": None, "last_login": None, "last_activity": None,
            "created_at": now_iso(), "updated_at": now_iso(),
        })
        logger.info("Admin user seeded")
    elif not verify_password(admin_password, existing["hashed_password"]):
        await db.users.update_one({"username": admin_username},
                                  {"$set": {"hashed_password": hash_password(admin_password),
                                            "email": admin_email}})

    if not await db.locations.find_one({}):
        locs = [
            ("Masjid At-Taubah", "religious"), ("Bengkel Kerja", "skills"),
            ("Poliklinik", "health"), ("Ruang Kelas", "education"),
            ("Lapangan Olahraga", "sports"), ("Pos Keamanan Blok A", "security"),
        ]
        for name, ltype in locs:
            await db.locations.insert_one({
                "id": new_id(), "location_name": name, "location_type": ltype,
                "gps_coordinates": None, "description": None, "created_at": now_iso(),
            })
        logger.info("Default locations seeded")

    if not await db.inmates.find_one({}):
        samples = [
            ("WB-2024-0001", "Budi Santoso", "A", "Narkotika", None),
            ("WB-2024-0002", "Andi Wijaya", "B", "Pencurian", "Hipertensi - kontrol rutin"),
            ("WB-2024-0003", "Slamet Riyadi", "A", "Penggelapan", None),
        ]
        for reg, name, block, crime, med in samples:
            await db.inmates.insert_one({
                "id": new_id(), "registration_number": reg, "full_name": name,
                "identity_number": None, "photo_url": None, "status": "active",
                "date_entry": "2024-01-15", "estimated_release_date": "2027-01-15",
                "cell_block": block, "crime_category": crime, "medical_alert": med,
                "barcode_data": reg, "created_at": now_iso(), "updated_at": now_iso(),
            })
        logger.info("Sample inmates seeded")

    if not await db.users.find_one({"username": "supervisor"}):
        await db.users.insert_one({
            "id": new_id(), "username": "supervisor", "email": None, "phone": None,
            "full_name": "Supervisor Pembinaan", "position": "Kasi Pembinaan",
            "assigned_location": None, "device_name": None, "role": "supervisor",
            "hashed_password": hash_password("Supervisor@123"), "status": "active",
            "start_date": None, "end_date": None, "last_login": None, "last_activity": None,
            "created_at": now_iso(), "updated_at": now_iso(),
        })
    if not await db.users.find_one({"username": "operator1"}):
        loc = await db.locations.find_one({"location_name": "Masjid At-Taubah"})
        await db.users.insert_one({
            "id": new_id(), "username": "operator1", "email": None, "phone": None,
            "full_name": "Operator Masjid", "position": "Petugas Scan",
            "assigned_location": loc["id"] if loc else None,
            "device_name": "Tablet Pos Masjid", "role": "operator",
            "hashed_password": hash_password("Operator@123"), "status": "active",
            "start_date": None, "end_date": None, "last_login": None, "last_activity": None,
            "created_at": now_iso(), "updated_at": now_iso(),
        })


@app.on_event("startup")
async def startup():
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
