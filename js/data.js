// ── 데이터 구조 & localStorage 관리 ──

const DB_KEY = 'carManager_v1';

const CONSUMABLE_DEFAULTS = {
  engineOil:    { name: '엔진오일',       kmCycle: 10000, dayCycle: 365 },
  tire:         { name: '타이어',         kmCycle: 50000, dayCycle: 1825 },
  brakePad:     { name: '브레이크 패드',  kmCycle: 40000, dayCycle: 1460 },
  battery:      { name: '배터리',         kmCycle: 80000, dayCycle: 1095 },
  airFilter:    { name: '에어필터',       kmCycle: 20000, dayCycle: 730 },
  cabinFilter:  { name: '에어컨 필터',    kmCycle: 15000, dayCycle: 365 },
  wiper:        { name: '와이퍼',         kmCycle: 0,     dayCycle: 365 },
  coolant:      { name: '냉각수',         kmCycle: 40000, dayCycle: 730 },
};

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || { vehicles: [], logs: {} };
  } catch { return { vehicles: [], logs: {} }; }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getDB() { return loadDB(); }

// ── 차량 ──
function getVehicles() { return getDB().vehicles || []; }

function addVehicle(v) {
  const db = getDB();
  if (!db.vehicles) db.vehicles = [];
  const id = 'v_' + Date.now();
  const vehicle = { id, ...v, createdAt: new Date().toISOString() };
  db.vehicles.push(vehicle);
  if (!db.logs[id]) db.logs[id] = { fuel: [], repair: [], expense: [], consumables: {} };
  saveDB(db);
  return vehicle;
}

function deleteVehicle(id) {
  const db = getDB();
  db.vehicles = db.vehicles.filter(v => v.id !== id);
  delete db.logs[id];
  saveDB(db);
}

function updateVehicleMileage(id, mileage) {
  const db = getDB();
  const v = db.vehicles.find(x => x.id === id);
  if (v && mileage > (v.mileage || 0)) v.mileage = mileage;
  saveDB(db);
}

function getVehicle(id) {
  return getDB().vehicles.find(v => v.id === id);
}

// ── 로그 헬퍼 ──
function getLogs(vehicleId) {
  const db = getDB();
  if (!db.logs[vehicleId]) db.logs[vehicleId] = { fuel: [], repair: [], expense: [], consumables: {} };
  return db.logs[vehicleId];
}

// ── 주유 ──
function getFuelLogs(vehicleId) {
  return getLogs(vehicleId).fuel || [];
}

function addFuelLog(vehicleId, entry) {
  const db = getDB();
  if (!db.logs[vehicleId]) db.logs[vehicleId] = { fuel: [], repair: [], expense: [], consumables: {} };
  if (!db.logs[vehicleId].fuel) db.logs[vehicleId].fuel = [];
  const id = 'f_' + Date.now();
  const log = { id, ...entry };
  db.logs[vehicleId].fuel.push(log);
  db.logs[vehicleId].fuel.sort((a, b) => new Date(b.date) - new Date(a.date));
  // 차량 주행거리 업데이트
  const v = db.vehicles.find(x => x.id === vehicleId);
  if (v && entry.mileage > (v.mileage || 0)) v.mileage = entry.mileage;
  saveDB(db);
  return log;
}

function deleteFuelLog(vehicleId, logId) {
  const db = getDB();
  db.logs[vehicleId].fuel = db.logs[vehicleId].fuel.filter(x => x.id !== logId);
  saveDB(db);
}

function calcFuelEff(logs, currentMileage, previousMileage) {
  if (!previousMileage || !currentMileage) return null;
  const diff = currentMileage - previousMileage;
  if (diff <= 0 || !logs.amount) return null;
  return (diff / logs.amount).toFixed(1);
}

// ── 정비 ──
function getRepairLogs(vehicleId) {
  return getLogs(vehicleId).repair || [];
}

function addRepairLog(vehicleId, entry) {
  const db = getDB();
  if (!db.logs[vehicleId].repair) db.logs[vehicleId].repair = [];
  const id = 'r_' + Date.now();
  const log = { id, ...entry };
  db.logs[vehicleId].repair.push(log);
  db.logs[vehicleId].repair.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (entry.mileage) {
    const v = db.vehicles.find(x => x.id === vehicleId);
    if (v && entry.mileage > (v.mileage || 0)) v.mileage = entry.mileage;
  }
  saveDB(db);
  return log;
}

function deleteRepairLog(vehicleId, logId) {
  const db = getDB();
  db.logs[vehicleId].repair = db.logs[vehicleId].repair.filter(x => x.id !== logId);
  saveDB(db);
}

// ── 지출 ──
function getExpenseLogs(vehicleId) {
  return getLogs(vehicleId).expense || [];
}

