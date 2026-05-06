const STORAGE_KEY = "mathThinkingRpgProgress";
const timeScale = 10;

const stages = [
  {
    id: "schedule",
    title: "家事排程塔",
    short: "排程",
    npc: "管家米洛",
    symbol: "排",
    intro: "小佑要完成所有家事。機器任務可以自己跑，但小佑親手做的任務不能重疊。",
    hint: "先把有先後關係的工作找出來，再讓自動任務和手動任務並行。"
  },
  {
    id: "hourglass",
    title: "沙漏時計洞",
    short: "沙漏",
    npc: "時計師琳",
    symbol: "時",
    intro: "你有 7 分鐘和 10 分鐘沙漏，要準確量出 25 分鐘。",
    hint: "每次沙漏漏完都是一個決策點。記錄翻轉時刻，會比一直猜快。"
  },
  {
    id: "bus",
    title: "巴士調度營",
    short: "租車",
    npc: "車隊長柏特",
    symbol: "車",
    intro: "155 位學生要去戶外教學。座位要夠，花費要低，空位也要少。",
    hint: "先滿足座位數，再比較總花費。最便宜的方案不一定是車輛最少。"
  },
  {
    id: "guard",
    title: "警衛雅克之門",
    short: "雅克",
    npc: "警衛雅克",
    symbol: "鑰",
    intro: "房間標籤會轉成三位數鑰匙標籤。請找出遺失的 RAB 應該是哪個數字。",
    hint: "同一個字母永遠對應同一個數字。先用已知鑰匙反推 A、B、E、R。"
  }
];

const chores = {
  A: { id: "A", name: "洗衣服", duration: 40, type: "auto", color: "blue", dep: null },
  B: { id: "B", name: "晾衣服", duration: 10, type: "manual", color: "orange", dep: "A" },
  C: { id: "C", name: "燒開水", duration: 15, type: "auto", color: "cyan", dep: null },
  D: { id: "D", name: "掃地", duration: 10, type: "manual", color: "amber", dep: null },
  E: { id: "E", name: "拖地", duration: 15, type: "manual", color: "yellow", dep: "D" },
  F: { id: "F", name: "洗碗", duration: 15, type: "manual", color: "green", dep: null },
  G: { id: "G", name: "擦桌子", duration: 10, type: "manual", color: "lime", dep: null },
  H: { id: "H", name: "倒垃圾", duration: 10, type: "manual", color: "slate", dep: null }
};

const busRules = {
  target: 155,
  largeCapacity: 40,
  largeCost: 9000,
  mediumCapacity: 25,
  mediumCost: 5000
};

const guardWords = ["BEB", "RAB", "ERB", "EAB", "AER"];
const guardKnown = [
  { word: "BEB", value: "636" },
  { word: "EAB", value: "396" },
  { word: "ERB", value: "346" },
  { word: "AER", value: "934" }
];

const defaultProgress = () => ({
  playerName: "",
  completedStages: {},
  attempts: { schedule: 0, hourglass: 0, bus: [], guard: [] },
  finished: false
});

let appState = {
  screen: "login",
  activeStage: null,
  progress: loadProgress(),
  selectedNpc: null
};

let scheduleState = [];
let hourglassTimer = null;
let toastTimer = null;
let busState = { large: 0, medium: 0, history: appState.progress.attempts.bus || [] };
let guardState = { map: { A: "", B: "", E: "", R: "" }, answer: "", mistakes: 0 };
let hourglassState = {
  time: 0,
  aTop: 7,
  aBot: 0,
  bTop: 10,
  bBot: 0,
  isRunning: false,
  winLogged: false,
  log: []
};

const $ = (selector) => document.querySelector(selector);

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...defaultProgress(), ...saved } : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.progress));
}

function clearProgress() {
  window.clearInterval(hourglassTimer);
  localStorage.removeItem(STORAGE_KEY);
  appState = { screen: "login", activeStage: null, progress: defaultProgress(), selectedNpc: null };
  scheduleState = [];
  busState = { large: 0, medium: 0, history: [] };
  resetHourglassState();
  guardState = { map: { A: "", B: "", E: "", R: "" }, answer: "", mistakes: 0 };
  showToast("進度已清空，請重新開始。");
  renderApp();
}

function showToast(message, type = "info") {
  const toast = $("#toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  toastTimer = window.setTimeout(() => {
    toast.className = "toast";
  }, 2600);
}

