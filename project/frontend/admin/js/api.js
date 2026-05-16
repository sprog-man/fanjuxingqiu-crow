let TOKEN = '';

function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  return fetch(path, { ...opts, headers }).then(async r => {
    if (r.status === 401) {
      // Token 过期
      TOKEN = '';
      showLogin();
      throw new Error('登录已过期');
    }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '请求失败');
    return d;
  });
}

// === 登录 ===
function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';
}
function showAdmin() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';
}

function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  document.getElementById('loginError').textContent = '';
  if (!username || !password) { document.getElementById('loginError').textContent = '请输入用户名和密码'; return; }
  fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(r => r.json()).then(d => {
    if (d.error) { document.getElementById('loginError').textContent = d.error; return; }
    TOKEN = d.data.token;
    document.getElementById('adminUser').textContent = d.data.username;
    showAdmin();
    loadDashboard();
  }).catch(() => { document.getElementById('loginError').textContent = '登录失败，请检查网络'; });
}

function doLogout() { TOKEN = ''; showLogin(); }

// 默认显示登录页
showLogin();

// === 导航 ===
document.getElementById('adminLayout').addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item');
  if (!nav) return;
  e.preventDefault();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  nav.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + nav.dataset.page);
  if (page) page.classList.add('active');
  if (nav.dataset.page === 'dashboard') loadDashboard();
  if (nav.dataset.page === 'gatherings') loadGatherings();
  if (nav.dataset.page === 'users') loadUsers();
});

