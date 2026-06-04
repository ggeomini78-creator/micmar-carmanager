const DB_KEY = 'carManager_v1';

const CONSUMABLE_DEFAULTS = {
  engineOil:   { name: '엔진오일',      kmCycle: 10000, dayCycle: 365 },
  tire:        { name: '타이어',        kmCycle: 50000, dayCycle: 1825 },
  brakePad:    { name: '브레이크 패드', kmCycle: 40000, dayCycle: 1460 },
  battery:     { name: '배터리',        kmCycle: 80000, dayCycle: 1095 },
  airFilter:   { name: '에어필터',      kmCycle: 20000, dayCycle: 730 },
  cabinFilter: { name: '에어컨 필터',   kmCycle: 15000, dayCycle: 365 },
  wiper:       { name: '와이퍼',        kmCycle: 0,     dayCycle: 365 },
  coolant:     { name: '냉각수',        kmCycle: 40000, dayCycle: 730 },
};

// 정비 항목 → 소모품 키 매핑
const REPAIR_TO_CONSUMABLE = {
  '엔진오일 교환': 'engineOil',
  '타이어 교체': 'tire',
  '브레이크 패드 교체': 'brakePad',
  '배터리 교체': 'battery',
  '에어필터 교체': 'airFilter',
  '에어컨 필터 교체': 'cabinFilter',
  '와이퍼 교체': 'wiper',
  '냉각수 교체': 'coolant',
};

function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { vehicles: [], logs: {} }; }
  catch { return { vehicles: [], logs: {} }; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function getDB() { return loadDB(); }

function ensureLogs(db, id) {
  if (!db.logs) db.logs = {};
  if (!db.logs[id]) db.logs[id] = {};
  const l = db.logs[id];
  if (!l.fuel) l.fuel = [];
  if (!l.repair) l.repair = [];
  if (!l.expense) l.expense = [];
  if (!l.consumables) l.consumables = {};
  return l;
}

// ── 차량 ──
function getVehicles() { return getDB().vehicles || []; }
function getVehicle(id) { return getDB().vehicles.find(v => v.id === id); }
function addVehicle(v) {
  const db = getDB();
  if (!db.vehicles) db.vehicles = [];
  const id = 'v_' + Date.now();
  db.vehicles.push({ id, ...v, createdAt: new Date().toISOString() });
  ensureLogs(db, id);
  saveDB(db);
  return id;
}
function _updateMileage(db, id, km) {
  const v = db.vehicles.find(x => x.id === id);
  if (v && km && km > (v.mileage || 0)) v.mileage = km;
}

// ── 주유 ──
function getFuelLogs(vid) { return ensureLogs(loadDB(), vid).fuel; }
function addFuelLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.fuel.push({ id: 'f_' + Date.now(), ...entry });
  logs.fuel.sort((a,b) => new Date(b.date)-new Date(a.date));
  if (entry.mileage) _updateMileage(db, vid, entry.mileage);
  saveDB(db);
}
function updateFuelLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const i = logs.fuel.findIndex(x => x.id === logId);
  if (i !== -1) logs.fuel[i] = { ...logs.fuel[i], ...entry };
  logs.fuel.sort((a,b) => new Date(b.date)-new Date(a.date));
  if (entry.mileage) _updateMileage(db, vid, entry.mileage);
  saveDB(db);
}
function deleteFuelLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.fuel = logs.fuel.filter(x => x.id !== logId); saveDB(db);
}

// ── 정비 ──
function getRepairLogs(vid) { return ensureLogs(loadDB(), vid).repair; }
function addRepairLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.repair.push({ id: 'r_' + Date.now(), ...entry });
  logs.repair.sort((a,b) => new Date(b.date)-new Date(a.date));
  if (entry.mileage) _updateMileage(db, vid, entry.mileage);
  // 소모품 자동 연동
  const cKey = REPAIR_TO_CONSUMABLE[entry.category];
  if (cKey) logs.consumables[cKey] = { lastDate: entry.date, lastMileage: entry.mileage || null };
  saveDB(db);
}
function updateRepairLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const i = logs.repair.findIndex(x => x.id === logId);
  if (i !== -1) logs.repair[i] = { ...logs.repair[i], ...entry };
  logs.repair.sort((a,b) => new Date(b.date)-new Date(a.date));
  if (entry.mileage) _updateMileage(db, vid, entry.mileage);
  const cKey = REPAIR_TO_CONSUMABLE[entry.category];
  if (cKey) logs.consumables[cKey] = { lastDate: entry.date, lastMileage: entry.mileage || null };
  saveDB(db);
}
function deleteRepairLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.repair = logs.repair.filter(x => x.id !== logId); saveDB(db);
}

// ── 지출 ──
function getExpenseLogs(vid) { return ensureLogs(loadDB(), vid).expense; }
function addExpenseLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.expense.push({ id: 'e_' + Date.now(), ...entry });
  logs.expense.sort((a,b) => new Date(b.date)-new Date(a.date));
  saveDB(db);
}
function updateExpenseLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const i = logs.expense.findIndex(x => x.id === logId);
  if (i !== -1) logs.expense[i] = { ...logs.expense[i], ...entry };
  logs.expense.sort((a,b) => new Date(b.date)-new Date(a.date));
  saveDB(db);
}
function deleteExpenseLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.expense = logs.expense.filter(x => x.id !== logId); saveDB(db);
}

