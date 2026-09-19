'use strict';
// ═══════════════════════════════════════════════════════════
//  NPTEL OS MCQ Platform — app.js  (Nature Theme) v2
// ═══════════════════════════════════════════════════════════

const VIDEO_TOPICS = {
  1:'Course Overview',2:'Computer System Layers',3:'PC Hardware & Memory',
  4:'Programs to Processes',5:'CPU Resource Mgmt',6:'Memory: Partition Model',
  7:'Fragmentation & Algorithms',8:'Virtual Memory & MMU',9:'Segmentation',
  10:'xv6 Memory Code',11:'xv6 Kernel Address Space',12:'PC Booting',
  13:'Process in xv6',14:'Process Mgmt Syscalls',15:'Interrupts & PIC',
  16:'Interrupt Handling',17:'Software Interrupts',18:'CPU Context Switch',
  19:'CPU Scheduling',20:'Priority Scheduling'
};

// ─── State ─────────────────────────────────────────────────
let allQuestions = [];
let session = {
  questions: [], answers: [], current: 0,
  mode: 'practice', startTime: 0,
  timerInterval: null, timePerQ: 0, qStartTime: 0,
};

// ─── Storage ───────────────────────────────────────────────
const SS_KEY = 'nptel_os_stats_v2';
function loadStats() {
  try { return JSON.parse(localStorage.getItem(SS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveStats(s) { localStorage.setItem(SS_KEY, JSON.stringify(s)); }

function recordAnswer(q, chosenIdx) {
  const s = loadStats();
  if (!s.byVideo) s.byVideo = {};
  if (!s.byTopic) s.byTopic = {};

  const vid = String(q.video);
  const topic = q.subtopic || q.topic;
  const isCorrect = (chosenIdx === q.correctAnswer);

  if (!s.byVideo[vid]) s.byVideo[vid] = {attempted:0, correct:0};
  s.byVideo[vid].attempted++;
  if (isCorrect) s.byVideo[vid].correct++;

  if (!s.byTopic[topic]) s.byTopic[topic] = {attempted:0, correct:0};
  s.byTopic[topic].attempted++;
  if (isCorrect) s.byTopic[topic].correct++;

  s.totalAttempted = (s.totalAttempted||0) + 1;
  if (isCorrect) s.totalCorrect = (s.totalCorrect||0) + 1;

  const today = new Date().toDateString();
  if (s.lastStudied !== today) {
    const yesterday = new Date(Date.now()-86400000).toDateString();
    s.streak = (s.lastStudied === yesterday) ? (s.streak||0)+1 : 1;
    s.lastStudied = today;
  }
  saveStats(s);
}

// ─── Load Data ─────────────────────────────────────────────
async function loadAllQuestions() {
  const promises = [];
  for (let v = 1; v <= 20; v++) {
    const pad = String(v).padStart(2,'0');
    promises.push(
      fetch(`data/q${pad}.json`).then(r => r.ok ? r.json() : []).catch(e => [])
    );
  }
  const arrays = await Promise.all(promises);
  allQuestions = [].concat(...arrays); // fixed flat() compatibility
  updateHomeStats();
  buildSidebarNav();
  buildVideoGrid();
}

// ─── Helpers ───────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function getChipVal(id) {
  const a = document.querySelector(`#${id} .chip.active`);
  return a ? a.dataset.val : null;
}
function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

// ─── Panel Routing ─────────────────────────────────────────
const App = {};
let currentPanel = 'home';

App.showPanel = function(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('panel-'+name);
  if (el) { el.classList.add('active'); }
  document.getElementById('app-main').scrollTop = 0;
  if (window.innerWidth <= 640) { document.getElementById('app-sidebar').classList.remove('mobile-open'); const ov = document.getElementById('sidebar-overlay'); if(ov) ov.classList.remove('active'); }

  // Sidebar active state
  document.querySelectorAll('.sb-main-item').forEach(b => b.classList.remove('active'));
  if (name === 'home') document.getElementById('sb-home-btn').classList.add('active');
  else if (name === 'mode' || name === 'practice-setup' || name === 'exam-setup' || name === 'video-select')
    document.getElementById('sb-mode-btn').classList.add('active');
  else if (name === 'stats') document.getElementById('sb-stats-btn').classList.add('active');

  // Quote visibility
  const hideQuote = ['quiz','results'].includes(name);
  document.getElementById('main-quote').style.display = hideQuote ? 'none' : 'block';

  // Topbar
  const showTopbar = (name === 'quiz');
  document.getElementById('main-topbar').style.display = showTopbar ? 'flex' : 'none';

  currentPanel = name;
};

// ─── Home Stats ────────────────────────────────────────────
function updateHomeStats() {
  document.getElementById('home-total-q').textContent = allQuestions.length;
  const s = loadStats();
  const att = s.totalAttempted || 0;
  const cor = s.totalCorrect || 0;
  document.getElementById('home-attempted').textContent = att;
  document.getElementById('home-accuracy').textContent = att > 0 ? Math.round(cor/att*100)+'%' : '—';
  document.getElementById('home-streak').textContent = s.streak || 0;
}

// ─── Sidebar Nav ───────────────────────────────────────────
function buildSidebarNav() {
  const nav = document.getElementById('sb-nav');
  if (!nav) return;
  nav.innerHTML = '';
  const s = loadStats();
  for (let v = 1; v <= 20; v++) {
    const stat = (s.byVideo || {})[String(v)];
    const count = allQuestions.filter(q => q.video === v).length;
    const hasDone = stat && stat.attempted > 0;
    const pct = hasDone ? Math.round(stat.correct / stat.attempted * 100) : null;

    const btn = document.createElement('button');
    btn.className = 'sb-item' + (hasDone ? ' done' : '');
    btn.dataset.v = v;
    btn.innerHTML = `
      <span class="sb-dot"></span>
      <span class="sb-item-label" title="${v}: ${VIDEO_TOPICS[v]||''}">${v}: ${VIDEO_TOPICS[v]||''}</span>
      <span class="sb-item-count">${pct !== null ? pct+'%' : count}</span>
    `;
    btn.onclick = () => startVideoSession(v);
    nav.appendChild(btn);
  }
}

function setActiveSidebarVideo(v) {
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  const target = document.querySelector(`.sb-item[data-v="${v}"]`);
  if (target) { target.classList.add('active'); target.scrollIntoView({block:'nearest'}); }
}

// ─── Video Grid (panel) ────────────────────────────────────
function buildVideoGrid() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const s = loadStats();
  for (let v = 1; v <= 20; v++) {
    const stat = (s.byVideo||{})[String(v)];
    let scoreHTML = '<span class="video-tile-score score-none">—</span>';
    if (stat && stat.attempted > 0) {
      const pct = Math.round(stat.correct/stat.attempted*100);
      const cls = pct>=70?'score-good':pct>=40?'score-mid':'score-bad';
      scoreHTML = `<span class="video-tile-score ${cls}">${pct}%</span>`;
    }
    const tile = document.createElement('button');
    tile.className = 'video-tile';
    tile.innerHTML = `<span class="video-tile-num">V${v}</span><span class="video-tile-label">${VIDEO_TOPICS[v]||''}</span>${scoreHTML}`;
    tile.onclick = () => startVideoSession(v);
    grid.appendChild(tile);
  }
}

function startVideoSession(v) {
  setActiveSidebarVideo(v);
  if (window.innerWidth <= 640) { document.getElementById('app-sidebar').classList.remove('mobile-open'); const ov = document.getElementById('sidebar-overlay'); if(ov) ov.classList.remove('active'); }
  const pool = shuffle(allQuestions.filter(q => q.video === v));
  startSession(pool, 'practice', 0); session.video = v;
}

// ─── Start Sessions ────────────────────────────────────────
App.startPractice = function() {
  const diff  = getChipVal('diff-chips');
  const count = getChipVal('count-chips');
  const doShuffle = document.getElementById('toggle-shuffle').checked;
  let pool = allQuestions.filter(q => diff==='all' || q.difficulty===diff);
  pool = doShuffle ? shuffle(pool) : pool;
  if (count !== 'all') pool = pool.slice(0, parseInt(count));
  startSession(pool, 'practice', 0); session.video = v;
};

App.startExam = function() {
  const count   = parseInt(getChipVal('exam-count-chips'));
  const timeVal = parseInt(getChipVal('time-chips'));
  const pool    = shuffle(allQuestions).slice(0, count);
  startSession(pool, 'exam', timeVal);
};

App.startWeakTopics = function() {
  const s = loadStats();
  const topics = s.byTopic || {};
  const sorted = Object.entries(topics)
    .filter(([,v]) => v.attempted >= 2)
    .sort((a,b) => (a[1].correct/a[1].attempted) - (b[1].correct/b[1].attempted))
    .slice(0,3).map(([t]) => t);
  let pool;
  if (sorted.length === 0) pool = shuffle(allQuestions).slice(0,15);
  else {
    pool = allQuestions.filter(q => sorted.includes(q.subtopic||q.topic));
    pool = pool.length < 5 ? shuffle(allQuestions).slice(0,15) : shuffle(pool).slice(0,15);
  }
  startSession(pool, 'practice', 0); session.video = v;
};

// ─── Session Core ──────────────────────────────────────────
function startSession(questions, mode, timePerQ) {
  if (questions.length === 0) { alert('No questions found for that filter.'); return; }
  clearInterval(session.timerInterval);
  session = {
    questions,
    answers: new Array(questions.length).fill(null),
    current: 0, mode, startTime: Date.now(),
    timerInterval: null, timePerQ, qStartTime: Date.now(),
  };
  document.getElementById('topbar-title').textContent = mode === 'exam' ? '📝 Exam' : '📖 Practice';
  App.showPanel('quiz');
  renderQuestion();
  if (mode === 'exam' && timePerQ > 0) startQTimer();
}

// ─── Timer ─────────────────────────────────────────────────
function startQTimer() {
  clearInterval(session.timerInterval);
  session.qStartTime = Date.now();
  const el = document.getElementById('topbar-timer');

  session.timerInterval = setInterval(() => {
    const remaining = session.timePerQ - Math.floor((Date.now()-session.qStartTime)/1000);
    if (remaining <= 0) {
      clearInterval(session.timerInterval);
      el.textContent = '0:00';
      if (session.answers[session.current] === null) session.answers[session.current] = -1;
      App.nextQ();
    } else {
      el.textContent = formatTime(remaining);
      el.className = 'topbar-timer' + (remaining<=10?' timer-warn':'');
    }
  }, 500);
}

// ─── Render Question ───────────────────────────────────────
function renderQuestion() {
  const q     = session.questions[session.current];
  const idx   = session.current;
  const total = session.questions.length;

  // Progress
  document.getElementById('quiz-progress-fill').style.width = ((idx+1)/total*100)+'%';
  document.getElementById('q-num').textContent = `Q${idx+1} of ${total}`;
  document.getElementById('q-topic-label').textContent = q.subtopic || q.topic || '';

  // Badges
  const diffEl = document.getElementById('q-difficulty');
  diffEl.textContent = q.difficulty;
  diffEl.className = `q-badge diff-${q.difficulty}`;
  document.getElementById('q-video-badge').textContent = `Video ${q.video}`;

  document.getElementById('question-text').textContent = q.question;

  // Options
  const ol = document.getElementById('options-list');
  ol.innerHTML = '';
  const labels = ['A','B','C','D'];
  const chosen = session.answers[idx];
  const answered = chosen !== null;

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if (answered) {
      btn.disabled = true;
      if (i === q.correctAnswer) btn.classList.add('correct');
      else if (i === chosen && chosen !== q.correctAnswer) btn.classList.add('wrong');
      else if (i === chosen) btn.classList.add('selected');
    }
    btn.innerHTML = `<span class="option-letter">${labels[i]}</span><span>${opt}</span>`;
    if (!answered) btn.onclick = () => selectAnswer(i);
    ol.appendChild(btn);
  });

  // Explanation
  const exBox = document.getElementById('explanation-box');
  if (session.mode === 'practice' && answered && chosen !== -1) {
    exBox.style.display = 'block';
    let html = `<div class="expl-title">💡 Explanation</div><div class="expl-body">${q.explanation}</div>`;
    if (q.optionExplanations) {
      q.optionExplanations.forEach((e,i) => {
        html += `<div class="opt-exp-row"><span class="opt-letter-sm">${labels[i]}.</span><span>${e}</span></div>`;
      });
    }
    exBox.innerHTML = html;
  } else {
    exBox.style.display = 'none';
  }

  // Nav
  document.getElementById('btn-prev').style.visibility = idx > 0 ? 'visible' : 'hidden';
  document.getElementById('btn-next').textContent = idx === total-1 ? 'Finish ✓' : 'Next →';

  if (session.mode==='exam' && session.timePerQ>0 && answered === false) startQTimer();
}

