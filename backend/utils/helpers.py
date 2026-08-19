 
"""
helpers.py - توابع کمکی
=======================
توابع عمومی برای استفاده در پروژه
"""

import json
from pathlib import Path
from typing import Dict, Any


def load_json_file(path: Path) -> Dict[str, Any]:
    """بارگذاری فایل JSON"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"⚠️ فایل {path} پیدا نشد")
        return {}
    except Exception as e:
        print(f"❌ خطا در بارگذاری فایل {path}: {e}")
        return {}


def save_json_file(path: Path, data: Dict[str, Any]):
    """ذخیره فایل JSON"""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ خطا در ذخیره فایل {path}: {e}")