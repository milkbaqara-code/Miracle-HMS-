import os, uuid, logging, json, subprocess
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import Session
from app.core.database import Base, SessionLocal

logger = logging.getLogger("MediaVault")
router = APIRouter()

# ── VAULT DIRECTORIES ──────────────────────────────────────────────
VAULT_DIR = "/media/vault"
MV_EXPORTS = "/media/vault/exports"
os.makedirs(VAULT_DIR, exist_ok=True)
os.makedirs(MV_EXPORTS, exist_ok=True)

# ── MODELS ─────────────────────────────────────────────────────────
class MediaVaultAsset(Base):
    __tablename__ = "mv_assets"
    __table_args__ = {"extend_existing": True}
    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_name    = Column(String(128), nullable=False)
    asset_type    = Column(String(32), nullable=False)  # VIDEO, AUDIO, IMAGE
    file_path     = Column(String(255), nullable=False)
    duration_sec  = Column(Integer, default=0)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MediaVaultProject(Base):
    __tablename__ = "mv_projects"
    __table_args__ = {"extend_existing": True}
    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_name  = Column(String(128), nullable=False)
    state_json    = Column(Text, nullable=False, default="{}")
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── ENDPOINTS ──────────────────────────────────────────────────────

@router.get("/")
def get_assets(db: Session = Depends(get_db)):
    assets = db.query(MediaVaultAsset).order_by(MediaVaultAsset.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "asset_name": a.asset_name,
            "asset_type": a.asset_type,
            "file_path": a.file_path,
            "duration_sec": a.duration_sec,
            "url": f"/api/media-vault/stream/{a.id}"
        }
        for a in assets
    ]

@router.post("/upload")
async def upload_asset(
    file: UploadFile = File(...),
    asset_name: str = Form(...),
    asset_type: str = Form(...),
    db: Session = Depends(get_db)
):
    """Uploads media straight to the vault."""
    ext = file.filename.split('.')[-1].lower() if file.filename else "bin"
    asset_id = str(uuid.uuid4())
    safe_path = os.path.join(VAULT_DIR, f"{asset_id}.{ext}")

    with open(safe_path, "wb") as f:
        f.write(await file.read())

    # Create DB entry
    asset = MediaVaultAsset(
        id=asset_id,
        asset_name=asset_name,
        asset_type=asset_type.upper(),
        file_path=safe_path
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"status": "UPLOAD_OK", "id": asset.id, "file_path": asset.file_path}

@router.get("/stream/{asset_id}")
def stream_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(MediaVaultAsset).filter(MediaVaultAsset.id == asset_id).first()
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="Asset not found on disk")
    return FileResponse(asset.file_path)