// ─── Answer ────────────────────────────────────────────────
function selectAnswer(i) {
  if (session.answers[session.current] !== null) return;
  session.answers[session.current] = i;
  recordAnswer(session.questions[session.current], i);
  renderQuestion();
}

App.nextQ = function() {
  if (session.current >= session.questions.length-1) finishSession();
  else { session.current++; renderQuestion(); }
};

App.prevQ = function() {
  if (session.current > 0) { session.current--; renderQuestion(); }
};

// ─── Finish ────────────────────────────────────────────────
function finishSession() {
  clearInterval(session.timerInterval);
  document.getElementById('topbar-timer').textContent = '';

  const qs = session.questions;
  const ans = session.answers;
  let correct=0, wrong=0, skipped=0;
  const topicErrors = {};

  qs.forEach((q,i) => {
    if (ans[i]===null||ans[i]===-1) skipped++;
    else if (ans[i]===q.correctAnswer) correct++;
    else {
      wrong++;
      const t = q.subtopic||q.topic;
      topicErrors[t] = (topicErrors[t]||0)+1;
    }
  });

  const pct = Math.round(correct / Math.max(qs.length-skipped,1) * 100);
  const elapsed = Math.round((Date.now()-session.startTime)/1000);

  document.getElementById('result-score').textContent = `${pct}%`;
  document.getElementById('res-correct').textContent  = correct;
  document.getElementById('res-wrong').textContent    = wrong;
  document.getElementById('res-skipped').textContent  = skipped;
  document.getElementById('res-time').textContent     = formatTime(elapsed);

  // Weak areas
  const weakEl = document.getElementById('weak-topics-list');
  const sorted = Object.entries(topicErrors).sort((a,b)=>b[1]-a[1]).slice(0,4);
  if (sorted.length===0) {
    weakEl.innerHTML = '<div class="empty-state">🎉 No weak areas this session!</div>';
  } else {
    weakEl.innerHTML = sorted.map(([t,c]) => {
      const pctW = Math.round(c/Math.max(wrong,1)*100);
      return `<div class="weak-item">
        <span class="weak-topic-name">${t}</span>
        <div class="weak-bar-wrap"><div class="weak-bar-fill" style="width:${pctW}%"></div></div>
        <span class="weak-pct">${c} err</span>
      </div>`;
    }).join('');
  }

  buildReview();
  document.getElementById('review-section').style.display = 'none';
  updateHomeStats();
  buildSidebarNav();
  buildVideoGrid();

  // Setup buttons
  const btnNextVideo = document.getElementById('btn-next-video');
  if (btnNextVideo) {
    if (session.video && session.video < 20) {
      btnNextVideo.style.display = 'inline-block';
    } else {
      btnNextVideo.style.display = 'none';
    }
  }

  App.showPanel('results');
}

