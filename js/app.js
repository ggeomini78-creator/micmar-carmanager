// ── 카매니저 앱 메인 ──

let currentVehicleId = null;
let charts = {};

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  initVehicleSelector();
  initNav();
  initModals();
  initButtons();
  initImportExport();

  const saved = localStorage.getItem('carManager_currentVehicle');
  if (saved && getVehicles().find(v => v.id === saved)) {
    setCurrentVehicle(saved);
  } else {
    const vehicles = getVehicles();
    if (vehicles.length) setCurrentVehicle(vehicles[0].id);
  }
  renderPage('dashboard');
  setToday();
});

// ── 날짜 기본값 ──
function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  ['fDate', 'rDate', 'cDate', 'eDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

// ── 차량 셀렉터 ──
function initVehicleSelector() {
  const sel = document.getElementById('vehicleSelect');
  sel.addEventListener('change', () => {
    if (sel.value) setCurrentVehicle(sel.value);
  });
  renderVehicleSelector();
}

function renderVehicleSelector() {
  const sel = document.getElementById('vehicleSelect');
  const vehicles = getVehicles();
  sel.innerHTML = '<option value="">차량을 선택하세요</option>';
  vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.nickname} (${v.plate || '번호판 미입력'})`;
    if (v.id === currentVehicleId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function setCurrentVehicle(id) {
  currentVehicleId = id;
  localStorage.setItem('carManager_currentVehicle', id);
  renderVehicleSelector();
  const v = getVehicle(id);
  const badge = document.getElementById('currentVehicleBadge');
  badge.textContent = v ? `${v.nickname}` : '차량 미선택';
  refreshCurrentPage();
}

// ── 네비게이션 ──
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderPage(page);
      closeSidebar();
    });
  });
}

function renderPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = {
    dashboard: '대시보드',
    fuel: '주유 기록',
    repair: '정비 기록',
    consumables: '소모품 관리',
    expense: '기타 지출',
    stats: '통계',
  }[page] || page;

  if (!currentVehicleId) return;

  switch (page) {
    case 'dashboard':   renderDashboard(); break;
    case 'fuel':        renderFuelPage(); break;
    case 'repair':      renderRepairPage(); break;
    case 'consumables': renderConsumablesPage(); break;
    case 'expense':     renderExpensePage(); break;
    case 'stats':       renderStatsPage(); break;
  }
}

function refreshCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  if (active) renderPage(active.dataset.page);
}

// ── 사이드바 (모바일) ──
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});

document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('overlay').addEventListener('click', closeSidebar);

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ── 대시보드 ──
function renderDashboard() {
  const noMsg = document.getElementById('noVehicleMsg');
  const content = document.getElementById('dashboardContent');

  if (!currentVehicleId) {
    noMsg.style.display = '';
    content.style.display = 'none';
    return;
  }

  noMsg.style.display = 'none';
  content.style.display = '';

  const vehicle = getVehicle(currentVehicleId);
  const fuel = getFuelLogs(currentVehicleId);
  const repair = getRepairLogs(currentVehicleId);
  const expense = getExpenseLogs(currentVehicleId);

  // 통계
  document.getElementById('statMileage').textContent =
    vehicle?.mileage ? `${vehicle.mileage.toLocaleString()} km` : '— km';

  const effs = fuel.map(l => l.fuelEff).filter(Boolean).map(Number);
  document.getElementById('statFuelEff').textContent =
    effs.length ? `${(effs.slice(0,3).reduce((s,v)=>s+v,0)/Math.min(effs.length,3)).toFixed(1)} km/L` : '— km/L';

  const now = new Date();
  const thisMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
  const monthTotal = [...fuel, ...repair, ...expense]
    .filter(l => { const d = new Date(l.date); return d.getFullYear() * 100 + d.getMonth() + 1 === thisMonth; })
    .reduce((s, l) => s + (l.total || l.cost || 0), 0);
  document.getElementById('statMonthly').textContent = monthTotal ? `${monthTotal.toLocaleString()}원` : '—원';

  document.getElementById('statRepair').textContent = repair.length ? `${repair.length}회` : '—회';

  // 소모품 상태
  const consumableEl = document.getElementById('consumableStatus');
  const statuses = getConsumableStatus(currentVehicleId);
  consumableEl.innerHTML = '';
  const showItems = statuses.filter(s => s.lastDate || s.status !== 'ok').slice(0, 5);
  if (!showItems.length) {
    consumableEl.innerHTML = '<div style="color:var(--text3);font-size:.82rem;padding:.4rem 0">소모품 기록을 입력하면 상태가 표시됩니다.</div>';
  } else {
    showItems.forEach(s => {
      const el = document.createElement('div');
      el.className = `consumable-item ${s.status !== 'ok' ? s.status : ''}`;
      el.innerHTML = `<div class="consumable-dot"></div><span class="ci-name">${s.name}</span><span class="ci-status">${s.detail}</span>`;
      consumableEl.appendChild(el);
    });
  }

  // 최근 활동
  const actEl = document.getElementById('recentActivity');
  const allLogs = [
    ...fuel.map(l => ({ type: 'fuel', date: l.date, text: `주유 ${l.amount}L (${fmt(l.total)}원)`, icon: '⛽' })),
    ...repair.map(l => ({ type: 'repair', date: l.date, text: l.category, icon: '🔧' })),
    ...expense.map(l => ({ type: 'expense', date: l.date, text: `${l.category} ${fmt(l.cost)}원`, icon: '💳' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  actEl.innerHTML = '';
  if (!allLogs.length) {
    actEl.innerHTML = '<div style="color:var(--text3);font-size:.82rem;padding:.4rem 0">아직 기록이 없습니다.</div>';
  } else {
    allLogs.forEach(l => {
      const el = document.createElement('div');
      el.className = 'activity-item';
      el.innerHTML = `<span class="ai-icon">${l.icon}</span><span class="ai-text"><strong>${l.text}</strong></span><span class="ai-date">${l.date}</span>`;
      actEl.appendChild(el);
    });
  }
}

// ── 주유 페이지 ──
function renderFuelPage() {
  const logs = getFuelLogs(currentVehicleId);
  const tbody = document.getElementById('fuelTableBody');
  const empty = document.getElementById('fuelEmpty');
  tbody.innerHTML = '';

  if (!logs.length) {
    empty.style.display = '';
    document.getElementById('fuelTable').style.display = 'none';
    document.getElementById('avgFuelEff').textContent = '—';
    document.getElementById('totalFuelCount').textContent = '0회';
    document.getElementById('totalFuelCost').textContent = '—';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('fuelTable').style.display = '';

  const totalCost = logs.reduce((s, l) => s + (l.total || 0), 0);
  const effs = logs.map(l => l.fuelEff).filter(Boolean).map(Number);
  const avgEff = effs.length ? (effs.reduce((s,v)=>s+v,0)/effs.length).toFixed(1) : '—';

  document.getElementById('avgFuelEff').textContent = avgEff !== '—' ? `${avgEff} km/L` : '—';
  document.getElementById('totalFuelCount').textContent = `${logs.length}회`;
  document.getElementById('totalFuelCost').textContent = `${fmt(totalCost)}원`;

  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td>${l.mileage ? l.mileage.toLocaleString() + ' km' : '—'}</td>
      <td>${l.amount}L</td>
      <td>${fmt(l.price)}원</td>
      <td>${fmt(l.total)}원</td>
      <td>${l.fuelEff ? l.fuelEff + ' km/L' : '—'}</td>
      <td style="color:var(--text2);font-size:.8rem">${l.memo || ''}</td>
      <td><button class="btn-del" onclick="delFuel('${l.id}')">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function delFuel(id) {
  if (!confirm('주유 기록을 삭제할까요?')) return;
  deleteFuelLog(currentVehicleId, id);
  renderFuelPage();
  showToast('삭제되었습니다');
}

// ── 정비 페이지 ──
function renderRepairPage() {
  const logs = getRepairLogs(currentVehicleId);
  const tbody = document.getElementById('repairTableBody');
  const empty = document.getElementById('repairEmpty');
  tbody.innerHTML = '';

  if (!logs.length) {
    empty.style.display = '';
    document.getElementById('repairTable').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('repairTable').style.display = '';

  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td><span style="background:rgba(77,142,255,.12);color:var(--blue);padding:.15rem .5rem;border-radius:4px;font-size:.8rem">${l.category || '기타'}</span></td>
      <td>${l.shop || '—'}</td>
      <td>${l.mileage ? l.mileage.toLocaleString() + ' km' : '—'}</td>
      <td>${l.cost ? fmt(l.cost) + '원' : '—'}</td>
      <td style="color:var(--text2);font-size:.8rem">${l.memo || ''}</td>
      <td><button class="btn-del" onclick="delRepair('${l.id}')">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function delRepair(id) {
  if (!confirm('정비 기록을 삭제할까요?')) return;
  deleteRepairLog(currentVehicleId, id);
  renderRepairPage();
  showToast('삭제되었습니다');
}

// ── 소모품 페이지 ──
function renderConsumablesPage() {
  const grid = document.getElementById('consumableGrid');
  const statuses = getConsumableStatus(currentVehicleId);
  grid.innerHTML = '';

  statuses.forEach(s => {
    const card = document.createElement('div');
    card.className = `consumable-card ${s.status !== 'ok' ? s.status : ''}`;

    const statusText = s.status === 'danger' ? '교체 필요' : s.status === 'warn' ? '교체 권장' : '정상';

    card.innerHTML = `
      <div class="cc-header">
        <span class="cc-name">${s.name}</span>
        <span class="cc-badge">${statusText}</span>
      </div>
      <div class="cc-detail">${s.lastDate ? `최근 교체: ${s.lastDate}` : '교체 기록 없음'}</div>
      <div class="cc-detail">${s.detail}</div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${s.pct}%"></div></div>
    `;
    grid.appendChild(card);
  });
}

// ── 지출 페이지 ──
function renderExpensePage() {
  const logs = getExpenseLogs(currentVehicleId);
  const tbody = document.getElementById('expenseTableBody');
  const empty = document.getElementById('expenseEmpty');
  tbody.innerHTML = '';

  if (!logs.length) {
    empty.style.display = '';
    document.getElementById('expenseTable').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('expenseTable').style.display = '';

  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td><span style="background:rgba(240,165,0,.1);color:var(--accent);padding:.15rem .5rem;border-radius:4px;font-size:.8rem">${l.category}</span></td>
      <td>${l.name || '—'}</td>
      <td>${fmt(l.cost)}원</td>
      <td style="color:var(--text2);font-size:.8rem">${l.memo || ''}</td>
      <td><button class="btn-del" onclick="delExpense('${l.id}')">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function delExpense(id) {
  if (!confirm('지출 기록을 삭제할까요?')) return;
  deleteExpenseLog(currentVehicleId, id);
  renderExpensePage();
  showToast('삭제되었습니다');
}

// ── 통계 페이지 ──
function renderStatsPage() {
  const now = new Date();
  const yearSel = document.getElementById('statYear');
  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);

  const prevYear = yearSel.value ? parseInt(yearSel.value) : now.getFullYear();
  yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === prevYear ? 'selected' : ''}>${y}년</option>`).join('');

  const year = parseInt(yearSel.value);
  yearSel.onchange = () => renderStatsPage();

  const monthly = getMonthlyStats(currentVehicleId, year);
  const labels = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  destroyChart('monthlyChart');
  const ctx1 = document.getElementById('monthlyChart').getContext('2d');
  charts.monthlyChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '주유', data: monthly.map(m => m.fuel), backgroundColor: 'rgba(240,165,0,.7)' },
        { label: '정비', data: monthly.map(m => m.repair), backgroundColor: 'rgba(77,142,255,.7)' },
        { label: '기타', data: monthly.map(m => m.expense), backgroundColor: 'rgba(255,107,53,.7)' },
      ]
    },
    options: chartOptions({ stacked: true })
  });

  const catStats = getCategoryStats(currentVehicleId, year);
  destroyChart('categoryChart');
  const ctx2 = document.getElementById('categoryChart').getContext('2d');
  if (Object.keys(catStats).length) {
    charts.categoryChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catStats),
        datasets: [{ data: Object.values(catStats), backgroundColor: ['rgba(240,165,0,.8)','rgba(77,142,255,.8)','rgba(255,107,53,.8)','rgba(46,204,113,.8)','rgba(155,89,182,.8)','rgba(255,159,67,.8)','rgba(72,219,251,.8)'] }]
      },
      options: { ...chartOptions(), plugins: { legend: { position: 'right', labels: { color: '#8b90a8', font: { size: 12 } } } } }
    });
  }

  const fuelLogs = getFuelLogs(currentVehicleId).filter(l => new Date(l.date).getFullYear() === year && l.fuelEff);
  destroyChart('fuelChart');
  const ctx3 = document.getElementById('fuelChart').getContext('2d');
  charts.fuelChart = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: fuelLogs.map(l => l.date).reverse(),
      datasets: [{ label: '연비 (km/L)', data: fuelLogs.map(l => parseFloat(l.fuelEff)).reverse(), borderColor: 'rgba(46,204,113,.8)', backgroundColor: 'rgba(46,204,113,.08)', tension: .3, fill: true, pointBackgroundColor: 'rgba(46,204,113,1)' }]
    },
    options: chartOptions()
  });

  const summary = getYearSummary(currentVehicleId, year);
  document.getElementById('yearSummary').innerHTML = `
    <div class="ys-item"><span class="ys-label">총 지출</span><span class="ys-val">${fmt(summary.total)}원</span></div>
    <div class="ys-item"><span class="ys-label">주유 총액</span><span class="ys-val">${fmt(summary.totalFuel)}원</span></div>
    <div class="ys-item"><span class="ys-label">정비 총액</span><span class="ys-val">${fmt(summary.totalRepair)}원</span></div>
    <div class="ys-item"><span class="ys-label">기타 지출</span><span class="ys-val">${fmt(summary.totalExpense)}원</span></div>
    <div class="ys-item"><span class="ys-label">총 주유량</span><span class="ys-val">${summary.totalLiters}L</span></div>
    <div class="ys-item"><span class="ys-label">평균 연비</span><span class="ys-val">${summary.avgEff ? summary.avgEff + ' km/L' : '—'}</span></div>
  `;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function chartOptions(opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: opts.stacked === undefined ? {
      x: { ticks: { color: '#5a5f7a' }, grid: { color: 'rgba(46,52,85,.4)' } },
      y: { ticks: { color: '#5a5f7a' }, grid: { color: 'rgba(46,52,85,.4)' } }
    } : {
      x: { stacked: true, ticks: { color: '#5a5f7a' }, grid: { color: 'rgba(46,52,85,.4)' } },
      y: { stacked: true, ticks: { color: '#5a5f7a' }, grid: { color: 'rgba(46,52,85,.4)' } }
    },
    plugins: {
      legend: { labels: { color: '#8b90a8', font: { size: 12 } } },
      tooltip: { backgroundColor: '#22263a', borderColor: '#2e3455', borderWidth: 1 }
    }
  };
}

