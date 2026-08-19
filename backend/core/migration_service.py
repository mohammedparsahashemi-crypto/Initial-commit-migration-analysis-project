import json
import os
import random
from pathlib import Path

# === تغییر مهم برای Render ===
# به جای مسیر نسبی پیچیده، از Path استفاده می‌کنیم
BASE_DIR = Path(__file__).parent.parent.parent  # به ریشه پروژه می‌رود
DATA_DIR = BASE_DIR / "data"
HISTORICAL_FILE = DATA_DIR / "historical-data.json"
MIGRATION_FILE = DATA_DIR / "migration-data.json"

# اگر پوشه data وجود ندارد، بساز
DATA_DIR.mkdir(parents=True, exist_ok=True)


class MigrationService:
    def __init__(self):
        self.provinces = []
        self.provinces_dict = {}
        self.historical_data = {}
        self.total_migrants = 0
        self.last_update = ""
        self._load_data()
        self._generate_historical_if_needed()
    
    def _load_data(self):
        print(f"📂 بارگذاری از: {MIGRATION_FILE}")
        if MIGRATION_FILE.exists():
            with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                provinces_dict = data.get('provinces', {})
                
                self.provinces = []
                self.provinces_dict = {}
                for name, info in provinces_dict.items():
                    province = {
                        'id': name,
                        'name': info.get('name', name),
                        'incoming': info.get('incoming', 0),
                        'outgoing': info.get('outgoing', 0),
                        'net': info.get('net', 0),
                        'causes': info.get('causes', {})
                    }
                    self.provinces.append(province)
                    self.provinces_dict[name] = province
                
                self.total_migrants = data.get('totalMigrants', 0)
                self.last_update = data.get('lastUpdate', '')
                
                print(f"✅ {len(self.provinces)} استان بارگذاری شد")
        else:
            print(f"⚠️ فایل پیدا نشد: {MIGRATION_FILE}")
        
        if HISTORICAL_FILE.exists():
            with open(HISTORICAL_FILE, 'r', encoding='utf-8') as f:
                self.historical_data = json.load(f)
                print(f"✅ داده‌های تاریخی بارگذاری شدند")
    
    def _generate_historical_if_needed(self):
        if not self.historical_data or len(self.historical_data) == 0:
            print("📊 تولید داده‌های تاریخی...")
            self._generate_historical_data()
            self._save_historical_data()
    
    def _generate_historical_data(self):
        years = list(range(1390, 1406))
        
        for province in self.provinces:
            name = province['name']
            current_in = province.get('incoming', 50000)
            current_out = province.get('outgoing', 40000)
            
            if current_in > current_out:
                base_in = current_in * 0.7
                base_out = current_out * 0.9
                trend_in = 0.03
                trend_out = 0.01
            else:
                base_in = current_in * 0.8
                base_out = current_out * 0.7
                trend_in = 0.01
                trend_out = 0.03
            
            incoming = []
            outgoing = []
            net = []
            
            noise_in = random.uniform(0.02, 0.06)
            noise_out = random.uniform(0.02, 0.06)
            
            for i, year in enumerate(years):
                factor_in = 1 + (trend_in * (i / len(years))) + random.uniform(-noise_in, noise_in)
                factor_out = 1 + (trend_out * (i / len(years))) + random.uniform(-noise_out, noise_out)
                
                val_in = max(500, int(base_in * factor_in))
                val_out = max(500, int(base_out * factor_out))
                
                incoming.append(val_in)
                outgoing.append(val_out)
                net.append(val_in - val_out)
            
            self.historical_data[name] = {
                'years': years,
                'incoming': incoming,
                'outgoing': outgoing,
                'net': net
            }
    
    def _save_historical_data(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(HISTORICAL_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.historical_data, f, ensure_ascii=False, indent=2)
        print(f"✅ داده‌های تاریخی ذخیره شدند: {len(self.historical_data)} استان")
    
    def get_historical(self, province_name):
        if province_name in self.historical_data:
            return self.historical_data[province_name]
        return None
    
    def get_all_provinces(self):
        return self.provinces
    
    def get_province_by_name(self, name):
        return self.provinces_dict.get(name)
    
    def get_total_migrants(self):
        return self.total_migrants
    
    def get_last_update(self):
        return self.last_update