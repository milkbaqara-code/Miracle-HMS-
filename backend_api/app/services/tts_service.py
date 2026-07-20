import os
import base64
import httpx
import logging

logger = logging.getLogger("TTS_Service")

# ============================================================
# SOVEREIGN TTS SERVICE — Uses Google Cloud TTS REST API
# Auth: GEMINI_API_KEY (same Google project, no SDK needed)
# Fallback: raises exception → frontend uses browser TTS
# ============================================================

class TTSService:
    """
    Uses Google Cloud Text-to-Speech REST API directly.
    The GEMINI_API_KEY doubles as the API key for Google Cloud TTS
    (both are Google Cloud APIs, same project key works).
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.endpoint = "https://texttospeech.googleapis.com/v1/text:synthesize"
        if self.api_key:
            logger.info("✅ TTS Service initialized with Google API Key")
        else:
            logger.warning("⚠️ TTS Service: GEMINI_API_KEY not set — voice will fall back to browser TTS")

    async def text_to_speech(self, text: str, language_code: str = "EN") -> str:
        """
        Converts text to speech using Google Cloud TTS REST API.
        Returns base64-encoded MP3 string.
        Raises Exception on failure (triggers browser TTS fallback).
        """
        if not self.api_key:
            raise Exception("No API key configured. Frontend will use browser TTS.")

        # =================================================================
        # SOVEREIGN PHONETIC NORMALIZATION PIPELINE
        # Directive: ALWAYS use the Lexicon-first approach.
        # The phonetic_lexicon module is the single source of truth for
        # how enterprise terms are pronounced. DO NOT add new regex rules
        # here -- add them to app/services/phonetic_lexicon.py instead.
        # =================================================================
        from app.services.phonetic_lexicon import normalize_for_speech
        text = normalize_for_speech(text)

        # Map language codes to Google Cloud TTS params
        if language_code == "AR":
            lang = "ar-XA"
            voice_name = "ar-XA-Wavenet-A"
        elif language_code == "BN":
            lang = "bn-IN"
            voice_name = "bn-IN-Wavenet-A"
        else:
            lang = "en-GB"
            voice_name = "en-GB-Neural2-C"  # Premium British female voice

        payload = {
            "input": {"text": text[:500]},  # Guard against oversized text
            "voice": {
                "languageCode": lang,
                "name": voice_name,
                "ssmlGender": "FEMALE"
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "pitch": 0.0,
                "speakingRate": 0.93,
                "effectsProfileId": ["small-bluetooth-speaker-class-device"]
            }
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{self.endpoint}?key={self.api_key}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

        if response.status_code != 200:
            logger.error(f"Google TTS API error {response.status_code}: {response.text[:200]}")
            raise Exception(f"TTS API returned {response.status_code}")

        data = response.json()
        audio_content = data.get("audioContent", "")
        if not audio_content:
            raise Exception("TTS API returned empty audio content")

        logger.info(f"✅ TTS synthesized: {len(text)} chars → {lang}")
        return audio_content  # Already base64 from Google Cloud REST API

tts_service = TTSService()