function startGame(name) {
  const playerName = name.trim();
  if (!playerName) {
    showToast("請先輸入玩家姓名。", "error");
    return;
  }
  appState.progress.playerName = playerName;
  appState.screen = "lobby";
  saveProgress();
  renderApp();
}

function continueGame() {
  if (!appState.progress.playerName) return;
  appState.screen = appState.progress.finished ? "ending" : "lobby";
  renderApp();
}

function openStage(stageId) {
  appState.activeStage = stageId;
  appState.screen = "stage";
  appState.selectedNpc = null;
  if (stageId === "hourglass") resetHourglassState();
  renderApp();
}

function returnLobby() {
  window.clearInterval(hourglassTimer);
  hourglassState.isRunning = false;
  appState.screen = "lobby";
  appState.activeStage = null;
  renderApp();
}

function markStageComplete(stageId) {
  if (!appState.progress.completedStages[stageId]) {
    appState.progress.completedStages[stageId] = true;
    saveProgress();
    showToast("關卡完成，回大廳看看新的進度。", "success");
  }
}

function allStagesDone() {
  return stages.every((stage) => appState.progress.completedStages[stage.id]);
}

function tryFinishGame() {
  if (!allStagesDone()) {
    const missing = stages.filter((stage) => !appState.progress.completedStages[stage.id]).map((stage) => stage.short).join("、");
    appState.selectedNpc = {
      name: "大廳導師",
      text: `還差 ${missing}。完成所有地圖後，再回來找我通關。`,
      final: true
    };
    renderApp();
    return;
  }
  appState.progress.finished = true;
  appState.screen = "ending";
  saveProgress();
  renderApp();
}

function renderApp() {
  if (appState.screen === "login") renderLogin();
  if (appState.screen === "lobby") renderLobby();
  if (appState.screen === "stage") renderStage();
  if (appState.screen === "ending") renderEnding();
}

function renderLogin() {
  const hasSave = Boolean(appState.progress.playerName);
  $("#app").innerHTML = `
    <main class="screen login-screen">
      <section class="login-card">
        <p class="subtitle">Math Thinking RPG</p>
        <h1 class="pixel-title">數學思考冒險</h1>
        <p class="subtitle">輸入玩家姓名，進入復古 RPG 大廳，和 NPC 對話挑戰四張數學地圖。</p>
        <form class="name-form" id="name-form">
          <input id="player-name" maxlength="16" placeholder="請輸入玩家姓名" value="${hasSave ? appState.progress.playerName : ""}">
          <button class="primary-button" type="submit">開始冒險</button>
        </form>
        ${hasSave ? `
          <div class="continue-row">
            <button class="secondary-button" id="continue-game">繼續 ${appState.progress.playerName} 的進度</button>
            <button class="danger-button" id="clear-save">清空進度、重新開始</button>
          </div>
        ` : ""}
      </section>
    </main>
  `;
  $("#name-form").addEventListener("submit", (event) => {
    event.preventDefault();
    startGame($("#player-name").value);
  });
  if (hasSave) {
    $("#continue-game").addEventListener("click", continueGame);
    $("#clear-save").addEventListener("click", clearProgress);
  }
}

function renderTopBar(title) {
  return `
    <header class="top-bar">
      <div>
        <h1>${title}</h1>
        <div class="task-meta">玩家：${appState.progress.playerName || "未登入"}</div>
      </div>
      <div class="top-actions">
        <button class="secondary-button" id="go-lobby">回到大廳</button>
        <button class="danger-button" id="reset-progress">清空進度、重新開始</button>
      </div>
    </header>
  `;
}

function bindTopBar() {
  const lobbyButton = $("#go-lobby");
  if (lobbyButton) lobbyButton.addEventListener("click", returnLobby);
  $("#reset-progress").addEventListener("click", clearProgress);
}

