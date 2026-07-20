import time
import httpx
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter
import urllib.parse
import logging

logger = logging.getLogger("MasterOS")

router = APIRouter()

WEATHER_CITIES = [
  { "name": 'DHAKA',     "lat": 23.8103, "lon": 90.4125, "tz": 'Asia/Dhaka' },
  { "name": 'NEW YORK',  "lat": 40.7128, "lon": -74.006, "tz": 'America/New_York' },
  { "name": 'LONDON',    "lat": 51.5074, "lon": -0.1278, "tz": 'Europe/London' },
  { "name": 'DUBAI',     "lat": 25.2048, "lon": 55.2708, "tz": 'Asia/Dubai' },
  { "name": 'SINGAPORE', "lat": 1.3521,  "lon": 103.8198, "tz": 'Asia/Singapore' },
  { "name": 'TOKYO',     "lat": 35.6762, "lon": 139.6503, "tz": 'Asia/Tokyo' },
  { "name": 'SYDNEY',    "lat": -33.8688, "lon": 151.2093, "tz": 'Australia/Sydney'},
  { "name": 'MUMBAI',    "lat": 19.0760, "lon": 72.8777,  "tz": 'Asia/Kolkata' },
  { "name": 'PARIS',     "lat": 48.8566, "lon": 2.3522,   "tz": 'Europe/Paris' },
  { "name": 'BEIJING',   "lat": 39.9042, "lon": 116.4074, "tz": 'Asia/Shanghai' },
]

FX_PAIRS = ['EUR','GBP','JPY','AED','SGD','BDT','AUD','INR','CNY','CAD']

# In-memory Global Cache
class GlobalCache:
    weather_data = []
    fx_data = {}
    last_weather_fetch = 0
    last_fx_fetch = 0
    CACHE_TTL = 3600  # 1 hour in seconds

global_cache = GlobalCache()

async def fetch_city_weather(client: httpx.AsyncClient, city: dict):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={city['lat']}&longitude={city['lon']}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh&timezone={urllib.parse.quote(city['tz'])}"
    try:
        response = await client.get(url, timeout=10.0)
        if response.status_code == 200:
            c = response.json().get("current", {})
            if c:
                return {
                    "city": city,
                    "temp": round(c.get("temperature_2m", 0)),
                    "feelsLike": round(c.get("apparent_temperature", 0)),
                    "humidity": round(c.get("relative_humidity_2m", 0)),
                    "windSpeed": round(c.get("wind_speed_10m", 0)),
                    "weatherCode": c.get("weather_code", 0),
                    "isDay": c.get("is_day", 1),
                }
    except Exception as e:
        logger.error(f"Weather fetch failed for {city['name']}: {e}")
    
    return {
        "city": city,
        "temp": 0, "feelsLike": 0, "humidity": 0, "windSpeed": 0,
        "weatherCode": 0, "isDay": 1,
    }

async def update_weather_cache():
    now = time.time()
    if now - global_cache.last_weather_fetch < global_cache.CACHE_TTL and global_cache.weather_data:
        return global_cache.weather_data

    async with httpx.AsyncClient() as client:
        tasks = [fetch_city_weather(client, city) for city in WEATHER_CITIES]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_results = []
        for res in results:
            if isinstance(res, Exception):
                logger.error(f"Weather gather exception: {res}")
            else:
                valid_results.append(res)
                
        if valid_results:
            global_cache.weather_data = valid_results
            global_cache.last_weather_fetch = now
            
    return global_cache.weather_data

async def update_fx_cache():
    now = time.time()
    if now - global_cache.last_fx_fetch < global_cache.CACHE_TTL and global_cache.fx_data:
        return global_cache.fx_data

    url = f"https://api.frankfurter.dev/v1/latest?base=USD&symbols={','.join(FX_PAIRS)}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                rates = response.json().get("rates", {})
                
                next_fx = {}
                for p in FX_PAIRS:
                    rate = rates.get(p, 0)
                    prev = global_cache.fx_data.get(p, {}).get("rate", rate)
                    next_fx[p] = {"rate": rate, "prev": prev}
                
                global_cache.fx_data = next_fx
                global_cache.last_fx_fetch = now
    except Exception as e:
        logger.error(f"FX fetch failed: {e}")

    return global_cache.fx_data

@router.get("/sync")
async def get_global_sync():
    """Returns globally cached weather and FX rates, plus server time."""
    weather, fx = await asyncio.gather(
        update_weather_cache(),
        update_fx_cache()
    )
    
    return {
        "status": "SUCCESS",
        "data": {
            "weather": weather,
            "fxRates": fx,
            "server_time": datetime.now(timezone.utc).isoformat()
        }
    }
