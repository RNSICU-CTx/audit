// -----------------------------
// Config
// -----------------------------
const API_BASE = "https://stats-api-nh00.onrender.com";

// Variables to plot
const contVars = ["Age", "LVEF", "aus"];  // continuous predictors
const catVars = ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"]; // categorical

// -----------------------------
// Utility: create container + canvas
// -----------------------------
function createPlotContainer(parentId, plotId, title) {
  const parent = document.getElementById(parentId);
  const container = document.createElement("div");
  container.style.margin = "25px 0";

  const heading = document.createElement("h3");
  heading.textContent = title;
  container.appendChild(heading);

  const canvas = document.createElement("canvas");
  canvas.id = plotId;
  container.appendChild(canvas);

  parent.appendChild(container);
  return canvas.id;
}

// -----------------------------
// Summary Table
// -----------------------------
fetch(`${API_BASE}/summary`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#summaryTable tbody");

    data.forEach(row => {
      const tr = document.createElement("tr");

      if (row.type === "continuous") {
        tr.innerHTML = `
          <td>${row.variable}</td><td>${row.type}</td><td>-</td>
          <td>${row.mean}</td><td>${row.median}</td><td>${row.std}</td><td>${row.iqr}</td>
          <td>${row.min}</td><td>${row.max}</td><td>${row.n}</td><td>-</td><td>-</td>
        `;
      }

      if (row.type === "categorical") {
        tr.innerHTML = `
          <td>${row.variable}</td><td>${row.type}</td><td>${row.category}</td>
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td>-</td><td>-</td><td>-</td><td>${row.count}</td><td>${row.percent}%</td>
        `;
      }

      tbody.appendChild(tr);
    });
  });

// -----------------------------
// Scatter Plots
// -----------------------------
function makeScatter(canvasId, data, xvar) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const points = data.map(d => ({ x: d[xvar], y: d.pres }));

  new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: `${xvar} vs Residuals`,
        data: points,
        backgroundColor: "rgba(54, 162, 235, 0.5)"
      }]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: `${xvar} vs Pearson Residuals` } },
      scales: {
        x: { title: { display: true, text: xvar } },
        y: { title: { display: true, text: "Residuals" }, min: -4, max: 4 }
      }
    }
  });
}

fetch(`${API_BASE}/scatter`)
  .then(r => r.json())
  .then(data => {
    contVars.forEach(v => {
      const canvasId = createPlotContainer("scatterContainer", `scatter-${v}`, `${v} Scatter`);
      makeScatter(canvasId, data[v], v);
    });
  });

// -----------------------------
// Binned Residuals (Boxplot style)
// -----------------------------
function makeBinnedBoxplot(canvasId, groupedData, xvar) {
  const trace = {
    x: groupedData.map(d => d.bin),
    y: groupedData.map(d => d.mean),
    error_y: {
      type: "data",
      array: groupedData.map(d => d.se),
      visible: true
    },
    type: "box",
    boxpoints: "all",
    jitter: 0.3,
    pointpos: 0,
    marker: { color: "rgba(255, 159, 64, 0.6)" },
    name: `${xvar}`
  };

  Plotly.newPlot(canvasId, [trace], {
    title: `${xvar} (Binned) vs Residuals`,
    yaxis: { title: "Residuals", range: [-4, 4] }
  });
}

fetch(`${API_BASE}/bins?n_bins=10`)
  .then(r => r.json())
  .then(data => {
    contVars.forEach(v => {
      if (data[v]) {
        const divId = createPlotContainer("binsContainer", `bins-${v}`, `${v} Bins`);
        makeBinnedBoxplot(divId, data[v], v);
      }
    });
  });

// -----------------------------
// Categorical Variables (Boxplot style)
// -----------------------------
function makeCategoricalBoxplot(canvasId, groupedData, xvar) {
  const trace = {
    x: groupedData.map(d => d[xvar]),
    y: groupedData.map(d => d.mean),
    error_y: {
      type: "data",
      array: groupedData.map(d => d.se),
      visible: true
    },
    type: "box",
    boxpoints: "all",
    jitter: 0.3,
    pointpos: 0,
    marker: { color: "rgba(75, 192, 192, 0.6)" },
    name: `${xvar}`
  };

  Plotly.newPlot(canvasId, [trace], {
    title: `Residuals by ${xvar}`,
    yaxis: { title: "Residuals", range: [-4, 4] }
  });
}

fetch(`${API_BASE}/categorical`)
  .then(r => r.json())
  .then(data => {
    catVars.forEach(v => {
      if (data[v]) {
        const divId = createPlotContainer("catContainer", `cat-${v}`, `${v}`);
        makeCategoricalBoxplot(divId, data[v], v);
      }
    });
  });

// -----------------------------
// Linear Regression Results Table
// -----------------------------
fetch(`${API_BASE}/lm`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#lmTable tbody");
    Object.keys(data.coef).forEach(varName => {
      const row = document.createElement("tr");
      const sigClass = data.p_value[varName] < 0.05 ? "sig" : "";
      row.innerHTML = `
        <td>${varName}</td>
        <td>${data.coef[varName].toFixed(3)}</td>
        <td>${data.CI_lower[varName].toFixed(3)} – ${data.CI_upper[varName].toFixed(3)}</td>
        <td class="${sigClass}">${data.p_value[varName].toExponential(2)}</td>
      `;
      tbody.appendChild(row);
    });
  });

// -----------------------------
// Raw Data Viewer
// -----------------------------
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
