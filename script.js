// ============================================================
// Cardiothoracic Surgery Audit Dashboard
// ============================================================

const API_BASE = "https://stats-api-nh00.onrender.com"; 

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
  window.lucide.createIcons();
}
  initializeDashboard();

// Sidebar toggle logic
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("menuToggle");

  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      if (window.innerWidth < 900) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
  }

  // Active link highlighting + auto-close on mobile
  const links = document.querySelectorAll(".sidebar-nav a");
  links.forEach(link => {
    link.addEventListener("click", () => {
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      if (window.innerWidth < 900) {
        sidebar.classList.remove("open");
      }
    });
  });

});



// --- Initialization ---
async function initializeDashboard() {
  try {
    const vars = await fetchJSON(`${API_BASE}/variables`);
    if (!vars) throw new Error("Failed to load variables");
    renderSummary();
    renderKDESection(document.getElementById("scatterPlots"), vars.continuous);
    renderCategoricalSection(document.getElementById("catPlots"), vars.categorical);
    renderLinearModels(); 
    attachRawToggle();
  } catch (err) {
    console.error("Init error:", err);
    document.getElementById("summaryTableContainer").innerText = "Error loading dashboard: " + err.message;
  }
}

// --- Fetch helper ---
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    console.warn("Fetch error", url, res.status, txt);
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

// --------------------
// Summary table
// --------------------
async function renderSummary() {
  try {
    const summary = await fetchJSON(`${API_BASE}/summary`);
    const container = document.getElementById("summaryTableContainer");
    container.innerHTML = buildSummaryTableHTML(summary);
  } catch (e) {
    console.error("Summary error:", e);
    document.getElementById("summaryTableContainer").innerText = "Unable to load summary.";
  }
}

