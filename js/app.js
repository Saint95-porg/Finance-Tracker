// js/app.js — Phase 4
// New additions: Chart.js charts, dark mode, navigation, filtering

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { analyzeFinances } from './advisor.js';

console.log('✅ app.js loaded');

// ─── CATEGORY CONFIG ──────────────────────────────────────
const CAT = {
  Food:          { icon: '🍽', color: '#f97316' },
  Transport:     { icon: '🚗', color: '#3b82f6' },
  Rent:          { icon: '🏠', color: '#ef4444' },
  Bills:         { icon: '💡', color: '#eab308' },
  Shopping:      { icon: '🛍', color: '#a855f7' },
  Health:        { icon: '💊', color: '#10b981' },
  Entertainment: { icon: '🎬', color: '#06b6d4' },
  Other:         { icon: '📌', color: '#94a3b8' },
  Salary:        { icon: '💼', color: '#10b981' },
  Freelance:     { icon: '💻', color: '#14b8a6' },
  Gift:          { icon: '🎁', color: '#ec4899' },
  Investment:    { icon: '📈', color: '#22c55e' },
};

// ─── STATE ────────────────────────────────────────────────
let transactions = [];
let currentUser  = null;
let currentType  = 'expense';
let unsubscribe  = null;
let pieChart     = null;   // Chart.js instance
let barChart     = null;   // Chart.js instance
let isDark       = false;

// ─── DOM REFERENCES ───────────────────────────────────────
const loadingScreen  = document.getElementById('loading-screen');
const appShell       = document.getElementById('app-shell');
const greetingText   = document.getElementById('greeting-text');
const userName       = document.getElementById('user-name');
const userEmail      = document.getElementById('user-email');
const userAvatar     = document.getElementById('user-avatar');
const logoutBtn      = document.getElementById('logout-btn');
const nameInput      = document.getElementById('expense-name');
const amountInput    = document.getElementById('expense-amount');
const categorySelect = document.getElementById('expense-category');
const addBtn         = document.getElementById('add-btn');
const clearBtn       = document.getElementById('clear-btn');
const recentList     = document.getElementById('recent-list');
const expenseList    = document.getElementById('expense-list');
const breakdownEl    = document.getElementById('breakdown-list');
const filterType     = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');


// ══════════════════════════════════════════════
//  DARK MODE
// ══════════════════════════════════════════════

// Load saved preference from localStorage on startup
function initTheme() {
  isDark = localStorage.getItem('ft-dark') === 'true';
  applyTheme();
}

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  const icon = isDark ? '☀️' : '🌙';
  document.getElementById('theme-toggle').textContent        = icon;
  document.getElementById('theme-toggle-mobile').textContent = icon;

  // Update Chart.js colors to match theme
  if (pieChart || barChart) updateChartTheme();
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('ft-dark', isDark);
  applyTheme();
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-mobile').addEventListener('click', toggleTheme);


// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function navigateTo(sectionId) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target section
  document.getElementById('section-' + sectionId).classList.add('active');

  // Highlight nav item
  document.querySelector(`.nav-item[data-section="${sectionId}"]`).classList.add('active');

  // Close mobile sidebar if open
  document.querySelector('.sidebar').classList.remove('open');

  // Redraw charts when navigating to analytics
  // Chart.js needs the canvas to be visible to render correctly
  if (sectionId === 'charts') {
    setTimeout(buildCharts, 50);
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.section));
});

document.getElementById('view-all-btn').addEventListener('click', () => {
  navigateTo('transactions');
});

// Mobile menu toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});


// ══════════════════════════════════════════════
//  AUTH GATE
// ══════════════════════════════════════════════
onAuthStateChanged(auth, function(user) {
  console.log('🔥 Auth state:', user ? user.email : 'null');

  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;

  // Populate user info in sidebar
  const name = user.displayName || user.email.split('@')[0];
  userName.textContent  = name;
  userEmail.textContent = user.email;
  userAvatar.textContent = name.charAt(0).toUpperCase();

  // Set greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  greetingText.textContent = `${greeting}, ${name.split(' ')[0]} 👋`;

  // Show the app
  loadingScreen.style.display = 'none';
  appShell.style.display      = 'flex';

  // Init theme and start data listener
  initTheme();
  startListener(user.uid);
});


