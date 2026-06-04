// ── 카매니저 앱 ──
let currentVehicleId = null;
let charts = {};
let editingId = null; // 수정 중인 로그 ID

document.addEventListener('DOMContentLoaded', () => {
  initNav(); initModals(); initButtons(); initImportExport();
  const saved = localStorage.getItem('carManager_currentVehicle');
  const vehicles = getVehicles();
  if (saved && vehicles.find(v => v.id === saved)) setCurrentVehicle(saved);
  else if (vehicles.length) setCurrentVehicle(vehicles[0].id);
  renderVehicleSelector();
  renderPage('dashboard');
  setToday();
});

// ── 오늘 날짜 세팅 ──
function setToday() {
  const today = new Date().toISOString().slice(0,10);
  ['fDate','rDate','cDate','eDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = today; });
}

// ── 차량 셀렉터 ──
function renderVehicleSelector() {
  const sel = document.getElementById('vehicleSelect');
  const vehicles = getVehicles();
  sel.innerHTML = '<option value="">차량 선택</option>';
  vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.nickname + (v.plate ? ` (${v.plate})` : '');
    if (v.id === currentVehicleId) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => { if (sel.value) setCurrentVehicle(sel.value); };
}

function setCurrentVehicle(id) {
  currentVehicleId = id;
  localStorage.setItem('carManager_currentVehicle', id);
  renderVehicleSelector();
  const v = getVehicle(id);
  document.getElementById('currentVehicleBadge').textContent = v ? v.nickname : '차량 미선택';
  refreshCurrentPage();
}

// ── 네비게이션 ──
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderPage(item.dataset.page);
      closeSidebar();
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const item = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (item) item.classList.add('active');
  renderPage(page);
}

function renderPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  const titles = { dashboard:'대시보드', fuel:'주유 기록', repair:'정비 기록', consumables:'소모품 관리', expense:'기타 지출', stats:'통계' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (!currentVehicleId) return;
  if (page === 'dashboard') renderDashboard();
  else if (page === 'fuel') renderFuelPage();
  else if (page === 'repair') renderRepairPage();
  else if (page === 'consumables') renderConsumablesPage();
  else if (page === 'expense') renderExpensePage();
  else if (page === 'stats') renderStatsPage();
}

function refreshCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  if (active) renderPage(active.dataset.page);
  else renderPage('dashboard');
}

// ── 사이드바 모바일 ──
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
if (hamburger) hamburger.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
if (overlay) overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }

// ── 대시보드 ──
function renderDashboard() {
  const noMsg = document.getElementById('noVehicleMsg');
  const content = document.getElementById('dashboardContent');
  if (!currentVehicleId) { noMsg.style.display=''; content.style.display='none'; return; }
  noMsg.style.display='none'; content.style.display='';

  const vehicle = getVehicle(currentVehicleId);
  const fuel = getFuelLogs(currentVehicleId);
  const repair = getRepairLogs(currentVehicleId);
  const expense = getExpenseLogs(currentVehicleId);

  // stat 카드
  document.getElementById('statMileage').textContent = vehicle?.mileage ? vehicle.mileage.toLocaleString() + ' km' : '— km';
  const effs = fuel.map(l=>l.fuelEff).filter(Boolean).map(Number);
  document.getElementById('statFuelEff').textContent = effs.length ? (effs.slice(0,3).reduce((s,v)=>s+v,0)/Math.min(effs.length,3)).toFixed(1)+' km/L' : '— km/L';

  const now = new Date();
  const ym = now.getFullYear()*100 + now.getMonth()+1;
  const monthTotal = [...fuel,...repair,...expense]
    .filter(l => { const d=new Date(l.date); return d.getFullYear()*100+d.getMonth()+1===ym; })
    .reduce((s,l) => s+(l.total||l.cost||0), 0);
  document.getElementById('statMonthly').textContent = monthTotal ? fmt(monthTotal)+'원' : '—원';
  document.getElementById('statRepair').textContent = repair.length ? repair.length+'회' : '—회';

  // 소모품 상태
  const consumableEl = document.getElementById('consumableStatus');
  const statuses = getConsumableStatus(currentVehicleId);
  consumableEl.innerHTML = '';
  const shown = statuses.filter(s => s.lastDate || s.status !== 'ok').slice(0,5);
  if (!shown.length) {
    consumableEl.innerHTML = '<div style="color:var(--text3);font-size:.8rem;padding:.3rem 0">소모품 기록을 입력하면 상태가 표시됩니다.</div>';
  } else {
    shown.forEach(s => {
      const el = document.createElement('div');
      el.className = `consumable-item ${s.status!=='ok'?s.status:''}`;
      el.innerHTML = `<div class="consumable-dot"></div><span class="ci-name">${s.name}</span><span class="ci-status">${s.detail}</span>`;
      consumableEl.appendChild(el);
    });
  }

  // 최근 활동
  const actEl = document.getElementById('recentActivity');
  const allLogs = [
    ...fuel.map(l=>({date:l.date, text:`주유 ${l.amount}L · ${fmt(l.total)}원`, icon:'⛽'})),
    ...repair.map(l=>({date:l.date, text:l.category, icon:'🔧'})),
    ...expense.map(l=>({date:l.date, text:`${l.category} · ${fmt(l.cost)}원`, icon:'💳'})),
  ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  actEl.innerHTML = '';
  if (!allLogs.length) {
    actEl.innerHTML='<div style="color:var(--text3);font-size:.8rem;padding:.3rem 0">아직 기록이 없습니다.</div>';
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
  const table = document.getElementById('fuelTable');
  tbody.innerHTML = '';

  const totalCost = logs.reduce((s,l)=>s+(l.total||0),0);
  const effs = logs.map(l=>l.fuelEff).filter(Boolean).map(Number);
  const avgEff = effs.length ? (effs.reduce((s,v)=>s+v,0)/effs.length).toFixed(1) : null;
  document.getElementById('avgFuelEff').textContent = avgEff ? avgEff+' km/L' : '—';
  document.getElementById('totalFuelCount').textContent = logs.length+'회';
  document.getElementById('totalFuelCost').textContent = logs.length ? fmt(totalCost)+'원' : '—';

  if (!logs.length) { empty.style.display=''; table.style.display='none'; return; }
  empty.style.display='none'; table.style.display='';

  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td>${l.mileage ? l.mileage.toLocaleString()+' km' : '—'}</td>
      <td>${l.amount ? l.amount+'L' : '—'}</td>
      <td>${l.price ? fmt(l.price)+'원' : '—'}</td>
      <td>${l.total ? fmt(l.total)+'원' : '—'}</td>
      <td>${l.fuelEff ? '<span class="tag tag-green">'+l.fuelEff+' km/L</span>' : '—'}</td>
      <td style="color:var(--text2);font-size:.78rem;max-width:120px">${l.memo||''}</td>
      <td><div class="action-btns">
        <button class="btn-edit" onclick="openEditFuel('${l.id}')" title="수정">✏️</button>
        <button class="btn-del" onclick="delFuel('${l.id}')" title="삭제">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function openEditFuel(id) {
  const logs = getFuelLogs(currentVehicleId);
  const l = logs.find(x => x.id === id);
  if (!l) return;
  editingId = id;
  document.getElementById('fDate').value = l.date;
  document.getElementById('fMileage').value = l.mileage || '';
  document.getElementById('fAmount').value = l.amount || '';
  document.getElementById('fPrice').value = l.price || '';
  document.getElementById('fTotal').value = l.total || '';
  document.getElementById('fMemo').value = l.memo || '';
  document.getElementById('modalFuelTitle').textContent = '주유 기록 수정';
  document.getElementById('btnSaveFuel').textContent = '수정 저장';
  openModal('modalFuel');
}

function delFuel(id) {
  if (!confirm('주유 기록을 삭제할까요?')) return;
  deleteFuelLog(currentVehicleId, id); renderFuelPage(); showToast('삭제되었습니다');
}

// ── 정비 페이지 ──
function renderRepairPage() {
  const logs = getRepairLogs(currentVehicleId);
  const tbody = document.getElementById('repairTableBody');
  const empty = document.getElementById('repairEmpty');
  const table = document.getElementById('repairTable');
  tbody.innerHTML = '';
  if (!logs.length) { empty.style.display=''; table.style.display='none'; return; }
  empty.style.display='none'; table.style.display='';
  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td><span class="tag tag-blue">${l.category||'기타'}</span></td>
      <td>${l.shop||'—'}</td>
      <td>${l.mileage ? l.mileage.toLocaleString()+' km' : '—'}</td>
      <td>${l.cost ? fmt(l.cost)+'원' : '—'}</td>
      <td style="color:var(--text2);font-size:.78rem;max-width:120px">${l.memo||''}</td>
      <td><div class="action-btns">
        <button class="btn-edit" onclick="openEditRepair('${l.id}')" title="수정">✏️</button>
        <button class="btn-del" onclick="delRepair('${l.id}')" title="삭제">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function openEditRepair(id) {
  const l = getRepairLogs(currentVehicleId).find(x => x.id === id);
  if (!l) return;
  editingId = id;
  document.getElementById('rDate').value = l.date;
  document.getElementById('rCategory').value = l.category || '';
  document.getElementById('rShop').value = l.shop || '';
  document.getElementById('rMileage').value = l.mileage || '';
  document.getElementById('rCost').value = l.cost || '';
  document.getElementById('rMemo').value = l.memo || '';
  document.getElementById('modalRepairTitle').textContent = '정비 기록 수정';
  document.getElementById('btnSaveRepair').textContent = '수정 저장';
  openModal('modalRepair');
}

function delRepair(id) {
  if (!confirm('정비 기록을 삭제할까요?')) return;
  deleteRepairLog(currentVehicleId, id); renderRepairPage(); showToast('삭제되었습니다');
}

// ── 소모품 페이지 ──
function renderConsumablesPage() {
  const grid = document.getElementById('consumableGrid');
  grid.innerHTML = '';
  getConsumableStatus(currentVehicleId).forEach(s => {
    const card = document.createElement('div');
    card.className = `consumable-card ${s.status!=='ok'?s.status:''}`;
    const statusText = s.status==='danger'?'교체 필요':s.status==='warn'?'교체 권장':'정상';
    card.innerHTML = `
      <div class="cc-header"><span class="cc-name">${s.name}</span><span class="cc-badge">${statusText}</span></div>
      <div class="cc-detail">${s.lastDate?'최근 교체: '+s.lastDate:'교체 기록 없음'}</div>
      <div class="cc-detail">${s.detail}</div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${s.pct}%"></div></div>`;
    grid.appendChild(card);
  });
}

// ── 지출 페이지 ──
function renderExpensePage() {
  const logs = getExpenseLogs(currentVehicleId);
  const tbody = document.getElementById('expenseTableBody');
  const empty = document.getElementById('expenseEmpty');
  const table = document.getElementById('expenseTable');
  tbody.innerHTML = '';
  if (!logs.length) { empty.style.display=''; table.style.display='none'; return; }
  empty.style.display='none'; table.style.display='';
  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.date}</td>
      <td><span class="tag tag-amber">${l.category}</span></td>
      <td>${l.name||'—'}</td>
      <td>${fmt(l.cost)}원</td>
      <td style="color:var(--text2);font-size:.78rem">${l.memo||''}</td>
      <td><div class="action-btns">
        <button class="btn-edit" onclick="openEditExpense('${l.id}')" title="수정">✏️</button>
        <button class="btn-del" onclick="delExpense('${l.id}')" title="삭제">🗑</button>
      </div></td>`;
    tbody.appendChild(tr);
  });
}

function openEditExpense(id) {
  const l = getExpenseLogs(currentVehicleId).find(x => x.id === id);
  if (!l) return;
  editingId = id;
  document.getElementById('eDate').value = l.date;
  document.getElementById('eCategory').value = l.category || '';
  document.getElementById('eName').value = l.name || '';
  document.getElementById('eCost').value = l.cost || '';
  document.getElementById('eMemo').value = l.memo || '';
  document.getElementById('modalExpenseTitle').textContent = '지출 수정';
  document.getElementById('btnSaveExpense').textContent = '수정 저장';
  openModal('modalExpense');
}

function delExpense(id) {
  if (!confirm('지출 기록을 삭제할까요?')) return;
  deleteExpenseLog(currentVehicleId, id); renderExpensePage(); showToast('삭제되었습니다');
}

// ── 통계 페이지 ──
function renderStatsPage() {
  const now = new Date();
  const yearSel = document.getElementById('statYear');
  if (!yearSel._initialized) {
    const years = [];
    for (let y = now.getFullYear(); y >= now.getFullYear()-5; y--) years.push(y);
    yearSel.innerHTML = years.map(y=>`<option value="${y}">${y}년</option>`).join('');
    yearSel._initialized = true;
    yearSel.onchange = () => drawStatsCharts(parseInt(yearSel.value));
  }
  drawStatsCharts(parseInt(yearSel.value) || now.getFullYear());
}

function drawStatsCharts(year) {
  const monthly = getMonthlyStats(currentVehicleId, year);
  const labels = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  destroyChart('monthlyChart');
  charts.monthlyChart = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: { labels, datasets: [
      { label:'주유', data: monthly.map(m=>m.fuel), backgroundColor:'rgba(240,165,0,.7)' },
      { label:'정비', data: monthly.map(m=>m.repair), backgroundColor:'rgba(77,142,255,.7)' },
      { label:'기타', data: monthly.map(m=>m.expense), backgroundColor:'rgba(255,107,53,.7)' },
    ]},
    options: chartOpts({ stacked: true })
  });

  const catStats = getCategoryStats(currentVehicleId, year);
  destroyChart('categoryChart');
  if (Object.keys(catStats).length) {
    charts.categoryChart = new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: { labels: Object.keys(catStats), datasets: [{ data: Object.values(catStats), backgroundColor: ['rgba(240,165,0,.8)','rgba(77,142,255,.8)','rgba(255,107,53,.8)','rgba(46,204,113,.8)','rgba(155,89,182,.8)','rgba(255,159,67,.8)','rgba(72,219,251,.8)'] }] },
      options: { ...chartOpts(), plugins: { legend: { position:'right', labels:{ color:'#8b90a8', font:{size:11}, boxWidth:12 } } } }
    });
  }

  const fuelLogs = getFuelLogs(currentVehicleId).filter(l => new Date(l.date).getFullYear()===year && l.fuelEff).reverse();
  destroyChart('fuelChart');
  charts.fuelChart = new Chart(document.getElementById('fuelChart'), {
    type: 'line',
    data: { labels: fuelLogs.map(l=>l.date), datasets: [{ label:'연비 (km/L)', data: fuelLogs.map(l=>parseFloat(l.fuelEff)), borderColor:'rgba(46,204,113,.8)', backgroundColor:'rgba(46,204,113,.08)', tension:.3, fill:true, pointBackgroundColor:'rgba(46,204,113,1)', pointRadius:3 }] },
    options: chartOpts()
  });

  const summary = getYearSummary(currentVehicleId, year);
  document.getElementById('yearSummary').innerHTML = `
    <div class="ys-item"><span class="ys-label">총 지출</span><span class="ys-val">${fmt(summary.total)}원</span></div>
    <div class="ys-item"><span class="ys-label">주유 총액</span><span class="ys-val">${fmt(summary.totalFuel)}원</span></div>
    <div class="ys-item"><span class="ys-label">정비 총액</span><span class="ys-val">${fmt(summary.totalRepair)}원</span></div>
    <div class="ys-item"><span class="ys-label">기타 지출</span><span class="ys-val">${fmt(summary.totalExpense)}원</span></div>
    <div class="ys-item"><span class="ys-label">총 주유량</span><span class="ys-val">${summary.totalLiters}L</span></div>
    <div class="ys-item"><span class="ys-label">평균 연비</span><span class="ys-val">${summary.avgEff ? summary.avgEff+' km/L' : '—'}</span></div>`;
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function chartOpts(opts={}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color:'#8b90a8', font:{size:11} } },
      tooltip: { backgroundColor:'#22263a', borderColor:'#2e3455', borderWidth:1 }
    }
  };
  if (opts.stacked) {
    base.scales = {
      x: { stacked:true, ticks:{color:'#5a5f7a'}, grid:{color:'rgba(46,52,85,.4)'} },
      y: { stacked:true, ticks:{color:'#5a5f7a'}, grid:{color:'rgba(46,52,85,.4)'} }
    };
  } else {
    base.scales = {
      x: { ticks:{color:'#5a5f7a'}, grid:{color:'rgba(46,52,85,.4)'} },
      y: { ticks:{color:'#5a5f7a'}, grid:{color:'rgba(46,52,85,.4)'} }
    };
  }
  return base;
}

// ── 모달 ──
function initModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('open');
      resetModalState();
    });
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target===m) { m.classList.remove('open'); resetModalState(); } });
  });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); resetModalState(); }

function resetModalState() {
  editingId = null;
  // 타이틀/버튼 텍스트 원래대로
  const map = {
    modalFuel: ['modalFuelTitle','주유 기록 추가','btnSaveFuel','저장'],
    modalRepair: ['modalRepairTitle','정비 기록 추가','btnSaveRepair','저장'],
    modalExpense: ['modalExpenseTitle','지출 추가','btnSaveExpense','저장'],
  };
  Object.values(map).forEach(([tid,ttxt,bid,btxt]) => {
    const t=document.getElementById(tid); const b=document.getElementById(bid);
    if(t) t.textContent=ttxt; if(b) b.textContent=btxt;
  });
}

// ── 버튼들 ──
function initButtons() {
  document.getElementById('btnAddVehicle').onclick = () => openModal('modalVehicle');
  document.getElementById('btnAddVehicleMain').onclick = () => openModal('modalVehicle');
  document.getElementById('btnSaveVehicle').onclick = saveVehicle;

  // 대시보드 stat 카드 클릭
  document.getElementById('cardMileage').onclick = () => navigateTo('fuel');
  document.getElementById('cardFuelEff').onclick = () => navigateTo('fuel');
  document.getElementById('cardMonthly').onclick = () => navigateTo('stats');
  document.getElementById('cardRepair').onclick = () => navigateTo('repair');

  // 주유 모달
  document.getElementById('btnAddFuel').onclick = () => { if(!checkVehicle()) return; setToday(); clearFuelForm(); openModal('modalFuel'); };
  document.getElementById('btnSaveFuel').onclick = saveFuel;

  // 주유 입력 방식 토글
  document.getElementById('toggleLiter').onclick = () => setFuelMode('liter');
  document.getElementById('toggleAmount').onclick = () => setFuelMode('amount');

  // 주유 자동계산
  ['fAmount','fPrice','fTotal2'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcFuelAuto);
  });
  document.getElementById('fMileage').addEventListener('input', calcFuelEffPreview);

  // 정비
  document.getElementById('btnAddRepair').onclick = () => { if(!checkVehicle()) return; setToday(); clearRepairForm(); openModal('modalRepair'); };
  document.getElementById('btnSaveRepair').onclick = saveRepair;

  // 소모품
  document.getElementById('btnUpdateConsumable').onclick = () => { if(!checkVehicle()) return; setToday(); openModal('modalConsumable'); };
  document.getElementById('btnSaveConsumable').onclick = saveConsumable;

  // 지출
  document.getElementById('btnAddExpense').onclick = () => { if(!checkVehicle()) return; setToday(); clearExpenseForm(); openModal('modalExpense'); };
  document.getElementById('btnSaveExpense').onclick = saveExpense;
}

// ── 주유 입력 모드 ──
let fuelMode = 'liter'; // 'liter' or 'amount'
function setFuelMode(mode) {
  fuelMode = mode;
  document.getElementById('toggleLiter').classList.toggle('active', mode==='liter');
  document.getElementById('toggleAmount').classList.toggle('active', mode==='amount');
  document.getElementById('fuelRowLiter').style.display = mode==='liter' ? '' : 'none';
  document.getElementById('fuelRowAmount').style.display = mode==='amount' ? '' : 'none';
  calcFuelAuto();
}

function calcFuelAuto() {
  if (fuelMode === 'liter') {
    const amt = parseFloat(document.getElementById('fAmount').value)||0;
    const price = parseFloat(document.getElementById('fPrice').value)||0;
    if (amt && price) document.getElementById('fTotalCalc').value = Math.round(amt*price);
    else document.getElementById('fTotalCalc').value = '';
  } else {
    const total = parseFloat(document.getElementById('fTotal2').value)||0;
    const price = parseFloat(document.getElementById('fPrice').value)||0;
    if (total && price) document.getElementById('fAmountCalc').value = (total/price).toFixed(2);
    else document.getElementById('fAmountCalc').value = '';
  }
  calcFuelEffPreview();
}

function calcFuelEffPreview() {
  if (!currentVehicleId) return;
  const km = parseFloat(document.getElementById('fMileage').value);
  const amt = fuelMode==='liter'
    ? parseFloat(document.getElementById('fAmount').value)
    : parseFloat(document.getElementById('fAmountCalc').value);
  if (!km || !amt) { document.getElementById('fuelEffBox').style.display='none'; return; }
  const logs = getFuelLogs(currentVehicleId);
  const last = logs.find(l=>l.mileage);
  if (last && km > last.mileage) {
    document.getElementById('calcFuelEff').textContent = ((km-last.mileage)/amt).toFixed(1)+' km/L';
    document.getElementById('fuelEffBox').style.display='';
  }
}

function clearFuelForm() {
  ['fMileage','fAmount','fPrice','fTotalCalc','fTotal2','fAmountCalc','fMemo'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('fuelEffBox').style.display='none';
  setFuelMode('liter');
}
function clearRepairForm() { ['rMileage','rShop','rCost','rMemo'].forEach(id => { document.getElementById(id).value=''; }); document.getElementById('rCategory').value=''; }
function clearExpenseForm() { ['eName','eCost','eMemo'].forEach(id => { document.getElementById(id).value=''; }); }

// ── 저장 함수들 ──
function saveVehicle() {
  const nickname = document.getElementById('vNickname').value.trim();
  if (!nickname) { showToast('⚠️ 차량 이름을 입력해주세요'); return; }
  addVehicle({
    nickname, make: document.getElementById('vMake').value.trim(),
    model: document.getElementById('vModel').value.trim(),
    year: parseInt(document.getElementById('vYear').value)||null,
    plate: document.getElementById('vPlate').value.trim(),
    mileage: parseInt(document.getElementById('vMileage').value)||0,
  });
  closeModal('modalVehicle');
  ['vNickname','vMake','vModel','vYear','vPlate','vMileage'].forEach(id => { document.getElementById(id).value=''; });
  renderVehicleSelector();
  const vs = getVehicles(); setCurrentVehicle(vs[vs.length-1].id);
  showToast('✅ 차량이 추가되었습니다');
}

function saveFuel() {
  const date = document.getElementById('fDate').value;
  const mileage = parseInt(document.getElementById('fMileage').value)||null;
  let amount, price, total;

  if (fuelMode === 'liter') {
    amount = parseFloat(document.getElementById('fAmount').value);
    price = parseInt(document.getElementById('fPrice').value)||null;
    total = amount && price ? Math.round(amount*price) : null;
  } else {
    total = parseInt(document.getElementById('fTotal2').value);
    price = parseInt(document.getElementById('fPrice').value)||null;
    amount = parseFloat(document.getElementById('fAmountCalc').value)||null;
  }

  if (!date || !amount) { showToast('⚠️ 날짜와 주유량을 입력해주세요'); return; }

  const logs = getFuelLogs(currentVehicleId);
  const last = logs.find(l => l.mileage && (!editingId || l.id !== editingId));
  let fuelEff = null;
  if (last && mileage && amount && mileage > last.mileage) {
    fuelEff = ((mileage - last.mileage)/amount).toFixed(1);
  }

  const entry = { date, mileage, amount, price, total, memo: document.getElementById('fMemo').value.trim(), fuelEff };

  if (editingId) {
    updateFuelLog(currentVehicleId, editingId, entry);
    showToast('✅ 수정되었습니다');
  } else {
    addFuelLog(currentVehicleId, entry);
    showToast('✅ 주유 기록이 저장되었습니다');
  }
  closeModal('modalFuel'); renderFuelPage();
}

function saveRepair() {
  const date = document.getElementById('rDate').value;
  const category = document.getElementById('rCategory').value;
  if (!date || !category) { showToast('⚠️ 날짜와 정비 항목을 선택해주세요'); return; }
  const entry = {
    date, category, shop: document.getElementById('rShop').value.trim(),
    mileage: parseInt(document.getElementById('rMileage').value)||null,
    cost: parseInt(document.getElementById('rCost').value)||0,
    memo: document.getElementById('rMemo').value.trim(),
  };
  if (editingId) { updateRepairLog(currentVehicleId, editingId, entry); showToast('✅ 수정되었습니다'); }
  else { addRepairLog(currentVehicleId, entry); showToast('✅ 정비 기록이 저장되었습니다'); }
  closeModal('modalRepair'); renderRepairPage();
}

function saveConsumable() {
  const item = document.getElementById('cItem').value;
  const date = document.getElementById('cDate').value;
  if (!item || !date) { showToast('⚠️ 항목과 날짜를 입력해주세요'); return; }
  updateConsumable(currentVehicleId, item, date, parseInt(document.getElementById('cMileage').value)||null);
  closeModal('modalConsumable');
  document.getElementById('cMileage').value='';
  renderConsumablesPage(); showToast('✅ 소모품 기록이 업데이트되었습니다');
}

function saveExpense() {
  const date = document.getElementById('eDate').value;
  const cost = parseInt(document.getElementById('eCost').value);
  if (!date || !cost) { showToast('⚠️ 날짜와 금액을 입력해주세요'); return; }
  const entry = {
    date, category: document.getElementById('eCategory').value,
    name: document.getElementById('eName').value.trim(),
    cost, memo: document.getElementById('eMemo').value.trim(),
  };
  if (editingId) { updateExpenseLog(currentVehicleId, editingId, entry); showToast('✅ 수정되었습니다'); }
  else { addExpenseLog(currentVehicleId, entry); showToast('✅ 지출이 저장되었습니다'); }
  closeModal('modalExpense'); renderExpensePage();
}

// ── 내보내기/불러오기 ──
function initImportExport() {
  document.getElementById('btnExport').onclick = () => { exportData(); showToast('📤 데이터를 내보냈습니다'); };
  document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (importData(ev.target.result)) { showToast('✅ 데이터를 불러왔습니다'); location.reload(); }
      else showToast('❌ 파일 형식이 올바르지 않습니다');
    };
    reader.readAsText(file); e.target.value='';
  });
}

// ── 유틸 ──
function fmt(n) { if (!n && n!==0) return '—'; return Math.round(n).toLocaleString('ko-KR'); }
function checkVehicle() { if (!currentVehicleId) { showToast('⚠️ 먼저 차량을 선택해주세요'); return false; } return true; }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