function renderLobby() {
  const completedCount = stages.filter((stage) => appState.progress.completedStages[stage.id]).length;
  $("#app").innerHTML = `
    <main class="screen lobby-screen">
      ${renderTopBar("數學思考 RPG 大廳")}
      <section class="lobby-layout">
        <div class="pixel-map" aria-label="RPG 大廳地圖">
          <div class="map-water water-left"></div>
          <div class="map-water water-right"></div>
          <div class="map-water water-bottom"></div>
          <div class="map-bridge bridge-main"></div>
          <div class="map-bridge bridge-side"></div>
          <div class="temple">
            <div class="temple-roof"></div>
            <div class="temple-body">
              <span>數學道場</span>
            </div>
          </div>
          <div class="stone-path path-main"></div>
          <div class="stone-path path-left"></div>
          <div class="stone-path path-right"></div>
          <div class="shrine shrine-a"></div>
          <div class="shrine shrine-b"></div>
          <div class="barrel"></div>
          <div class="tree tree-a"></div>
          <div class="tree tree-b"></div>
          <div class="tree tree-c"></div>
          <div class="tree tree-d"></div>
          <div class="tree tree-e"></div>
          <div class="tree tree-f"></div>
          <div class="leaf leaf-a"></div>
          <div class="leaf leaf-b"></div>
          <div class="leaf leaf-c"></div>
          <div class="map-road road-h"></div>
          <div class="map-road road-v"></div>
          <div class="player-sprite">你</div>
          ${stages.map((stage) => `
            <button class="npc-sprite npc-${stage.id} ${appState.progress.completedStages[stage.id] ? "done" : ""}" data-npc="${stage.id}" aria-label="${stage.title}">
              ${stage.symbol}
              <span class="npc-label">${stage.short}${appState.progress.completedStages[stage.id] ? "完成" : ""}</span>
            </button>
          `).join("")}
          <button class="npc-sprite npc-final" id="final-npc" aria-label="通關導師">
            師
            <span class="npc-label">通關導師</span>
          </button>
        </div>
        <aside>
          <section class="status-panel">
            <h2>冒險進度</h2>
            <p class="task-meta">完成 ${completedCount} / ${stages.length} 張挑戰地圖。</p>
            <div class="progress-list">
              ${stages.map((stage) => `
                <div class="progress-item">
                  <strong>${stage.title}</strong>
                  <span class="badge ${appState.progress.completedStages[stage.id] ? "done" : ""}">
                    ${appState.progress.completedStages[stage.id] ? "完成" : "未完成"}
                  </span>
                </div>
              `).join("")}
            </div>
          </section>
          <section class="dialog-panel" id="lobby-dialog">
            ${renderLobbyDialog()}
          </section>
        </aside>
      </section>
    </main>
  `;
  bindTopBar();
  $("#go-lobby").style.display = "none";
  stages.forEach((stage) => {
    document.querySelector(`[data-npc="${stage.id}"]`).addEventListener("click", () => {
      appState.selectedNpc = stage;
      renderLobby();
    });
  });
  const enterStage = $("#enter-stage");
  if (enterStage && appState.selectedNpc?.id) {
    enterStage.addEventListener("click", () => openStage(appState.selectedNpc.id));
  }
  $("#final-npc").addEventListener("click", tryFinishGame);
}

function renderLobbyDialog() {
  if (appState.selectedNpc?.final) {
    return `
      <h2>${appState.selectedNpc.name}</h2>
      <p>${appState.selectedNpc.text}</p>
    `;
  }
  if (appState.selectedNpc) {
    const stage = appState.selectedNpc;
    return `
      <h2>${stage.npc}</h2>
      <p>${stage.intro}</p>
      <p><strong>線索：</strong>${stage.hint}</p>
      <div class="dialog-actions">
        <button class="primary-button" id="enter-stage">進入 ${stage.title}</button>
      </div>
    `;
  }
  return `
    <h2>大廳導師</h2>
    <p>歡迎，${appState.progress.playerName || "勇者"}。點選地圖上的人物，先聽任務說明，再進入不同挑戰地圖。</p>
    <p>完成四張地圖後，回來找我對話就能通關。</p>
  `;
}

function renderStage() {
  const stage = stages.find((item) => item.id === appState.activeStage);
  $("#app").innerHTML = `
    <main class="screen stage-screen">
      ${renderTopBar(stage.title)}
      <section class="npc-row">
        <div class="npc-card">
          <strong>${stage.npc}</strong>
          <p>${stage.intro}</p>
        </div>
        <div class="npc-card">
          <strong>策略提示</strong>
          <p>${stage.hint}</p>
        </div>
      </section>
      <section id="stage-content"></section>
    </main>
  `;
  bindTopBar();
  if (stage.id === "schedule") renderScheduleStage();
  if (stage.id === "hourglass") renderHourglassStage();
  if (stage.id === "bus") renderBusStage();
  if (stage.id === "guard") renderGuardStage();
}