// ══════════════════════════════════════════════
//  FIRESTORE REAL-TIME LISTENER
// ══════════════════════════════════════════════
function startListener(userId) {
  console.log('🔥 Starting listener for:', userId);

  // No orderBy here — that requires a Firestore composite index
  // We sort manually in JavaScript instead, which needs no index
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId)
  );

  unsubscribe = onSnapshot(q,
    function(snapshot) {
      console.log('📦 Snapshot fired. Docs:', snapshot.docs.length);

      transactions = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort(function(a, b) {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA; // newest first
        });

      console.log('✅ Transactions sorted:', transactions.length);
      render();
    },
    function(error) {
      console.error('❌ Snapshot error:', error.code, error.message);
    }
  );
}


// ══════════════════════════════════════════════
//  CREATE
// ══════════════════════════════════════════════
async function addTransaction() {
  const name     = nameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categorySelect.value;

  console.log('Adding:', { name, amount, category, type: currentType });

  if (!name)                        { nameInput.classList.add('error');   return; }
  if (isNaN(amount) || amount <= 0) { amountInput.classList.add('error'); return; }

  addBtn.disabled    = true;
  addBtn.textContent = 'Saving...';

  try {
    const docRef = await addDoc(collection(db, 'transactions'), {
      userId:    currentUser.uid,
      name,
      amount,
      category,
      type:      currentType,
      createdAt: serverTimestamp()
    });

    console.log('✅ Saved to Firestore with ID:', docRef.id);

    nameInput.value   = '';
    amountInput.value = '';
    nameInput.focus();

  } catch (err) {
    console.error('❌ addDoc failed:', err.code, err.message);
    alert('Failed to save: ' + err.code + ' — ' + err.message);
  }

  addBtn.disabled    = false;
  addBtn.textContent = 'Add Transaction';
}

// ══════════════════════════════════════════════
//  DELETE
// ══════════════════════════════════════════════
async function deleteTransaction(id) {
  try {
    await deleteDoc(doc(db, 'transactions', id));
  } catch (err) {
    console.error('Delete error:', err);
  }
}

window._delete = deleteTransaction;


// ══════════════════════════════════════════════
//  RENDER — called every time onSnapshot fires
// ══════════════════════════════════════════════
function render() {
  renderStats();
  renderRecentList();
  renderFullList();
  renderBreakdown();
  buildCharts();
  renderAdvisor(); 
}


// ── Stats ──────────────────────────────────────
function renderStats() {
  const income  = sumBy(transactions.filter(t => t.type === 'income'));
  const expense = sumBy(transactions.filter(t => t.type === 'expense'));
  const balance = income - expense;

  document.getElementById('stat-balance').textContent = fmt(balance);
  document.getElementById('stat-income').textContent  = fmt(income);
  document.getElementById('stat-expense').textContent = fmt(expense);
  document.getElementById('stat-count').textContent   = transactions.length;
}


// ── Recent list (dashboard — last 5 only) ──────
function renderRecentList() {
  const recent = transactions.slice(0, 5);
  recentList.innerHTML = recent.length
    ? recent.map(t => transactionHTML(t)).join('')
    : '<li class="empty-state">No transactions yet. Add your first one above.</li>';
}


// ── Full list (transactions tab — with filters) ─
function renderFullList() {
  const type = filterType.value;
  const cat  = filterCategory.value;

  let filtered = transactions;
  if (type !== 'all') filtered = filtered.filter(t => t.type === type);
  if (cat  !== 'all') filtered = filtered.filter(t => t.category === cat);

  expenseList.innerHTML = filtered.length
    ? filtered.map(t => transactionHTML(t)).join('')
    : '<li class="empty-state">No transactions match your filters.</li>';
}


// ── Shared transaction HTML builder ────────────
function transactionHTML(t) {
  const meta = CAT[t.category] || { icon: '📌', color: '#94a3b8' };
  const sign = t.type === 'expense' ? '−' : '+';
  const date = t.createdAt?.toDate
    ? t.createdAt.toDate().toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
    : '—';

  return `
    <li>
      <div class="t-item">
        <div class="t-icon">${meta.icon}</div>
        <div class="t-info">
          <div class="t-name">${t.name}</div>
          <div class="t-meta">${t.category} · ${date}</div>
        </div>
        <div class="t-amount ${t.type}">${sign}${fmt(t.amount)}</div>
        <button class="t-delete" onclick="window._delete('${t.id}')" title="Delete">✕</button>
      </div>
    </li>`;
}


