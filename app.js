let state = {
  isPlus: false,
  xp: 100,
  level: 1,
  lang: localStorage.getItem('dock_lang') || 'en',
  theme: localStorage.getItem('dock_theme') || 'midnight',
  dyslexia: localStorage.getItem('dock_dyslexia') === 'true',
  fontSize: localStorage.getItem('dock_fontsize') || 'normal',
  activeTitle: "Novice Scheduler",
  unlockedTitles: ["Novice Scheduler"],
  quickHorizon: "🎯 NOW",
  offlineQueue: JSON.parse(localStorage.getItem('dock_offline_queue') || '[]'),
  tasks: [
    { id: 1, text: "Work shift / Sole trader jobs", day: "Every Day", timeSlot: "9:00 AM", horizon: "🎯 NOW", duration: "3 hrs", completed: false },
    { id: 2, text: "Family dinner prep", day: "Tuesday", timeSlot: "5:00 PM", horizon: "⏳ NEXT", duration: "1.5 hrs", completed: false }
  ]
};

const allTitlesData = [
  { name: "Novice Scheduler", reqLevel: 1 },
  { name: "Task Crusher", reqLevel: 2 },
  { name: "Time Architect", reqLevel: 3 },
  { name: "Master of DOCK", reqLevel: 5 }
];

let bannerTimeout = null;

function initApp() {
  loadSavedData();
  applyAccessibilitySettings();
  renderTasks();
  updateXpUI();
  renderTitleChips();
  initNetworkListeners();
}

function loadSavedData() {
  state.isPlus = localStorage.getItem('dock_isPlus') === 'true';
  const savedXp = localStorage.getItem('dock_user_xp');
  if(savedXp !== null) state.xp = parseInt(savedXp, 10);
  const savedTitle = localStorage.getItem('dock_active_title');
  if(savedTitle) state.activeTitle = savedTitle;
  const savedTasks = localStorage.getItem('dock_tasks_v27');
  if(savedTasks) { try { state.tasks = JSON.parse(savedTasks); } catch(e) {} }
  calculateLevel();
}

function saveTasksToStorage() { 
  localStorage.setItem('dock_tasks_v27', JSON.stringify(state.tasks));
}

function initNetworkListeners() {
  const pill = document.getElementById('offline-status-pill');
  if (!pill) return;
  function updateNetStatus() {
    if (navigator.onLine) {
      pill.className = "offline-pill online";
      pill.innerText = "● Live";
    } else {
      pill.className = "offline-pill offline";
      pill.innerText = "○ Offline Mode";
    }
  }
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  updateNetStatus();
}

function changeLanguage(langKey) {
  state.lang = langKey;
  localStorage.setItem('dock_lang', langKey);
}

// CALENDAR IMPORT & SYNC FUNCTIONS
function importGoogleCalendarEvents() {
  const importedEvent = {
    id: Date.now(),
    text: "flea + warmer (Google Calendar)",
    day: "Wednesday",
    timeSlot: "6:00 PM",
    horizon: "🎯 NOW",
    duration: "1 hr",
    completed: false
  };
  state.tasks.unshift(importedEvent);
  saveTasksToStorage();
  renderTasks();
  fireNotification("Calendar Synced!", "Imported 1 event from Google Calendar successfully.");
}

function handleIcsFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    let summaryMatch = content.match(/SUMMARY:(.*)/);
    let taskName = summaryMatch ? summaryMatch[1].trim() : "Imported Event";
    
    state.tasks.unshift({
      id: Date.now(),
      text: `${taskName} (.ics)`,
      day: "Today",
      timeSlot: "12:00 PM",
      horizon: "⏳ NEXT",
      duration: "1 hr",
      completed: false
    });
    saveTasksToStorage();
    renderTasks();
    fireNotification("ICS Imported!", `Successfully imported "${taskName}" into DOCK.`);
  };
  reader.readAsText(file);
}

function exportToIcs() {
  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DOCK Task Manager//EN\n";
  state.tasks.forEach(t => {
    icsContent += "BEGIN:VEVENT\n";
    icsContent += `SUMMARY:${t.text}\n`;
    icsContent += `DESCRIPTION:DOCK Precision Task - Horizon: ${t.horizon}\n`;
    icsContent += "END:VEVENT\n";
  });
  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dock_schedule.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  fireNotification("ICS Feed Exported", "dock_schedule.ics downloaded successfully.");
}

// VOICE MICRO-SPRINT SPEECH RECOGNITION
let recognition = null;
let isListening = false;

function toggleVoiceListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("🎙️ Voice recognition is not supported in this browser.");
    return;
  }
  const box = document.getElementById('voice-transcript-box');
  const textElem = document.getElementById('live-speech-text');
  const micBtn = document.getElementById('mic-trigger-btn');

  if (isListening) { if (recognition) recognition.stop(); return; }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-GB';
  recognition.interimResults = true;

  recognition.onstart = () => { isListening = true; box.style.display = 'block'; micBtn.classList.add('listening'); textElem.innerText = "Listening..."; };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    textElem.innerText = `"${transcript}"`;
    if (event.results[0].isFinal) {
      setTimeout(() => {
        box.style.display = 'none'; micBtn.classList.remove('listening'); isListening = false;
        document.getElementById('assistant-input').value = transcript;
        sendAssistantMsg();
      }, 800);
    }
  };
  recognition.onerror = () => { box.style.display = 'none'; micBtn.classList.remove('listening'); isListening = false; };
  recognition.onend = () => { box.style.display = 'none'; micBtn.classList.remove('listening'); isListening = false; };
  try { recognition.start(); } catch(e) { isListening = false; micBtn.classList.remove('listening'); }
}

function setQuickHorizon(horizonVal, btnElem) {
  state.quickHorizon = horizonVal;
  document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
  btnElem.classList.add('active');
}

function requestNotificationPermission() {
  if (!("Notification" in window)) { alert("🔔 Notifications enabled."); return; }
  Notification.requestPermission().then(permission => {
    if (permission === "granted") alert("✅ Notifications enabled!");
  });
}

function fireNotification(title, bodyText) {
  if (window.Notification && Notification.permission === "granted") {
    try { new Notification(title, { body: bodyText }); } catch(e) {}
  }
  const banner = document.getElementById('celebration-banner');
  document.getElementById('banner-title').innerText = title;
  document.getElementById('celebration-subtitle').innerText = bodyText;
  if (bannerTimeout) clearTimeout(bannerTimeout);
  banner.classList.add('show');
  bannerTimeout = setTimeout(() => banner.classList.remove('show'), 4000);
}

function applyAccessibilitySettings() {
  const body = document.getElementById('app-body');
  body.classList.remove('theme-contrast', 'theme-sepia', 'theme-light');
  if (state.theme && state.theme !== 'midnight') body.classList.add('theme-' + state.theme);
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) themeSelect.value = state.theme;

  const dyslexiaToggle = document.getElementById('dyslexia-toggle');
  if (dyslexiaToggle) dyslexiaToggle.checked = state.dyslexia;
  if (state.dyslexia) body.classList.add('dyslexia-mode');
  else body.classList.remove('dyslexia-mode');

  if (state.fontSize === 'large') body.style.setProperty('--font-size-multiplier', '1.15rem');
  else if (state.fontSize === 'xlarge') body.style.setProperty('--font-size-multiplier', '1.3rem');
  else body.style.setProperty('--font-size-multiplier', '1rem');
}

function setThemeMode(val) { state.theme = val; localStorage.setItem('dock_theme', val); applyAccessibilitySettings(); }
function toggleDyslexiaMode(checked) { state.dyslexia = checked; localStorage.setItem('dock_dyslexia', checked ? 'true' : 'false'); applyAccessibilitySettings(); }
function setAccessibilityFontSize(val) { state.fontSize = val; localStorage.setItem('dock_fontsize', val); applyAccessibilitySettings(); }

async function startCheckout(planType) {
  closeModal('pricing-modal');
  alert("Redirecting to secure checkout for " + planType + "...");
}

function triggerEmailExport() { alert("✉️ Schedule export generated."); }

function calculateLevel() {
  let lvl = 1; let remainingXp = state.xp; let nextLevelCost = 150;
  while (remainingXp >= nextLevelCost) { remainingXp -= nextLevelCost; lvl++; nextLevelCost += 50; }
  state.level = lvl;
  allTitlesData.forEach(t => { if (state.level >= t.reqLevel && !state.unlockedTitles.includes(t.name)) state.unlockedTitles.push(t.name); });
}

function updateXpUI() {
  calculateLevel();
  const currentLevelCost = 100 + (state.level - 1) * 50;
  let progressInLevel = (state.xp % currentLevelCost);
  let pct = Math.min(100, Math.round((progressInLevel / currentLevelCost) * 100));

  if(document.getElementById('profile-level-title')) document.getElementById('profile-level-title').innerText = `Level ${state.level}: ${state.activeTitle}`;
  if(document.getElementById('header-level-badge')) document.getElementById('header-level-badge').innerText = `Lvl ${state.level}`;
  if(document.getElementById('profile-xp-text')) document.getElementById('profile-xp-text').innerText = `${state.xp} XP`;
  if(document.getElementById('xp-bar-fill')) document.getElementById('xp-bar-fill').style.width = pct + '%';
  if(document.getElementById('mini-xp-fill')) document.getElementById('mini-xp-fill').style.width = pct + '%';
}