function analyzeSchedule() {
  const taskDetails = scheduleState.map((item) => {
    const task = chores[item.id];
    return { ...item, ...task, endTime: item.startTime + task.duration };
  });
  const totalTime = taskDetails.reduce((max, task) => Math.max(max, task.endTime), 0);
  const errors = [];
  const manualTasks = taskDetails.filter((task) => task.type === "manual").sort((a, b) => a.startTime - b.startTime);
  for (let index = 0; index < manualTasks.length - 1; index += 1) {
    const current = manualTasks[index];
    const next = manualTasks[index + 1];
    if (current.endTime > next.startTime) {
      errors.push({ id: next.id, msg: `小佑同時在做「${current.name}」與「${next.name}」。` });
    }
  }
  taskDetails.forEach((task) => {
    if (!task.dep) return;
    const depTask = taskDetails.find((candidate) => candidate.id === task.dep);
    if (!depTask) errors.push({ id: task.id, msg: `必須先安排「${chores[task.dep].name}」。` });
    else if (depTask.endTime > task.startTime) errors.push({ id: task.id, msg: `順序錯誤：「${task.name}」需等「${depTask.name}」完成。` });
  });
  const allDone = Object.keys(chores).every((id) => scheduleState.some((item) => item.id === id));
  return { taskDetails, totalTime, errors, allDone };
}

function renderScheduleStage() {
  const analysis = analyzeSchedule();
  $("#stage-content").innerHTML = `
    <div class="schedule-layout">
      <aside class="tool-card">
        <div class="section-title">任務銀行</div>
        <div class="task-list" id="task-bank"></div>
        <button class="secondary-button" id="schedule-reset">全部重設</button>
      </aside>
      <div class="stage-card">
        <h2>總時間：${analysis.totalTime} 分鐘</h2>
        <div class="chart-card">
          <div class="timeline"><span></span><div id="time-ruler" class="ruler"></div></div>
          <div id="gantt-chart"></div>
        </div>
        <div id="schedule-feedback" class="feedback-area"></div>
        <div class="tool-card" style="margin-top:12px">
          <div class="section-title">排程詳細調整</div>
          <div id="schedule-details" class="detail-grid"></div>
        </div>
      </div>
    </div>
  `;
  renderTaskBank();
  renderRuler();
  const chart = $("#gantt-chart");
  chart.appendChild(renderGanttLane("auto", "機器自動化", analysis.taskDetails, analysis.errors));
  chart.appendChild(renderGanttLane("manual", "小佑親自做", analysis.taskDetails, analysis.errors));
  renderScheduleFeedback(analysis);
  renderScheduleDetails(analysis);
  $("#schedule-reset").addEventListener("click", () => {
    scheduleState = [];
    appState.progress.attempts.schedule += 1;
    saveProgress();
    renderScheduleStage();
  });
}

function renderTaskBank() {
  const bank = $("#task-bank");
  bank.innerHTML = "";
  Object.values(chores).forEach((task) => {
    const active = scheduleState.some((item) => item.id === task.id);
    const button = document.createElement("button");
    button.className = "task-button";
    button.disabled = active;
    button.innerHTML = `
      <span><strong>${task.name}</strong><span class="task-meta">${task.type === "auto" ? "機器自動" : "親手執行"} · ${task.duration} 分鐘</span></span>
      <strong>${active ? "已加入" : "加入"}</strong>
    `;
    button.addEventListener("click", () => {
      addTask(task.id);
      renderScheduleStage();
    });
    bank.appendChild(button);
  });
}

function addTask(id) {
  if (scheduleState.some((item) => item.id === id)) return;
  const analysis = analyzeSchedule();
  let startTime = 0;
  if (chores[id].type === "manual") {
    const manualEnds = analysis.taskDetails.filter((task) => task.type === "manual").map((task) => task.endTime);
    startTime = manualEnds.length ? Math.max(...manualEnds) : 0;
  }
  scheduleState.push({ id, startTime });
}

function renderRuler() {
  const ruler = $("#time-ruler");
  for (let minute = 0; minute <= 80; minute += 10) {
    const mark = document.createElement("span");
    mark.className = "ruler-mark";
    mark.style.left = `${minute * timeScale}px`;
    mark.textContent = minute;
    ruler.appendChild(mark);
  }
}

