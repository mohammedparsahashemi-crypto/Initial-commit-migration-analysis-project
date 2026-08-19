// ============================================
// آرانش · سامانه پایش مهاجرت
// نسخه ۲.۱ - رفع کامل باگ‌ها + افکت‌های مدرن
// ============================================

let migrationData = null;
let mapInstance = null;
let mapFullInstance = null;
let currentProvince = null;
let predictionChart = null;
let causeChart = null;
let historicalChart = null;
let allPredictionsChart = null;
let homeChart = null;
let geoJSONCache = null;

const API_URL = 'http://localhost:8000/api/v1';
const CURRENT_YEAR = 1405;

// =========================================================
// بارگذاری داده‌ها
// =========================================================

async function loadData() {
    try {
        const response = await fetch(`${API_URL}/provinces`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        migrationData = await response.json();
        console.log('✅ داده‌ها بارگذاری شدند');
        initApp();
    } catch (error) {
        console.error('❌ خطا:', error);
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--red);border-color:rgba(248,113,113,0.2);">
                <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
                <div style="font-weight:600;font-size:16px;">خطا در ارتباط با سرور</div>
                <small style="color:var(--text-muted);">مطمئن شوید بکند در حال اجراست</small>
                <br><small style="color:var(--text-muted);font-family:monospace;font-size:12px;">python main.py</small>
            </div>
        `;
    }
}

function initApp() {
    updateStats();
    populateProvinceSelect();
    populateReportTable();
    initMap();
    initMapFull();
    loadNews('all');
    setupNavigation();
    setupSearchAndSort();
    setupMobileNav();
    setupEnterKeySearch();
    renderHomeChart();
}

// =========================================================
// ناوبری
// =========================================================

function setupMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');
    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('open');
        });
    }
}

function setupNavigation() {
    const links = document.querySelectorAll('.nav-menu li a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            showPage(page);
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const menu = document.querySelector('.nav-menu');
            if (menu) menu.classList.remove('open');
        });
    });
}

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.add('active');
    
    if (pageName === 'map' && mapFullInstance) {
        setTimeout(() => mapFullInstance.invalidateSize(), 350);
    }
    if (pageName === 'home' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 350);
    }
}

// =========================================================
// آمار
// =========================================================

function updateStats() {
    if (!migrationData) return;
    
    const provinces = migrationData.provinces;
    let total = 0;
    let top = { net: -Infinity, name: '' };
    let crisis = { net: Infinity, name: '' };
    let positive = 0;

    provinces.forEach(p => {
        total += p.incoming || 0;
        if (p.net > top.net) top = p;
        if (p.net < crisis.net) crisis = p;
        if (p.net > 0) positive++;
    });

    document.getElementById('totalMigrants').textContent = total.toLocaleString('fa-IR');
    document.getElementById('topProvince').textContent = top.name || '-';
    document.getElementById('topProvinceVal').textContent = (top.net || 0).toLocaleString('fa-IR') + ' نفر';
    document.getElementById('crisisProvince').textContent = crisis.name || '-';
    document.getElementById('crisisProvinceVal').textContent = (crisis.net || 0).toLocaleString('fa-IR') + ' نفر';
    document.getElementById('positiveCount').textContent = positive;
}

// =========================================================
// نمایش اطلاعات استان از روی ردیف جدول
// =========================================================

function showProvinceInfoFromRow(row) {
    try {
        const data = JSON.parse(row.dataset.province);
        showProvinceInfo(data);
        showPage('home');
    } catch (e) {
        console.error('خطا در parse:', e);
    }
}

function showProvinceInfoFromRowByData(provinceName) {
    if (!migrationData) {
        setTimeout(() => showProvinceInfoFromRowByData(provinceName), 500);
        return;
    }
    const province = migrationData.provinces.find(p => p.name === provinceName);
    if (province) {
        showProvinceInfo(province);
        showPage('home');
    } else {
        console.warn('⚠️ استان یافت نشد:', provinceName);
    }
}

// =========================================================
// نقشه‌ها
// =========================================================

function initMap() {
    const container = document.getElementById('map');
    if (!container) return;

    mapInstance = L.map('map', {
        center: [32.5, 53.5],
        zoom: 5,
        zoomControl: false,
        minZoom: 4.5,
        maxZoom: 7,
        maxBounds: [[24, 40], [41, 68]],
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd'
    }).addTo(mapInstance);

    loadGeoJSON(mapInstance, false);
}

function initMapFull() {
    const container = document.getElementById('mapFull');
    if (!container) return;

    mapFullInstance = L.map('mapFull', {
        center: [32.5, 53.5],
        zoom: 5,
        zoomControl: true,
        minZoom: 4.5,
        maxZoom: 7,
        maxBounds: [[24, 40], [41, 68]],
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd'
    }).addTo(mapFullInstance);

    loadGeoJSON(mapFullInstance, true);
}

async function loadGeoJSON(map, isFull) {
    try {
        if (!geoJSONCache) {
            const response = await fetch('assets/map/iran-provinces.geojson');
            if (!response.ok) throw new Error('GeoJSON not found');
            geoJSONCache = await response.json();
        }
        
        const data = geoJSONCache;
        const provinces = migrationData.provinces;
        
        function getColor(net) {
            if (net > 30000) return '#4ade80';
            if (net > 10000) return '#22d3ee';
            if (net > -5000) return '#fbbf24';
            if (net > -15000) return '#fb923c';
            return '#f87171';
        }

        function findProvince(name) {
            if (!name) return null;
            let clean = name.replace(/^استان\s*/g, '').trim();
            
            // === اصلاح اسامی خاص ===
            const nameMap = {
                'کهکیلویه': 'کهگیلویه و بویراحمد',
                'کهگیلویه': 'کهگیلویه و بویراحمد',
                'بویراحمد': 'کهگیلویه و بویراحمد',
                'چهارمحال': 'چهارمحال و بختیاری',
                'سیستان': 'سیستان و بلوچستان',
                'بلوچستان': 'سیستان و بلوچستان',
                'خراسان رضوی': 'خراسان رضوی',
                'خراسان شمالی': 'خراسان شمالی',
                'خراسان جنوبی': 'خراسان جنوبی',
                'آذربایجان شرقی': 'آذربایجان شرقی',
                'آذربایجان غربی': 'آذربایجان غربی'
            };
            
            // بررسی map
            for (const [key, value] of Object.entries(nameMap)) {
                if (clean.includes(key) || key.includes(clean)) {
                    clean = value;
                    break;
                }
            }
            
            for (const p of provinces) {
                if (p.name === clean || p.id === clean) return p;
            }
            
            for (const p of provinces) {
                if (p.name.includes(clean) || clean.includes(p.name)) return p;
            }
            
            const map = {
                'tehran': 'تهران', 'karaj': 'البرز', 'tabriz': 'آذربایجان شرقی',
                'isfahan': 'اصفهان', 'mashhad': 'خراسان رضوی', 'shiraz': 'فارس',
                'ahvaz': 'خوزستان', 'kerman': 'کرمان', 'yazd': 'یزد'
            };
            
            const lower = clean.toLowerCase();
            for (const [en, fa] of Object.entries(map)) {
                if (lower.includes(en)) return provinces.find(p => p.name === fa);
            }
            
            return null;
        }

        L.geoJSON(data, {
            style: function(feature) {
                const name = feature.properties?.province_name || feature.properties?.name || '';
                const province = findProvince(name);
                
                if (province) {
                    return {
                        color: 'rgba(34,211,238,0.3)',
                        weight: 1.5,
                        opacity: 0.6,
                        fillColor: getColor(province.net),
                        fillOpacity: 0.75
                    };
                }
                return {
                    color: 'rgba(255,255,255,0.05)',
                    weight: 1,
                    opacity: 0.15,
                    fillColor: '#1a2a3a',
                    fillOpacity: 0.3
                };
            },
            onEachFeature: function(feature, layer) {
                const name = feature.properties?.province_name || feature.properties?.name || '';
                const province = findProvince(name);
                
                if (province) {
                    layer.bindPopup(`
                        <div style="font-family:sans-serif;direction:rtl;padding:4px;min-width:180px;">
                            <b style="font-size:16px;color:#22d3ee;">${province.name}</b><br>
                            <span style="color:#4ade80;">ورودی: ${province.incoming.toLocaleString('fa-IR')}</span><br>
                            <span style="color:#f87171;">خروجی: ${province.outgoing.toLocaleString('fa-IR')}</span><br>
                            <b style="font-size:14px;color:${province.net > 0 ? '#4ade80' : '#f87171'}">
                                خالص: ${province.net > 0 ? '+' : ''}${province.net.toLocaleString('fa-IR')}
                            </b>
                        </div>
                    `);
                    
                    layer.on('click', function() {
                        showProvinceInfo(province);
                        if (!isFull) {
                            document.getElementById('panelContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    });
                    
                    layer.on('mouseover', function() {
                        this.setStyle({ weight: 3, opacity: 1, fillOpacity: 0.9 });
                        this.bringToFront();
                    });
                    
                    layer.on('mouseout', function() {
                        this.setStyle({
                            weight: 1.5,
                            opacity: 0.6,
                            fillColor: getColor(province.net),
                            fillOpacity: 0.75
                        });
                    });
                }
            }
        }).addTo(map);

        map.fitBounds([[25, 44], [40, 64]]);
        map.setZoom(5);
    } catch (err) {
        console.error('❌ خطا در بارگذاری نقشه:', err);
    }
}

// =========================================================
// نمایش اطلاعات استان
// =========================================================

async function showProvinceInfo(province) {
    currentProvince = province;
    const panel = document.getElementById('panelContent');
    
    const causeNames = {
        economic: 'اقتصادی',
        education: 'آموزشی',
        climate: 'اقلیمی',
        security: 'امنیتی',
        infrastructure: 'زیرساختی',
        family: 'خانوادگی',
        health: 'سلامت'
    };
    
    let mainCause = '';
    let maxP = 0;
    if (province.causes) {
        Object.entries(province.causes).forEach(([k, v]) => {
            if (v > maxP) { maxP = v; mainCause = causeNames[k] || k; }
        });
    }
    
    const netClass = province.net > 0 ? 'positive' : (province.net < 0 ? 'negative' : 'neutral');
    const emoji = province.net > 0 ? '📈' : (province.net < 0 ? '📉' : '➖');
    
    panel.innerHTML = `
        <div class="province-info">
            <h2>${emoji} ${province.name}</h2>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0;">
                <div style="background:rgba(74,222,128,0.06);padding:10px;border-radius:10px;text-align:center;border:1px solid rgba(74,222,128,0.06);">
                    <div style="font-size:10px;color:var(--text-muted);">ورودی</div>
                    <div style="font-size:20px;font-weight:700;color:#4ade80;">${province.incoming.toLocaleString('fa-IR')}</div>
                </div>
                <div style="background:rgba(248,113,113,0.06);padding:10px;border-radius:10px;text-align:center;border:1px solid rgba(248,113,113,0.06);">
                    <div style="font-size:10px;color:var(--text-muted);">خروجی</div>
                    <div style="font-size:20px;font-weight:700;color:#f87171;">${province.outgoing.toLocaleString('fa-IR')}</div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.25);padding:14px;border-radius:10px;text-align:center;margin-bottom:10px;border:1px solid var(--accent-border);">
                <div style="font-size:10px;color:var(--text-muted);">خالص مهاجرت</div>
                <div class="net ${netClass}" style="font-size:28px;">${province.net > 0 ? '+' : ''}${province.net.toLocaleString('fa-IR')}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                    علت اصلی: <span style="color:var(--cyan);">${mainCause || 'نامشخص'}</span>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-box">
                    <h4>📈 پیش‌بینی ۵ سال آینده</h4>
                    <canvas id="predictionChart"></canvas>
                </div>
                <div class="chart-box">
                    <h4>📊 علل مهاجرت</h4>
                    <canvas id="causeChart"></canvas>
                </div>
                <div class="chart-box full-width">
                    <h4>📉 روند تاریخی</h4>
                    <canvas id="historicalChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        renderPredictionChart(province);
        renderCauseChart(province);
        renderHistoricalChart(province);
    }, 150);
}