// ── 모달 초기화 ──
function initModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('open');
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── 버튼들 ──
function initButtons() {
  // 차량 추가
  document.getElementById('btnAddVehicle').onclick = () => openModal('modalVehicle');
  document.getElementById('btnAddVehicleMain').onclick = () => openModal('modalVehicle');
  document.getElementById('btnSaveVehicle').onclick = saveVehicle;

  // 주유
  document.getElementById('btnAddFuel').onclick = () => {
    if (!checkVehicle()) return;
    setToday();
    openModal('modalFuel');
  };
  document.getElementById('btnSaveFuel').onclick = saveFuel;

  // 주유 자동 계산
  ['fAmount', 'fPrice'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const amt = parseFloat(document.getElementById('fAmount').value) || 0;
      const price = parseFloat(document.getElementById('fPrice').value) || 0;
      document.getElementById('fTotal').value = amt && price ? Math.round(amt * price) : '';
    });
  });

  // 주유 연비 자동 계산
  document.getElementById('fMileage').addEventListener('input', () => {
    const currentKm = parseFloat(document.getElementById('fMileage').value);
    const amount = parseFloat(document.getElementById('fAmount').value);
    if (!currentVehicleId || !currentKm) return;
    const logs = getFuelLogs(currentVehicleId);
    const lastLog = logs.find(l => l.mileage);
    if (lastLog && amount && currentKm > lastLog.mileage) {
      const eff = ((currentKm - lastLog.mileage) / amount).toFixed(1);
      document.getElementById('calcFuelEff').textContent = `${eff} km/L`;
      document.getElementById('fuelEffBox').style.display = '';
    }
  });

  // 정비
  document.getElementById('btnAddRepair').onclick = () => {
    if (!checkVehicle()) return;
    setToday();
    openModal('modalRepair');
  };
  document.getElementById('btnSaveRepair').onclick = saveRepair;

  // 소모품
  document.getElementById('btnUpdateConsumable').onclick = () => {
    if (!checkVehicle()) return;
    setToday();
    openModal('modalConsumable');
  };
  document.getElementById('btnSaveConsumable').onclick = saveConsumable;

  // 지출
  document.getElementById('btnAddExpense').onclick = () => {
    if (!checkVehicle()) return;
    setToday();
    openModal('modalExpense');
  };
  document.getElementById('btnSaveExpense').onclick = saveExpense;
}