// === Dashboard ===
async function loadDashboard() {
  try {
    const d = await api('/api/admin/stats');
    document.getElementById('statTotal').textContent = d.total;
    document.getElementById('statCost').textContent = d.totalCost;
    document.getElementById('statAvg').textContent = d.avgCost;
    document.getElementById('recentBody').innerHTML = (d.recent || []).map(g => `<tr>
      <td>${g.title}</td><td>${fmtDate(g.dateTime)}</td><td>${g.location?.name || '-'}</td>
      <td>${g.totalCost}元</td><td>${(g.participants || []).join(', ')}</td>
    </tr>`).join('');
  } catch (e) {
    document.getElementById('recentBody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#e55;padding:24px">加载失败</td></tr>';
  }
}

// === Gatherings ===
async function loadGatherings() {
  try {
    const d = await api('/api/admin/gatherings');
    const items = d.items || [];
    if (items.length === 0) {
      document.getElementById('gatheringsBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ccc;padding:24px">暂无聚餐记录</td></tr>';
      return;
    }
    document.getElementById('gatheringsBody').innerHTML = items.map(g => `<tr>
      <td>${g.title}</td><td>${fmtDate(g.dateTime)}</td><td>${g.location?.name || '-'}</td>
      <td>${g.totalCost}元</td><td>${(g.participants || []).join(', ')}</td>
      <td>${(g.moodTags || []).map(t => `<span class="badge">${t}</span>`).join('')}</td>
    </tr>`).join('');
  } catch (e) {
    document.getElementById('gatheringsBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e55;padding:24px">加载失败，请确认后端已启动</td></tr>';
  }
}

// === Users ===
let userChartDays = 30;

async function loadUsers() {
  await Promise.all([loadUserStats(), loadUserGrowth(), loadUserTable()]);
}

async function loadUserStats() {
  try {
    const d = await api('/api/admin/stats');
    document.getElementById('userTotal').textContent = d.totalUsers || 0;
    document.getElementById('userToday').textContent = d.todayUsers || 0;
  } catch (e) { /* ignore */ }
}

async function loadUserGrowth() {
  try {
    const d = await api('/api/admin/users/growth?days=' + userChartDays);
    renderChart(d.data || []);
  } catch (e) {
    document.getElementById('chartError').style.display = 'block';
  }
}

function renderChart(points) {
  const wrap = document.getElementById('userChartWrap');
  document.getElementById('chartError').style.display = 'none';
  if (!points || points.length === 0) { wrap.innerHTML = '<div style="text-align:center;color:#ccc;padding:50px 0">暂无数据</div>'; return; }

  // 更新 tab active 状态
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.chart-tab[data-days="' + userChartDays + '"]')?.classList.add('active');

  const w = points.length * 40 + 40, h = 160;
  const maxNew = Math.max(...points.map(p => p.newUsers), 1);
  const maxTotal = Math.max(...points.map(p => p.totalUsers), 1);
  const padL = 0, padR = 10, padT = 10, padB = 20;
  const cw = w, ch = h;

  let html = `<svg class="chart-svg" viewBox="0 0 ${cw} ${ch}" style="width:${Math.max(w,280)}px">`;

  // 网格线
  for (let y = 0; y < 4; y++) {
    const yy = padT + (ch - padT - padB) * y / 3;
    html += `<line x1="0" y1="${yy}" x2="${cw}" y2="${yy}" stroke="#f0f0f0" stroke-width="1"/>`;
  }

  // 折线：新增用户（橙色）
  const xStep = (cw - padL - padR) / Math.max(points.length - 1, 1);
  const newPath = points.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + (ch - padT - padB) * (1 - p.newUsers / maxNew);
    return (i === 0 ? 'M' : 'L') + x.toFixed(0) + ' ' + y.toFixed(0);
  }).join(' ');
  html += `<path d="${newPath}" stroke="#D85A30" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
  // 新增数据点
  points.forEach((p, i) => {
    const x = padL + i * xStep;
    const y = padT + (ch - padT - padB) * (1 - p.newUsers / maxNew);
    html += `<circle cx="${x}" cy="${y}" r="3" fill="#D85A30" stroke="#fff" stroke-width="1.5"/>`;
  });

  // 折线：累计用户（紫色）
  const totalPath = points.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + (ch - padT - padB) * (1 - p.totalUsers / maxTotal);
    return (i === 0 ? 'M' : 'L') + x.toFixed(0) + ' ' + y.toFixed(0);
  }).join(' ');
  html += `<path d="${totalPath}" stroke="#534AB7" stroke-width="2" fill="none" stroke-linejoin="round" stroke-dasharray="4,2"/>`;
  points.forEach((p, i) => {
    const x = padL + i * xStep;
    const y = padT + (ch - padT - padB) * (1 - p.totalUsers / maxTotal);
    html += `<circle cx="${x}" cy="${y}" r="3" fill="#534AB7" stroke="#fff" stroke-width="1.5"/>`;
  });

  // X 轴标签（每5个显示一个）
  points.forEach((p, i) => {
    if (i % 5 !== 0 && i !== points.length - 1) return;
    const x = padL + i * xStep;
    html += `<text x="${x}" y="${ch - 3}" text-anchor="middle" font-size="10" fill="#999">${p.date}</text>`;
  });

  html += '</svg>';
  wrap.innerHTML = html;
}

function switchChart(days) {
  userChartDays = days;
  loadUserGrowth();
}

async function loadUserTable() {
  try {
    const d = await api('/api/admin/users');
    const items = d.items || [];
    if (items.length === 0) {
      document.getElementById('usersBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ccc;padding:24px">暂无用户</td></tr>';
      return;
    }
    document.getElementById('usersBody').innerHTML = items.map(u => `<tr>
      <td>${u.nickname || '-'}</td>
      <td style="font-size:11px;color:#999">${u.openid || '-'}</td>
      <td>${u.avatar_url ? '<img src="'+u.avatar_url+'" style="width:28px;height:28px;border-radius:50%">' : '-'}</td>
      <td>${(u.preference_tags || []).map(t => `<span class="badge">${t}</span>`).join('') || '-'}</td>
      <td>${(u.friend_ids || []).length}</td>
      <td>${fmtDate(u.createdAt)}</td>
    </tr>`).join('');
  } catch (e) {
    document.getElementById('usersBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e55;padding:24px">加载失败</td></tr>';
  }
}

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