function renderGanttLane(type, label, tasks, errors) {
  const lane = document.createElement("div");
  lane.className = "lane";
  lane.innerHTML = `<div class="lane-label">${label}</div><div class="lane-track"></div>`;
  const track = lane.querySelector(".lane-track");
  tasks.filter((task) => task.type === type).forEach((task, index) => {
    const hasError = errors.some((error) => error.id === task.id);
    const bar = document.createElement("div");
    bar.className = `bar ${task.color}${hasError ? " error" : ""}${type === "auto" && index % 2 ? " auto-second" : ""}`;
    bar.style.left = `${task.startTime * timeScale}px`;
    bar.style.width = `${task.duration * timeScale}px`;
    bar.textContent = `${task.name} ${task.duration}m`;
    track.appendChild(bar);
  });
  return lane;
}

function renderScheduleFeedback(analysis) {
  const feedback = $("#schedule-feedback");
  analysis.errors.forEach((error) => {
    feedback.insertAdjacentHTML("beforeend", `<div class="message error">${error.msg}</div>`);
  });
  if (analysis.allDone && analysis.errors.length === 0) {
    feedback.insertAdjacentHTML("beforeend", `
      <div class="message success">
        有效排程完成。你用 ${analysis.totalTime} 分鐘完成所有家事。
        <button class="small-button" id="complete-schedule">完成本關</button>
      </div>
    `);
    $("#complete-schedule").addEventListener("click", () => markStageComplete("schedule"));
  }
}