function buildSummaryTableHTML(summaryRows) {
  // Build a table similar to previous design
  const tbl = document.createElement("table");
  tbl.className = "summary-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Variable</th><th>Level</th><th>Alive</th><th>Dead</th><th>Total</th></tr>`;
  tbl.appendChild(thead);
  const tbody = document.createElement("tbody");

  summaryRows.forEach(row => {
    if (row.type === "continuous") {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="cont-var">${row.variable}</td><td></td>
        <td>${row.Alive ?? "-"}</td><td>${row.Dead ?? "-"}</td><td>${row.Total ?? "-"}</td>`;
      tbody.appendChild(tr);
    } else if (row.type === "categorical" && row.level === null) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="cat-var">${row.variable}</td><td></td><td></td><td></td><td></td>`;
      tbody.appendChild(tr);
    } else if (row.type === "categorical") {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="cat-level">${row.variable}</td><td class="cat-level">${row.level}</td>
        <td>${row.Alive ?? ""}</td><td>${row.Dead ?? ""}</td><td>${row.Total ?? ""}</td>`;
      tbody.appendChild(tr);
    }
  });

  tbl.appendChild(tbody);
  return tbl.outerHTML;
}

// --------------------
// KDE / Continuous plotting
// --------------------
async function renderKDESection(container, continuousVars) {
  console.log(continuousVars)
  for (const v of continuousVars) {
    const plotDiv = document.createElement("div");
    plotDiv.className = "plot";
    container.appendChild(plotDiv);
    renderSmoothResidual(v, plotDiv);
  }
}


function drawKDEHeatmap(targetDiv, kde, points, varName) {
  // kde.grid_x (length Nx), kde.grid_y (length Ny), kde.z (Ny x Nx nested list)
  const x = kde.grid_x;
  const y = kde.grid_y;
  const z = kde.z; // array of arrays, shape [Ny][Nx]
  // Heatmap (density) + scatter overlay (semi-transparent)
  const data = [
    {
      x: x,
      y: y,
      z: z,
      type: 'contour',
      colorscale: 'Blues',
      contours: {
        coloring: 'lines',   // draw lines instead of filled regions
        showlabels: true     // label contour levels
      },
      showscale: true,
      hoverinfo: 'x+y+z'
    },
    {
      x: points.map(p => p[varName]),
      y: points.map(p => p.pres),
      mode: 'markers',
      marker: { size: 4, opacity: 0.45 },
      type: 'scatter',
      name: 'points',
      hoverinfo: 'x+y'
    }
  ];


  const layout = {
    margin: { t: 30, l: 60, r: 25, b: 60 },
    xaxis: { title: varName },
    yaxis: { title: 'Residual (pres)' },
    legend: { orientation: 'h' }
  };

  Plotly.newPlot(targetDiv, data, layout, {responsive: true});
}

// --- NEW: Smoothed residual curve ---
async function renderSmoothResidual(varName, targetDiv) {
  try {
    const resp = await fetchJSON(`${API_BASE}/smooth_residual?var=${encodeURIComponent(varName)}&frac=0.3`);

    const ciTrace = {
      x: [...resp.binned.x, ...resp.binned.x.slice().reverse()],
      y: [...resp.binned.ci_upper, ...resp.binned.ci_lower.slice().reverse()],
      fill: 'toself',
      fillcolor: 'rgba(0, 0, 255, 0.15)',
      line: { width: 0 },
      hoverinfo: 'skip',
      name: '95% CI'
    };

    const smoothTrace = {
      x: resp.smooth.x,
      y: resp.smooth.y,
      mode: 'lines',
      line: { width: 3, color: 'blue' },
      name: 'Smoothed mean residual'
    };

    const pointsTrace = {
      x: resp.binned.x,
      y: resp.binned.mean,
      mode: 'markers',
      marker: { color: 'blue', size: 6, symbol: 'circle' },
      name: 'Bin means'
    };

    const layout = {
      margin: { t: 30, l: 60, r: 25, b: 60 },
      xaxis: { title: varName },
      yaxis: { title: 'Residual (pres)', zeroline: true },
      showlegend: true
    };

    Plotly.newPlot(targetDiv, [ciTrace, smoothTrace, pointsTrace], layout, { responsive: true });
  } catch (err) {
    console.error("Smooth residual error:", err);
    targetDiv.innerHTML = `<p style="color:red;">Error rendering residual curve for ${varName}</p>`;
  }
}



function drawScatterFallback(targetDiv, points, varName, message) {
  const data = [
    {
      x: points.map(p => p[varName]),
      y: points.map(p => p.pres),
      mode: 'markers',
      type: 'scatter',
      marker: {size: 5, opacity: 0.6},
      name: 'pres vs ' + varName
    }
  ];
  const layout = {
    margin: { t: 30, l: 60, r: 25, b: 60 },
    xaxis: { title: varName },
    yaxis: { title: 'Residual (pres)' },
    annotations: (message ? [{
      text: message,
      showarrow: false,
      xref: 'paper',
      yref: 'paper',
      x: 0, y: 1.08,
      font: {size: 11, color: '#666'}
    }] : [])
  };
  Plotly.newPlot(targetDiv, data, layout, {responsive: true});
}

// --------------------
// Categorical predicted mortality boxplots with actual overlay
// --------------------
async function renderCategoricalSection(container, catVars) {
  container.innerHTML = "";
  if (!catVars || catVars.length === 0) {
    container.innerText = "No categorical variables available.";
    return;
  }

  catVars.forEach(async (v) => {
    try {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "18px";
      const title = document.createElement("h3");
      title.style.margin = "6px 0";
      title.textContent = `Predicted mortality by ${v}`;
      wrap.appendChild(title);

      const plotDiv = document.createElement("div");
      plotDiv.style.width = "100%";
      plotDiv.style.height = "420px";
      wrap.appendChild(plotDiv);
      container.appendChild(wrap);

      const resp = await fetchJSON(`${API_BASE}/category_pred?var=${encodeURIComponent(v)}`);
      if (!resp || !resp.categories) {
        plotDiv.innerText = `No category data available for ${v}`;
        return;
      }
      drawCategoryBoxplot(plotDiv, resp.categories, v);
    } catch (err) {
      console.error("Categorical render error for", v, err);
      const errDiv = document.createElement("div");
      errDiv.textContent = `Unable to render categorical plot for ${v}: ${err.message}`;
      container.appendChild(errDiv);
    }
  });
}

function drawCategoryBoxplot(targetDiv, categories, varName) {
  // categories: list of {category, pred_values[], actual_mortality, n, ci_lower, ci_upper, ...}
  const boxTraces = [];
  const categoryNames = categories.map(c => c.category);

  categories.forEach((c) => {
    // Convert predicted mortality values to percentages
    const predPercent = c.pred_values.map(v => v * 100);
    boxTraces.push({
      y: predPercent,
      name: c.category,
      type: 'box',
      boxpoints: 'outliers',
      marker: { opacity: 0.6 },
      hovertemplate: "%{y:.2f}%<extra>" + c.category + "</extra>"
    });
  });

  // Single-point overlay for observed mortality, converted to %
  const observed = {
    x: categoryNames,
    y: categories.map(c =>
      c.actual_mortality === null ? null : c.actual_mortality * 100
    ),
    mode: 'markers',
    marker: { size: 10, symbol: 'diamond', color: 'black' },
    name: 'Observed mortality',
    hovertemplate: "%{x}<br>Observed: %{y:.2f}%<extra></extra>"
  };

  const data = [...boxTraces, observed];

  const layout = {
    margin: { t: 30, l: 80, r: 20, b: 140 },
    yaxis: { title: 'Predicted mortality (%)', zeroline: true },
    xaxis: { title: varName, tickangle: -45, automargin: true },
    showlegend: true
  };

  Plotly.newPlot(targetDiv, data, layout, { responsive: true });
}


// --------------------
// Linear models table
// --------------------
async function renderLinearModels() {
  try {
    const rows = await fetchJSON(`${API_BASE}/lm`);
    const tbody = document.querySelector("#lmTable tbody");
    tbody.innerHTML = "";
    if (!Array.isArray(rows)) {
      tbody.innerHTML = `<tr><td colspan="4">No model results</td></tr>`;
      return;
    }
    rows.forEach(r => {
      const tr = document.createElement("tr");
      const ciText = (r.CI_lower !== undefined && r.CI_upper !== undefined) ? `${r.CI_lower} — ${r.CI_upper}` : "-";
      const pval = (r.p_value !== undefined) ? r.p_value : "-";
      tr.innerHTML = `<td>${escapeHtml(r.variable)}</td><td>${escapeHtml(r.coef)}</td><td>${escapeHtml(ciText)}</td><td>${escapeHtml(pval)}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("LM fetch error:", err);
    const tbody = document.querySelector("#lmTable tbody");
    tbody.innerHTML = `<tr><td colspan="4">Unable to load regression results.</td></tr>`;
  }
}

// --------------------
// Raw data toggle
// --------------------
function attachRawToggle() {
  const btn = document.getElementById("toggleRaw");
  const container = document.getElementById("rawDataContainer");
  const headerRow = document.getElementById("rawDataHeader");
  const tbody = document.querySelector("#rawDataTable tbody");

  btn.addEventListener("click", async () => {
    if (container.style.display === "none") {
      // show
      try {
        btn.disabled = true;
        btn.innerText = "Loading...";
        const rows = await fetchJSON(`${API_BASE}/data`);
        btn.disabled = false;
        btn.innerText = "Show / Hide Raw Data";

        if (!Array.isArray(rows) || rows.length === 0) {
          headerRow.innerHTML = `<th>No data</th>`;
          tbody.innerHTML = "";
        } else {
          // Build header keys from first row
          const keys = Object.keys(rows[0]);
          headerRow.innerHTML = keys.map(k => `<th>${escapeHtml(k)}</th>`).join("");
          tbody.innerHTML = rows.map(r => `<tr>${keys.map(k => `<td>${escapeHtml(String(r[k] ?? ""))}</td>`).join("")}</tr>`).join("");
        }
        container.style.display = "block";
      } catch (err) {
        console.error("Raw data load error:", err);
        btn.disabled = false;
        btn.innerText = "Show / Hide Raw Data";
        container.style.display = "block";
        headerRow.innerHTML = `<th>Error loading data</th>`;
        tbody.innerHTML = `<tr><td>${escapeHtml(err.message)}</td></tr>`;
      }
    } else {
      container.style.display = "none";
    }
  });
}

// --------------------
// Utilities
// --------------------
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
