// ============================================================
// Cardiothoracic Surgery Audit Dashboard
// ============================================================

//-------------------------------------------------------------
// Config
//-------------------------------------------------------------
const API_BASE = "https://stats-api-nh00.onrender.com";
const Y_AXIS_RANGE = [-4, 4]; // consistent y-axis limits

// Default variables — can be dynamically replaced later
const DASHBOARD_VARS = {
  summary: {
    continuous: ["Age", "LVEF", "aus"],
    categorical: ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"]
  },
  boxplot: {
    continuous: ["Age", "LVEF", "aus"],
    categorical: ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"]
  },
  lm: ["Age", "Sex", "diabetes"]
};

//-------------------------------------------------------------
// Helper: build query string from params
//-------------------------------------------------------------
function buildQuery(params) {
  return Object.entries(params)
    .map(([k, v]) =>
      Array.isArray(v)
        ? v.map(val => `${k}=${encodeURIComponent(val)}`).join("&")
        : `${k}=${encodeURIComponent(v)}`
    )
    .join("&");
}

//-------------------------------------------------------------
// Helper: create Plotly plot container + draw plot
//-------------------------------------------------------------
function createPlot(containerId, plotId, traces, layout) {
  const div = document.createElement("div");
  div.id = plotId;
  document.getElementById(containerId).appendChild(div);
  Plotly.newPlot(div.id, traces, layout);
}

//-------------------------------------------------------------
// Summary Statistics Table
//-------------------------------------------------------------
function buildSummary(vars) {
  const query = buildQuery({
    vars: vars.continuous.concat(vars.categorical)
  });

  fetch(`${API_BASE}/summary?${query}`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.querySelector("#summaryTable tbody");
      tbody.innerHTML = "";

      data.forEach(row => {
        const tr = document.createElement("tr");

        if (row.type === "continuous") {
          tr.innerHTML = `
            <td>${row.variable}</td><td>${row.type}</td><td>-</td>
            <td>${row.mean}</td><td>${row.median}</td><td>${row.std}</td>
            <td>${row.iqr}</td><td>${row.min}</td><td>${row.max}</td>
            <td>${row.n}</td><td>-</td><td>-</td>`;
        } else {
          tr.innerHTML = `
            <td>${row.variable}</td><td>${row.type}</td><td>${row.category}</td>
            <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
            <td>-</td><td>${row.count}</td><td>${row.percent}%</td>`;
        }
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error("Error loading summary:", err));
}

//-------------------------------------------------------------
// Scatter Plots (Residuals vs Continuous Variables)
//-------------------------------------------------------------
function buildScatter(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/scatter?var=${v}`)
      .then(r => r.json())
      .then(data => {
        const trace = {
          x: data.points.map(p => p[v]),
          y: data.points.map(p => p.pres),
          mode: "markers",
          type: "scatter",
          name: v,
          marker: { opacity: 0.7 }
        };

        const layout = {
          title: `${v} vs Residuals`,
          xaxis: { title: v },
          yaxis: { title: "Residuals", range: Y_AXIS_RANGE }
        };

        createPlot("scatterPlots", `scatter-${v}`, [trace], layout);
      })
      .catch(err => console.error(`Error building scatter for ${v}:`, err));
  });
}

//-------------------------------------------------------------
// Binned Residuals (Boxplots)
//-------------------------------------------------------------
function buildBins(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/bins?var=${v}&n_bins=10`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;

        const trace = {
          x: data.bins.map(b => b.bin),
          y: data.bins.flatMap(b => b.points),
          type: "box",
          boxpoints: "all",
          jitter: 0.4,
          name: v
        };

        const layout = {
          title: `${v} (Binned) vs Residuals`,
          yaxis: { title: "Residuals", range: Y_AXIS_RANGE }
        };

        createPlot("binPlots", `bins-${v}`, [trace], layout);
      })
      .catch(err => console.error(`Error building bins for ${v}:`, err));
  });
}