function checkVehicle() {
  if (!currentVehicleId) {
    showToast('⚠️ 먼저 차량을 선택해주세요');
    return false;
  }
  return true;
}

// ── 저장 함수들 ──
function saveVehicle() {
  const nickname = document.getElementById('vNickname').value.trim();
  if (!nickname) { showToast('⚠️ 차량 이름을 입력해주세요'); return; }

  addVehicle({
    nickname,
    make: document.getElementById('vMake').value.trim(),
    model: document.getElementById('vModel').value.trim(),
    year: parseInt(document.getElementById('vYear').value) || null,
    plate: document.getElementById('vPlate').value.trim(),
    mileage: parseInt(document.getElementById('vMileage').value) || 0,
  });

  closeModal('modalVehicle');
  clearForm(['vNickname','vMake','vModel','vYear','vPlate','vMileage']);
  renderVehicleSelector();
  const vehicles = getVehicles();
  setCurrentVehicle(vehicles[vehicles.length - 1].id);
  showToast('✅ 차량이 추가되었습니다');
}

function saveFuel() {
  const date = document.getElementById('fDate').value;
  const mileage = parseInt(document.getElementById('fMileage').value);
  const amount = parseFloat(document.getElementById('fAmount').value);
  const price = parseInt(document.getElementById('fPrice').value);

  if (!date || !amount || !price) { showToast('⚠️ 필수 항목을 입력해주세요'); return; }

  const logs = getFuelLogs(currentVehicleId);
  const lastLog = logs.find(l => l.mileage);
  let fuelEff = null;
  if (lastLog && mileage && amount && mileage > lastLog.mileage) {
    fuelEff = ((mileage - lastLog.mileage) / amount).toFixed(1);
  }

  addFuelLog(currentVehicleId, {
    date, mileage: mileage || null, amount, price,
    total: Math.round(amount * price),
    memo: document.getElementById('fMemo').value.trim(),
    fuelEff,
  });

  closeModal('modalFuel');
  clearForm(['fMileage','fAmount','fPrice','fTotal','fMemo']);
  document.getElementById('fuelEffBox').style.display = 'none';
  renderFuelPage();
  showToast('✅ 주유 기록이 저장되었습니다');
}

