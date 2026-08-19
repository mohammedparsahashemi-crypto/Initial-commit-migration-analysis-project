"""
config.py - تنظیمات پروژه
==========================
تنظیمات مسیرها، API و CORS
"""

from pathlib import Path

# مسیرهای اصلی
BASE_DIR = Path(__file__).parent.parent
BACKEND_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
MODELS_DIR = BASE_DIR / "models"

# ایجاد پوشه‌ها در صورت عدم وجود
CACHE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# مسیر فایل‌های داده
MIGRATION_DATA_PATH = DATA_DIR / "migration-data.json"
HISTORICAL_DATA_PATH = DATA_DIR / "historical-data.json"

# تنظیمات API
API_TITLE = "مهاجرت‌یاب API"
API_VERSION = "3.0.0"
API_DESCRIPTION = "API تحلیل و پیش‌بینی مهاجرت ایران"

# تنظیمات CORS
ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
]

# تنظیمات اسکرپر
SCRAPER_CACHE_HOURS = 3
SCRAPER_MAX_NEWS = 30