function renderScheduleDetails(analysis) {
  const details = $("#schedule-details");
  if (!analysis.taskDetails.length) {
    details.innerHTML = `<p class="empty-state">先從左側加入任務。</p>`;
    return;
  }
  analysis.taskDetails.forEach((task) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `
      <strong>${task.name}</strong>
      <label>開始 <input type="number" min="0" value="${task.startTime}" aria-label="${task.name}開始時間"></label>
      <button class="icon-button">移除</button>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      const item = scheduleState.find((candidate) => candidate.id === task.id);
      item.startTime = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
      renderScheduleStage();
    });
    row.querySelector("button").addEventListener("click", () => {
      scheduleState = scheduleState.filter((item) => item.id !== task.id);
      renderScheduleStage();
    });
    details.appendChild(row);
  });
}

function resetHourglassState() {
  window.clearInterval(hourglassTimer);
  hourglassState = { time: 0, aTop: 7, aBot: 0, bTop: 10, bBot: 0, isRunning: false, winLogged: false, log: ["系統已重置，準備開始。"] };
}

function renderHourglassStage() {
  $("#stage-content").innerHTML = `
    <div class="stage-card">
      <h2>總時間：<span id="global-time">${hourglassState.time}</span> 分鐘</h2>
      <div class="stage-tools">
        <button class="primary-button" id="btn-action">開始流動</button>
        <button class="secondary-button" id="btn-hourglass-reset">重新開始</button>
      </div>
      <div class="hourglass-layout" style="margin-top:16px">
        ${renderHourglassCard("a", "7 分鐘沙漏 A", 7)}
        ${renderHourglassCard("b", "10 分鐘沙漏 B", 10)}
        <aside class="tool-card">
          <div class="section-title">動作紀錄</div>
          <div class="log-box" id="log"></div>
        </aside>
      </div>
      <div id="hourglass-complete" class="feedback-area"></div>
    </div>
  `;
  bindHourglassControls();
  updateHourglassUI();
}

function renderHourglassCard(prefix, title) {
  return `
    <article class="hourglass-card">
      <h3>${title}</h3>
      <div class="glass">
        <div class="bulb top"><div class="sand" id="${prefix}-top-sand"></div><span id="${prefix}-top-text"></span></div>
        <div class="neck"></div>
        <div class="bulb bottom"><div class="sand" id="${prefix}-bot-sand"></div><span id="${prefix}-bot-text"></span></div>
      </div>
      <button class="primary-button" id="btn-flip-${prefix}">翻轉 ${prefix.toUpperCase()}</button>
    </article>
  `;
}

function bindHourglassControls() {
  $("#btn-action").addEventListener("click", startHourglass);
  $("#btn-hourglass-reset").addEventListener("click", () => {
    resetHourglassState();
    renderHourglassStage();
  });
  $("#btn-flip-a").addEventListener("click", () => flipHourglass("a"));
  $("#btn-flip-b").addEventListener("click", () => flipHourglass("b"));
}

function updateHourglassUI() {
  $("#global-time").textContent = hourglassState.time;
  $("#a-top-sand").style.height = `${(hourglassState.aTop / 7) * 100}%`;
  $("#a-bot-sand").style.height = `${(hourglassState.aBot / 7) * 100}%`;
  $("#b-top-sand").style.height = `${(hourglassState.bTop / 10) * 100}%`;
  $("#b-bot-sand").style.height = `${(hourglassState.bBot / 10) * 100}%`;
  $("#a-top-text").textContent = `${hourglassState.aTop} 分`;
  $("#a-bot-text").textContent = `${hourglassState.aBot} 分`;
  $("#b-top-text").textContent = `${hourglassState.bTop} 分`;
  $("#b-bot-text").textContent = `${hourglassState.bBot} 分`;
  $("#btn-action").disabled = hourglassState.isRunning || (hourglassState.aTop === 0 && hourglassState.bTop === 0);
  $("#btn-flip-a").disabled = hourglassState.isRunning;
  $("#btn-flip-b").disabled = hourglassState.isRunning;
  $("#log").innerHTML = hourglassState.log.map((message) => `<div class="log-entry">${message}</div>`).join("");
  if (hourglassState.time === 25 && !hourglassState.winLogged) {
    hourglassState.winLogged = true;
    hourglassState.log.unshift("成功量測到 25 分鐘。");
    $("#hourglass-complete").innerHTML = `<div class="message success">你成功量測 25 分鐘。<button class="small-button" id="complete-hourglass">完成本關</button></div>`;
    $("#complete-hourglass").addEventListener("click", () => markStageComplete("hourglass"));
  }
}

function startHourglass() {
  if (hourglassState.isRunning) return;
  if (hourglassState.aTop === 0 && hourglassState.bTop === 0) {
    hourglassState.log.unshift("兩個沙漏都空了，請先翻轉沙漏。");
    updateHourglassUI();
    return;
  }
  hourglassState.isRunning = true;
  hourglassState.log.unshift(`第 ${hourglassState.time} 分鐘：沙漏開始流動。`);
  updateHourglassUI();
  hourglassTimer = window.setInterval(tickHourglass, 500);
}

function pauseHourglass(reason) {
  window.clearInterval(hourglassTimer);
  hourglassState.isRunning = false;
  hourglassState.log.unshift(`第 ${hourglassState.time} 分鐘：${reason}`);
  updateHourglassUI();
}

function tickHourglass() {
  let aFlowed = false;
  let bFlowed = false;
  if (hourglassState.aTop > 0) {
    hourglassState.aTop -= 1;
    hourglassState.aBot += 1;
    aFlowed = true;
  }
  if (hourglassState.bTop > 0) {
    hourglassState.bTop -= 1;
    hourglassState.bBot += 1;
    bFlowed = true;
  }
  if (!aFlowed && !bFlowed) {
    pauseHourglass("沒有沙子在流動了。");
    return;
  }
  hourglassState.time += 1;
  const aDone = hourglassState.aTop === 0 && aFlowed;
  const bDone = hourglassState.bTop === 0 && bFlowed;
  updateHourglassUI();
  if (aDone && bDone) pauseHourglass("A 和 B 同時漏完，請決定下一步。");
  else if (aDone) pauseHourglass("7 分鐘沙漏 A 漏完，請決定下一步。");
  else if (bDone) pauseHourglass("10 分鐘沙漏 B 漏完，請決定下一步。");
}

function flipHourglass(which) {
  if (which === "a") [hourglassState.aTop, hourglassState.aBot] = [hourglassState.aBot, hourglassState.aTop];
  if (which === "b") [hourglassState.bTop, hourglassState.bBot] = [hourglassState.bBot, hourglassState.bTop];
  hourglassState.log.unshift(`第 ${hourglassState.time} 分鐘：翻轉沙漏 ${which.toUpperCase()}。`);
  updateHourglassUI();
}

function getBusStats() {
  const capacity = busState.large * busRules.largeCapacity + busState.medium * busRules.mediumCapacity;
  const cost = busState.large * busRules.largeCost + busState.medium * busRules.mediumCost;
  return { capacity, cost, empty: capacity - busRules.target, isValid: capacity >= busRules.target };
}

function evaluateBusCombination(large, medium, cost, empty) {
  if (large === 2 && medium === 3) return { tag: "最佳解", desc: "剛好 155 人沒有空位，也是最低成本方案。", tone: "best", isBest: true };
  if (large === 4 && medium === 0) return { tag: "陷阱解", desc: "全用大車很直覺，但花費偏高。", tone: "warning" };
  if (large === 3 && medium === 2) return { tag: "高成本", desc: "座位足夠，但花費太高。", tone: "bad" };
  if (empty > 20) return { tag: "空位多", desc: "可出發，但空位偏多。", tone: "warning" };
  return { tag: "可行", desc: "能出發，請再比較是否能更省。", tone: "normal" };
}

function renderBusStage() {
  const stats = getBusStats();
  $("#stage-content").innerHTML = `
    <div class="bus-layout">
      <section class="tool-card">
        <div class="section-title">調度指揮所</div>
        ${renderBusControl("large", "大客車", "40 人 · 9,000 元", busState.large)}
        ${renderBusControl("medium", "中型巴士", "25 人 · 5,000 元", busState.medium)}
        <div class="bus-preview">
          <div><span>總座位數</span><strong id="bus-capacity">${stats.capacity} / 155</strong></div>
          <div><span>剩餘空位</span><strong>${stats.empty < 0 ? `不足 ${Math.abs(stats.empty)} 個` : `${stats.empty} 個`}</strong></div>
          <div><span>預估總花費</span><strong id="bus-cost">$${stats.cost.toLocaleString("en-US")}</strong></div>
        </div>
        <div class="seat-meter"><span style="width:${Math.min(100, Math.round(stats.capacity / 155 * 100))}%"></span></div>
        <button class="primary-button" id="bus-dispatch">${stats.isValid ? "確認方案並記錄" : "座位不足，無法出發"}</button>
      </section>
      <section class="report-card">
        <h2>方案分析戰報</h2>
        <div class="bus-table-wrap">
          <table class="bus-table">
            <thead><tr><th>組合</th><th>座位</th><th>花費</th><th>評價</th></tr></thead>
            <tbody id="bus-history"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;
  document.querySelectorAll("[data-bus-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const [kind, delta] = button.dataset.busStep.split(":");
      busState[kind] = Math.max(0, busState[kind] + Number.parseInt(delta, 10));
      renderBusStage();
    });
  });
  $("#bus-dispatch").addEventListener("click", dispatchBusPlan);
  renderBusHistory();
}