function saveRepair() {
  const date = document.getElementById('rDate').value;
  const category = document.getElementById('rCategory').value;
  if (!date || !category) { showToast('⚠️ 날짜와 정비 항목을 선택해주세요'); return; }

  const mileage = parseInt(document.getElementById('rMileage').value);
  addRepairLog(currentVehicleId, {
    date,
    category,
    shop: document.getElementById('rShop').value.trim(),
    mileage: mileage || null,
    cost: parseInt(document.getElementById('rCost').value) || 0,
    memo: document.getElementById('rMemo').value.trim(),
  });

  closeModal('modalRepair');
  clearForm(['rMileage','rShop','rCost','rMemo']);
  document.getElementById('rCategory').value = '';
  renderRepairPage();
  showToast('✅ 정비 기록이 저장되었습니다');
}

function saveConsumable() {
  const item = document.getElementById('cItem').value;
  const date = document.getElementById('cDate').value;
  if (!item || !date) { showToast('⚠️ 항목과 날짜를 입력해주세요'); return; }

  const mileage = parseInt(document.getElementById('cMileage').value) || null;
  updateConsumable(currentVehicleId, item, date, mileage);

  closeModal('modalConsumable');
  clearForm(['cMileage']);
  renderConsumablesPage();
  showToast('✅ 소모품 기록이 업데이트되었습니다');
}

