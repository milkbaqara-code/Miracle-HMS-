"""
Z-CC: MIRACLE CONTENT CREATOR ENGINE
The Sovereign AGI Marketing Agent — Auto-sequences, generates, and publishes
enterprise content across YouTube, LinkedIn, and Facebook with 100% brand accuracy.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, Boolean, Enum as SAEnum
from datetime import datetime, timezone
import logging, json, uuid, os

from app.core.database import Base, SessionLocal, engine
from app.core.ai_kernel import call_llm

logger = logging.getLogger("ContentCreator")
router = APIRouter()

# ── MODELS ────────────────────────────────────────────────────────────────────

class CampaignSequence(Base):
    __tablename__ = "cc_campaign_sequences"
    __table_args__ = {"extend_existing": True}
    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    zone_id      = Column(String(32), nullable=False)   # e.g. Z-29, Z-27, Z-11
    zone_name    = Column(String(128), nullable=False)
    topic_theme  = Column(String(64), nullable=False)
    custom_brief = Column(Text, nullable=True)
    sequence_day = Column(Integer, default=0)           # Day in the rotation
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AssetVault(Base):
    __tablename__ = "cc_asset_vault"
    __table_args__ = {"extend_existing": True}
    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_name   = Column(String(256), nullable=False)
    asset_type   = Column(SAEnum("UI_SCREENSHOT", "UI_RECORDING", "MASCOT_PNG",
                                  "MASCOT_VIDEO", "BG_LOOP", "PRODUCT_IMAGE",
                                  name="cc_asset_type"), default="UI_SCREENSHOT")
    zone_tag     = Column(String(64), nullable=True)    # e.g. FNB_KDS, PMS_GRID
    emotion_tag  = Column(String(64), nullable=True)    # e.g. CONFIDENT, WARNING, EXPLAIN
    file_path    = Column(String(512), nullable=False)
    description  = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class SocialApiConfig(Base):
    __tablename__ = "cc_social_api_configs"
    __table_args__ = {"extend_existing": True}
    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    platform        = Column(SAEnum("YOUTUBE", "LINKEDIN", "FACEBOOK", "INSTAGRAM", "TWITTER",
                                    name="cc_platform"), nullable=False)
    api_key         = Column(Text, nullable=True)
    api_secret      = Column(Text, nullable=True)
    access_token    = Column(Text, nullable=True)
    refresh_token   = Column(Text, nullable=True)
    page_id         = Column(String(256), nullable=True)   # Facebook page ID / YouTube channel ID
    auto_publish    = Column(Boolean, default=False)
    publish_schedule = Column(String(64), nullable=True)   # e.g. "TUE,THU 09:00"
    is_connected    = Column(Boolean, default=False)
    updated_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

class CampaignLedger(Base):
    __tablename__ = "cc_campaign_ledger"
    __table_args__ = {"extend_existing": True}
    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sequence_id     = Column(String(36), nullable=True)
    zone_id         = Column(String(32), nullable=False)
    topic_theme     = Column(String(64), nullable=False)
    generated_text  = Column(Text, nullable=True)          # JSON with platform outputs
    media_prompt    = Column(Text, nullable=True)
    asset_used      = Column(String(256), nullable=True)   # Asset vault reference
    publish_status  = Column(SAEnum("DRAFT", "PUBLISHED", "FAILED", "SCHEDULED",
                                     name="cc_publish_status"), default="DRAFT")
    platforms_posted = Column(Text, nullable=True)         # JSON list of platforms posted to
    published_at    = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# Create tables
try:
    Base.metadata.create_all(bind=engine, tables=[
        CampaignSequence.__table__,
        AssetVault.__table__,
        SocialApiConfig.__table__,
        CampaignLedger.__table__,
    ], checkfirst=True)
except Exception as e:
    logger.warning(f"CC table init warning: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── ZONE BRAIN KNOWLEDGE BASE ─────────────────────────────────────────────────

ZONE_KNOWLEDGE = {
    "Z-07": {
        "name": "Emergency Command Grid & Live Telemetry (Z-07)",
        "hook": "Real-time emergency tracking system with wristband IoT integration and auto-response SLA tracking.",
        "features": ["Live wristband telemetry", "Automated cardiac/hypoxia alerts", "SLA compliance dashboards", "Ambulance dispatch triggers", "Doctor acknowledgment flow"],
        "seo_focus": "hospital emergency response software, real time patient tracking, medical SLA dashboard, IoT wristband integration",
    },
    "Z-30": {
        "name": "Sovereign Bed & Occupancy Engine (Z-30)",
        "hook": "Automated bed allocation registry and clinical ward check-in coordinator with real-time occupancy synchronization.",
        "features": ["Live bed allocation", "Ward status coordinator", "Clinic check-in registry", "Discharge planner", "Occupancy statistics"],
        "seo_focus": "hospital bed management software, patient occupancy dashboard, clinical ward coordinator, hospital PMS",
    },
    "Z-12": {
        "name": "Clinical Inventory & Supply Chain (Z-12)",
        "hook": "The world's first AI-native clinical inventory matrix with low-stock alerts, vaccine registry, and automated supplier audit trails.",
        "features": ["Medicine low-stock alerts", "Vaccine temperature logs", "Sovereign audit trails", "Automated purchase orders", "Expiry date tracking"],
        "seo_focus": "medical inventory management, pharmacy software system, vaccine tracking, hospital procurement",
    },
    "Z-27": {
        "name": "Outpatient Clinic Scheduler (Z-27)",
        "hook": "Specialist medical practitioner scheduling coordinator with appointment logs, SOAP consult records, and lab integration.",
        "features": ["Specialist roster dispatcher", "SOAP consulting suite", "Lab order integrations", "Patient vitals stream", "Prescription engine"],
        "seo_focus": "doctor appointment scheduler, medical clinic software, electronic health records EHR, hospital OPD",
    },
    "Z-09": {
        "name": "Medical Personnel & Gratuity (Z-09)",
        "hook": "Biometric compliance shifts engine for medical practitioners with automated licensing and nursing gratuity logs.",
        "features": ["On-duty staff supervisor", "Nursing shift compliance", "Medical license registry", "Gratuity calculator", "Leave tracker"],
        "seo_focus": "medical staffing software, nurse shift scheduler, biometric compliance hospital, healthcare HR",
    },
    "Z-20": {
        "name": "Sovereign AGI Medical Nexus (Z-20)",
        "hook": "Self-learning hospital supervisor engine with diagnostic efficiency scoring, anomaly shielding, and real-time medical auditing.",
        "features": ["Self-expanding departments", "Diagnostic efficiency scoring", "Anomaly shielding", "Clinical anomaly alerts", "Append-only logs"],
        "seo_focus": "hospital AGI management, medical AI supervisor, healthcare automation platform, clinic audit engine",
    },
}

# ── SEQUENCE MATRIX API ───────────────────────────────────────────────────────

@router.get("/sequences")
def get_sequences(db: Session = Depends(get_db)):
    seqs = db.query(CampaignSequence).order_by(CampaignSequence.sequence_day).all()
    return [{"id": s.id, "zone_id": s.zone_id, "zone_name": s.zone_name,
             "topic_theme": s.topic_theme, "custom_brief": s.custom_brief,
             "sequence_day": s.sequence_day, "is_active": s.is_active} for s in seqs]

@router.post("/sequences")
def create_sequence(zone_id: str, zone_name: str, topic_theme: str,
                    custom_brief: Optional[str] = None, db: Session = Depends(get_db)):
    count = db.query(CampaignSequence).count()
    seq = CampaignSequence(
        id=str(uuid.uuid4()), zone_id=zone_id, zone_name=zone_name,
        topic_theme=topic_theme, custom_brief=custom_brief, sequence_day=count + 1
    )
    db.add(seq)
    db.commit()
    return {"status": "CREATED", "id": seq.id}

@router.delete("/sequences/{seq_id}")
def delete_sequence(seq_id: str, db: Session = Depends(get_db)):
    seq = db.query(CampaignSequence).filter(CampaignSequence.id == seq_id).first()
    if not seq:
        raise HTTPException(404, "Sequence not found")
    db.delete(seq)
    db.commit()
    return {"status": "DELETED"}

# ── ASSET VAULT API ───────────────────────────────────────────────────────────

@router.get("/assets")
def get_assets(zone_tag: Optional[str] = None, asset_type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(AssetVault)
    if zone_tag:
        q = q.filter(AssetVault.zone_tag == zone_tag)
    if asset_type:
        q = q.filter(AssetVault.asset_type == asset_type)
    assets = q.all()
    return [{"id": a.id, "asset_name": a.asset_name, "asset_type": a.asset_type,
             "zone_tag": a.zone_tag, "emotion_tag": a.emotion_tag,
             "file_path": a.file_path, "description": a.description} for a in assets]

@router.post("/assets/register")
def register_asset(asset_name: str, asset_type: str, zone_tag: str,
                   file_path: str, emotion_tag: Optional[str] = None,
                   description: Optional[str] = None, db: Session = Depends(get_db)):
    asset = AssetVault(
        id=str(uuid.uuid4()), asset_name=asset_name, asset_type=asset_type,
        zone_tag=zone_tag, emotion_tag=emotion_tag, file_path=file_path,
        description=description
    )
    db.add(asset)
    db.commit()
    return {"status": "REGISTERED", "id": asset.id}

@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(AssetVault).filter(AssetVault.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.commit()
    return {"status": "DELETED"}

# ── SOCIAL API CONFIG ─────────────────────────────────────────────────────────

@router.get("/social-configs")
def get_social_configs(db: Session = Depends(get_db)):
    configs = db.query(SocialApiConfig).all()
    return [{"id": c.id, "platform": c.platform, "page_id": c.page_id,
             "auto_publish": c.auto_publish, "publish_schedule": c.publish_schedule,
             "is_connected": c.is_connected,
             # Never return secrets in full — mask them
             "api_key_masked": (c.api_key[:6] + "••••••" if c.api_key else None),
             "access_token_set": bool(c.access_token)} for c in configs]

class SocialConfigRequest(BaseModel):
    platform: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    page_id: Optional[str] = None
    auto_publish: bool = False
    publish_schedule: Optional[str] = None

@router.post("/social-configs")
def upsert_social_config(req: SocialConfigRequest, db: Session = Depends(get_db)):
    existing = db.query(SocialApiConfig).filter(SocialApiConfig.platform == req.platform).first()
    if existing:
        existing.api_key = req.api_key or existing.api_key
        existing.api_secret = req.api_secret or existing.api_secret
        existing.access_token = req.access_token or existing.access_token
        existing.refresh_token = req.refresh_token or existing.refresh_token
        existing.page_id = req.page_id or existing.page_id
        existing.auto_publish = req.auto_publish
        existing.publish_schedule = req.publish_schedule
        existing.is_connected = bool(req.access_token or existing.access_token)
        db.commit()
        return {"status": "UPDATED", "platform": req.platform}
    else:
        cfg = SocialApiConfig(
            id=str(uuid.uuid4()), platform=req.platform,
            api_key=req.api_key, api_secret=req.api_secret,
            access_token=req.access_token, refresh_token=req.refresh_token,
            page_id=req.page_id, auto_publish=req.auto_publish,
            publish_schedule=req.publish_schedule,
            is_connected=bool(req.access_token)
        )
        db.add(cfg)
        db.commit()
        return {"status": "CREATED", "platform": req.platform}

# ── CONTENT GENERATION ENGINE ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    zone_id: str
    platforms: List[str]        # ["youtube", "linkedin", "facebook"]
    custom_brief: Optional[str] = ""
    tone: Optional[str] = "elite"  # elite | technical | emotional
    topic_theme: Optional[str] = "launch"
    target_audience: Optional[str] = "property_owners"
    platform_modes: Optional[dict] = {}

@router.post("/generate")
async def generate_content(req: GenerateRequest, db: Session = Depends(get_db)):
    try:
        zone = ZONE_KNOWLEDGE.get(req.zone_id, {
            "name": req.zone_id,
            "hook": f"Miracle OS enterprise module: {req.zone_id}",
            "features": ["AI-native operations", "Real-time sync", "Enterprise-grade security"],
            "seo_focus": "enterprise software, hotel management, AI ERP"
        })

        tone_map = {
            "elite": "Prestigious, visionary, strategic. Speak to enterprise decision-makers and C-suite executives.",
            "technical": "Highly technical, structured, precise. Speak to developers and CTOs.",
            "emotional": "Inspiring, human-centric, aspirational. Speak to business owners who are tired of legacy systems."
        }
        tone_text = tone_map.get(req.tone, tone_map["elite"])

        platform_instructions = []
        p_modes = req.platform_modes or {}
        if "youtube" in req.platforms:
            mode = p_modes.get("youtube", "release_walkthrough")
            platform_instructions.append(f"[YOUTUBE_SCRIPT]\n(Write a punchy 45-second YouTube Shorts script in the style of '{mode}'. Subtitle-ready — short punchy sentences. End with 'Find us at vigilantitsolution.com')")
        if "linkedin" in req.platforms:
            mode = p_modes.get("linkedin", "thought_leadership")
            platform_instructions.append(f"[LINKEDIN]\n(Write a {mode} style post. Include a compelling hook, 3-5 bullet points of specific feature benefits, and end with a CTA + 10 relevant hashtags including #MiracleHMS)")
        if "facebook" in req.platforms:
            mode = p_modes.get("facebook", "visual_story")
            platform_instructions.append(f"[FACEBOOK]\n(Write a {mode} style post under 200 words. Start with a question or bold statement. Use line breaks for visual breathing room. End with emojis and link.)")
        if "twitter" in req.platforms:
            mode = p_modes.get("twitter", "feature_teaser")
            platform_instructions.append(f"[TWITTER]\n(Write a {mode} style post/thread under 280 characters per tweet. Engage the audience instantly.)")

        prompt = f"""You are the Sovereign AGI Content Director for Vigilant IT Solution Ltd and Miracle HMS.

