const chores = {
  A: { id: "A", name: "洗衣服", duration: 40, type: "auto", icon: "洗", color: "blue", dep: null },
  B: { id: "B", name: "晾衣服", duration: 10, type: "manual", icon: "晾", color: "orange", dep: "A" },
  C: { id: "C", name: "燒開水", duration: 15, type: "auto", icon: "水", color: "cyan", dep: null },
  D: { id: "D", name: "掃地", duration: 10, type: "manual", icon: "掃", color: "amber", dep: null },
  E: { id: "E", name: "拖地", duration: 15, type: "manual", icon: "拖", color: "yellow", dep: "D" },
  F: { id: "F", name: "洗碗", duration: 15, type: "manual", icon: "碗", color: "green", dep: null },
  G: { id: "G", name: "擦桌子", duration: 10, type: "manual", icon: "擦", color: "lime", dep: null },
  H: { id: "H", name: "倒垃圾", duration: 10, type: "manual", icon: "倒", color: "slate", dep: null }
};

const scheduleState = [];
const timeScale = 10;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function switchGame(game) {
  $$(".tab-button").forEach((button) => button.classList.toggle("active", button.dataset.game === game));
  $("#schedule-game").classList.toggle("active", game === "schedule");
  $("#hourglass-game").classList.toggle("active", game === "hourglass");
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
    if (!depTask) {
      errors.push({ id: task.id, msg: `必須先安排「${chores[task.dep].name}」。` });
    } else if (depTask.endTime > task.startTime) {
      errors.push({ id: task.id, msg: `順序錯誤：「${task.name}」需等「${depTask.name}」完成。` });
    }
  });

  const allDone = Object.keys(chores).every((id) => scheduleState.some((item) => item.id === id));
  return { taskDetails, totalTime, errors, allDone };
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
      <span class="task-main">
        <span class="task-icon">${task.icon}</span>
        <span><strong>${task.name}</strong><span class="task-meta">${task.type === "auto" ? "機器自動" : "親手執行"} · ${task.duration} 分鐘</span></span>
      </span>
      <strong>${active ? "已加入" : "加入"}</strong>
    `;
    button.addEventListener("click", () => addTask(task.id));
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
  renderSchedule();
}

function updateStart(id, value) {
  const task = scheduleState.find((item) => item.id === id);
  if (!task) return;
  task.startTime = Math.max(0, Number.parseInt(value, 10) || 0);
  renderSchedule();
}

function removeTask(id) {
  const index = scheduleState.findIndex((item) => item.id === id);
  if (index >= 0) scheduleState.splice(index, 1);
  renderSchedule();
}

function renderRuler() {
  const ruler = $("#time-ruler");
  ruler.innerHTML = "";
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
    bar.textContent = `${task.icon} ${task.name} ${task.duration}m`;
    track.appendChild(bar);
  });

  return lane;
}

function renderSchedule() {
  const analysis = analyzeSchedule();
  $("#schedule-total").textContent = analysis.totalTime;
  $("#schedule-total").style.color = analysis.totalTime > 70 ? "#fde68a" : "#bbf7d0";

  renderTaskBank();
  renderRuler();

  const chart = $("#gantt-chart");
  chart.innerHTML = "";
  chart.appendChild(renderGanttLane("auto", "機器自動化", analysis.taskDetails, analysis.errors));
  chart.appendChild(renderGanttLane("manual", "小佑親自做", analysis.taskDetails, analysis.errors));

  const feedback = $("#schedule-feedback");
  feedback.innerHTML = "";
  analysis.errors.forEach((error) => {
    const item = document.createElement("div");
    item.className = "message error";
    item.textContent = error.msg;
    feedback.appendChild(item);
  });
  if (analysis.allDone && analysis.errors.length === 0) {
    const item = document.createElement("div");
    item.className = "message success";
    item.textContent = `完成！你成功在 ${analysis.totalTime} 分鐘內完成所有家事。${analysis.totalTime === 70 ? "這是最優解。" : "還可以再挑戰更短的排程。"}`;
    feedback.appendChild(item);
  }

  const details = $("#schedule-details");
  if (!analysis.taskDetails.length) {
    details.className = "detail-grid empty-state";
    details.textContent = "先從左側加入任務。";
    return;
  }

  details.className = "detail-grid";
  details.innerHTML = "";
  analysis.taskDetails.forEach((task) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `
      <strong>${task.icon} ${task.name}</strong>
      <label>開始 <input type="number" min="0" value="${task.startTime}" aria-label="${task.name}開始時間"></label>
      <button class="icon-button" aria-label="移除${task.name}">刪</button>
    `;
    row.querySelector("input").addEventListener("change", (event) => updateStart(task.id, event.target.value));
    row.querySelector("button").addEventListener("click", () => removeTask(task.id));
    details.appendChild(row);
  });
}

let time = 0;
const maxA = 7;
const maxB = 10;
let aTop = 7;
let aBot = 0;
let bTop = 10;
let bBot = 0;
let timerId = null;
let isRunning = false;
let winLogged = false;

function updateHourglassUI() {
  $("#global-time").textContent = time;
  $("#a-top-sand").style.height = `${(aTop / maxA) * 100}%`;
  $("#a-bot-sand").style.height = `${(aBot / maxA) * 100}%`;
  $("#a-top-text").textContent = `${aTop} 分`;
  $("#a-bot-text").textContent = `${aBot} 分`;
  $("#b-top-sand").style.height = `${(bTop / maxB) * 100}%`;
  $("#b-bot-sand").style.height = `${(bBot / maxB) * 100}%`;
  $("#b-top-text").textContent = `${bTop} 分`;
  $("#b-bot-text").textContent = `${bBot} 分`;
  $("#btn-action").disabled = isRunning || (aTop === 0 && bTop === 0);
  $("#btn-flip-a").disabled = isRunning;
  $("#btn-flip-b").disabled = isRunning;

  if (time === 25 && !winLogged) {
    logMessage("<span class='highlight'>成功量測到 25 分鐘！</span>");
    winLogged = true;
  }
}

function logMessage(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<strong>第 ${time} 分鐘</strong> ${message}`;
  $("#log").prepend(entry);
}

