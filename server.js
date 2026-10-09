// URL base da API: local usa o mesmo host; em produção (domínio próprio) aponta para o Render
const LIVE_API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? window.location.origin
  : "https://empireads-dash.onrender.com";

// Alterna o período ativo (Hoje / 7 dias / Personalizado)
const periodToggle = document.getElementById("periodToggle");
const rangePopover = document.getElementById("rangePopover");
const rangeStart = document.getElementById("rangeStart");
const rangeEnd = document.getElementById("rangeEnd");
const rangeApply = document.getElementById("rangeApply");
const personalizadoBtn = periodToggle.querySelector('[data-period="personalizado"]');
const calendarDays = document.getElementById("calendarDays");
const calendarMonthLabel = document.getElementById("calendarMonth");
const calendarSelection = document.getElementById("rangeSelection");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderRangeCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = localDateString(new Date());
  const monthName = calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  calendarMonthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  calendarPrev.disabled = year === 2000 && month === 0;
  calendarNext.disabled = year === new Date().getFullYear() && month === new Date().getMonth();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push('<span class="calendar-empty"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const value = localDateString(new Date(year, month, day, 12));
    const isStart = value === rangeStart.value;
    const isEnd = value === rangeEnd.value;
    const inRange = rangeStart.value && rangeEnd.value && value > rangeStart.value && value < rangeEnd.value;
    const classNames = ["calendar-day", isStart ? "range-start" : "", isEnd ? "range-end" : "", inRange ? "in-range" : ""]
      .filter(Boolean).join(" ");
    cells.push(`<button type="button" class="${classNames}" data-calendar-date="${value}" ${value > today ? "disabled" : ""}>${day}</button>`);
  }
  calendarDays.innerHTML = cells.join("");

  if (!rangeStart.value) calendarSelection.textContent = "Selecione a data inicial";
  else if (!rangeEnd.value) calendarSelection.textContent = `Início: ${new Date(`${rangeStart.value}T12:00:00`).toLocaleDateString("pt-BR")} · agora selecione o fim`;
  else calendarSelection.textContent = `${new Date(`${rangeStart.value}T12:00:00`).toLocaleDateString("pt-BR")} – ${new Date(`${rangeEnd.value}T12:00:00`).toLocaleDateString("pt-BR")}`;
}

periodToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".period-btn");
  if (!btn) return;
  periodToggle.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  if (btn.dataset.period === "personalizado") {
    rangePopover.classList.toggle("open");
    if (rangePopover.classList.contains("open")) renderRangeCalendar();
  } else {
    rangePopover.classList.remove("open");
  }
});

rangeApply.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!rangeStart.value || !rangeEnd.value || rangeStart.value > rangeEnd.value) {
    rangeApply.textContent = "Escolha as duas datas";
    window.setTimeout(() => { rangeApply.textContent = "Aplicar período"; }, 1800);
    return;
  }
  const start = new Date(`${rangeStart.value}T12:00:00`).toLocaleDateString("pt-BR");
  const end = new Date(`${rangeEnd.value}T12:00:00`).toLocaleDateString("pt-BR");
  personalizadoBtn.textContent = `${start} — ${end}`;
  rangePopover.classList.remove("open");
});

rangePopover.addEventListener("click", (e) => e.stopPropagation());

calendarPrev.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1, 12);
  renderRangeCalendar();
});

calendarNext.addEventListener("click", () => {
  const now = new Date();
  if (calendarMonth.getFullYear() === now.getFullYear() && calendarMonth.getMonth() === now.getMonth()) return;
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12);
  renderRangeCalendar();
});

calendarDays.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-calendar-date]");
  if (!dayButton) return;
  const selectedDate = dayButton.dataset.calendarDate;
  if (!rangeStart.value || rangeEnd.value || selectedDate < rangeStart.value) {
    rangeStart.value = selectedDate;
    rangeEnd.value = "";
  } else {
    rangeEnd.value = selectedDate;
  }
  renderRangeCalendar();
});

rangePopover.querySelectorAll("[data-range-days]").forEach((button) => {
  button.addEventListener("click", () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Number(button.dataset.rangeDays) + 1);
    rangeStart.value = localDateString(start);
    rangeEnd.value = localDateString(end);
    personalizadoBtn.classList.add("active");
    periodToggle.querySelectorAll(".period-btn").forEach((item) => {
      if (item !== personalizadoBtn) item.classList.remove("active");
    });
    personalizadoBtn.textContent = `Últimos ${button.dataset.rangeDays} dias`;
    rangePopover.classList.remove("open");
    loadLiveMetrics();
  });
});