// ─── Review ────────────────────────────────────────────────
function buildReview() {
  const labels = ['A','B','C','D'];
  const rl = document.getElementById('review-list');
  rl.innerHTML = '';
  session.questions.forEach((q,i) => {
    const chosen = session.answers[i];
    const isSkipped = chosen===null||chosen===-1;
    const isCorrect = !isSkipped && chosen===q.correctAnswer;
    const cls = isSkipped?'review-skipped':isCorrect?'review-correct':'review-wrong';
    let uAns = isSkipped ? '<div class="review-ans-row">Skipped</div>' :
      `<div class="review-ans-row ${isCorrect?'ans-correct':'ans-wrong'}">Your answer: <strong>${labels[chosen]}. ${q.options[chosen]}</strong></div>`;
    if (!isSkipped && !isCorrect)
      uAns += `<div class="review-ans-row ans-correct">Correct: <strong>${labels[q.correctAnswer]}. ${q.options[q.correctAnswer]}</strong></div>`;
    const card = document.createElement('div');
    card.className = `review-card ${cls}`;
    card.innerHTML = `<div class="review-q-text">Q${i+1}. ${q.question}</div>
      <div class="review-answers">${uAns}</div>
      <div class="review-expl">${q.explanation}</div>`;
    rl.appendChild(card);
  });
}