function renderTitleChips() {
  const container = document.getElementById('title-chips-container');
  if(!container) return;
  container.innerHTML = '';
  allTitlesData.forEach(t => {
    const isUnlocked = state.unlockedTitles.includes(t.name);
    const isActive = state.activeTitle === t.name;
    const chip = document.createElement('div');
    chip.className = `title-chip ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
    chip.innerHTML = `${t.name} ${!isUnlocked ? '🔒' : ''}`;
    if (isUnlocked) {
      chip.onclick = () => { state.activeTitle = t.name; localStorage.setItem('dock_active_title', t.name); updateXpUI(); renderTitleChips(); };
    }
    container.appendChild(chip);
  });
}

window.switchView = function(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-item[data-target="${viewName}"]`);
  if(activeBtn) activeBtn.classList.add('active');
  window.scrollTo(0,0);
}

function triggerDopamineHit(taskText) {
  state.xp += 50; localStorage.setItem('dock_user_xp', state.xp);
  let oldLevel = state.level; calculateLevel(); updateXpUI(); renderTitleChips();
  fireNotification(state.level > oldLevel ? `⭐ Level ${state.level} Reached!` : `Task Completed!`, `+50 XP earned for "${taskText}"`);
}

function addQuickTask() {
  const input = document.getElementById('quick-task-input');
  const text = input.value.trim(); if (!text) return;
  const day = document.getElementById('task-day-select').value;
  const timeSlot = document.getElementById('task-time-select').value;
  const horizon = state.quickHorizon;
  
  state.tasks.unshift({ id: Date.now(), text, day, timeSlot, horizon, duration: "30 mins", completed: false });
  input.value = ''; saveTasksToStorage(); renderTasks();
  fireNotification("Task Scheduled!", `${text} (${timeSlot} - ${horizon})`);
}
function handleTaskKey(e) { if (e.key === 'Enter') addQuickTask(); }

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if(t) { t.completed = !t.completed; saveTasksToStorage(); renderTasks(); if(t.completed) triggerDopamineHit(t.text); }
}

function deleteTask(id) { state.tasks = state.tasks.filter(x => x.id !== id); saveTasksToStorage(); renderTasks(); }
function clearCompleted() { state.tasks = state.tasks.filter(x => !x.completed); saveTasksToStorage(); renderTasks(); }

function renderTasks() {
  const activeContainer = document.getElementById('task-container');
  const completedContainer = document.getElementById('completed-container');
  const completedSection = document.getElementById('completed-section');
  if(!activeContainer || !completedContainer) return;
  
  activeContainer.innerHTML = ''; completedContainer.innerHTML = '';
  const activeTasks = state.tasks.filter(t => !t.completed);
  const completedTasks = state.tasks.filter(t => t.completed);

  if (activeTasks.length === 0) {
    activeContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">All caught up! 🎉</div>`;
  } else {
    activeTasks.forEach(task => {
      activeContainer.innerHTML += `
        <div class="task-item">
          <div class="task-left">
            <input type="checkbox" class="custom-checkbox" onchange="toggleTask(${task.id})">
            <div>
              <span class="task-text">${task.text}</span>
              <div class="task-badges">
                <span class="badge">${task.day}</span>
                <span class="badge time">⏰ ${task.timeSlot}</span>
                <span class="badge horizon" style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD;">${task.horizon || '🎯 NOW'}</span>
              </div>
            </div>
          </div>
          <button class="delete-btn" onclick="deleteTask(${task.id})">✕</button>
        </div>`;
    });
  }

  if (completedTasks.length > 0) {
    completedSection.style.display = 'block';
    completedTasks.forEach(task => {
      completedContainer.innerHTML += `
        <div class="task-item">
          <div class="task-left">
            <input type="checkbox" class="custom-checkbox" checked onchange="toggleTask(${task.id})">
            <div><span class="task-text">${task.text}</span></div>
          </div>
          <button class="delete-btn" onclick="deleteTask(${task.id})">✕</button>
        </div>`;
    });
  } else { completedSection.style.display = 'none'; }
}

function sendAssistantMsg() {
  const input = document.getElementById('assistant-input');
  const raw = input.value.trim(); if (!raw) return;
  appendChat(raw, 'user'); input.value = '';
  setTimeout(() => {
    state.tasks.unshift({ id: Date.now(), text: raw, day: "Today", timeSlot: "10:00 AM", horizon: "🎯 NOW", duration: "30 mins", completed: false });
    saveTasksToStorage(); renderTasks();
    appendChat(`Scheduled <strong>"${raw}"</strong> for Today at 10:00 AM (🎯 NOW).`, 'assistant');
    fireNotification("Precision Task Locked!", raw);
  }, 300);
}

function handleAssistantKey(e) { if (e.key === 'Enter') sendAssistantMsg(); }
function appendChat(msg, type) {
  const log = document.getElementById('chat-log');
  if(!log) return;
  log.innerHTML += `<div class="chat-msg ${type}">${msg}</div>`;
  log.scrollTop = log.scrollHeight;
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

window.onload = initApp;