document.addEventListener("click", (e) => {
  if (!periodToggle.contains(e.target)) rangePopover.classList.remove("open");
});

// Alterna entre tema escuro e claro
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
  themeToggle.textContent = isLight ? "🌙" : "☀️";
});

// Abre/fecha o menu suspenso e fecha ao clicar fora
const menuToggle = document.getElementById("menuToggle");
const menuDropdown = document.getElementById("menuDropdown");
menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle("open");
});
document.addEventListener("click", () => menuDropdown.classList.remove("open"));
menuDropdown.addEventListener("click", (e) => e.stopPropagation());

// Ordena a tabela ao clicar nos cabeçalhos das colunas
const table = document.querySelector(".perf-table");
const tbody = table.querySelector("tbody");
let sortState = { col: null, asc: true };

function parseCellValue(cell, type) {
  if (type === "text") return cell.textContent.trim().toLowerCase();
  const match = cell.textContent.replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

table.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", (e) => {
    if (e.target.closest(".hide-toggle")) return;
    const col = Number(th.dataset.col);
    const type = th.dataset.type;
    const asc = sortState.col === col ? !sortState.asc : true;
    sortState = { col, asc };

    table.querySelectorAll("th.sortable .sort").forEach((s) => (s.textContent = "↓"));
    const arrow = th.querySelector(".sort");
    if (arrow) arrow.textContent = asc ? "↑" : "↓";

    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.sort((a, b) => {
      const va = parseCellValue(a.children[col], type);
      const vb = parseCellValue(b.children[col], type);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    rows.forEach((row) => tbody.appendChild(row));
  });
});

// Oculta/exibe os valores das colunas "Visita ao perfil" e "Custo p/ visita"
table.querySelectorAll(".hide-toggle").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const col = Number(btn.dataset.hideCol);
    const isHidden = btn.classList.toggle("active");
    tbody.querySelectorAll("tr").forEach((row) => {
      row.children[col].classList.toggle("col-hidden", isHidden);
    });
  });
});

// Ações do menu (apenas feedback visual por enquanto)
menuDropdown.querySelectorAll("button[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    menuDropdown.classList.remove("open");
  });
});

