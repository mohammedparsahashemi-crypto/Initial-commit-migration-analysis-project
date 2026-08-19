import json
from typing import Dict, List, Any, Optional
from pathlib import Path


class MigrationService:
    def __init__(self, data_path: Path):
        self.data_path = Path(data_path)
        self._data = None
        self._historical = None
        self.historical_path = Path(__file__).parent.parent.parent / "data" / "historical-data.json"
        
        # نقشه تبدیل نام استان‌ها (فارسی → انگلیسی)
        self.province_map = {
            'تهران': 'Tehran',
            'البرز': 'Karaj',
            'آذربایجان شرقی': 'Tabriz',
            'آذربایجان غربی': 'Urmia',
            'اردبیل': 'Ardabil',
            'اصفهان': 'Isfahan',
            'ایلام': 'Ilam',
            'بوشهر': 'Bushehr',
            'چهارمحال و بختیاری': 'Shahrekord',
            'خراسان جنوبی': 'Birjand',
            'خراسان رضوی': 'Mashhad',
            'خراسان شمالی': 'Bojnurd',
            'خوزستان': 'Ahvaz',
            'زنجان': 'Zanjan',
            'سمنان': 'Semnan',
            'سیستان و بلوچستان': 'Zahedan',
            'فارس': 'Shiraz',
            'قزوین': 'Qazvin',
            'قم': 'Qom',
            'کردستان': 'Sanandaj',
            'کرمان': 'Kerman',
            'کرمانشاه': 'Kermanshah',
            'کهگیلویه و بویراحمد': 'Yasuj',
            'گلستان': 'Gorgan',
            'گیلان': 'Rasht',
            'لرستان': 'Khorramabad',
            'مازندران': 'Sari',
            'مرکزی': 'Arak',
            'هرمزگان': 'Bandar Abbas',
            'همدان': 'Hamedan',
            'یزد': 'Yazd'
        }

    def _load_data(self) -> Dict[str, Any]:
        if self._data is None:
            try:
                with open(self.data_path, 'r', encoding='utf-8') as f:
                    self._data = json.load(f)
            except:
                self._data = {'provinces': {}, 'totalMigrants': 0, 'lastUpdate': 'N/A'}
        return self._data

    def _load_historical(self) -> Dict[str, Any]:
        if self._historical is None:
            try:
                with open(self.historical_path, 'r', encoding='utf-8') as f:
                    self._historical = json.load(f)
            except:
                self._historical = {'years': {}}
        return self._historical

    def get_data(self) -> Dict[str, Any]:
        return self._load_data()

    def get_historical_data(self, province_name: str) -> Dict:
        """دریافت داده‌های تاریخی یک استان با نام فارسی"""
        historical = self._load_historical()
        
        # تبدیل نام فارسی به انگلیسی
        province_id = self.province_map.get(province_name, province_name)
        
        years = []
        incoming = []
        outgoing = []
        net = []
        
        for year_str, year_data in sorted(historical.get('years', {}).items()):
            if int(year_str) >= 1390:
                if province_id in year_data:
                    years.append(year_str)
                    inc = year_data[province_id].get('incoming', 0)
                    out = year_data[province_id].get('outgoing', 0)
                    incoming.append(inc)
                    outgoing.append(out)
                    net.append(inc - out)
        
        return {
            'province_id': province_id,
            'years': years,
            'incoming': incoming,
            'outgoing': outgoing,
            'net': net
        }

    def get_provinces_list(self) -> Dict:
        data = self._load_data()
        provinces = []
        
        for key, value in data.get('provinces', {}).items():
            provinces.append({
                'id': key,
                'name': value.get('name', key),
                'incoming': value.get('incoming', 0),
                'outgoing': value.get('outgoing', 0),
                'net': value.get('net', 0),
                'causes': value.get('causes', {})
            })
        
        return {
            'count': len(provinces),
            'provinces': provinces
        }

    def get_province(self, name: str) -> Optional[Dict]:
        data = self._load_data()
        
        for key, value in data.get('provinces', {}).items():
            if key == name or value.get('name') == name:
                return {
                    'id': key,
                    'name': value.get('name', key),
                    'incoming': value.get('incoming', 0),
                    'outgoing': value.get('outgoing', 0),
                    'net': value.get('net', 0),
                    'causes': value.get('causes', {})
                }
        
        return None

    def get_stats(self) -> Dict:
        data = self._load_data()
        provinces = data.get('provinces', {})
        
        total_incoming = sum(p.get('incoming', 0) for p in provinces.values())
        total_outgoing = sum(p.get('outgoing', 0) for p in provinces.values())
        positive_count = sum(1 for p in provinces.values() if p.get('net', 0) > 0)
        negative_count = sum(1 for p in provinces.values() if p.get('net', 0) < 0)
        
        return {
            'total_incoming': total_incoming,
            'total_outgoing': total_outgoing,
            'net_migration': total_incoming - total_outgoing,
            'positive_count': positive_count,
            'negative_count': negative_count,
            'total_provinces': len(provinces),
            'last_update': data.get('lastUpdate', 'نامشخص')
        }

    def search_provinces(self, query: str) -> List[Dict]:
        data = self._load_data()
        results = []
        query = query.lower()
        
        for key, value in data.get('provinces', {}).items():
            name = value.get('name', key).lower()
            if query in name or query in key.lower():
                results.append({
                    'id': key,
                    'name': value.get('name', key),
                    'incoming': value.get('incoming', 0),
                    'outgoing': value.get('outgoing', 0),
                    'net': value.get('net', 0)
                })
        
        return results