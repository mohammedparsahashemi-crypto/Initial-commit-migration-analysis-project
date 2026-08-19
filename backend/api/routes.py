from fastapi import APIRouter, HTTPException, Query
from backend.core.migration_service import MigrationService
from backend.core.predictor import Predictor
from backend.core.scraper import get_scraper
from backend.core.classifier import get_classifier

router = APIRouter()
service = MigrationService()
predictor = Predictor()

@router.get("/provinces")
async def get_provinces():
    """دریافت لیست همه استان‌ها با داده‌های مهاجرت"""
    return {
        "provinces": service.get_all_provinces(),
        "totalMigrants": service.get_total_migrants(),
        "lastUpdate": service.get_last_update()
    }

@router.get("/historical/{province}")
async def get_historical(province: str):
    """دریافت داده‌های تاریخی یک استان"""
    # پیدا کردن استان با نام یا id
    province_data = service.get_province_by_name(province)
    if not province_data:
        for p in service.get_all_provinces():
            if p['id'] == province:
                province_data = p
                break
    
    if not province_data:
        raise HTTPException(status_code=404, detail=f"استان '{province}' یافت نشد")
    
    name = province_data['name']
    print(f"🔍 جستجوی داده تاریخی برای: {name}")
    
    data = service.get_historical(name)
    if not data:
        # اگر داده نبود، یکبار تولید کن
        print(f"⚠️ داده تاریخی برای {name} پیدا نشد، تولید میکنم...")
        service._generate_historical_data()
        service._save_historical_data()
        data = service.get_historical(name)
        
        if not data:
            raise HTTPException(status_code=404, detail=f"داده‌ای برای استان '{name}' یافت نشد")
    
    return data

@router.get("/predict/province/{province}")
async def predict_province(province: str, years: int = Query(5, ge=1, le=10)):
    """پیش‌بینی مهاجرت یک استان"""
    province_data = service.get_province_by_name(province)
    if not province_data:
        for p in service.get_all_provinces():
            if p['id'] == province:
                province_data = p
                break
    
    if not province_data:
        raise HTTPException(status_code=404, detail=f"استان '{province}' یافت نشد")
    
    name = province_data['name']
    hist_data = service.get_historical(name)
    
    if not hist_data:
        # اگر داده نبود، یکبار تولید کن
        service._generate_historical_data()
        service._save_historical_data()
        hist_data = service.get_historical(name)
        
        if not hist_data:
            raise HTTPException(status_code=404, detail=f"داده‌ای برای استان '{name}' یافت نشد")
    
    predictions = predictor.predict(hist_data, years)
    
    return {
        "province": name,
        "current_net": province_data.get('net', 0),
        "predictions": predictions
    }

@router.get("/predict/all")
async def predict_all(years: int = Query(3, ge=1, le=10)):
    """پیش‌بینی همه استان‌ها"""
    results = []
    for province in service.get_all_provinces():
        name = province['name']
        hist_data = service.get_historical(name)
        if hist_data:
            preds = predictor.predict(hist_data, years)
            results.append({
                "province": name,
                "current_net": province.get('net', 0),
                "predictions": preds
            })
    
    results.sort(key=lambda x: x['predictions'][-1]['predicted_net'] if x['predictions'] else 0, reverse=True)
    return {"predictions": results}

@router.get("/risk-zones")
async def get_risk_zones(threshold: int = Query(-10000)):
    """دریافت استان‌های پرخطر"""
    results = []
    for province in service.get_all_provinces():
        name = province['name']
        hist_data = service.get_historical(name)
        if hist_data:
            preds = predictor.predict(hist_data, 3)
            if preds and len(preds) > 0:
                last = preds[-1]
                if last['predicted_net'] < threshold:
                    results.append({
                        "province": name,
                        "predicted_net": last['predicted_net'],
                        "year": 1405 + len(preds)
                    })
    return {"risk_zones": results}

@router.get("/news")
async def get_news(limit: int = Query(30)):
    """دریافت اخبار مهاجرت"""
    scraper = get_scraper()
    news = scraper.get_all_news()
    return {"news": news[:limit], "count": len(news)}

@router.get("/news/source/{source}")
async def get_news_by_source(source: str, limit: int = Query(30), force_fresh: bool = Query(False)):
    """دریافت اخبار از یک منبع خاص"""
    scraper = get_scraper()
    news = scraper.scrape_source(source, force_fresh)
    return {"news": news[:limit], "count": len(news)}

@router.get("/news/search")
async def search_news(q: str, limit: int = Query(20)):
    """جستجو در اخبار"""
    scraper = get_scraper()
    results = scraper.search_news(q)
    return {"results": results[:limit], "count": len(results)}

@router.get("/analyze")
async def analyze_text(text: str):
    """تحلیل علت مهاجرت با استفاده از classifier"""
    classifier = get_classifier()
    scores = classifier.classify(text)
    main_cause, percent = classifier.get_main_cause(text)
    confidence = classifier.get_confidence(text)
    
    return {
        "text": text,
        "scores": scores,
        "main_cause": main_cause,
        "main_cause_label": classifier.get_category_label(main_cause),
        "percentage": percent,
        "confidence": confidence
    }