// =========================================================
// نمودار پیش‌بینی
// =========================================================

async function renderPredictionChart(province) {
    const ctx = document.getElementById('predictionChart');
    if (!ctx) return;
    
    try {
        const response = await fetch(`${API_URL}/predict/province/${encodeURIComponent(province.name)}?years=5`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        let historicalData = { years: [], net: [], incoming: [], outgoing: [] };
        try {
            const histResponse = await fetch(`${API_URL}/historical/${encodeURIComponent(province.name)}`);
            if (histResponse.ok) {
                historicalData = await histResponse.json();
            }
        } catch (e) {
            console.warn('⚠️ داده تاریخی موجود نیست');
        }
        
        if (predictionChart) predictionChart.destroy();
        
        if (data.detail || !data.predictions || data.predictions.length === 0) {
            ctx.parentElement.innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">⚠️ ${data.detail || 'داده‌ای موجود نیست'}</div>`;
            return;
        }
        
        const histLabels = historicalData.years || [];
        const histValues = historicalData.net || [];
        const forecastLabels = data.predictions.map((p, i) => `${CURRENT_YEAR + i + 1}`);
        const forecastValues = data.predictions.map(p => p.predicted_net);
        const upperBounds = data.predictions.map(p => p.upper_bound);
        const lowerBounds = data.predictions.map(p => p.lower_bound);
        
        let allLabels = [];
        let allHistData = [];
        let allForecastData = [];
        let allUpperData = [];
        let allLowerData = [];
        
        for (let i = 0; i < histLabels.length; i++) {
            allLabels.push(histLabels[i]);
            allHistData.push(histValues[i] || 0);
            allForecastData.push(null);
            allUpperData.push(null);
            allLowerData.push(null);
        }
        
        if (histLabels.length > 0 && forecastLabels.length > 0) {
            allLabels.push('⏳');
            allHistData.push(null);
            allForecastData.push(null);
            allUpperData.push(null);
            allLowerData.push(null);
        }
        
        const startIdx = allLabels.length;
        for (let i = 0; i < forecastLabels.length; i++) {
            allLabels.push(forecastLabels[i]);
            allHistData.push(null);
            allForecastData.push(forecastValues[i] || 0);
            allUpperData.push(upperBounds[i] || 0);
            allLowerData.push(lowerBounds[i] || 0);
        }
        
        const splitIndex = histLabels.length > 0 ? histLabels.length - 1 : 0;
        
        predictionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: '📊 داده‌های تاریخی',
                        data: allHistData,
                        borderColor: 'rgba(34, 211, 238, 0.7)',
                        backgroundColor: 'rgba(34, 211, 238, 0.05)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgba(34, 211, 238, 0.6)',
                        spanGaps: false
                    },
                    {
                        label: '🔮 پیش‌بینی',
                        data: allForecastData,
                        borderColor: '#f5c542',
                        backgroundColor: 'rgba(245, 197, 66, 0.06)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        borderDash: [8, 5],
                        pointRadius: 6,
                        pointBackgroundColor: '#f5c542',
                        pointBorderColor: '#060b18',
                        pointBorderWidth: 2,
                        pointStyle: 'triangle',
                        spanGaps: false
                    },
                    {
                        label: 'محدوده اطمینان بالا',
                        data: allUpperData,
                        borderColor: 'rgba(245, 197, 66, 0.15)',
                        backgroundColor: 'rgba(245, 197, 66, 0.05)',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [3, 3],
                        borderWidth: 1,
                        spanGaps: false
                    },
                    {
                        label: 'محدوده اطمینان پایین',
                        data: allLowerData,
                        borderColor: 'rgba(245, 197, 66, 0.15)',
                        backgroundColor: 'rgba(245, 197, 66, 0.05)',
                        fill: '-1',
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [3, 3],
                        borderWidth: 1,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#bccce0',
                            font: { size: 9 },
                            boxWidth: 12,
                            padding: 8,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(6,11,24,0.95)',
                        borderColor: 'rgba(245,197,66,0.15)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                if (context.parsed.y === null || context.parsed.y === undefined) return null;
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                label += context.parsed.y.toLocaleString('fa-IR') + ' نفر';
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { 
                            color: '#bccce0', 
                            font: { size: 8 },
                            callback: function(value) {
                                return value.toLocaleString('fa-IR');
                            }
                        }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { 
                            color: '#bccce0', 
                            font: { size: 8 },
                            callback: function(value) {
                                return value === '⏳' ? '⏳' : value;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ خطا:', error);
        ctx.parentElement.innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">⚠️ خطا در دریافت داده‌ها</div>`;
    }
}

// =========================================================
// نمودار علل مهاجرت
// =========================================================

function renderCauseChart(province) {
    const ctx = document.getElementById('causeChart');
    if (!ctx) return;
    
    if (causeChart) causeChart.destroy();
    
    if (!province.causes || Object.keys(province.causes).length === 0) {
        ctx.parentElement.innerHTML = `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:30px;">هیچ داده‌ای موجود نیست</div>`;
        return;
    }
    
    const causeNames = {
        economic: 'اقتصادی', climate: 'اقلیمی', security: 'امنیتی',
        education: 'آموزشی', infrastructure: 'زیرساختی', family: 'خانوادگی', health: 'سلامت'
    };
    
    const colors = ['#4ade80', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee'];
    const labels = Object.keys(province.causes).map(k => causeNames[k] || k);
    const values = Object.values(province.causes);
    
    causeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#bccce0', font: { size: 8 }, boxWidth: 10, padding: 6, usePointStyle: true }
                }
            },
            cutout: '65%'
        }
    });
}