function saveExpense() {
  const date = document.getElementById('eDate').value;
  const category = document.getElementById('eCategory').value;
  const cost = parseInt(document.getElementById('eCost').value);
  if (!date || !cost) { showToast('⚠️ 날짜와 금액을 입력해주세요'); return; }

  addExpenseLog(currentVehicleId, {
    date, category,
    name: document.getElementById('eName').value.trim(),
    cost,
    memo: document.getElementById('eMemo').value.trim(),
  });

  closeModal('modalExpense');
  clearForm(['eName','eCost','eMemo']);
  renderExpensePage();
  showToast('✅ 지출이 저장되었습니다');
}

// ── 내보내기/불러오기 ──
function initImportExport() {
  document.getElementById('btnExport').onclick = () => {
    exportData();
    showToast('📤 데이터를 내보냈습니다');
  };

  document.getElementById('btnImport').onclick = () => {
    document.getElementById('importFile').click();
  };

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (importData(ev.target.result)) {
        showToast('✅ 데이터를 불러왔습니다');
        location.reload();
      } else {
        showToast('❌ 파일 형식이 올바르지 않습니다');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ── 유틸 ──
function fmt(n) {
  if (!n && n !== 0) return '—';
  return Math.round(n).toLocaleString('ko-KR');
}

function clearForm(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