// ── 소모품 ──
function getConsumables(vid) { return ensureLogs(loadDB(), vid).consumables; }
function updateConsumable(vid, item, date, mileage) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.consumables[item] = { lastDate: date, lastMileage: mileage || null };
  saveDB(db);
}
function getConsumableStatus(vid) {
  const vehicle = getVehicle(vid); if (!vehicle) return [];
  const consumables = getConsumables(vid);
  const currentMileage = vehicle.mileage || 0;
  const now = new Date();
  return Object.entries(CONSUMABLE_DEFAULTS).map(([key, def]) => {
    const data = consumables[key];
    let status = 'ok', pct = 0, detail = '기록 없음';
    if (data) {
      const daysPassed = Math.floor((now - new Date(data.lastDate)) / 86400000);
      const kmPassed = data.lastMileage != null ? currentMileage - data.lastMileage : null;
      const dayPct = def.dayCycle ? daysPassed / def.dayCycle : 0;
      const kmPct = (def.kmCycle && kmPassed != null) ? kmPassed / def.kmCycle : 0;
      pct = Math.min(Math.max(dayPct, kmPct) * 100, 100);
      if (pct >= 90) status = 'danger';
      else if (pct >= 70) status = 'warn';
      const parts = [];
      if (kmPassed != null) parts.push(kmPassed.toLocaleString() + 'km 경과');
      parts.push(daysPassed + '일 경과');
      detail = parts.join(' · ');
    }
    return { key, name: def.name, status, pct: Math.round(pct), detail, lastDate: data?.lastDate || null };
  });
}

// ── 통계 ──
function getMonthlyStats(vid, year) {
  const months = Array(12).fill(0).map(() => ({ fuel:0, repair:0, expense:0 }));
  getFuelLogs(vid).forEach(l => { const d=new Date(l.date); if(d.getFullYear()===year) months[d.getMonth()].fuel += l.total||0; });
  getRepairLogs(vid).forEach(l => { const d=new Date(l.date); if(d.getFullYear()===year) months[d.getMonth()].repair += l.cost||0; });
  getExpenseLogs(vid).forEach(l => { const d=new Date(l.date); if(d.getFullYear()===year) months[d.getMonth()].expense += l.cost||0; });
  return months;
}
function getCategoryStats(vid, year) {
  const map = {};
  getFuelLogs(vid).filter(l=>new Date(l.date).getFullYear()===year).forEach(l=>{ map['주유']=(map['주유']||0)+(l.total||0); });
  getRepairLogs(vid).filter(l=>new Date(l.date).getFullYear()===year).forEach(l=>{ map[l.category||'정비']=(map[l.category||'정비']||0)+(l.cost||0); });
  getExpenseLogs(vid).filter(l=>new Date(l.date).getFullYear()===year).forEach(l=>{ map[l.category||'기타']=(map[l.category||'기타']||0)+(l.cost||0); });
  return map;
}
function getYearSummary(vid, year) {
  const fuel=getFuelLogs(vid).filter(l=>new Date(l.date).getFullYear()===year);
  const repair=getRepairLogs(vid).filter(l=>new Date(l.date).getFullYear()===year);
  const expense=getExpenseLogs(vid).filter(l=>new Date(l.date).getFullYear()===year);
  const totalFuel=fuel.reduce((s,l)=>s+(l.total||0),0);
  const totalRepair=repair.reduce((s,l)=>s+(l.cost||0),0);
  const totalExpense=expense.reduce((s,l)=>s+(l.cost||0),0);
  const totalLiters=fuel.reduce((s,l)=>s+(l.amount||0),0);
  const effs=fuel.map(l=>l.fuelEff).filter(Boolean).map(Number);
  const avgEff=effs.length?(effs.reduce((s,v)=>s+v,0)/effs.length).toFixed(1):null;
  return { totalFuel, totalRepair, totalExpense, total:totalFuel+totalRepair+totalExpense, totalLiters:totalLiters.toFixed(1), avgEff, fuelCount:fuel.length, repairCount:repair.length };
}

// ── 캘린더용: 날짜별 기록 맵 ──
function getLogsByDate(vid) {
  const map = {};
  const add = (date, type) => {
    if (!date) return;
    const key = date.slice(0,10);
    if (!map[key]) map[key] = { fuel:[], repair:[], expense:[] };
    map[key][type].push(true);
  };
  getFuelLogs(vid).forEach(l => add(l.date, 'fuel'));
  getRepairLogs(vid).forEach(l => add(l.date, 'repair'));
  getExpenseLogs(vid).forEach(l => add(l.date, 'expense'));
  return map;
}
function getLogsOnDate(vid, dateStr) {
  return {
    fuel: getFuelLogs(vid).filter(l => l.date === dateStr),
    repair: getRepairLogs(vid).filter(l => l.date === dateStr),
    expense: getExpenseLogs(vid).filter(l => l.date === dateStr),
  };
}

// ── 내보내기/불러오기 ──
function exportData() {
  const blob = new Blob([JSON.stringify(getDB(), null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`carmanager_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
function importData(json) {
  try { const d=JSON.parse(json); if(!d.vehicles) throw 0; localStorage.setItem(DB_KEY,JSON.stringify(d)); return true; }
  catch { return false; }
}