// =========================================================
// نمودار روند تاریخی
// =========================================================

async function renderHistoricalChart(province) {
    const ctx = document.getElementById('historicalChart');
    if (!ctx) return;
    
    try {
        const response = await fetch(`${API_URL}/historical/${encodeURIComponent(province.name)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (historicalChart) historicalChart.destroy();
        
        if (!data.years || data.years.length === 0) {
            ctx.parentElement.innerHTML = `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:30px;">داده‌های تاریخی موجود نیست</div>`;
            return;
        }
        
        historicalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.years,
                datasets: [
                    {
                        label: 'ورودی',
                        data: data.incoming || [],
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74,222,128,0.05)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#4ade80'
                    },
                    {
                        label: 'خروجی',
                        data: data.outgoing || [],
                        borderColor: '#f87171',
                        backgroundColor: 'rgba(248,113,113,0.05)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#f87171'
                    },
                    {
                        label: 'خالص',
                        data: data.net || [],
                        borderColor: '#f5c542',
                        borderWidth: 3,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#f5c542',
                        pointBorderColor: '#060b18',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#bccce0', font: { size: 9 }, boxWidth: 12, padding: 8, usePointStyle: true }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(6,11,24,0.95)',
                        borderColor: 'rgba(245,197,66,0.15)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toLocaleString('fa-IR') + ' نفر';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { 
                            color: '#bccce0', 
                            font: { size: 8 },
                            callback: function(value) {
                                return value.toLocaleString('fa-IR');
                            }
                        }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#bccce0', font: { size: 8 } }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ خطا:', error);
        ctx.parentElement.innerHTML = `<div style="color:var(--red);font-size:12px;text-align:center;padding:20px;">⚠️ خطا در دریافت داده‌ها</div>`;
    }
}