@router.post("/trim")
def trim_clip(asset_id: str, start_sec: float, end_sec: float, db: Session = Depends(get_db)):
    """Phase 1: Basic FFmpeg trim."""
    asset = db.query(MediaVaultAsset).filter(MediaVaultAsset.id == asset_id).first()
    if not asset: raise HTTPException(404, "Asset not found")
    
    out_id = str(uuid.uuid4())
    ext = asset.file_path.split('.')[-1]
    out_path = os.path.join(VAULT_DIR, f"trimmed_{out_id}.{ext}")

    cmd = [
        "ffmpeg", "-y", "-i", asset.file_path,
        "-ss", str(start_sec), "-to", str(end_sec),
        "-c", "copy", out_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        logger.error(f"Trim failed: {e.stderr.decode()}")
        raise HTTPException(500, "FFmpeg trim failed")

    new_asset = MediaVaultAsset(
        id=out_id,
        asset_name=f"{asset.asset_name} (Trimmed)",
        asset_type=asset.asset_type,
        file_path=out_path
    )
    db.add(new_asset)
    db.commit()
    return {"status": "TRIMMED", "id": out_id}

@router.post("/remove-bg")
async def remove_background(
    payload: dict,
    db: Session = Depends(get_db)
):
    """Phase 3: AI Background Removal using rembg."""
    asset_id = payload.get("asset_id")
    asset = db.query(MediaVaultAsset).filter(MediaVaultAsset.id == asset_id).first()
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(404, "Asset not found")
        
    try:
        from rembg import remove
        from PIL import Image
        import io
        
        with open(asset.file_path, "rb") as f:
            input_data = f.read()
            
        output_data = remove(input_data)
        
        new_id = str(uuid.uuid4())
        safe_path = os.path.join(VAULT_DIR, f"{new_id}_nobg.png")
        
        img = Image.open(io.BytesIO(output_data))
        img.save(safe_path, format="PNG")
        
        new_asset = MediaVaultAsset(
            id=new_id,
            asset_name=f"{asset.asset_name} (No BG)",
            asset_type="IMAGE",
            file_path=safe_path
        )
        db.add(new_asset)
        db.commit()
        db.refresh(new_asset)
        return {"status": "BG_REMOVED", "id": new_asset.id, "file_path": new_asset.file_path}
    except ImportError:
        raise HTTPException(500, "rembg not installed on server.")
    except Exception as e:
        logger.error(f"BG Removal failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/transcribe")
def transcribe_audio(payload: dict, db: Session = Depends(get_db)):
    """Phase 3: AI Auto-lyrics using Whisper."""
    asset_id = payload.get("asset_id")
    asset = db.query(MediaVaultAsset).filter(MediaVaultAsset.id == asset_id).first()
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(404, "Asset not found")
        
    try:
        import whisper
        # Load whisper base model
        model = whisper.load_model("base")
        # Transcribe with word-level timestamps
        result = model.transcribe(asset.file_path, word_timestamps=True)
        
        lyrics = []
        for segment in result.get("segments", []):
            for word in segment.get("words", []):
                lyrics.append({
                    "text": word["word"].strip(),
                    "start_time": word["start"],
                    "duration": word["end"] - word["start"]
                })
        return {"status": "TRANSCRIBED", "lyrics": lyrics}
    except ImportError:
        raise HTTPException(500, "whisper not installed on server.")
    except Exception as e:
        logger.error(f"Whisper failed: {e}")
        raise HTTPException(500, str(e))

@router.post("/render")
def render_timeline(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Phase 2 & 3: Advanced FFmpeg filter_complex rendering.
    """
    clips = payload.get("clips", [])
    if not clips:
        raise HTTPException(400, "No clips provided")
        
    job_id = f"render_{int(datetime.now().timestamp())}"
    out_file = os.path.join(MV_EXPORTS, f"{job_id}.mp4")
    
    def _do_render():
        logger.info(f"Starting complex render job {job_id}")
        inputs = []
        video_clips = [c for c in clips if c.get("type") == "VIDEO"]
        audio_clips = [c for c in clips if c.get("type") == "AUDIO"]
        text_clips = [c for c in clips if c.get("type") == "TEXT"]
        
        db_session = SessionLocal()
        try:
            list_file = os.path.join(MV_EXPORTS, f"{job_id}_list.txt")
            with open(list_file, "w") as f:
                for c in video_clips:
                    a = db_session.query(MediaVaultAsset).filter(MediaVaultAsset.id == c["asset_id"]).first()
                    if a and os.path.exists(a.file_path):
                        f.write(f"file '{a.file_path}'\n")
            
            cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file]
            
            audio_inputs = []
            for ac in audio_clips:
                a = db_session.query(MediaVaultAsset).filter(MediaVaultAsset.id == ac["asset_id"]).first()
                if a and os.path.exists(a.file_path):
                    cmd.extend(["-i", a.file_path])
                    audio_inputs.append(a.file_path)
                    
            filter_complex = ""
            
            if audio_inputs:
                filter_complex += f"[0:a]"
                for i in range(len(audio_inputs)):
                    filter_complex += f"[{i+1}:a]"
                filter_complex += f"amix=inputs={len(audio_inputs)+1}:duration=first[aout];"
            
            if text_clips:
                vid_stream = "[0:v]"
                for i, tc in enumerate(text_clips):
                    text = tc.get("name", "").replace("'", "\\'")
                    start = tc.get("start_time", 0)
                    end = start + tc.get("duration", 2)
                    next_stream = f"[v{i}]" if i < len(text_clips)-1 else "[vout]"
                    filter_complex += f"{vid_stream}drawtext=text='{text}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,{start},{end})'{next_stream};"
                    vid_stream = next_stream
            
            if filter_complex:
                cmd.extend(["-filter_complex", filter_complex.rstrip(";")])
                if text_clips:
                    cmd.extend(["-map", "[vout]"])
                else:
                    cmd.extend(["-map", "0:v"])
                    
                if audio_inputs:
                    cmd.extend(["-map", "[aout]"])
                else:
                    cmd.extend(["-map", "0:a?"])
            else:
                cmd.extend(["-c", "copy"])
                
            cmd.append(out_file)
            subprocess.run(cmd, check=True)
            
            res_asset = MediaVaultAsset(
                asset_name=f"Studio Render {job_id}",
                asset_type="VIDEO",
                file_path=out_file
            )
            db_session.add(res_asset)
            db_session.commit()
            
        except Exception as e:
            logger.error(f"Complex render failed: {e}")
        finally:
            db_session.close()

    background_tasks.add_task(_do_render)
    return {"status": "RENDERING_STARTED", "job_id": job_id}


