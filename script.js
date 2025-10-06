// -----------------------------
// Config
// -----------------------------
const API_BASE = "https://stats-api-nh00.onrender.com";  // Set API link

//-----------------------------------------
// Default variables (placeholder until interactive)
//-----------------------------------------
const SUMMARY_VARS = {
  continuous: ["Age", "LVEF", "aus"], 
  categorical: ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"]
};

const BOXPLOT_VARS = {
  continuous: ["Age", "LVEF", "aus"], 
  categorical: ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"]
};

const LM_PREDICTORS = ["Age", "Sex", "diabetes"]; // regression defaults

//-----------------------------------------
// Build dashboard with defaults
//-----------------------------------------
buildSummary(SUMMARY_VARS);
buildScatter(BOXPLOT_VARS.continuous);
buildBins(BOXPLOT_VARS.continuous);
buildCategorical(BOXPLOT_VARS.categorical);
buildLM(SUMMARY_VARS);  // regression still tied to a subset
setupRawData();

//-----------------------------------------
// Summary Table
//-----------------------------------------
function buildSummary(vars) {
  fetch(`${API_BASE}/summary?vars=${vars.continuous.concat(vars.categorical).join("&vars=")}`)
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
    });
}

//-----------------------------------------
// Scatter Plots
//-----------------------------------------
function buildScatter(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/scatter?var=${v}`)
      .then(r => r.json())
      .then(data => {
        const div = document.createElement("div");
        div.id = `scatter-${v}`;
        document.getElementById("scatterPlots").appendChild(div);

        const trace = {
          x: data.points.map(p => p[v]),
          y: data.points.map(p => p.pres),
          mode: "markers",
          type: "scatter",
          name: `${v}`
        };

        Plotly.newPlot(div.id, [trace], {
          title: `${v} vs Residuals`,
          xaxis: { title: v },
          yaxis: { title: "Residuals", range: [-4, 4] }
        });
      });
  });
}

//-----------------------------------------
// Binned residuals as boxplots
//-----------------------------------------
function buildBins(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/bins?var=${v}&n_bins=10`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;

        const div = document.createElement("div");
        div.id = `bins-${v}`;
        document.getElementById("binPlots").appendChild(div);

        const trace = {
          x: data.bins.map(b => b.bin),
          y: data.bins.flatMap(b => b.points),
          type: "box",
          boxpoints: "all",
          jitter: 0.4,
          name: v
        };

        Plotly.newPlot(div.id, [trace], {
          title: `${v} (Binned) vs Residuals`,
          yaxis: { title: "Residuals", range: [-4, 4] }
        });
      });
  });
}

//-----------------------------------------
// Categorical residuals as boxplots
//-----------------------------------------
function buildCategorical(vars) {
  vars.forEach(v => {
    fetch(`${API_BASE}/categorical?var=${v}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;

        const div = document.createElement("div");
        div.id = `cat-${v}`;
        document.getElementById("catPlots").appendChild(div);

        const trace = {
          x: data.categories.map(c => c.category),
          y: data.categories.flatMap(c => c.points),
          type: "box",
          boxpoints: "all",
          jitter: 0.4,
          name: v
        };

        Plotly.newPlot(div.id, [trace], {
          title: `Residuals by ${v}`,
          yaxis: { title: "Residuals", range: [-4, 4] }
        });
      });
  });
}

//-----------------------------------------
// Linear regression results table (dynamic)
//-----------------------------------------
fetch(`${API_BASE}/lm`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#lmTable tbody");
    tbody.innerHTML = ""; // clear old rows if reloading

    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">No regression results available</td>`;
      tbody.appendChild(tr);
      return;
    }

    data.forEach(row => {
      const tr = document.createElement("tr");

      // Highlight statistically significant p-values
      const isSignificant = row.p_value < 0.05;
      const sigClass = isSignificant ? "sig" : "";

      // Format CI and p-values
      const ci = `${row.CI_lower.toFixed(3)} – ${row.CI_upper.toFixed(3)}`;
      const pVal = row.p_value < 0.001 
        ? "<0.001" 
        : row.p_value.toFixed(3);

      tr.innerHTML = `
        <td>${row.variable}</td>
        <td>${row.coef.toFixed(3)}</td>
        <td>${ci}</td>
        <td class="${sigClass}">${pVal}</td>
      `;

      tbody.appendChild(tr);
    });
  })
  .catch(err => {
    console.error("Error loading regression results:", err);
    const tbody = document.querySelector("#lmTable tbody");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">Error loading data</td>`;
    tbody.appendChild(tr);
  });


//-----------------------------------------
// Raw data toggle
//-----------------------------------------
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
            Object.keys(data[0]).forEach(col => {
              const th = document.createElement("th");
              th.textContent = col;
              headerRow.appendChild(th);
            });
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
          });
      }
    } else {
      container.style.display = "none";
    }
  });
}