// ── Category breakdown bars ────────────────────
function renderBreakdown() {
  const grouped = groupByCategory();
  const cats    = Object.keys(grouped);

  if (cats.length === 0) {
    breakdownEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">No expense data yet.</p>';
    return;
  }

  const max = Math.max(...Object.values(grouped));

  breakdownEl.innerHTML = cats.map(cat => {
    const pct  = Math.round((grouped[cat] / max) * 100);
    const meta = CAT[cat] || { icon: '📌', color: '#94a3b8' };
    return `
      <div class="breakdown-row">
        <span class="breakdown-label">${meta.icon} ${cat}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${meta.color}"></div>
        </div>
        <span class="breakdown-amount">${fmt(grouped[cat])}</span>
      </div>`;
  }).join('');
}


// ══════════════════════════════════════════════
//  CHART.JS — build or update both charts
// ══════════════════════════════════════════════
function buildCharts() {
  buildPieChart();
  buildBarChart();
}

// ── PIE CHART — spending by category ──────────
function buildPieChart() {
  const grouped = groupByCategory();
  const labels  = Object.keys(grouped);
  const values  = Object.values(grouped);
  const colors  = labels.map(l => CAT[l]?.color || '#94a3b8');

  const textColor = isDark ? '#94a3b8' : '#64748b';

  // If chart already exists, update its data instead of rebuilding
  if (pieChart) {
    pieChart.data.labels           = labels;
    pieChart.data.datasets[0].data = values;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.update();
    renderPieLegend(labels, colors, values);
    return;
  }

  const ctx = document.getElementById('pie-chart');
  if (!ctx) return;

  if (labels.length === 0) {
    ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
    document.getElementById('pie-legend').innerHTML =
      '<p style="color:var(--text-tertiary);font-size:13px;">No expense data yet.</p>';
    return;
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderWidth:     2,
        borderColor:     isDark ? '#1e293b' : '#ffffff',
        hoverOffset:     6
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '65%',
      plugins: {
        legend: { display: false }, // we build our own legend
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = Math.round((context.raw / total) * 100);
              return ` ${fmt(context.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  renderPieLegend(labels, colors, values);
}

function renderPieLegend(labels, colors, values) {
  const legendEl = document.getElementById('pie-legend');
  legendEl.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${label}</span>
    </div>
  `).join('');
}


// ── BAR CHART — income vs expenses ────────────
function buildBarChart() {
  const income  = sumBy(transactions.filter(t => t.type === 'income'));
  const expense = sumBy(transactions.filter(t => t.type === 'expense'));
  const balance = income - expense;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  if (barChart) {
    barChart.data.datasets[0].data = [income, expense, balance];
    barChart.options.scales.x.ticks.color = textColor;
    barChart.options.scales.y.ticks.color = textColor;
    barChart.options.scales.y.grid.color  = gridColor;
    barChart.update();
    return;
  }

  const ctx = document.getElementById('bar-chart');
  if (!ctx) return;

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses', 'Balance'],
      datasets: [{
        data:            [income, expense, balance],
        backgroundColor: ['#10b981', '#ef4444', '#6366f1'],
        borderRadius:    8,
        borderSkipped:   false,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: textColor, font: { size: 12 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font:  { size: 11 },
            callback: val => '₦' + (val >= 1000 ? (val/1000).toFixed(0) + 'k' : val)
          }
        }
      }
    }
  });
}


// Update chart colors when theme toggles
function updateChartTheme() {
  const borderColor = isDark ? '#1e293b' : '#ffffff';
  const gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor   = isDark ? '#94a3b8' : '#64748b';

  if (pieChart) {
    pieChart.data.datasets[0].borderColor = borderColor;
    pieChart.update();
  }
  if (barChart) {
    barChart.options.scales.x.ticks.color = textColor;
    barChart.options.scales.y.ticks.color = textColor;
    barChart.options.scales.y.grid.color  = gridColor;
    barChart.update();
  }
}


// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function groupByCategory() {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce(function(acc, t) {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
}