//-------------------------------------------------------------
// Categorical Residuals (Boxplots)
//-------------------------------------------------------------
function buildCategorical(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/categorical?var=${v}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;

        const trace = {
          x: data.categories.map(c => c.category),
          y: data.categories.flatMap(c => c.points),
          type: "box",
          boxpoints: "all",
          jitter: 0.4,
          name: v
        };

        const layout = {
          title: `Residuals by ${v}`,
          yaxis: { title: "Residuals", range: Y_AXIS_RANGE }
        };

        createPlot("catPlots", `cat-${v}`, [trace], layout);
      })
      .catch(err => console.error(`Error building categorical for ${v}:`, err));
  });
}

//-------------------------------------------------------------
// Linear Regression Results Table
//-------------------------------------------------------------
function buildLM() {
  const query = buildQuery({ predictors: DASHBOARD_VARS.lm });

  fetch(`${API_BASE}/lm?${query}`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.querySelector("#lmTable tbody");
      tbody.innerHTML = "";

      if (!data || data.error) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="4">No regression results available</td>`;
        tbody.appendChild(row);
        return;
      }

      // Handle both dict-style and list-style responses
      const rows = Array.isArray(data)
        ? data
        : Object.keys(data.coef || {}).map(v => ({
            variable: v,
            coef: data.coef[v],
            CI_lower: data.CI_lower[v],
            CI_upper: data.CI_upper[v],
            p_value: data.p_value[v]
          }));

      rows.forEach(row => {
        const tr = document.createElement("tr");
        const isSig = row.p_value < 0.05 ? "sig" : "";
        const ciText = `${row.CI_lower.toFixed(3)} – ${row.CI_upper.toFixed(3)}`;
        const pText = row.p_value < 0.001 ? "<0.001" : row.p_value.toFixed(3);

        tr.innerHTML = `
          <td>${row.variable}</td>
          <td>${row.coef.toFixed(3)}</td>
          <td>${ciText}</td>
          <td class="${isSig}">${pText}</td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error("Error loading regression results:", err);
      const tbody = document.querySelector("#lmTable tbody");
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4">Error loading data</td>`;
      tbody.appendChild(row);
    });
}

//-------------------------------------------------------------
// Raw Data Toggle (De-identified)
//-------------------------------------------------------------
function setupRawData() {
  document.getElementById("toggleRaw").addEventListener("click", () => {
    const container = document.getElementById("rawDataContainer");

    if (container.style.display === "none") {
      container.style.display = "block";

      if (!container.dataset.loaded) {
        fetch(`${API_BASE}/data`)
          .then(r => r.json())
          .then(data => {
            const headerRow = document.getElementById("rawDataHeader");
            const tbody = document.querySelector("#rawDataTable tbody");

            // Build headers
            Object.keys(data[0]).forEach(col => {
              const th = document.createElement("th");
              th.textContent = col;
              headerRow.appendChild(th);
            });

            // Build rows
            data.forEach(row => {
              const tr = document.createElement("tr");
              Object.values(row).forEach(val => {
                const td = document.createElement("td");
                td.textContent = val;
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
            });

            container.dataset.loaded = true;
          })
          .catch(err => console.error("Error loading raw data:", err));
      }
    } else {
      container.style.display = "none";
    }
  });
}

//-------------------------------------------------------------
// Initialize Dashboard
//-------------------------------------------------------------
function initDashboard() {
  buildSummary(DASHBOARD_VARS.summary);
  buildScatter(DASHBOARD_VARS.boxplot.continuous);
  buildBins(DASHBOARD_VARS.boxplot.continuous);
  buildCategorical(DASHBOARD_VARS.boxplot.categorical);
  buildLM();
  setupRawData();
}

initDashboard();


// Sidebar toggle
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("menuToggle");

  toggle.addEventListener("click", () => {
    if (window.innerWidth < 900) {
      sidebar.classList.toggle("open");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });

  // Active link highlighting
  const links = document.querySelectorAll(".sidebar-nav a");
  links.forEach(link => {
    link.addEventListener("click", () => {
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      // Close sidebar on mobile after navigation
      if (window.innerWidth < 900) {
        sidebar.classList.remove("open");
      }
    });
  });
});