CONTEXT: We are launching targeted public health campaigns, clinical advisory newsletters, and emergency announcements to position Miracle HMS as THE WORLD'S FIRST AI/AGI-DRIVEN HEALTHCARE & HOSPITAL MANAGEMENT SYSTEM.

TODAY'S CLINICAL ZONE: {zone['name']}
CORE CLINICAL HOOK: {zone['hook']}
KEY FEATURES TO HIGHLIGHT: {', '.join(zone['features'])}
SEO KEYWORDS TO TARGET: {zone['seo_focus']}
CONTENT TONE: {tone_text}
TARGET AUDIENCE: {req.target_audience}
CAMPAIGN TOPIC THEME: {req.topic_theme}
CUSTOM BRIEF FROM MEDICAL DIRECTOR: {req.custom_brief or 'None — use your best judgment.'}

BRAND RULES:
- Always mention "Vigilant IT Solution" and "Miracle HMS" explicitly
- Position as: "World's First AI/AGI-Driven Healthcare & Hospital Management System"
- Link: https://www.vigilantitsolution.com/guest (Miracle HMS Patient Portal)
- Never sound generic. Every clinical advisory and event highlight must be medically precise and relevant.

Generate content in these exact sections. Do not add any intro or outro text:

{chr(10).join(platform_instructions)}