function sumBy(arr) {
  return arr.reduce((sum, t) => sum + t.amount, 0);
}

function fmt(amount) {
  return '₦' + Math.abs(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ══════════════════════════════════════════════
//  FINANCIAL ADVISOR RENDER
// ══════════════════════════════════════════════
function renderAdvisor() {
  const report      = analyzeFinances(transactions);
  const insightsList = document.getElementById('insights-list');
  const scoreNumber  = document.getElementById('score-number');
  const scoreGrade   = document.getElementById('score-grade');
  const scoreMessage = document.getElementById('score-message');
  const scoreMeta    = document.getElementById('score-meta');
  const ringFill     = document.getElementById('score-ring-fill');

  if (report.empty) {
    scoreNumber.textContent  = '—';
    scoreGrade.textContent   = 'No data yet';
    scoreGrade.className     = 'score-grade';
    scoreMessage.textContent = 'Add income and expense transactions to get your financial health score.';
    scoreMeta.innerHTML      = '';
    insightsList.innerHTML   = `
      <div class="advisor-empty">
        <span class="empty-icon">🧠</span>
        <p>Your personalised insights will appear here once you have transactions this month.</p>
      </div>`;
    return;
  }

  // ── Update score ring ──
  const circumference = 314; // 2 * π * 50
  const offset        = circumference - (report.score / 100) * circumference;
  ringFill.style.strokeDashoffset = offset;
  ringFill.setAttribute('class', 'score-ring-fill ' + report.scoreGrade); // ✅ SVG needs setAttribute

  // ── Update score text ──
  scoreNumber.textContent  = report.score;
  scoreGrade.textContent   = report.scoreLabel;
  scoreGrade.className     = 'score-grade ' + report.scoreGrade;
  scoreMessage.textContent = report.scoreMessage;

  // ── Score pills showing key stats ──
  const income  = transactions
    .filter(t => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      const n = new Date();
      return t.type === 'income' && d &&
             d.getMonth() === n.getMonth() &&
             d.getFullYear() === n.getFullYear();
    })
    .reduce((s, t) => s + t.amount, 0);

  const expenses = transactions
    .filter(t => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      const n = new Date();
      return t.type === 'expense' && d &&
             d.getMonth() === n.getMonth() &&
             d.getFullYear() === n.getFullYear();
    })
    .reduce((s, t) => s + t.amount, 0);

  scoreMeta.innerHTML = `
    <span class="score-pill">📅 This month</span>
    <span class="score-pill">Income: ${fmt(income)}</span>
    <span class="score-pill">Spent: ${fmt(expenses)}</span>
  `;

  // ── Render insight cards ──
  insightsList.innerHTML = report.insights.map(insight => `
    <div class="insight-card ${insight.type}">
      <div class="insight-icon">${insight.icon}</div>
      <div class="insight-body">
        <div class="insight-title">${insight.title}</div>
        <div class="insight-message">${insight.message}</div>
      </div>
      <div class="insight-metric-wrapper">
        <span class="insight-metric">${insight.metric}</span>
        <span class="insight-metric-label">${insight.label}</span>
      </div>
    </div>
  `).join('');
}


// ══════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════
addBtn.addEventListener('click', addTransaction);
nameInput.addEventListener('keydown',   e => { if (e.key === 'Enter') addTransaction(); });
amountInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTransaction(); });
nameInput.addEventListener('input',   () => nameInput.classList.remove('error'));
amountInput.addEventListener('input', () => amountInput.classList.remove('error'));

document.getElementById('btn-expense').addEventListener('click', function() {
  currentType = 'expense';
  this.classList.add('active');
  document.getElementById('btn-income').classList.remove('active');
});

document.getElementById('btn-income').addEventListener('click', function() {
  currentType = 'income';
  this.classList.add('active');
  document.getElementById('btn-expense').classList.remove('active');
});

filterType.addEventListener('change',     renderFullList);
filterCategory.addEventListener('change', renderFullList);

clearBtn.addEventListener('click', async function() {
  if (transactions.length === 0) return;
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
  await Promise.all(transactions.map(t => deleteDoc(doc(db, 'transactions', t.id))));
});

logoutBtn.addEventListener('click', async function() {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  window.location.href = 'index.html';
});