function addExpenseLog(vehicleId, entry) {
  const db = getDB();
  if (!db.logs[vehicleId].expense) db.logs[vehicleId].expense = [];
  const id = 'e_' + Date.now();
  const log = { id, ...entry };
  db.logs[vehicleId].expense.push(log);
  db.logs[vehicleId].expense.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveDB(db);
  return log;
}

function deleteExpenseLog(vehicleId, logId) {
  const db = getDB();
  db.logs[vehicleId].expense = db.logs[vehicleId].expense.filter(x => x.id !== logId);
  saveDB(db);
}

// ── 소모품 ──
function getConsumables(vehicleId) {
  return getLogs(vehicleId).consumables || {};
}

function updateConsumable(vehicleId, item, date, mileage) {
  const db = getDB();
  if (!db.logs[vehicleId].consumables) db.logs[vehicleId].consumables = {};
  db.logs[vehicleId].consumables[item] = { lastDate: date, lastMileage: mileage || null };
  saveDB(db);
}

function getConsumableStatus(vehicleId) {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return [];
  const consumables = getConsumables(vehicleId);
  const currentMileage = vehicle.mileage || 0;
  const now = new Date();

  return Object.entries(CONSUMABLE_DEFAULTS).map(([key, def]) => {
    const data = consumables[key];
    let status = 'ok';
    let pct = 0;
    let detail = '기록 없음';

    if (data) {
      const lastDate = new Date(data.lastDate);
      const daysPassed = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      const kmPassed = data.lastMileage ? currentMileage - data.lastMileage : null;

      let dayPct = def.dayCycle ? daysPassed / def.dayCycle : 0;
      let kmPct = (def.kmCycle && kmPassed !== null) ? kmPassed / def.kmCycle : 0;
      pct = Math.min(Math.max(dayPct, kmPct) * 100, 100);

      if (pct >= 90) status = 'danger';
      else if (pct >= 70) status = 'warn';

      const parts = [];
      if (kmPassed !== null) parts.push(`${kmPassed.toLocaleString()}km 경과`);
      parts.push(`${daysPassed}일 경과`);
      detail = parts.join(' · ');
    }

    return { key, name: def.name, status, pct: Math.round(pct), detail, lastDate: data?.lastDate || null };
  });
}

// ── 통계 ──
function getMonthlyStats(vehicleId, year) {
  const fuel = getFuelLogs(vehicleId);
  const repair = getRepairLogs(vehicleId);
  const expense = getExpenseLogs(vehicleId);
  const months = Array(12).fill(0).map(() => ({ fuel: 0, repair: 0, expense: 0 }));

  fuel.forEach(l => {
    const d = new Date(l.date);
    if (d.getFullYear() === year) months[d.getMonth()].fuel += l.total || 0;
  });
  repair.forEach(l => {
    const d = new Date(l.date);
    if (d.getFullYear() === year) months[d.getMonth()].repair += l.cost || 0;
  });
  expense.forEach(l => {
    const d = new Date(l.date);
    if (d.getFullYear() === year) months[d.getMonth()].expense += l.cost || 0;
  });
  return months;
}

function getCategoryStats(vehicleId, year) {
  const fuel = getFuelLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);
  const repair = getRepairLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);
  const expense = getExpenseLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);

  const map = {};
  fuel.forEach(l => { map['주유'] = (map['주유'] || 0) + (l.total || 0); });
  repair.forEach(l => { map[l.category || '정비'] = (map[l.category || '정비'] || 0) + (l.cost || 0); });
  expense.forEach(l => { map[l.category || '기타'] = (map[l.category || '기타'] || 0) + (l.cost || 0); });
  return map;
}

function getYearSummary(vehicleId, year) {
  const fuel = getFuelLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);
  const repair = getRepairLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);
  const expense = getExpenseLogs(vehicleId).filter(l => new Date(l.date).getFullYear() === year);

  const totalFuel = fuel.reduce((s, l) => s + (l.total || 0), 0);
  const totalRepair = repair.reduce((s, l) => s + (l.cost || 0), 0);
  const totalExpense = expense.reduce((s, l) => s + (l.cost || 0), 0);
  const totalLiters = fuel.reduce((s, l) => s + (l.amount || 0), 0);
  const effs = fuel.map(l => l.fuelEff).filter(Boolean).map(Number);
  const avgEff = effs.length ? (effs.reduce((s, v) => s + v, 0) / effs.length).toFixed(1) : null;

  return {
    totalFuel,
    totalRepair,
    totalExpense,
    total: totalFuel + totalRepair + totalExpense,
    totalLiters: totalLiters.toFixed(1),
    avgEff,
    fuelCount: fuel.length,
    repairCount: repair.length,
  };
}

// ── 데이터 내보내기/불러오기 ──
function exportData() {
  const db = getDB();
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carmanager_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(json) {
  try {
    const data = JSON.parse(json);
    if (!data.vehicles) throw new Error('잘못된 형식');
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