// =========================================================
// نمودار صفحه اصلی (۱۳۹۰ تا ۱۴۱۵ با گپ مشخص)
// =========================================================

async function renderHomeChart() {
    if (!migrationData) {
        setTimeout(renderHomeChart, 500);
        return;
    }

    const ctx = document.getElementById('homeChart');
    if (!ctx) return;

    try {
        let historicalYears = [];
        let historicalValues = [];
        
        try {
            const promises = migrationData.provinces.map(p => 
                fetch(`${API_URL}/historical/${encodeURIComponent(p.name)}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );
            const results = await Promise.all(promises);
            const validResults = results.filter(r => r && r.years && r.years.length > 0);
            
            if (validResults.length > 0) {
                const yearMap = {};
                validResults.forEach(r => {
                    r.years.forEach((year, i) => {
                        if (!yearMap[year]) yearMap[year] = [];
                        if (r.net && r.net[i] !== undefined && r.net[i] !== null) {
                            yearMap[year].push(r.net[i]);
                        }
                    });
                });
                
                const sortedYears = Object.keys(yearMap)
                    .filter(y => parseInt(y) >= 1390)
                    .sort((a, b) => parseInt(a) - parseInt(b));
                
                historicalYears = sortedYears;
                historicalValues = sortedYears.map(y => {
                    const vals = yearMap[y].filter(v => v !== null && v !== undefined);
                    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                });
            }
        } catch (e) {
            console.warn('⚠️ خطا در دریافت داده‌های تاریخی:', e);
        }

        let forecastYears = [];
        let forecastValues = [];
        let forecastUpper = [];
        let forecastLower = [];

        try {
            const response = await fetch(`${API_URL}/predict/all?years=10`);
            if (response.ok) {
                const data = await response.json();
                
                if (data.predictions && data.predictions.length > 0) {
                    const allValues = data.predictions.map(p => p.predictions.map(x => x.predicted_net));
                    const allUpper = data.predictions.map(p => p.predictions.map(x => x.upper_bound));
                    const allLower = data.predictions.map(p => p.predictions.map(x => x.lower_bound));
                    
                    forecastYears = data.predictions[0].predictions.map((p, i) => CURRENT_YEAR + i + 1);
                    forecastValues = forecastYears.map((_, i) => {
                        let sum = 0, count = 0;
                        allValues.forEach(arr => { 
                            if (arr[i] !== undefined && arr[i] !== null) { 
                                sum += arr[i] || 0; 
                                count++; 
                            } 
                        });
                        return count > 0 ? sum / count : 0;
                    });
                    forecastUpper = forecastYears.map((_, i) => {
                        let sum = 0, count = 0;
                        allUpper.forEach(arr => { 
                            if (arr[i] !== undefined && arr[i] !== null) { 
                                sum += arr[i] || 0; 
                                count++; 
                            } 
                        });
                        return count > 0 ? sum / count : 0;
                    });
                    forecastLower = forecastYears.map((_, i) => {
                        let sum = 0, count = 0;
                        allLower.forEach(arr => { 
                            if (arr[i] !== undefined && arr[i] !== null) { 
                                sum += arr[i] || 0; 
                                count++; 
                            } 
                        });
                        return count > 0 ? sum / count : 0;
                    });
                }
            }
        } catch (e) {
            console.warn('⚠️ خطا در دریافت پیش‌بینی:', e);
        }

        let allYears = [...historicalYears];
        let allValues = [...historicalValues];
        let allUpper = [...historicalValues];
        let allLower = [...historicalValues];
        
        forecastYears.forEach((year, i) => {
            if (year <= 1415) {
                allYears.push(year);
                allValues.push(forecastValues[i] || 0);
                allUpper.push(forecastUpper[i] || 0);
                allLower.push(forecastLower[i] || 0);
            }
        });

        const filteredIndices = allYears.map((y, i) => y <= 1415 ? i : -1).filter(i => i >= 0);
        const finalYears = filteredIndices.map(i => allYears[i]);
        const finalValues = filteredIndices.map(i => allValues[i]);
        const finalUpper = filteredIndices.map(i => allUpper[i]);
        const finalLower = filteredIndices.map(i => allLower[i]);

        const splitIndex = historicalYears.length > 0 ? historicalYears.length - 1 : 0;

        let gapLabels = [];
        let gapHistData = [];
        let gapForecastData = [];
        let gapUpperData = [];
        let gapLowerData = [];

        for (let i = 0; i <= splitIndex && i < finalYears.length; i++) {
            gapLabels.push(finalYears[i]);
            gapHistData.push(finalValues[i]);
            gapForecastData.push(null);
            gapUpperData.push(null);
            gapLowerData.push(null);
        }

        if (splitIndex < finalYears.length - 1) {
            gapLabels.push('⏳');
            gapHistData.push(null);
            gapForecastData.push(null);
            gapUpperData.push(null);
            gapLowerData.push(null);
        }

        for (let i = splitIndex + 1; i < finalYears.length; i++) {
            gapLabels.push(finalYears[i]);
            gapHistData.push(null);
            gapForecastData.push(finalValues[i]);
            gapUpperData.push(finalUpper[i]);
            gapLowerData.push(finalLower[i]);
        }

        if (homeChart) homeChart.destroy();

        homeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: gapLabels,
                datasets: [
                    {
                        label: '📊 داده‌های تاریخی',
                        data: gapHistData,
                        borderColor: 'rgba(34, 211, 238, 0.8)',
                        backgroundColor: 'rgba(34, 211, 238, 0.06)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: 'rgba(34, 211, 238, 0.6)',
                        spanGaps: false
                    },
                    {
                        label: '🔮 پیش‌بینی',
                        data: gapForecastData,
                        borderColor: '#f5c542',
                        backgroundColor: 'rgba(245, 197, 66, 0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        borderDash: [8, 5],
                        pointRadius: 6,
                        pointBackgroundColor: '#f5c542',
                        pointBorderColor: '#060b18',
                        pointBorderWidth: 2,
                        pointStyle: 'triangle',
                        spanGaps: false
                    },
                    {
                        label: 'محدوده اطمینان بالا',
                        data: gapUpperData,
                        borderColor: 'rgba(245, 197, 66, 0.15)',
                        backgroundColor: 'rgba(245, 197, 66, 0.03)',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [3, 3],
                        borderWidth: 1,
                        spanGaps: false
                    },
                    {
                        label: 'محدوده اطمینان پایین',
                        data: gapLowerData,
                        borderColor: 'rgba(245, 197, 66, 0.15)',
                        backgroundColor: 'rgba(245, 197, 66, 0.05)',
                        fill: '-1',
                        tension: 0.4,
                        pointRadius: 0,
                        borderDash: [3, 3],
                        borderWidth: 1,
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#bccce0',
                            font: { size: 11 },
                            boxWidth: 14,
                            padding: 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(6,11,24,0.95)',
                        borderColor: 'rgba(245,197,66,0.2)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                if (context.parsed.y === null || context.parsed.y === undefined) return null;
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                label += context.parsed.y.toLocaleString('fa-IR') + ' نفر';
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            color: '#bccce0',
                            font: { size: 10 },
                            callback: function(value) {
                                return value.toLocaleString('fa-IR');
                            }
                        }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            color: '#bccce0',
                            font: { size: 10 },
                            maxRotation: 45,
                            callback: function(value) {
                                return value === '⏳' ? '⏳' : value;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });

        console.log('✅ نمودار صفحه اصلی با گپ بارگذاری شد');

    } catch (error) {
        console.error('❌ خطا در رسم نمودار صفحه اصلی:', error);
        ctx.parentElement.innerHTML = `
            <div style="color:var(--red);text-align:center;padding:40px;">
                ⚠️ خطا در بارگذاری نمودار
                <br><small style="color:var(--text-muted);">${error.message}</small>
            </div>
        `;
    }
}

// =========================================================
// پیش‌بینی یک استان
// =========================================================

function populateProvinceSelect() {
    const select = document.getElementById('predictProvinceSelect');
    if (!select || !migrationData) return;
    
    select.innerHTML = '<option value="">انتخاب استان...</option>';
    migrationData.provinces.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
}

async function predictProvince() {
    const select = document.getElementById('predictProvinceSelect');
    const years = parseInt(document.getElementById('predictYears').value) || 5;
    const resultDiv = document.getElementById('predictResult');
    
    if (!select.value) {
        resultDiv.innerHTML = '<div style="color:var(--red);text-align:center;padding:12px;">⚠️ لطفاً یک استان انتخاب کنید</div>';
        return;
    }
    
    resultDiv.innerHTML = '<div class="loading">در حال پیش‌بینی</div>';
    
    try {
        const response = await fetch(`${API_URL}/predict/province/${encodeURIComponent(select.value)}?years=${years}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`خطای ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.detail) {
            resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ ${data.detail}</div>`;
            return;
        }
        
        if (!data.predictions || data.predictions.length === 0) {
            resultDiv.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:12px;">هیچ داده‌ای برای پیش‌بینی موجود نیست</div>';
            return;
        }
        
        resultDiv.innerHTML = `
            <div style="font-weight:600;font-size:15px;color:var(--cyan);margin-bottom:6px;">${data.province}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
                خالص فعلی: <span style="color:${data.current_net > 0 ? '#4ade80' : '#f87171'};font-weight:600;">${data.current_net.toLocaleString('fa-IR')}</span> نفر
            </div>
            ${data.predictions.map((p, i) => {
                const year = CURRENT_YEAR + i + 1;
                const netClass = p.predicted_net > 0 ? 'positive' : 'negative';
                return `
                    <div class="year-item">
                        <span>سال ${year}</span>
                        <span class="value ${netClass}">
                            ${p.predicted_net > 0 ? '+' : ''}${Math.round(p.predicted_net).toLocaleString('fa-IR')}
                            <span style="font-size:10px;color:var(--text-muted);">
                                (±${Math.round((p.upper_bound - p.lower_bound) / 2).toLocaleString('fa-IR')})
                            </span>
                        </span>
                    </div>
                `;
            }).join('')}
        `;
    } catch (error) {
        console.error('❌ خطا:', error);
        resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ خطا: ${error.message}</div>`;
    }
}

// =========================================================
// پیش‌بینی همه استان‌ها
// =========================================================

async function predictAll() {
    const resultDiv = document.getElementById('predictAllResult');
    const years = parseInt(document.getElementById('predictAllYears').value) || 3;
    resultDiv.innerHTML = '<div class="loading">در حال پیش‌بینی همه استان‌ها</div>';
    
    try {
        const response = await fetch(`${API_URL}/predict/all?years=${years}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.detail) {
            resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ ${data.detail}</div>`;
            return;
        }
        
        if (!data.predictions || data.predictions.length === 0) {
            resultDiv.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px;">هیچ داده‌ای موجود نیست</div>';
            return;
        }
        
        const sorted = [...data.predictions].sort((a, b) => {
            const aLast = a.predictions[a.predictions.length - 1].predicted_net;
            const bLast = b.predictions[b.predictions.length - 1].predicted_net;
            return bLast - aLast;
        });
        
        resultDiv.innerHTML = `
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
                ⏱ پیش‌بینی ${years} سال آینده
            </div>
            ${sorted.map(p => {
                const last = p.predictions[p.predictions.length - 1];
                const netClass = last.predicted_net > 0 ? 'positive' : 'negative';
                return `
                    <div class="year-item" style="cursor:pointer;" onclick="showProvinceInfoFromRowByData('${p.province}')">
                        <span>${p.province}</span>
                        <span class="value ${netClass}">
                            ${last.predicted_net > 0 ? '+' : ''}${Math.round(last.predicted_net).toLocaleString('fa-IR')}
                            <span style="font-size:10px;color:var(--text-muted);"> (سال ${CURRENT_YEAR + p.predictions.length})</span>
                        </span>
                    </div>
                `;
            }).join('')}
        `;
    } catch (error) {
        console.error('❌ خطا:', error);
        resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ خطا: ${error.message}</div>`;
    }
}

// =========================================================
// مناطق پرخطر
// =========================================================

async function getRiskZones() {
    const threshold = parseInt(document.getElementById('riskThreshold').value) || -10000;
    const resultDiv = document.getElementById('riskResult');
    resultDiv.innerHTML = '<div class="loading">در حال بررسی</div>';
    
    try {
        const response = await fetch(`${API_URL}/risk-zones?threshold=${threshold}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.detail) {
            resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ ${data.detail}</div>`;
            return;
        }
        
        if (!data.risk_zones || data.risk_zones.length === 0) {
            resultDiv.innerHTML = `
                <div style="color:var(--green);text-align:center;padding:16px;">
                    ✅ هیچ استان پرخطری با آستانه ${threshold.toLocaleString('fa-IR')} پیدا نشد
                </div>
            `;
            return;
        }
        
        resultDiv.innerHTML = `
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
                ⚠️ ${data.risk_zones.length} استان پرخطر
            </div>
            ${data.risk_zones.map(r => `
                <div class="year-item">
                    <span>🚨 ${r.province}</span>
                    <span class="value negative">
                        ${Math.round(r.predicted_net).toLocaleString('fa-IR')}
                        <span style="font-size:10px;color:var(--text-muted);"> (سال ${r.year})</span>
                    </span>
                </div>
            `).join('')}
        `;
    } catch (error) {
        console.error('❌ خطا:', error);
        resultDiv.innerHTML = `<div style="color:var(--red);text-align:center;padding:12px;">⚠️ خطا: ${error.message}</div>`;
    }
}

// =========================================================
// اخبار
// =========================================================

async function loadNews(source = 'all') {
    const container = document.getElementById('newsFullContainer');
    container.innerHTML = '<div class="loading">در حال دریافت اخبار</div>';
    
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === source);
    });
    
    try {
        let url = `${API_URL}/news?limit=30`;
        if (source !== 'all') {
            url = `${API_URL}/news/source/${source}?limit=30&force_fresh=true`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (source === 'all') {
            updateNewsWidget(data.news || []);
        }
        
        if (!data.news || data.news.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:50px;">📭 هیچ خبری یافت نشد</div>`;
            return;
        }
        
        container.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-muted);font-size:12px;">
                ${data.count || data.news.length} خبر
            </div>
            <div class="news-full-grid">
                ${data.news.map(n => `
                    <div class="news-full-card">
                        <h4>${n.title}</h4>
                        <div class="meta">
                            <span>📰 ${n.source}</span>
                            <span>📍 ${n.province || 'نامشخص'}</span>
                            ${n.date ? `<span>📅 ${n.date}</span>` : ''}
                        </div>
                        ${n.summary ? `<div class="summary">${n.summary}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('❌ خطا:', error);
        container.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">⚠️ خطا: ${error.message}</div>`;
    }
}

function updateNewsWidget(news) {
    const widget = document.getElementById('newsList');
    if (!widget) return;
    
    if (!news || news.length === 0) {
        widget.innerHTML = '<div class="news-item"><span class="news-loading">هیچ خبری موجود نیست</span></div>';
        return;
    }
    
    widget.innerHTML = news.slice(0, 5).map(n => `
        <div class="news-item">
            <span>${n.title.length > 40 ? n.title.slice(0, 40) + '...' : n.title}</span>
            <span class="province-tag">${n.province || 'نامشخص'}</span>
        </div>
    `).join('');
}

async function searchNews() {
    const query = document.getElementById('newsSearchInput').value;
    if (!query || query.length < 2) {
        alert('حداقل ۲ کاراکتر وارد کنید');
        return;
    }
    
    const container = document.getElementById('newsFullContainer');
    container.innerHTML = '<div class="loading">در حال جستجو</div>';
    
    try {
        const response = await fetch(`${API_URL}/news/search?q=${encodeURIComponent(query)}&limit=20`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:50px;">🔍 نتیجه‌ای پیدا نشد</div>`;
            return;
        }
        
        container.innerHTML = `
            <div class="news-full-grid">
                ${data.results.map(n => `
                    <div class="news-full-card">
                        <h4>${n.title}</h4>
                        <div class="meta">
                            <span>📰 ${n.source}</span>
                            <span>📍 ${n.province || 'نامشخص'}</span>
                        </div>
                        ${n.summary ? `<div class="summary">${n.summary}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('❌ خطا:', error);
        container.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px;">⚠️ خطا: ${error.message}</div>`;
    }
}

function setupEnterKeySearch() {
    const input = document.getElementById('newsSearchInput');
    if (input) {
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                searchNews();
            }
        });
    }
}