App.toggleReview = function() {
  const s = document.getElementById('review-section');
  s.style.display = s.style.display==='none' ? 'block' : 'none';
  if (s.style.display==='block') s.scrollIntoView({behavior:'smooth'});
};

// ─── Stats ─────────────────────────────────────────────────
App.showStats = function() {
  const s = loadStats();
  const ll = document.getElementById('stats-lecture-list');
  ll.innerHTML = '';
  for (let v=1;v<=20;v++) {
    const stat = (s.byVideo||{})[String(v)];
    const att = stat?stat.attempted:0;
    const cor = stat?stat.correct:0;
    const pct = att>0?Math.round(cor/att*100):null;
    const fillCls = pct===null?'fill-bad':pct>=70?'fill-good':pct>=40?'fill-mid':'fill-bad';
    const pctColor = pct===null?'var(--text-muted)':pct>=70?'var(--green-mid)':pct>=40?'var(--yellow)':'var(--red)';
    ll.innerHTML += `<div class="stats-row">
      <span class="stats-lec">Video ${v}</span>
      <span class="stats-topic">${VIDEO_TOPICS[v]||''}</span>
      <div class="stats-bar-wrap"><div class="stats-bar-fill ${fillCls}" style="width:${pct||0}%"></div></div>
      <span class="stats-pct" style="color:${pctColor}">${pct!==null?pct+'%':'—'}</span>
    </div>`;
  }

  const wl = document.getElementById('stats-weak-list');
  const weakSorted = Object.entries(s.byTopic||{})
    .filter(([,v])=>v.attempted>=2)
    .map(([t,v])=>({t,pct:Math.round(v.correct/v.attempted*100)}))
    .sort((a,b)=>a.pct-b.pct).slice(0,6);
  wl.innerHTML = weakSorted.length===0
    ? '<div class="empty-state">No data yet. Start practising!</div>'
    : weakSorted.map(({t,pct})=>`<div class="weak-item">
        <span class="weak-topic-name">${t}</span>
        <div class="weak-bar-wrap"><div class="weak-bar-fill" style="width:${pct}%"></div></div>
        <span class="weak-pct">${pct}%</span>
      </div>`).join('');

  document.getElementById('sb-stats-btn').classList.add('active');
  document.querySelectorAll('.sb-main-item').forEach(b => {
    if (b.id !== 'sb-stats-btn') b.classList.remove('active');
  });
  App.showPanel('stats');
};

