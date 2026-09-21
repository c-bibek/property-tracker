(function () {
  "use strict";

  const STORAGE_KEY = "propertyTracker.properties.v1";
  const THEME_KEY = "propertyTracker.theme";

  /** @type {Array<Object>} */
  let properties = loadProperties();
  let valueChart = null;
  let mixChart = null;

  // ---------- Storage ----------

  function loadProperties() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load properties", e);
      return [];
    }
  }

  function saveProperties() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  }

  // ---------- Helpers ----------

  function uid() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function num(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
  }

  function fmtPercent(n) {
    return (isFinite(n) ? n : 0).toFixed(1) + "%";
  }

  function computeMetrics(p) {
    const equity = num(p.currentValue) - num(p.mortgageBalance);
    const appreciation = num(p.currentValue) - num(p.purchasePrice);
    const monthlyCashFlow = num(p.monthlyRent) - num(p.monthlyExpenses) - num(p.mortgagePayment);
    const annualCashFlow = monthlyCashFlow * 12;
    const noi = (num(p.monthlyRent) - num(p.monthlyExpenses)) * 12;
    const capRate = num(p.currentValue) > 0 ? (noi / num(p.currentValue)) * 100 : 0;
    const cashOnCash = num(p.cashInvested) > 0 ? (annualCashFlow / num(p.cashInvested)) * 100 : 0;
    return { equity, appreciation, monthlyCashFlow, annualCashFlow, capRate, cashOnCash };
  }

  // ---------- Rendering ----------

  function render() {
    renderSummary();
    renderTable();
    renderCharts();
    document.getElementById("emptyState").hidden = properties.length !== 0;
    document.querySelector(".table-wrap").hidden = properties.length === 0;
  }

  function renderSummary() {
    let totalValue = 0, totalMortgage = 0, totalCashFlow = 0, capRateSum = 0, capRateCount = 0, cocSum = 0, cocCount = 0;

    properties.forEach((p) => {
      const m = computeMetrics(p);
      totalValue += num(p.currentValue);
      totalMortgage += num(p.mortgageBalance);
      totalCashFlow += m.monthlyCashFlow;
      if (num(p.currentValue) > 0) { capRateSum += m.capRate; capRateCount++; }
      if (num(p.cashInvested) > 0) { cocSum += m.cashOnCash; cocCount++; }
    });

    const totalEquity = totalValue - totalMortgage;
    const avgCapRate = capRateCount ? capRateSum / capRateCount : 0;
    const avgCoc = cocCount ? cocSum / cocCount : 0;

    document.getElementById("sumValue").textContent = fmtMoney(totalValue);
    document.getElementById("sumValueSub").textContent =
      properties.length + (properties.length === 1 ? " property" : " properties");

    document.getElementById("sumEquity").textContent = fmtMoney(totalEquity);
    document.getElementById("sumEquitySub").textContent = "vs " + fmtMoney(totalMortgage) + " mortgage balance";

    const cfEl = document.getElementById("sumCashflow");
    cfEl.textContent = fmtMoney(totalCashFlow);
    cfEl.className = "summary-value " + (totalCashFlow >= 0 ? "positive" : "negative");
    document.getElementById("sumCashflowSub").textContent = fmtMoney(totalCashFlow * 12) + " / year";

    document.getElementById("sumCaprate").textContent = fmtPercent(avgCapRate);
    document.getElementById("sumCoc").textContent = fmtPercent(avgCoc) + " cash-on-cash";
  }

  function getFilteredSorted() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const typeFilter = document.getElementById("typeFilter").value;
    const sortBy = document.getElementById("sortSelect").value;

    let list = properties.filter((p) => {
      const matchesQuery =
        !q ||
        (p.address || "").toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q);
      const matchesType = !typeFilter || p.type === typeFilter;
      return matchesQuery && matchesType;
    });

    list = list.slice().sort((a, b) => {
      const ma = computeMetrics(a), mb = computeMetrics(b);
      switch (sortBy) {
        case "value": return num(b.currentValue) - num(a.currentValue);
        case "equity": return mb.equity - ma.equity;
        case "cashflow": return mb.monthlyCashFlow - ma.monthlyCashFlow;
        case "caprate": return mb.capRate - ma.capRate;
        default: return (a.address || "").localeCompare(b.address || "");
      }
    });

    return list;
  }

  function renderTable() {
    const tbody = document.getElementById("propTableBody");
    tbody.innerHTML = "";

    const list = getFilteredSorted();

    list.forEach((p) => {
      const m = computeMetrics(p);
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="addr-cell">
          <div class="addr-main">${escapeHtml(p.address || "(no address)")}</div>
          <div class="addr-sub">${escapeHtml(p.status || "")}</div>
        </td>
        <td><span class="pill">${escapeHtml(p.type || "-")}</span></td>
        <td>${p.purchaseDate ? escapeHtml(p.purchaseDate) : "-"}<br/><span class="addr-sub">${fmtMoney(num(p.purchasePrice))}</span></td>
        <td>${fmtMoney(num(p.currentValue))}</td>
        <td>${fmtMoney(num(p.mortgageBalance))}</td>
        <td class="${m.equity >= 0 ? "positive" : "negative"}">${fmtMoney(m.equity)}</td>
        <td class="${m.monthlyCashFlow >= 0 ? "positive" : "negative"}">${fmtMoney(m.monthlyCashFlow)}</td>
        <td>${fmtPercent(m.capRate)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost" data-action="edit" data-id="${p.id}">Edit</button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  function renderCharts() {
    const list = getFilteredSorted();
    const labels = list.map((p) => shortAddr(p.address));
    const values = list.map((p) => num(p.currentValue));
    const mortgages = list.map((p) => num(p.mortgageBalance));
    const equities = list.map((p, i) => values[i] - mortgages[i]);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim();
    const positive = styles.getPropertyValue("--positive").trim();
    const muted = styles.getPropertyValue("--text-muted").trim();
    const gridColor = styles.getPropertyValue("--border").trim();

    const valueCtx = document.getElementById("valueChart").getContext("2d");
    if (valueChart) valueChart.destroy();
    valueChart = new Chart(valueCtx, {
      type: "bar",
      data: {
        labels: labels.length ? labels : ["No properties"],
        datasets: [
          {
            label: "Equity",
            data: equities.length ? equities : [0],
            backgroundColor: positive,
            stack: "s",
          },
          {
            label: "Mortgage Balance",
            data: mortgages.length ? mortgages : [0],
            backgroundColor: accent,
            stack: "s",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom", labels: { color: muted } } },
        scales: {
          x: { stacked: true, ticks: { color: muted }, grid: { color: gridColor } },
          y: { stacked: true, ticks: { color: muted }, grid: { color: gridColor } },
        },
      },
    });

    const mixCtx = document.getElementById("mixChart").getContext("2d");
    if (mixChart) mixChart.destroy();
    const typeMap = {};
    properties.forEach((p) => {
      const t = p.type || "Other";
      typeMap[t] = (typeMap[t] || 0) + num(p.currentValue);
    });
    const mixLabels = Object.keys(typeMap);
    const mixValues = Object.values(typeMap);
    const palette = ["#2f6fed", "#1a9e5c", "#d6a545", "#d64545", "#8a5cf5", "#2fb6c4"];

    mixChart = new Chart(mixCtx, {
      type: "doughnut",
      data: {
        labels: mixLabels.length ? mixLabels : ["No properties"],
        datasets: [
          {
            data: mixValues.length ? mixValues : [1],
            backgroundColor: mixLabels.length ? palette : [gridColor],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom", labels: { color: muted } } },
      },
    });
  }

  function shortAddr(addr) {
    if (!addr) return "?";
    const first = addr.split(",")[0];
    return first.length > 18 ? first.slice(0, 16) + "…" : first;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ---------- Modal ----------

  const overlay = document.getElementById("modalOverlay");
  const form = document.getElementById("propertyForm");

  function openModal(property) {
    form.reset();
    document.getElementById("deleteBtn").hidden = !property;
    document.getElementById("modalTitle").textContent = property ? "Edit Property" : "Add Property";
    document.getElementById("propId").value = property ? property.id : "";

    if (property) {
      document.getElementById("fAddress").value = property.address || "";
      document.getElementById("fType").value = property.type || "Single-Family";
      document.getElementById("fStatus").value = property.status || "Owned - Rented";
      document.getElementById("fPurchaseDate").value = property.purchaseDate || "";
      document.getElementById("fPurchasePrice").value = property.purchasePrice ?? "";
      document.getElementById("fCurrentValue").value = property.currentValue ?? "";
      document.getElementById("fMortgageBalance").value = property.mortgageBalance ?? "";
      document.getElementById("fMortgagePayment").value = property.mortgagePayment ?? "";
      document.getElementById("fCashInvested").value = property.cashInvested ?? "";
      document.getElementById("fMonthlyRent").value = property.monthlyRent ?? "";
      document.getElementById("fMonthlyExpenses").value = property.monthlyExpenses ?? "";
      document.getElementById("fNotes").value = property.notes || "";
    }

    overlay.hidden = false;
  }

  function closeModal() {
    overlay.hidden = true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("propId").value;

    const data = {
      id: id || uid(),
      address: document.getElementById("fAddress").value.trim(),
      type: document.getElementById("fType").value,
      status: document.getElementById("fStatus").value,
      purchaseDate: document.getElementById("fPurchaseDate").value,
      purchasePrice: num(document.getElementById("fPurchasePrice").value),
      currentValue: num(document.getElementById("fCurrentValue").value),
      mortgageBalance: num(document.getElementById("fMortgageBalance").value),
      mortgagePayment: num(document.getElementById("fMortgagePayment").value),
      cashInvested: num(document.getElementById("fCashInvested").value),
      monthlyRent: num(document.getElementById("fMonthlyRent").value),
      monthlyExpenses: num(document.getElementById("fMonthlyExpenses").value),
      notes: document.getElementById("fNotes").value.trim(),
    };

    if (id) {
      const idx = properties.findIndex((p) => p.id === id);
      if (idx !== -1) properties[idx] = data;
    } else {
      properties.push(data);
    }

    saveProperties();
    closeModal();
    render();
  }

  function handleDelete() {
    const id = document.getElementById("propId").value;
    if (!id) return;
    if (!confirm("Delete this property? This cannot be undone.")) return;
    properties = properties.filter((p) => p.id !== id);
    saveProperties();
    closeModal();
    render();
  }

  // ---------- Export / Import ----------

  function exportData() {
    const blob = new Blob([JSON.stringify(properties, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "property-tracker-export-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!Array.isArray(imported)) throw new Error("Invalid file format");
        const existingIds = new Set(properties.map((p) => p.id));
        imported.forEach((p) => {
          if (!p.id || existingIds.has(p.id)) p.id = uid();
          properties.push(p);
        });
        saveProperties();
        render();
        alert("Imported " + imported.length + " properties.");
      } catch (err) {
        alert("Could not import file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ---------- Theme ----------

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    renderCharts();
  }

  // ---------- Wire up events ----------

  document.getElementById("addPropertyBtn").addEventListener("click", () => openModal(null));
  document.getElementById("emptyAddBtn").addEventListener("click", () => openModal(null));
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("deleteBtn").addEventListener("click", handleDelete);
  form.addEventListener("submit", handleSubmit);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById("propTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='edit']");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const property = properties.find((p) => p.id === id);
    if (property) openModal(property);
  });

  document.getElementById("searchInput").addEventListener("input", render);
  document.getElementById("typeFilter").addEventListener("change", render);
  document.getElementById("sortSelect").addEventListener("change", render);

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  // ---------- Init ----------

  initTheme();
  render();
})();