function renderBusControl(kind, label, meta, count) {
  return `
    <div class="bus-control">
      <div><strong>${label}</strong><span class="task-meta">${meta}</span></div>
      <div class="stepper">
        <button class="step-button" data-bus-step="${kind}:-1">-</button>
        <output>${count}</output>
        <button class="step-button add" data-bus-step="${kind}:1">+</button>
      </div>
    </div>
  `;
}

function dispatchBusPlan() {
  const stats = getBusStats();
  if (!stats.isValid) {
    showToast("座位不足，這樣有人無法出發。", "error");
    return;
  }
  if (busState.history.some((record) => record.large === busState.large && record.medium === busState.medium)) {
    showToast("這個方案已經記錄過了。", "error");
    return;
  }
  const evaluation = evaluateBusCombination(busState.large, busState.medium, stats.cost, stats.empty);
  const record = { id: Date.now(), large: busState.large, medium: busState.medium, ...stats, evaluation };
  busState.history.unshift(record);
  appState.progress.attempts.bus = busState.history;
  saveProgress();
  if (evaluation.isBest) markStageComplete("bus");
  else showToast("方案已記錄，繼續找更划算的組合。");
  renderBusStage();
}

function renderBusHistory() {
  const body = $("#bus-history");
  if (!busState.history.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">尚未有任何調度紀錄。</td></tr>`;
    return;
  }
  const lowest = Math.min(...busState.history.map((record) => record.cost));
  body.innerHTML = busState.history.map((record) => `
    <tr class="${record.evaluation.isBest ? "best-row" : ""}">
      <td><strong>${record.large} 大 + ${record.medium} 中</strong></td>
      <td>${record.capacity} <span class="task-meta">(${record.empty > 0 ? `+${record.empty}` : "0"})</span></td>
      <td><strong>${record.cost === lowest ? "★ " : ""}$${record.cost.toLocaleString("en-US")}</strong></td>
      <td><span class="tag ${record.evaluation.tone}">${record.evaluation.tag}</span><span class="task-meta">${record.evaluation.desc}</span></td>
    </tr>
  `).join("");
}

