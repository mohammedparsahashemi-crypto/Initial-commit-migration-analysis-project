"""
models.py - مدل‌های داده برای API
==================================
تعریف مدل‌های Pydantic برای اعتبارسنجی داده‌های ورودی و خروجی
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class NewsRequest(BaseModel):
    """درخواست تحلیل یک خبر"""
    text: str = Field(..., min_length=5, description="متن خبر")


class AnalyzeRequest(BaseModel):
    """درخواست تحلیل گروهی اخبار"""
    news_list: List[str] = Field(..., min_length=1, description="لیست اخبار")


class PredictRequest(BaseModel):
    """درخواست پیش‌بینی"""
    province: str = Field(..., min_length=2, max_length=50, description="نام استان")
    years: int = Field(5, ge=1, le=10, description="تعداد سال‌های پیش‌بینی")


class ProvinceResponse(BaseModel):
    """اطلاعات یک استان"""
    id: str
    name: str
    incoming: int
    outgoing: int
    net: int
    causes: Optional[Dict[str, float]] = {}


class ProvincesListResponse(BaseModel):
    """لیست استان‌ها"""
    count: int
    provinces: List[ProvinceResponse]


class AnalyzeResponse(BaseModel):
    """نتیجه تحلیل"""
    causes: Dict[str, float]
    main_cause: str
    main_percent: float
    confidence: Optional[float] = None