App.resetStats = function() {
  document.getElementById('modal-reset').style.display = 'flex';
};
App.confirmResetData = function() {
  localStorage.removeItem(SS_KEY);
  updateHomeStats();
  buildSidebarNav();
  App.showStats();
  App.closeModal();
};

// ─── Exit ──────────────────────────────────────────────────
App.confirmExit  = () => { document.getElementById('modal-exit').style.display='flex'; };
App.closeModal = () => { document.getElementById('modal-exit').style.display='none'; const mr = document.getElementById('modal-reset'); if (mr) mr.style.display='none'; };
App.forceExit    = () => {
  App.closeModal();
  clearInterval(session.timerInterval);
  document.getElementById('topbar-timer').textContent = '';
  updateHomeStats();
  App.showPanel('home');
};

// ─── Chip Groups ───────────────────────────────────────────
document.querySelectorAll('.chip-group').forEach(group => {
  group.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// ─── Boot ──────────────────────────────────────────────────
window.App = App;
loadAllQuestions();

App.toggleSidebar = function() {
  const sb = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sb) return;
  if (window.innerWidth <= 640) {
    sb.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active');
  } else {
    sb.classList.toggle('collapsed');
  }
};

App.retakeTest = function() {
  const prevQs = [...session.questions];
  const prevMode = session.mode;
  const prevTime = session.timePerQ;
  const prevVideo = session.video;
  
  startSession(prevQs, prevMode, prevTime);
  if (prevVideo) session.video = prevVideo;
};

App.nextVideoTest = function() {
  if (session.video && session.video < 20) {
    startVideoSession(session.video + 1);
  }
};