function renderGuardStage() {
  $("#stage-content").innerHTML = `
    <div class="guard-layout">
      <section class="tool-card">
        <h2>警衛雅克的鑰匙規則</h2>
        <p class="task-meta">已知房名與鑰匙標籤如下。請反推每個字母對應哪個數字。</p>
        <div class="key-bank">
          ${guardKnown.map((item) => `<div class="known-key"><span>${item.word}</span><strong>${item.value}</strong></div>`).join("")}
        </div>
      </section>
      <section class="stage-card">
        <h2>字母轉數字工具</h2>
        <div class="mapping-grid">
          ${["A", "B", "E", "R"].map((letter) => renderMappingCard(letter)).join("")}
        </div>
        <div class="tool-card" style="margin-top:12px">
          <div class="section-title">即時轉換</div>
          <div class="word-preview" id="word-preview"></div>
        </div>
        <div class="answer-row">
          <input id="guard-answer" inputmode="numeric" maxlength="3" placeholder="輸入 RAB 的鑰匙標籤" value="${guardState.answer}">
          <button class="primary-button" id="guard-submit">提交答案</button>
        </div>
        <div id="guard-feedback" class="feedback-area"></div>
      </section>
    </div>
  `;
  document.querySelectorAll("[data-guard-letter]").forEach((select) => {
    select.addEventListener("change", () => {
      guardState.map[select.dataset.guardLetter] = select.value;
      renderGuardPreview();
    });
  });
  $("#guard-answer").addEventListener("input", (event) => {
    guardState.answer = event.target.value.replace(/\D/g, "").slice(0, 3);
    event.target.value = guardState.answer;
  });
  $("#guard-submit").addEventListener("click", submitGuardAnswer);
  renderGuardPreview();
}

function renderMappingCard(letter) {
  return `
    <div class="mapping-card">
      <label>${letter}</label>
      <select data-guard-letter="${letter}">
        <option value="">?</option>
        ${Array.from({ length: 10 }, (_, number) => `<option value="${number}" ${guardState.map[letter] === String(number) ? "selected" : ""}>${number}</option>`).join("")}
      </select>
    </div>
  `;
}

function convertWord(word) {
  return word.split("").map((letter) => guardState.map[letter] || "?").join("");
}

function renderGuardPreview() {
  $("#word-preview").innerHTML = guardWords.map((word) => {
    const value = convertWord(word);
    const known = guardKnown.find((item) => item.word === word);
    const match = known && known.value === value;
    return `<div class="word-row ${match ? "match" : ""}"><strong>${word}</strong><span>${value}${known ? ` / 已知 ${known.value}` : " / 遺失"}</span></div>`;
  }).join("");
}

function submitGuardAnswer() {
  const mappedAnswer = convertWord("RAB");
  const correctByMap = guardState.map.A === "9" && guardState.map.B === "6" && guardState.map.E === "3" && guardState.map.R === "4";
  const typedAnswer = guardState.answer.trim();
  const correct = typedAnswer ? typedAnswer === "496" : correctByMap && mappedAnswer === "496";
  appState.progress.attempts.guard.push({ answer: typedAnswer || mappedAnswer, at: Date.now() });
  saveProgress();
  if (correct) {
    $("#guard-feedback").innerHTML = `<div class="message success">正確。RAB 轉成 496，警衛雅克找回遺失鑰匙。<button class="small-button" id="complete-guard">完成本關</button></div>`;
    $("#complete-guard").addEventListener("click", () => markStageComplete("guard"));
    return;
  }
  guardState.mistakes += 1;
  const hint = guardState.mistakes < 2
    ? "先觀察 BEB 和 636：同一個字母出現在第 1、3 位，對應的數字也應該一樣。"
    : "再比較 AER 和 EAB：相同字母換位置時，數字也會跟著移到同一個位置。請依 R、A、B 的順序重新檢查。";
  $("#guard-feedback").innerHTML = `<div class="message error">還不對。${hint}</div>`;
}

function renderEnding() {
  $("#app").innerHTML = `
    <main class="screen ending-screen">
      <section class="ending-card">
        <h1>通關完成</h1>
        <p class="subtitle">${appState.progress.playerName} 完成了四張數學思考地圖，取得推理勇者徽章。</p>
        <div class="progress-list">
          ${stages.map((stage) => `<div class="progress-item"><strong>${stage.title}</strong><span class="badge done">完成</span></div>`).join("")}
        </div>
        <div class="continue-row">
          <button class="secondary-button" id="ending-lobby">回大廳</button>
          <button class="danger-button" id="ending-reset">清空進度、重新開始</button>
        </div>
      </section>
    </main>
  `;
  $("#ending-lobby").addEventListener("click", () => {
    appState.screen = "lobby";
    renderApp();
  });
  $("#ending-reset").addEventListener("click", clearProgress);
}

renderApp();