// ---------- MODAL DE DETALHES DO CLIENTE ----------
const CLIENT_DETAILS = {
  "Pantera Jandira": { responsavel: "Camila Souza", status: "Ativo", plano: "Starter", contato: "(11) 98888-0001" },
  "Nati Tattoo": { responsavel: "Diego Alves", status: "Ativo", plano: "Starter", contato: "(11) 98888-0002" },
  "Mundo dos iPhones": { responsavel: "Bruna Lima", status: "Ativo", plano: "Enterprise", contato: "(11) 98888-0003" },
  "Luana Leopoldo": { responsavel: "Camila Souza", status: "Ativo", plano: "Starter", contato: "(11) 98888-0004" },
  "Dra. Naty Rocha": { responsavel: "Diego Alves", status: "Ativo", plano: "Pro", contato: "(11) 98888-0005" },
  "Ge Eletrônicos Matriz": { responsavel: "Bruna Lima", status: "Ativo", plano: "Pro", contato: "(11) 98888-0006" },
  "Black Jack": { responsavel: "Rafael Nunes", status: "Ativo", plano: "Enterprise", contato: "(11) 98888-0007" },
  "Electro Imports SP": { responsavel: "Rafael Nunes", status: "Ativo", plano: "Pro", contato: "(11) 98888-0008" },
  "Lana Leão": { responsavel: "Camila Souza", status: "Ativo", plano: "Starter", contato: "(11) 98888-0009" },
  "Dra. Jessica Amaral (CM)": { responsavel: "Diego Alves", status: "Ativo", plano: "Pro", contato: "(11) 98888-0010" },
  "ISAFE": { responsavel: "Bruna Lima", status: "Ativo", plano: "Pro", contato: "(11) 98888-0011" },
  "Kiss Importados": { responsavel: "Rafael Nunes", status: "Ativo", plano: "Starter", contato: "(11) 98888-0012" },
  "Teknos": { responsavel: "Camila Souza", status: "Ativo", plano: "Starter", contato: "(11) 98888-0013" },
};

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// gera pesos pseudo-aleatórios determinísticos a partir do nome, para dividir o total em "count" partes
function seededWeights(name, count) {
  let seed = 0;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  const weights = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    weights.push(0.5 + (seed % 1000) / 1000);
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

function buildDailyBreakdown(name, totalGasto, totalMensagens) {
  const weights = seededWeights(name, 7);
  let restanteMsg = totalMensagens;
  const rows = weights.map((w, i) => {
    const isLast = i === weights.length - 1;
    const msg = isLast ? restanteMsg : Math.max(0, Math.round(totalMensagens * w));
    restanteMsg -= msg;
    const gasto = totalGasto * w;
    const custo = msg > 0 ? gasto / msg : 0;
    return { dia: WEEK_DAYS[i], msg, gasto, custo };
  });
  return rows;
}

// Gera séries ilustrativas para o gráfico de gastos em diferentes janelas de tempo
const CHART_RANGES = {
  "7d": { labels: WEEK_DAYS, multiplier: 1 },
  "1m": { labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"], multiplier: 4 },
  "3m": { labels: ["Mês 1", "Mês 2", "Mês 3"], multiplier: 12 },
  "7m": { labels: ["Mês 1", "Mês 2", "Mês 3", "Mês 4", "Mês 5", "Mês 6", "Mês 7"], multiplier: 28 },
};

const CHART_RANGE_LABELS = {
  "7d": "Últimos 7 dias",
  "1m": "Último mês",
  "3m": "Últimos 3 meses",
  "7m": "Últimos 7 meses",
};

function buildChartSeries(name, totalGasto, rangeKey, dailyRows) {
  const config = CHART_RANGES[rangeKey];

  // "7 dias" usa os valores reais já calculados para a tabela de desempenho diário
  if (rangeKey === "7d" && dailyRows) {
    return { labels: dailyRows.map((d) => d.dia), values: dailyRows.map((d) => d.gasto) };
  }

  const weights = seededWeights(name + rangeKey, config.labels.length);
  const total = totalGasto * config.multiplier;
  const values = weights.map((w) => total * w);
  return { labels: config.labels, values };
}

function formatCompactBRL(value) {
  if (value >= 1000) return "R$" + (value / 1000).toFixed(1).replace(".", ",") + "k";
  return "R$" + value.toFixed(0);
}

function drawBarChart(canvas, labels, values, width, height, theme) {
  const cssWidth = width || canvas.clientWidth;
  const cssHeight = height || canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const isLight = theme === "light";
  const colors = isLight
    ? { bg: "#ffffff", grid: "rgba(0,0,0,0.12)", barTop: "#f5c518", barBottom: "#e7a900", value: "#111111", label: "#444444" }
    : { bg: null, grid: "rgba(255,255,255,0.12)", barTop: "#ffcf24", barBottom: "#df9f00", value: "#f3f3f4", label: "#a1a2a6" };

  if (colors.bg) {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  const max = Math.max(...values, 1);
  const paddingTop = 32;
  const paddingBottom = 28;
  const paddingSide = 16;
  const chartW = cssWidth - paddingSide * 2;
  const chartH = cssHeight - paddingTop - paddingBottom;
  const gap = values.length >= 7 ? 10 : 16;
  const barWidth = Math.max(12, (chartW - gap * (values.length - 1)) / values.length);
  const barsWidth = barWidth * values.length + gap * (values.length - 1);
  const startX = paddingSide + Math.max(0, (chartW - barsWidth) / 2);

  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  ctx.moveTo(paddingSide, cssHeight - paddingBottom);
  ctx.lineTo(cssWidth - paddingSide, cssHeight - paddingBottom);
  ctx.stroke();

  values.forEach((value, index) => {
    const barHeight = Math.max(2, (value / max) * chartH);
    const x = startX + index * (barWidth + gap);
    const y = cssHeight - paddingBottom - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, cssHeight - paddingBottom);
    gradient.addColorStop(0, colors.barTop);
    gradient.addColorStop(1, colors.barBottom);
    ctx.fillStyle = gradient;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.fillStyle = colors.value;
    ctx.font = "600 11px Rubik, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatCompactBRL(value), x + barWidth / 2, Math.max(13, y - 8));

    ctx.fillStyle = colors.label;
    ctx.font = "11px Rubik, sans-serif";
    ctx.fillText(labels[index], x + barWidth / 2, cssHeight - paddingBottom + 18);
  });
}

function renderChartToDataURL(labels, values) {
  const canvas = document.createElement("canvas");
  drawBarChart(canvas, labels, values, 640, 260, "light");
  return canvas.toDataURL("image/png");
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(date) {
  return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ---------- Comentários via API (banco de dados no servidor) ----------
// Cache local por cliente; o dado oficial vem do servidor.
const commentsCache = {};

async function getClientComments(name) {
  try {
    const response = await fetch(`${LIVE_API_BASE}/api/comments?client=${encodeURIComponent(name)}`, { credentials: "include" });
    if (!response.ok) throw new Error("fetch failed");
    const { data } = await response.json();
    commentsCache[name] = data || [];
  } catch (err) {
    if (!commentsCache[name]) commentsCache[name] = [];
  }
  return commentsCache[name];
}

async function addClientComment(name, author, text) {
  try {
    const response = await fetch(`${LIVE_API_BASE}/api/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client: name, author: author || "Anônimo", text }),
    });
    if (!response.ok) throw new Error("post failed");
    const { data } = await response.json();
    commentsCache[name] = data || [];
  } catch (err) {
    const fallback = commentsCache[name] || [];
    fallback.push({ author: author || "Anônimo", text, date: new Date().toISOString() });
    commentsCache[name] = fallback;
  }
  return commentsCache[name];
}

const clientModal = document.getElementById("clientModal");
const modalClientName = document.getElementById("modalClientName");
const modalInfoGrid = document.getElementById("modalInfoGrid");
const modalSummary = document.getElementById("modalSummary");
const modalDailyBody = document.getElementById("modalDailyBody");
const modalClose = document.getElementById("modalClose");
const chartToggle = document.getElementById("chartToggle");
const chartBody = document.getElementById("chartBody");
const chartRangeSelect = document.getElementById("chartRange");
const generateChartBtn = document.getElementById("generateChartBtn");
const clientChartCanvas = document.getElementById("clientChart");
const exportClientBtn = document.getElementById("exportClientBtn");
const exportPopover = document.getElementById("exportPopover");
const exportRangeSelect = document.getElementById("exportRange");
const exportIncludeNotes = document.getElementById("exportIncludeNotes");
const commentsList = document.getElementById("commentsList");
const notesAuthor = document.getElementById("notesAuthor");
const clientNotes = document.getElementById("clientNotes");
const notesStatus = document.getElementById("notesStatus");
const saveNotesBtn = document.getElementById("saveNotesBtn");

let currentClient = null;

function renderClientChart() {
  if (!currentClient) return;
  const { name, gasto, dailyRows } = currentClient;
  const { labels, values } = buildChartSeries(name, gasto, chartRangeSelect.value, dailyRows);
  drawBarChart(clientChartCanvas, labels, values);
}

function renderComments(name) {
  const comments = commentsCache[name] || [];
  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="comments-empty">Nenhum comentário ainda. Seja o primeiro a anotar algo sobre este cliente.</p>';
    return;
  }
  commentsList.innerHTML = comments
    .map(
      (c) => `
    <div class="comment-item">
      <div class="comment-item-header">
        <span class="comment-author">${c.author}</span>
        <span class="comment-date">${formatDateTime(new Date(c.date))}</span>
      </div>
      <p class="comment-text">${c.text.replace(/</g, "&lt;")}</p>
    </div>`
    )
    .join("");
}

function openClientModal(row) {
  const cells = row.querySelectorAll("td");
  const name = cells[0].textContent.trim();
  const gasto = parseCellValue(cells[1], "number");
  const mensagens = parseCellValue(cells[2], "number");
  const custoMsg = parseCellValue(cells[3], "number");
  const visitas = parseCellValue(cells[4], "number");
  const custoVisita = parseCellValue(cells[5], "number");
  const novosLeads = Number(row.__metric?.new_leads || 0);
  const totalContatos = Number(row.__metric?.total_contacts || 0);
  const impressoes = Number(row.__metric?.impressions || 0);

  const details = CLIENT_DETAILS[name] || { responsavel: "—", status: "Ativo", plano: "—", contato: "—" };

  modalClientName.textContent = name;

  modalInfoGrid.innerHTML = `
    <div class="modal-info-card"><span class="info-label">Responsável</span><span class="info-value">${details.responsavel}</span></div>
    <div class="modal-info-card"><span class="info-label">Status</span><span class="info-value">${details.status}</span></div>
    <div class="modal-info-card"><span class="info-label">Plano</span><span class="info-value">${details.plano}</span></div>
    <div class="modal-info-card"><span class="info-label">Contato</span><span class="info-value">${details.contato}</span></div>
  `;

  modalSummary.innerHTML = `
    <div class="summary-card"><span class="info-label">Valor gasto</span><span class="summary-value">${formatBRL(gasto)}</span></div>
    <div class="summary-card"><span class="info-label">Mensagens</span><span class="summary-value">${mensagens}</span></div>
    <div class="summary-card"><span class="info-label">Custo p/ msg</span><span class="summary-value">${formatBRL(custoMsg)}</span></div>
    <div class="summary-card"><span class="info-label">Visitas</span><span class="summary-value">${visitas}</span></div>
    <div class="summary-card"><span class="info-label">Custo p/ visita</span><span class="summary-value">${formatBRL(custoVisita)}</span></div>
    <div class="summary-card"><span class="info-label">Novos leads</span><span class="summary-value">${novosLeads.toLocaleString("pt-BR")}</span></div>
    <div class="summary-card"><span class="info-label">Total de contatos</span><span class="summary-value">${totalContatos.toLocaleString("pt-BR")}</span></div>
    <div class="summary-card"><span class="info-label">Impressões</span><span class="summary-value">${impressoes.toLocaleString("pt-BR")}</span></div>
  `;

  const dailyRows = row.__metric?.daily?.length
    ? row.__metric.daily.map((day) => ({
        dia: new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        msg: day.conversations,
        gasto: day.spend,
        custo: day.cost_per_conversation,
      }))
    : buildDailyBreakdown(name, gasto, mensagens);
  modalDailyBody.innerHTML = dailyRows
    .map(
      (d) => `
    <tr>
      <td>${d.dia}</td>
      <td>${d.msg}</td>
      <td>${formatBRL(d.gasto)}</td>
      <td>${formatBRL(d.custo)}</td>
    </tr>`
    )
    .join("");

  currentClient = { name, gasto, mensagens, custoMsg, visitas, custoVisita, novosLeads, totalContatos, impressoes, dailyRows };

  // gráfico inicia recolhido; só é desenhado quando o usuário abrir o painel
  chartRangeSelect.value = "7d";
  chartBody.classList.remove("open");
  chartToggle.classList.remove("open");

  renderComments(name);
  getClientComments(name).then(() => renderComments(name)); // sincroniza com o banco
  notesAuthor.value = "";
  clientNotes.value = "";
  notesStatus.textContent = "";

  clientModal.classList.add("open");
}

// Clique no nome do cliente abre o pop-up com os detalhes
tbody.querySelectorAll(".col-name").forEach((cell) => {
  cell.title = "Clique para ver detalhes";
});

tbody.addEventListener("click", (e) => {
  const nameCell = e.target.closest(".col-name");
  if (!nameCell) return;
  openClientModal(nameCell.closest("tr"));
});

// Painel do gráfico recolhido por padrão, abre apenas ao clicar
chartToggle.addEventListener("click", () => {
  const isOpen = chartBody.classList.toggle("open");
  chartToggle.classList.toggle("open", isOpen);
  if (isOpen) renderClientChart();
});

generateChartBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  renderClientChart();
});

// Pergunta o formato de exportação (Excel ou PDF) e se deve incluir as anotações
exportClientBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  exportPopover.classList.toggle("open");
});
exportPopover.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => exportPopover.classList.remove("open"));

exportPopover.querySelectorAll("button[data-format]").forEach((btn) => {
  btn.addEventListener("click", () => {
    exportPopover.classList.remove("open");
    const includeNotes = exportIncludeNotes.checked;
    const rangeKey = exportRangeSelect.value;
    if (btn.dataset.format === "excel") exportClientExcel(includeNotes, rangeKey);
    else exportClientPDF(includeNotes, rangeKey);
  });
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportClientExcel(includeNotes, rangeKey) {
  if (!currentClient) return;
  const { name, gasto, mensagens, custoMsg, visitas, custoVisita, dailyRows } = currentClient;
  const series = buildChartSeries(name, gasto, rangeKey, dailyRows);

  const lines = [
    "Cliente;Valor gasto;Mensagens;Custo por msg;Visitas;Custo por visita",
    `${name};${gasto.toFixed(2)};${mensagens};${custoMsg.toFixed(2)};${visitas};${custoVisita.toFixed(2)}`,
    "",
    "Dia;Mensagens;Valor gasto;Custo por msg",
    ...dailyRows.map((d) => `${d.dia};${d.msg};${d.gasto.toFixed(2)};${d.custo.toFixed(2)}`),
    "",
    `Visualização do gráfico: ${CHART_RANGE_LABELS[rangeKey]}`,
    "Período;Valor gasto",
    ...series.labels.map((label, i) => `${label};${series.values[i].toFixed(2)}`),
  ];

  if (includeNotes) {
    const comments = commentsCache[name] || [];
    if (comments.length > 0) {
      lines.push("");
      lines.push("Autor;Data;Comentário");
      comments.forEach((c) => {
        lines.push(`${c.author};${formatDateTime(new Date(c.date))};"${c.text.replace(/"/g, '""')}"`);
      });
    }
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${name.replace(/\s+/g, "_")}_dados.csv`);
}

function exportClientPDF(includeNotes, rangeKey) {
  if (!currentClient) return;
  const { name, gasto, mensagens, custoMsg, visitas, custoVisita, dailyRows } = currentClient;
  const series = buildChartSeries(name, gasto, rangeKey, dailyRows);
  const chartImg = renderChartToDataURL(series.labels, series.values);

  const rowsHtml = dailyRows
    .map((d) => `<tr><td>${d.dia}</td><td>${d.msg}</td><td>${formatBRL(d.gasto)}</td><td>${formatBRL(d.custo)}</td></tr>`)
    .join("");

  let commentsHtml = "";
  if (includeNotes) {
    const comments = commentsCache[name] || [];
    if (comments.length > 0) {
      commentsHtml =
        "<h3>Anotações / comentários</h3>" +
        comments
          .map(
            (c) =>
              `<p><strong>${c.author}</strong> <span style="color:#777;font-size:11px;">(${formatDateTime(new Date(c.date))})</span><br>${c.text.replace(/</g, "&lt;")}</p>`
          )
          .join("");
    }
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<base href="${document.baseURI}">
<title>${name} - Relatório</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    color: #111111;
    background-image: url("papel-timbrado.png");
    background-repeat: no-repeat;
    background-position: top center;
    background-size: 100% auto;
  }
  .report { padding: 230px 60px 130px; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #111111; text-align: center; text-transform: uppercase; }
  .subtitle { text-align: center; font-size: 12px; color: #555555; margin: 0 0 18px; }
  h3 { margin-top: 24px; margin-bottom: 8px; font-size: 14px; color: #111111; border-left: 4px solid #f5c518; padding-left: 8px; }
  p { color: #111111; }
  strong { color: #000000; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 6px 10px; font-size: 12px; text-align: left; color: #111111; }
  th { background: #f0f0f0; }
  .summary { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }
  .summary div { font-size: 12px; color: #111111; }
  img.chart { max-width: 100%; margin-top: 8px; background: #ffffff; }
</style>
</head>
<body>
  <div class="report">
    <h1>Relatório de performance</h1>
    <p class="subtitle">${name} &middot; ${CHART_RANGE_LABELS[rangeKey]}</p>
    <div class="summary">
      <div><strong>Valor gasto:</strong> ${formatBRL(gasto)}</div>
      <div><strong>Mensagens:</strong> ${mensagens}</div>
      <div><strong>Custo p/ msg:</strong> ${formatBRL(custoMsg)}</div>
      <div><strong>Visitas:</strong> ${visitas}</div>
      <div><strong>Custo p/ visita:</strong> ${formatBRL(custoVisita)}</div>
    </div>
    <h3>Gráfico (${CHART_RANGE_LABELS[rangeKey]})</h3>
    <img class="chart" src="${chartImg}" alt="Gráfico de gastos">
    <h3>Detalhamento diário (últimos 7 dias)</h3>
    <table>
      <thead><tr><th>Dia</th><th>Mensagens</th><th>Valor gasto</th><th>Custo p/ msg</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${commentsHtml}
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

saveNotesBtn.addEventListener("click", async () => {
  if (!currentClient) return;
  if (!clientNotes.value.trim()) return;
  saveNotesBtn.disabled = true;
  await addClientComment(currentClient.name, notesAuthor.value.trim(), clientNotes.value.trim());
  saveNotesBtn.disabled = false;
  renderComments(currentClient.name);
  clientNotes.value = "";
  notesStatus.textContent = "Comentário adicionado ✓";
  setTimeout(() => {
    notesStatus.textContent = "";
  }, 2000);
});

modalClose.addEventListener("click", () => clientModal.classList.remove("open"));
clientModal.addEventListener("click", (e) => {
  if (e.target === clientModal) clientModal.classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") clientModal.classList.remove("open");
});

// Conecta o visual atual ao backend protegido que consulta o Facebook Ads.
const periodApiValues = { hoje: "today", "7dias": "7d", "1mes": "1mes", personalizado: "custom" };
const dataStatus = document.getElementById("dataStatus");

function setDataStatus(state, message) {
  dataStatus.className = `data-status ${state}`;
  dataStatus.textContent = message;
}

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

function sameDatesPreviousMonth(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonth = new Date(year, month - 2, 1, 12);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(day, lastDay));
  return isoDate(targetMonth);
}

function getPreviousParams(period, customStart, customEnd) {
  const today = new Date();
  if (period === "hoje") {
    const previous = new Date(today);
    previous.setDate(previous.getDate() - 1);
    return new URLSearchParams({ period: "custom", start: isoDate(previous), end: isoDate(previous) });
  }

  if (period === "personalizado" && customStart && customEnd) {
    return new URLSearchParams({
      period: "custom",
      start: sameDatesPreviousMonth(customStart),
      end: sameDatesPreviousMonth(customEnd),
    });
  }

  let days = period === "1mes" ? 30 : 7;
  let currentStart;
  currentStart = new Date(today);
  currentStart.setDate(currentStart.getDate() - days + 1);

  const end = new Date(currentStart);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return new URLSearchParams({ period: "custom", start: isoDate(start), end: isoDate(end) });
}

function differenceMarkup(current, previous, lowerIsBetter = false, currency = false) {
  if (previous === undefined || previous === null || !Number.isFinite(Number(previous)) || Math.abs(current - previous) < 0.005) return "";
  const difference = current - previous;
  const absolute = Math.abs(difference);
  const sign = difference > 0 ? "+" : "−";
  const value = currency
    ? absolute < 10
      ? `R$${absolute.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `R$${Math.round(absolute).toLocaleString("pt-BR")}`
    : Math.round(absolute).toLocaleString("pt-BR");
  const good = lowerIsBetter ? difference < 0 : difference > 0;
  return `<em class="${good ? "up" : "down"}">(${sign}${value})</em>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
}

function liveCurrency(value) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function costPillClass(cost) {
  if (cost <= 0) return "pill-neutral";
  if (cost <= 6.5) return "pill-green";
  if (cost <= 7.5) return "pill-yellow";
  if (cost <= 9) return "pill-orange";
  return "pill-red";
}

// Mesmas faixas do custo por mensagem aplicadas à cor do número no card de KPI
function costValueColor(cost) {
  if (cost <= 0) return "#f4f4f5";
  if (cost <= 6.5) return "#2be080";
  if (cost <= 7.5) return "#ffca19";
  if (cost <= 9) return "#f47717";
  return "#f0444f";
}

function liveMetricRow(metric, previous = {}) {
  const spend = Number(metric.spend || 0);
  const conversations = Number(metric.conversations || 0);
  const costConversation = Number(metric.cost_per_conversation || 0);
  const visits = Number(metric.profile_visits || 0);
  const costVisit = Number(metric.cost_per_profile_visit || 0);
  const metricJson = escapeHtml(JSON.stringify(metric));
  return `<tr data-metric="${metricJson}">
    <td class="col-name">${escapeHtml(metric.client_name || metric.account_name)}</td>
    <td>${liveCurrency(spend)} ${differenceMarkup(spend, previous.spend, false, true)}</td>
    <td>${conversations.toLocaleString("pt-BR")} ${differenceMarkup(conversations, previous.conversations)}</td>
    <td><span class="pill ${costPillClass(costConversation)}">${liveCurrency(costConversation)}</span> ${differenceMarkup(costConversation, previous.cost_per_conversation, true, true)}</td>
    <td>${visits.toLocaleString("pt-BR")} ${differenceMarkup(visits, previous.profile_visits)}</td>
    <td><span class="pill ${costPillClass(costVisit)}">${liveCurrency(costVisit)}</span> ${differenceMarkup(costVisit, previous.cost_per_profile_visit, true, true)}</td>
  </tr>`;
}

function updateLiveCards(metrics, previousMetrics) {
  const totalSpend = metrics.reduce((sum, metric) => sum + Number(metric.spend || 0), 0);
  const totalMessages = metrics.reduce((sum, metric) => sum + Number(metric.conversations || 0), 0);
  const averageCost = totalMessages ? totalSpend / totalMessages : 0;
  const values = document.querySelectorAll(".kpi-value");
  const previousSpend = previousMetrics.reduce((sum, metric) => sum + Number(metric.spend || 0), 0);
  const previousMessages = previousMetrics.reduce((sum, metric) => sum + Number(metric.conversations || 0), 0);
  const previousCost = previousMessages ? previousSpend / previousMessages : 0;
  const cardValues = [liveCurrency(totalSpend), totalMessages.toLocaleString("pt-BR"), liveCurrency(averageCost)];
  const cardDiffs = [
    differenceMarkup(totalSpend, previousSpend, false, true),
    differenceMarkup(totalMessages, previousMessages),
    differenceMarkup(averageCost, previousCost, true, true),
  ];
  values.forEach((value, index) => {
    value.textContent = cardValues[index];
    if (index === 2) {
      value.style.color = costValueColor(averageCost);
    }
    const badge = value.closest(".kpi-value-row")?.querySelector(".badge");
    if (badge) {
      const diff = cardDiffs[index];
      badge.innerHTML = diff.replace(/<em class="(?:up|down)">|<\/em>/g, "");
      badge.classList.toggle("badge-up", diff.includes('class="up"'));
      badge.classList.toggle("badge-down", diff.includes('class="down"'));
      badge.style.display = diff ? "inline-block" : "none";
    }
  });
}

async function loadLiveMetrics() {
  setDataStatus("loading", "CARREGANDO DADOS...");
  const active = periodToggle.querySelector(".period-btn.active");
  const period = active?.dataset.period || "7dias";
  const params = new URLSearchParams({ period: periodApiValues[period] || "7d" });
  if (period === "personalizado" && rangeStart.value && rangeEnd.value) {
    params.set("start", rangeStart.value);
    params.set("end", rangeEnd.value);
  }

  try {
    const response = await fetch(`${LIVE_API_BASE}/api/metrics?${params.toString()}`);
    const json = await response.json();
    if (!response.ok || !Array.isArray(json.data)) {
      setDataStatus("error", "SEM DADOS");
      return;
    }

    const previousResponse = await fetch(`${LIVE_API_BASE}/api/metrics?${getPreviousParams(period, rangeStart.value, rangeEnd.value).toString()}`);
    const previousJson = previousResponse.ok ? await previousResponse.json() : { data: [] };
    const previousMap = new Map((previousJson.data || []).map((metric) => [metric.id, metric]));

    tbody.innerHTML = json.data.length
      ? json.data.map((metric) => liveMetricRow(metric, previousMap.get(metric.id))).join("")
      : '<tr><td colspan="6" class="empty-state">Nenhuma conta de anúncio encontrada.</td></tr>';
    tbody.querySelectorAll("tr[data-metric]").forEach((row) => {
      row.__metric = JSON.parse(row.dataset.metric);
    });
    updateLiveCards(json.data, previousJson.data || []);
    const accountLabel = `${json.data.length.toLocaleString("pt-BR")} contas conectadas ao Meta Ads`;
    document.getElementById("accountCount").textContent = accountLabel;
    const accountsPill = document.getElementById("accountsPill");
    if (accountsPill) accountsPill.textContent = `${json.data.length} contas ativas`;
    setDataStatus("ready", `ATUALIZADO ÀS ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (error) {
    console.warn("API do Facebook indisponível; mantendo dados visuais locais.", error);
    setDataStatus("error", "ERRO AO ATUALIZAR");
  }
}

periodToggle.addEventListener("click", (event) => {
  const button = event.target.closest(".period-btn");
  if (button && button.dataset.period !== "personalizado") {
    window.setTimeout(loadLiveMetrics, 0);
  }
});

rangeApply.addEventListener("click", () => {
  if (rangeStart.value && rangeEnd.value && rangeStart.value <= rangeEnd.value) {
    window.setTimeout(loadLiveMetrics, 0);
  }
});

loadLiveMetrics();
window.setInterval(loadLiveMetrics, 15 * 60 * 1000);

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const splashScreen = document.getElementById("splashScreen");

function hideSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash || splash.classList.contains("is-hidden")) return;
  splash.classList.add("is-hidden");
  setTimeout(() => splash.remove(), 500);
}