// =========================================================
// جدول گزارشات
// =========================================================

function populateReportTable(filter = '', sort = 'net') {
    const tbody = document.getElementById('reportBody');
    if (!tbody || !migrationData) return;
    
    let data = [...migrationData.provinces];
    
    if (filter) {
        data = data.filter(p => p.name.includes(filter));
    }
    
    const causeNames = {
        economic: 'اقتصادی', education: 'آموزشی', climate: 'اقلیمی',
        security: 'امنیتی', infrastructure: 'زیرساختی', family: 'خانوادگی', health: 'سلامت'
    };
    
    data.sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'incoming') return b.incoming - a.incoming;
        if (sort === 'outgoing') return b.outgoing - a.outgoing;
        return b.net - a.net;
    });
    
    tbody.innerHTML = data.map((p, i) => {
        let mainCause = '';
        let maxP = 0;
        if (p.causes) {
            Object.entries(p.causes).forEach(([k, v]) => {
                if (v > maxP) { maxP = v; mainCause = causeNames[k] || k; }
            });
        }
        
        const statusClass = p.net > 0 ? 'positive' : (p.net < 0 ? 'negative' : 'neutral');
        const statusText = p.net > 0 ? 'ورودی' : (p.net < 0 ? 'خروجی' : 'متوازن');
        const netClass = p.net > 0 ? 'positive' : (p.net < 0 ? 'negative' : 'neutral');
        
        return `
            <tr data-province='${JSON.stringify(p).replace(/'/g, "&#39;")}' onclick="showProvinceInfoFromRow(this)">
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.incoming.toLocaleString('fa-IR')}</td>
                <td>${p.outgoing.toLocaleString('fa-IR')}</td>
                <td class="value ${netClass}">${p.net > 0 ? '+' : ''}${p.net.toLocaleString('fa-IR')}</td>
                <td>${mainCause || 'نامشخص'}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

function setupSearchAndSort() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            populateReportTable(searchInput.value, sortSelect ? sortSelect.value : 'net');
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            populateReportTable(searchInput ? searchInput.value : '', sortSelect.value);
        });
    }
}

// =========================================================
// شروع
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✦ آرانش · سامانه پایش مهاجرت ✦');
    loadData();
});

// توابع گلوبال
window.predictProvince = predictProvince;
window.predictAll = predictAll;
window.getRiskZones = getRiskZones;
window.loadNews = loadNews;
window.searchNews = searchNews;
window.showPage = showPage;
window.showProvinceInfo = showProvinceInfo;
window.showProvinceInfoFromRow = showProvinceInfoFromRow;
window.showProvinceInfoFromRowByData = showProvinceInfoFromRowByData;