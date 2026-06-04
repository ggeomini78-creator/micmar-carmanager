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

function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { vehicles: [], logs: {} }; }
  catch { return { vehicles: [], logs: {} }; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function getDB() { return loadDB(); }

function ensureLogs(db, id) {
  if (!db.logs[id]) db.logs[id] = { fuel: [], repair: [], expense: [], consumables: {} };
  if (!db.logs[id].fuel) db.logs[id].fuel = [];
  if (!db.logs[id].repair) db.logs[id].repair = [];
  if (!db.logs[id].expense) db.logs[id].expense = [];
  if (!db.logs[id].consumables) db.logs[id].consumables = {};
  return db.logs[id];
}

// 차량
function getVehicles() { return getDB().vehicles || []; }
function getVehicle(id) { return getDB().vehicles.find(v => v.id === id); }
function addVehicle(v) {
  const db = getDB();
  if (!db.vehicles) db.vehicles = [];
  const id = 'v_' + Date.now();
  const vehicle = { id, ...v, createdAt: new Date().toISOString() };
  db.vehicles.push(vehicle);
  ensureLogs(db, id);
  saveDB(db);
  return vehicle;
}
function updateVehicleMileage(db, id, mileage) {
  const v = db.vehicles.find(x => x.id === id);
  if (v && mileage > (v.mileage || 0)) v.mileage = mileage;
}

// 주유
function getFuelLogs(vid) { return ensureLogs(getDB(), vid).fuel; }
function addFuelLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const id = 'f_' + Date.now();
  logs.fuel.push({ id, ...entry });
  logs.fuel.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (entry.mileage) updateVehicleMileage(db, vid, entry.mileage);
  saveDB(db); return id;
}
function updateFuelLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const idx = logs.fuel.findIndex(x => x.id === logId);
  if (idx !== -1) logs.fuel[idx] = { ...logs.fuel[idx], ...entry };
  logs.fuel.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (entry.mileage) updateVehicleMileage(db, vid, entry.mileage);
  saveDB(db);
}
function deleteFuelLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.fuel = logs.fuel.filter(x => x.id !== logId); saveDB(db);
}

// 정비
function getRepairLogs(vid) { return ensureLogs(getDB(), vid).repair; }
function addRepairLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const id = 'r_' + Date.now();
  logs.repair.push({ id, ...entry });
  logs.repair.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (entry.mileage) updateVehicleMileage(db, vid, entry.mileage);
  saveDB(db); return id;
}
function updateRepairLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const idx = logs.repair.findIndex(x => x.id === logId);
  if (idx !== -1) logs.repair[idx] = { ...logs.repair[idx], ...entry };
  logs.repair.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveDB(db);
}
function deleteRepairLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.repair = logs.repair.filter(x => x.id !== logId); saveDB(db);
}

// 지출
function getExpenseLogs(vid) { return ensureLogs(getDB(), vid).expense; }
function addExpenseLog(vid, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const id = 'e_' + Date.now();
  logs.expense.push({ id, ...entry });
  logs.expense.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveDB(db); return id;
}
function updateExpenseLog(vid, logId, entry) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  const idx = logs.expense.findIndex(x => x.id === logId);
  if (idx !== -1) logs.expense[idx] = { ...logs.expense[idx], ...entry };
  logs.expense.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveDB(db);
}
function deleteExpenseLog(vid, logId) {
  const db = getDB(); const logs = ensureLogs(db, vid);
  logs.expense = logs.expense.filter(x => x.id !== logId); saveDB(db);
}

// 소모품
function getConsumables(vid) { return ensureLogs(getDB(), vid).consumables; }
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
      const lastDate = new Date(data.lastDate);
      const daysPassed = Math.floor((now - lastDate) / 86400000);
      const kmPassed = data.lastMileage != null ? currentMileage - data.lastMileage : null;
      const dayPct = def.dayCycle ? daysPassed / def.dayCycle : 0;
      const kmPct = (def.kmCycle && kmPassed != null) ? kmPassed / def.kmCycle : 0;
      pct = Math.min(Math.max(dayPct, kmPct) * 100, 100);
      if (pct >= 90) status = 'danger';
      else if (pct >= 70) status = 'warn';
      const parts = [];
      if (kmPassed != null) parts.push(`${kmPassed.toLocaleString()}km 경과`);
      parts.push(`${daysPassed}일 경과`);
      detail = parts.join(' · ');
    }
    return { key, name: def.name, status, pct: Math.round(pct), detail, lastDate: data?.lastDate || null };
  });
}

// 통계
function getMonthlyStats(vid, year) {
  const fuel = getFuelLogs(vid), repair = getRepairLogs(vid), expense = getExpenseLogs(vid);
  const months = Array(12).fill(0).map(() => ({ fuel: 0, repair: 0, expense: 0 }));
  fuel.forEach(l => { const d = new Date(l.date); if (d.getFullYear() === year) months[d.getMonth()].fuel += l.total || 0; });
  repair.forEach(l => { const d = new Date(l.date); if (d.getFullYear() === year) months[d.getMonth()].repair += l.cost || 0; });
  expense.forEach(l => { const d = new Date(l.date); if (d.getFullYear() === year) months[d.getMonth()].expense += l.cost || 0; });
  return months;
}
function getCategoryStats(vid, year) {
  const map = {};
  getFuelLogs(vid).filter(l => new Date(l.date).getFullYear() === year).forEach(l => { map['주유'] = (map['주유']||0) + (l.total||0); });
  getRepairLogs(vid).filter(l => new Date(l.date).getFullYear() === year).forEach(l => { map[l.category||'정비'] = (map[l.category||'정비']||0) + (l.cost||0); });
  getExpenseLogs(vid).filter(l => new Date(l.date).getFullYear() === year).forEach(l => { map[l.category||'기타'] = (map[l.category||'기타']||0) + (l.cost||0); });
  return map;
}
function getYearSummary(vid, year) {
  const fuel = getFuelLogs(vid).filter(l => new Date(l.date).getFullYear() === year);
  const repair = getRepairLogs(vid).filter(l => new Date(l.date).getFullYear() === year);
  const expense = getExpenseLogs(vid).filter(l => new Date(l.date).getFullYear() === year);
  const totalFuel = fuel.reduce((s,l) => s+(l.total||0), 0);
  const totalRepair = repair.reduce((s,l) => s+(l.cost||0), 0);
  const totalExpense = expense.reduce((s,l) => s+(l.cost||0), 0);
  const totalLiters = fuel.reduce((s,l) => s+(l.amount||0), 0);
  const effs = fuel.map(l=>l.fuelEff).filter(Boolean).map(Number);
  const avgEff = effs.length ? (effs.reduce((s,v)=>s+v,0)/effs.length).toFixed(1) : null;
  return { totalFuel, totalRepair, totalExpense, total: totalFuel+totalRepair+totalExpense, totalLiters: totalLiters.toFixed(1), avgEff, fuelCount: fuel.length, repairCount: repair.length };
}

// 내보내기/불러오기
function exportData() {
  const blob = new Blob([JSON.stringify(getDB(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `carmanager_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
function importData(json) {
  try { const d = JSON.parse(json); if (!d.vehicles) throw 0; localStorage.setItem(DB_KEY, JSON.stringify(d)); return true; }
  catch { return false; }
}