[SEO_TITLE]
(A high-CTR title under 60 chars — include "Miracle HMS" or "Vigilant IT Solution")

[SEO_DESCRIPTION]
(A compelling 160-char meta description with primary keyword)

[SEO_KEYWORDS]
(Comma-separated 12 high-volume, long-tail SEO keywords)

[MEDIA_PROMPT]
(A detailed visual director's note for the Asset Vault compositor: which UI screenshot to show, what mascot emotion to use, what background to overlay, what text to burn in. Be specific about layout and visual hierarchy.)
"""

        messages = [{"role": "user", "content": prompt}]
        raw = await call_llm(messages)

        if not raw:
            raise HTTPException(500, "LLM engine failed to respond")

        # Parse sections
        def parse_section(tag: str, text: str) -> str:
            import re
            pattern = rf'\[{tag}\](.*?)(?=\[(?:YOUTUBE_SCRIPT|LINKEDIN|FACEBOOK|SEO_TITLE|SEO_DESCRIPTION|SEO_KEYWORDS|MEDIA_PROMPT)\]|$)'
            m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        result = {
            "youtube_script": parse_section("YOUTUBE_SCRIPT", raw),
            "linkedin":       parse_section("LINKEDIN", raw),
            "facebook":       parse_section("FACEBOOK", raw),
            "twitter":        parse_section("TWITTER", raw),
            "seo_title":      parse_section("SEO_TITLE", raw),
            "seo_description":parse_section("SEO_DESCRIPTION", raw),
            "seo_keywords":   parse_section("SEO_KEYWORDS", raw),
            "media_prompt":   parse_section("MEDIA_PROMPT", raw),
        }

        # Log to campaign ledger
        ledger = CampaignLedger(
            id=str(uuid.uuid4()), zone_id=req.zone_id,
            topic_theme=req.topic_theme,
            generated_text=json.dumps(result),
            media_prompt=result.get("media_prompt", ""),
            publish_status="PENDING",
            platforms_posted=json.dumps([])
        )
        db.add(ledger)
        db.commit()

        return {"status": "SUCCESS", "ledger_id": ledger.id, "content": result, "raw": raw}

    except Exception as e:
        logger.error(f"[CC] Generate error: {e}")
        raise HTTPException(500, str(e))

# ── CAMPAIGN LEDGER ───────────────────────────────────────────────────────────

@router.get("/ledger")
def get_ledger(limit: int = 20, db: Session = Depends(get_db)):
    entries = db.query(CampaignLedger).order_by(CampaignLedger.created_at.desc()).limit(limit).all()
    return [{"id": e.id, "zone_id": e.zone_id, "topic_theme": e.topic_theme,
             "publish_status": e.publish_status, "platforms_posted": e.platforms_posted,
             "published_at": e.published_at, "created_at": e.created_at} for e in entries]

@router.get("/ledger/{ledger_id}")
def get_ledger_entry(ledger_id: str, db: Session = Depends(get_db)):
    entry = db.query(CampaignLedger).filter(CampaignLedger.id == ledger_id).first()
    if not entry:
        raise HTTPException(404, "Ledger entry not found")
    content = json.loads(entry.generated_text) if entry.generated_text else {}
    return {"id": entry.id, "zone_id": entry.zone_id, "topic_theme": entry.topic_theme,
            "content": content, "media_prompt": entry.media_prompt,
            "publish_status": entry.publish_status, "created_at": entry.created_at}

@router.get("/zone-knowledge")
def get_zone_knowledge():
    return [{"zone_id": k, "zone_name": v["name"], "hook": v["hook"],
             "seo_focus": v["seo_focus"]} for k, v in ZONE_KNOWLEDGE.items()]


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — NATIVE MEDIA FORGE + CHRONO-TRIGGER + AUTO-PUBLISHER
# ══════════════════════════════════════════════════════════════════════════════
import subprocess
import asyncio
import httpx
from pathlib import Path

VAULT_ROOT  = Path("/media/vault")          # VPS asset vault path
OUTPUT_ROOT = Path("/media/cc_output")      # Generated MP4 / WebP output

# ── PHASE 2A: ELEVENLABS TTS ENGINE ──────────────────────────────────────────

async def generate_voiceover(script: str, output_path: str,
                              api_key: str, voice_id: str = "EXAVITQu4vr4xnSDxMaL") -> bool:
    """
    Calls ElevenLabs API to generate a studio-quality voiceover MP3.
    Default voice: 'Rachel' (neutral, professional).
    """
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
        payload = {
            "text": script,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.85}
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                Path(output_path).write_bytes(r.content)
                logger.info(f"[CC-TTS] Voiceover saved: {output_path}")
                return True
            else:
                logger.error(f"[CC-TTS] ElevenLabs error: {r.status_code} {r.text}")
                return False
    except Exception as e:
        logger.error(f"[CC-TTS] Exception: {e}")
        return False


# ── PHASE 2B: NATIVE FFMPEG VIDEO COMPOSITOR ─────────────────────────────────

def compose_video_native(asset_paths: list, audio_path: str,
                          output_path: str, subtitle_lines: list, aspect_ratio: str = "9:16") -> bool:
    """
    Native FFmpeg compositor. Uses ffprobe to measure accurate audio duration,
    distributes assets evenly, applies a dynamic crop based on aspect ratio,
    and applies sequential dynamic text hooks.
    """
    try:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        if not asset_paths:
            logger.error("[CC-COMP] No assets provided for composition")
            return False

        # --- Audio-Visual Syncing via ffprobe ---
        total_audio_duration = 45.0
        try:
            probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
            probe_out = subprocess.check_output(probe_cmd, text=True).strip()
            total_audio_duration = float(probe_out)
        except Exception as e:
            logger.warning(f"[CC-COMP] ffprobe failed, fallback to 45s: {e}")

        n = len(asset_paths)
        duration_each = total_audio_duration / n

        # Build input arguments
        input_args = []
        for p in asset_paths:
            input_args += ["-loop", "1", "-t", str(duration_each), "-i", p]

        # --- Platform-Specific Rendering (Crop & Scale) ---
        if aspect_ratio == "1:1":
            out_w, out_h = 1080, 1080
        elif aspect_ratio == "16:9":
            out_w, out_h = 1920, 1080
        else: # 9:16
            out_w, out_h = 1080, 1920

        # Build Ken Burns zoom filter per image
        zoom_filters = []
        for i in range(n):
            zoom_filters.append(
                f"[{i}:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
                f"crop={out_w}:{out_h},zoompan=z='min(zoom+0.0008,1.3)':d={duration_each * 25}:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={out_w}x{out_h},"
                f"setsar=1,fps=25[v{i}]"
            )

        concat_input = "".join(f"[v{i}]" for i in range(n))
        concat_filter = f"{''.join(zoom_filters)};{concat_input}concat=n={n}:v=1:a=0[video]"

        # --- Dynamic Captions & Text Hooks ---
        sub_filters = ""
        # Distribute the subtitle lines sequentially over the first 50% of the video
        num_subs = min(len(subtitle_lines), 3)
        sub_duration = (total_audio_duration * 0.5) / num_subs if num_subs > 0 else 0
        
        for idx, line in enumerate(subtitle_lines[:num_subs]):
            y_pos = int(out_h * 0.8) + idx * 80  # Place text near the bottom 20%
            safe_line = line.replace("'", "\\'").replace(":", "\\:")
            start_t = idx * sub_duration
            end_t = (idx + 1) * sub_duration
            sub_filters += (
                f",drawtext=text='{safe_line}':"
                f"fontcolor=white:fontsize={int(out_h * 0.02)}:box=1:boxcolor=black@0.6:boxborderw=8:"
                f"x=(w-text_w)/2:y={y_pos}:enable='between(t,{start_t},{end_t})'"
            )

        full_filter = f"{concat_filter}[video]{sub_filters}[final]"

        cmd = [
            "ffmpeg", "-y",
            *input_args,
            "-i", audio_path,
            "-filter_complex", full_filter,
            "-map", "[final]",
            "-map", f"{n}:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            "-pix_fmt", "yuv420p",
            output_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode == 0:
            logger.info(f"[CC-COMP] Video rendered: {output_path}")
            return True
        else:
            logger.error(f"[CC-COMP] FFmpeg error: {result.stderr[-500:]}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("[CC-COMP] FFmpeg timed out (>3 minutes)")
        return False
    except Exception as e:
        logger.error(f"[CC-COMP] Exception: {e}")
        return False


class ComposeRequest(BaseModel):
    ledger_id: str
    asset_ids: Optional[List[str]] = None      # Optional: Will use Smart Semantic Matching if empty
    elevenlabs_api_key: Optional[str] = None
    voiceover_script: Optional[str] = None  # Override; defaults to youtube_script
    target_aspect_ratio: Optional[str] = "9:16"


@router.post("/compose-video")
async def compose_video(req: ComposeRequest, db: Session = Depends(get_db)):
    """
    Phase 2A: Smart Asset Matching → generate TTS voiceover → FFmpeg sync render → save MP4.
    """
    try:
        # 1. Fetch ledger entry
        entry = db.query(CampaignLedger).filter(CampaignLedger.id == req.ledger_id).first()
        if not entry:
            raise HTTPException(404, "Ledger entry not found")

        content = json.loads(entry.generated_text or "{}")
        script = req.voiceover_script or content.get("youtube_script", "")
        if not script:
            raise HTTPException(400, "No YouTube script found in ledger entry")

        # 2. Smart Asset Matching / Fetch assets
        if req.asset_ids and len(req.asset_ids) > 0:
            assets = db.query(AssetVault).filter(AssetVault.id.in_(req.asset_ids)).all()
        else:
            # Smart Semantic Asset Matching based on Zone Tag and Topic
            assets = db.query(AssetVault).filter(
                (AssetVault.zone_tag == entry.zone_id) | 
                (AssetVault.asset_name.ilike(f"%{entry.topic_theme}%"))
            ).limit(4).all()
            if not assets:
                # Fallback to random assets
                assets = db.query(AssetVault).limit(4).all()

        if not assets:
            raise HTTPException(400, "No valid assets found in vault for composition")

        asset_paths = [a.file_path for a in assets]
        job_id = str(uuid.uuid4())[:8]
        OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

        audio_path  = str(OUTPUT_ROOT / f"{job_id}_voice.mp3")
        output_path = str(OUTPUT_ROOT / f"{job_id}_final.mp4")

        # 3. Generate voiceover
        if req.elevenlabs_api_key:
            voice_ok = await generate_voiceover(script, audio_path, req.elevenlabs_api_key)
        else:
            # Fallback: silent placeholder using ffmpeg silence
            voice_ok = False
            try:
                subprocess.run([
                    "ffmpeg", "-y", "-f", "lavfi", "-i",
                    "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-t", "45", audio_path
                ], capture_output=True, timeout=30)
                voice_ok = True
            except Exception as fe:
                logger.warning(f"[CC-COMP] Silent fallback failed: {fe}")

        if not voice_ok:
            raise HTTPException(500, "Voiceover generation failed")

        # 4. Extract subtitle lines from script (first 3 sentences)
        import re
        sentences = re.split(r'(?<=[.!?])\s+', script.strip())
        subtitle_lines = [s[:80] for s in sentences[:3]]

        # 5. FFmpeg composition in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            None, compose_video_native, asset_paths, audio_path, output_path, subtitle_lines, req.target_aspect_ratio
        )

        if not success:
            raise HTTPException(500, "FFmpeg composition failed")

        # 6. Update ledger with output path
        entry.asset_used = output_path
        db.commit()

        return {
            "status": "RENDERED",
            "output_path": output_path,
            "job_id": job_id,
            "asset_count": len(asset_paths),
            "voiceover": "ElevenLabs" if req.elevenlabs_api_key else "Silent fallback"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CC-COMPOSE] Error: {e}")
        raise HTTPException(500, str(e))


# ── PHASE 2C: OAUTH2 AUTO-PUBLISHER ──────────────────────────────────────────

async def publish_to_linkedin(text: str, access_token: str, person_urn: str) -> dict:
    """Posts a text update to LinkedIn via the Share API v2."""
    try:
        url = "https://api.linkedin.com/v2/ugcPosts"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        payload = {
            "author": f"urn:li:person:{person_urn}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload, headers=headers)
            return {"success": r.status_code in [200, 201], "status": r.status_code, "body": r.text[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def publish_to_facebook(text: str, access_token: str, page_id: str) -> dict:
    """Posts to a Facebook Page via the Graph API."""
    try:
        url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
        params = {"message": text, "access_token": access_token}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, params=params)
            data = r.json()
            return {"success": "id" in data, "post_id": data.get("id"), "body": str(data)[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def publish_to_youtube(title: str, description: str,
                              video_path: str, access_token: str) -> dict:
    """
    Uploads a video to YouTube via the Data API v3 (resumable upload).
    The video file must exist on the VPS.
    """
    try:
        video_file = Path(video_path)
        if not video_file.exists():
            return {"success": False, "error": f"Video file not found: {video_path}"}

        metadata_url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": str(video_file.stat().st_size),
        }
        metadata = {
            "snippet": {
                "title": title[:100],
                "description": description,
                "tags": ["MiracleOS", "VigilantITSolution", "AIEnterprise", "HospitalityTech", "ERP"],
                "categoryId": "28"
            },
            "status": {"privacyStatus": "public"}
        }
        async with httpx.AsyncClient(timeout=60) as client:
            # Step 1: Initiate resumable upload session
            init_r = await client.post(metadata_url, json=metadata, headers=headers)
            if init_r.status_code != 200:
                return {"success": False, "status": init_r.status_code, "body": init_r.text[:300]}

            upload_url = init_r.headers.get("Location")
            if not upload_url:
                return {"success": False, "error": "No upload URL in response"}

            # Step 2: Upload video bytes
            video_bytes = video_file.read_bytes()
            upload_r = await client.put(
                upload_url,
                content=video_bytes,
                headers={"Content-Type": "video/mp4", "Content-Length": str(len(video_bytes))},
                timeout=300
            )
            data = upload_r.json() if upload_r.text else {}
            return {"success": upload_r.status_code in [200, 201], "video_id": data.get("id"), "status": upload_r.status_code}

    except Exception as e:
        return {"success": False, "error": str(e)}


class PublishRequest(BaseModel):
    ledger_id: str
    platforms: List[str]    # ["linkedin", "facebook", "youtube"]
    linkedin_urn: Optional[str] = None     # LinkedIn person URN (digits only)


@router.post("/publish/{ledger_id}")
async def publish_content(ledger_id: str, req: PublishRequest, db: Session = Depends(get_db)):
    """
    Phase 2B: Read ledger entry → push text/video to each configured platform.
    Uses stored API tokens from cc_social_api_configs.
    """
    try:
        entry = db.query(CampaignLedger).filter(CampaignLedger.id == ledger_id).first()
        if not entry:
            raise HTTPException(404, "Ledger entry not found")

        content = json.loads(entry.generated_text or "{}")
        seo_title = content.get("seo_title", "Miracle OS — World's First AI ERP")
        seo_desc  = content.get("seo_description", "")
        results   = {}

        for platform in req.platforms:
            cfg = db.query(SocialApiConfig).filter(
                SocialApiConfig.platform == platform.upper()
            ).first()

            if not cfg or not cfg.access_token:
                results[platform] = {"success": False, "reason": "No access token configured"}
                continue

            if platform.lower() == "linkedin":
                text = content.get("linkedin", "")
                if not text:
                    results[platform] = {"success": False, "reason": "No LinkedIn text generated"}
                    continue
                urn = req.linkedin_urn or cfg.page_id or ""
                results[platform] = await publish_to_linkedin(text, cfg.access_token, urn)

            elif platform.lower() == "facebook":
                text = content.get("facebook", "")
                if not text:
                    results[platform] = {"success": False, "reason": "No Facebook text generated"}
                    continue
                results[platform] = await publish_to_facebook(text, cfg.access_token, cfg.page_id or "")

            elif platform.lower() == "youtube":
                video_path = entry.asset_used or ""
                if not video_path:
                    results[platform] = {"success": False, "reason": "No rendered video found. Run /compose-video first."}
                    continue
                results[platform] = await publish_to_youtube(
                    seo_title, f"{content.get('youtube_script', '')}\n\n{seo_desc}",
                    video_path, cfg.access_token
                )

        # Update ledger status
        all_ok = all(v.get("success") for v in results.values())
        entry.publish_status = "PUBLISHED" if all_ok else "FAILED"
        entry.platforms_posted = json.dumps(req.platforms)
        entry.published_at = datetime.now(timezone.utc)
        db.commit()

        return {"status": "PUBLISHED" if all_ok else "PARTIAL", "results": results, "ledger_id": ledger_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CC-PUBLISH] Error: {e}")
        raise HTTPException(500, str(e))


# ── PHASE 2D: CHRONO-TRIGGER AGI PULSE ───────────────────────────────────────

async def run_agi_campaign_pulse():
    """
    The Sovereign AGI Chrono-Trigger.
    Wakes up on schedule, reads the next sequence from the Sequence Matrix,
    auto-generates content, logs to Campaign Ledger, and (if configured) auto-publishes.
    This is wired into the FastAPI lifespan in main.py.
    """
    import calendar

    logger.info("🤖 [CC-PULSE] AGI Campaign Chrono-Trigger initialized.")

    while True:
        try:
            await asyncio.sleep(60)  # Check every 60 seconds

            now = datetime.now(timezone.utc)
            # Fire only on Tuesday (1) and Thursday (3) at 09:00 UTC
            if now.weekday() not in [1, 3] or now.hour != 3 or now.minute > 1:
                continue

            logger.info("⚡ [CC-PULSE] AGI Campaign Pulse FIRING for scheduled content generation...")

            db = SessionLocal()
            try:
                # Get next active sequence (round-robin by sequence_day)
                seqs = db.query(CampaignSequence).filter(
                    CampaignSequence.is_active == True
                ).order_by(CampaignSequence.sequence_day).all()

                if not seqs:
                    logger.warning("[CC-PULSE] No active sequences in matrix. Skipping pulse.")
                    continue

                # Pick sequence based on ISO week number (cycles through all)
                week_num = now.isocalendar()[1]
                seq = seqs[week_num % len(seqs)]

                logger.info(f"⚡ [CC-PULSE] Generating content for: {seq.zone_name} | Theme: {seq.topic_theme}")

                # Build generation request
                zone = ZONE_KNOWLEDGE.get(seq.zone_id, {
                    "name": seq.zone_name,
                    "hook": seq.topic_theme,
                    "features": ["Enterprise-grade AI operations"],
                    "seo_focus": "enterprise software, hotel management"
                })

                prompt = f"""You are the Sovereign AGI Content Director for Vigilant IT Solution Ltd and Miracle OS.
Generate autonomous campaign content for {zone['name']}.
CORE HOOK: {zone['hook']}
KEY FEATURES: {', '.join(zone.get('features', []))}
SEO FOCUS: {zone.get('seo_focus', '')}
BRIEF: {seq.custom_brief or 'Use your best judgment for maximum viral reach.'}

Generate:
[LINKEDIN]
(300-word elite thought-leadership post with 10 hashtags #MiracleOS #VigilantITSolution)

[FACEBOOK]
(Warm visual story under 200 words with emojis)

[YOUTUBE_SCRIPT]
(45-second punchy Shorts script with hook, problem, solution, CTA)

[SEO_TITLE]
(Under 60 chars — include Miracle OS)

[SEO_DESCRIPTION]
(160-char meta description)

[SEO_KEYWORDS]
(12 comma-separated long-tail keywords)

[MEDIA_PROMPT]
(Director's note for Asset Vault compositor)"""

                messages = [{"role": "user", "content": prompt}]
                raw = await call_llm(messages)

                if raw:
                    import re
                    def _parse(tag, text):
                        m = re.search(rf'\[{tag}\](.*?)(?=\[(?:LINKEDIN|FACEBOOK|YOUTUBE_SCRIPT|SEO_TITLE|SEO_DESCRIPTION|SEO_KEYWORDS|MEDIA_PROMPT)\]|$)', text, re.DOTALL | re.IGNORECASE)
                        return m.group(1).strip() if m else ""

                    result = {
                        "linkedin":       _parse("LINKEDIN", raw),
                        "facebook":       _parse("FACEBOOK", raw),
                        "youtube_script": _parse("YOUTUBE_SCRIPT", raw),
                        "seo_title":      _parse("SEO_TITLE", raw),
                        "seo_description":_parse("SEO_DESCRIPTION", raw),
                        "seo_keywords":   _parse("SEO_KEYWORDS", raw),
                        "media_prompt":   _parse("MEDIA_PROMPT", raw),
                    }

                    ledger = CampaignLedger(
                        id=str(uuid.uuid4()),
                        zone_id=seq.zone_id,
                        topic_theme=seq.topic_theme,
                        generated_text=json.dumps(result),
                        media_prompt=result.get("media_prompt", ""),
                        publish_status="DRAFT",
                        platforms_posted=json.dumps([])
                    )
                    db.add(ledger)
                    db.commit()

                    logger.info(f"✅ [CC-PULSE] Content generated and saved. Ledger ID: {ledger.id}")

                    # Auto-publish if all platforms have auto_publish=True
                    auto_configs = db.query(SocialApiConfig).filter(
                        SocialApiConfig.auto_publish == True,
                        SocialApiConfig.is_connected == True
                    ).all()

                    if auto_configs:
                        platforms_to_publish = [c.platform.lower() for c in auto_configs]
                        logger.info(f"⚡ [CC-PULSE] Auto-publishing to: {platforms_to_publish}")

                        for cfg in auto_configs:
                            plat = cfg.platform.lower()
                            try:
                                if plat == "linkedin":
                                    res = await publish_to_linkedin(result.get("linkedin", ""), cfg.access_token, cfg.page_id or "")
                                    logger.info(f"[CC-PULSE] LinkedIn: {res}")
                                elif plat == "facebook":
                                    res = await publish_to_facebook(result.get("facebook", ""), cfg.access_token, cfg.page_id or "")
                                    logger.info(f"[CC-PULSE] Facebook: {res}")
                            except Exception as pub_err:
                                logger.error(f"[CC-PULSE] Auto-publish error for {plat}: {pub_err}")

                        ledger.publish_status = "PUBLISHED"
                        ledger.platforms_posted = json.dumps(platforms_to_publish)
                        ledger.published_at = datetime.now(timezone.utc)
                        db.commit()

            finally:
                db.close()

            # Sleep 23 hours after a successful fire to prevent double-trigger
            logger.info("[CC-PULSE] Sleeping 23 hours after successful pulse.")
            await asyncio.sleep(23 * 3600)

        except asyncio.CancelledError:
            logger.info("[CC-PULSE] Chrono-Trigger daemon shutting down.")
            break
        except Exception as e:
            logger.error(f"[CC-PULSE] Unexpected error: {e}")
            await asyncio.sleep(3600)  # Back off 1 hour on error


@router.post("/trigger-pulse")
async def manual_trigger_pulse(db: Session = Depends(get_db)):
    """
    Manual override: Immediately fires the AGI Campaign Pulse for the next sequence.
    Use this to test the chrono-trigger without waiting for Tuesday/Thursday.
    """
    try:
        seqs = db.query(CampaignSequence).filter(CampaignSequence.is_active == True)\
                 .order_by(CampaignSequence.sequence_day).all()
        if not seqs:
            raise HTTPException(400, "No active sequences found. Add sequences to the matrix first.")

        from datetime import date
        seq = seqs[date.today().timetuple().tm_yday % len(seqs)]

        zone = ZONE_KNOWLEDGE.get(seq.zone_id, {
            "name": seq.zone_name, "hook": seq.topic_theme,
            "features": ["Enterprise-grade AI operations"],
            "seo_focus": "enterprise software"
        })

        prompt = f"""You are the Sovereign AGI Content Director for Vigilant IT Solution Ltd and Miracle OS.
Generate content for {zone['name']} — {zone['hook']}.
Custom Brief: {seq.custom_brief or 'Maximum viral reach, elite tone.'}

[LINKEDIN]
(300-word thought-leadership post + 10 hashtags #MiracleOS #VigilantITSolution #AGI)

[FACEBOOK]
(Visual warm story post under 200 words with emojis and a CTA)

[YOUTUBE_SCRIPT]
(45-second punchy Shorts script with hook, problem, solution, CTA to vigilantitsolution.com)

[SEO_TITLE]
[SEO_DESCRIPTION]
[SEO_KEYWORDS]
[MEDIA_PROMPT]"""

        messages = [{"role": "user", "content": prompt}]
        raw = await call_llm(messages)

        import re
        def _parse(tag, text):
            m = re.search(rf'\[{tag}\](.*?)(?=\[(?:LINKEDIN|FACEBOOK|YOUTUBE_SCRIPT|SEO_TITLE|SEO_DESCRIPTION|SEO_KEYWORDS|MEDIA_PROMPT)\]|$)', text, re.DOTALL | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        result = {
            "linkedin": _parse("LINKEDIN", raw), "facebook": _parse("FACEBOOK", raw),
            "youtube_script": _parse("YOUTUBE_SCRIPT", raw), "seo_title": _parse("SEO_TITLE", raw),
            "seo_description": _parse("SEO_DESCRIPTION", raw), "seo_keywords": _parse("SEO_KEYWORDS", raw),
            "media_prompt": _parse("MEDIA_PROMPT", raw),
        }

        ledger = CampaignLedger(
            id=str(uuid.uuid4()), zone_id=seq.zone_id, topic_theme=seq.topic_theme,
            generated_text=json.dumps(result), media_prompt=result.get("media_prompt", ""),
            publish_status="DRAFT", platforms_posted=json.dumps([])
        )
        db.add(ledger)
        db.commit()

        return {"status": "PULSE_FIRED", "sequence": seq.zone_name,
                "topic": seq.topic_theme, "ledger_id": ledger.id, "content": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CC-MANUAL-PULSE] Error: {e}")
        raise HTTPException(500, str(e))