function unlockDashboard(user) {
  loginScreen.classList.add("is-hidden");
  document.getElementById("dashboard").classList.remove("is-locked");
  if (user?.name) {
    localStorage.setItem("empireads-user-name", user.name);
  }
}

// Splash some quando a página terminar de carregar; se algo travar o evento
// "load" (imagem/fonte pendente), os fallbacks garantem o fechamento.
window.addEventListener("load", () => {
  setTimeout(hideSplash, 1100);
});
if (document.readyState === "complete") {
  setTimeout(hideSplash, 1100);
}
setTimeout(hideSplash, 3500); // fallback definitivo

// Restaura sessão ativa a partir do cookie do servidor
(async function checkSession() {
  const savedName = localStorage.getItem("empireads-user-name");
  if (savedName) notesAuthor.placeholder = `Seu nome (ex: ${savedName})`;
  try {
    const response = await fetch(`${LIVE_API_BASE}/api/me`, { credentials: "include" });
    if (response.ok) {
      const { user } = await response.json();
      unlockDashboard(user);
    }
  } catch (err) {
    // sem sessão ativa: tela de login permanece
  }
})();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!email || !password) {
    loginError.textContent = "Preencha seu e-mail e sua senha.";
    return;
  }
  const submitBtn = loginForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  loginError.textContent = "";
  try {
    const response = await fetch(`${LIVE_API_BASE}/api/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      loginError.textContent = payload.error || "Não foi possível entrar. Tente novamente.";
      return;
    }
    unlockDashboard(payload.user);
  } catch (err) {
    loginError.textContent = "Servidor indisponível. Verifique se o servidor está rodando.";
  } finally {
    submitBtn.disabled = false;
  }
});