function startTimer() {
  if (isRunning) return;
  if (aTop === 0 && bTop === 0) {
    logMessage("兩個沙漏都空了，請先翻轉沙漏。");
    return;
  }
  isRunning = true;
  logMessage("沙漏開始流動。");
  updateHourglassUI();
  timerId = window.setInterval(tick, 500);
}

function pauseTimer(reason) {
  window.clearInterval(timerId);
  isRunning = false;
  logMessage(`自動暫停：${reason}`);
  updateHourglassUI();
}

function tick() {
  let aFlowed = false;
  let bFlowed = false;

  if (aTop > 0) {
    aTop -= 1;
    aBot += 1;
    aFlowed = true;
  }
  if (bTop > 0) {
    bTop -= 1;
    bBot += 1;
    bFlowed = true;
  }

  if (!aFlowed && !bFlowed) {
    pauseTimer("沒有沙子在流動了。");
    return;
  }

  time += 1;
  updateHourglassUI();
  const aJustFinished = aTop === 0 && aFlowed;
  const bJustFinished = bTop === 0 && bFlowed;

  if (aJustFinished && bJustFinished) pauseTimer("<span class='highlight'>A 和 B 同時漏完，請決定下一步。</span>");
  else if (aJustFinished) pauseTimer("<span class='highlight'>7 分鐘沙漏 A 漏完，請決定下一步。</span>");
  else if (bJustFinished) pauseTimer("<span class='highlight'>10 分鐘沙漏 B 漏完，請決定下一步。</span>");
}

function flipA() {
  [aTop, aBot] = [aBot, aTop];
  logMessage("翻轉了 7 分鐘沙漏 A。");
  updateHourglassUI();
}

function flipB() {
  [bTop, bBot] = [bBot, bTop];
  logMessage("翻轉了 10 分鐘沙漏 B。");
  updateHourglassUI();
}

function resetHourglass() {
  time = 0;
  aTop = 7;
  aBot = 0;
  bTop = 10;
  bBot = 0;
  window.clearInterval(timerId);
  isRunning = false;
  winLogged = false;
  $("#log").innerHTML = "";
  logMessage("系統已重置，準備開始。");
  updateHourglassUI();
}

function boot() {
  $$(".tab-button").forEach((button) => button.addEventListener("click", () => switchGame(button.dataset.game)));
  $("#schedule-reset").addEventListener("click", () => {
    scheduleState.splice(0, scheduleState.length);
    renderSchedule();
  });
  $("#btn-action").addEventListener("click", startTimer);
  $("#btn-hourglass-reset").addEventListener("click", resetHourglass);
  $("#btn-flip-a").addEventListener("click", flipA);
  $("#btn-flip-b").addEventListener("click", flipB);
  renderSchedule();
  resetHourglass();
}

boot();
