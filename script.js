// Render API URL
const API_BASE = "https://stats-api-nh00.onrender.com";

//-----------------------------------------
// 1. Summary Table
//-----------------------------------------
fetch(`${API_BASE}/summary`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#summaryTable tbody");
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
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td>-</td><td>-</td><td>-</td>
          <td>${row.count}</td><td>${row.percent}%</td>`;
      }
      tbody.appendChild(tr);
    });
  });

//-----------------------------------------
// 2. Scatter Plots
//-----------------------------------------
function renderScatter(containerId, data, xvar) {
  const trace = {
    x: data.map(d => d[xvar]),
    y: data.map(d => d.pres),
    mode: "markers",
    type: "scatter",
    marker: { color: "blue", size: 6 },
    name: `${xvar} vs Residuals`
  };
  const layout = {
    title: `${xvar} vs Pearson Residuals`,
    xaxis: { title: xvar },
    yaxis: { title: "Residuals", range: [-4, 4] }
  };
  Plotly.newPlot(containerId, [trace], layout);
}

fetch(`${API_BASE}/scatter`)
  .then(r => r.json())
  .then(data => {
    renderScatter("scatter-Age", data.Age, "Age");
    renderScatter("scatter-LVEF", data.LVEF, "LVEF");
    renderScatter("scatter-aus", data.aus, "aus");
  });

//-----------------------------------------
// 3. Boxplots (Bins & Categoricals)
//-----------------------------------------
function renderBoxplots(containerId, data, varName) {
  const traces = [];
  data.forEach(group => {
    traces.push({
      y: group.points,
      x: Array(group.points.length).fill(group.category),
      type: "box",
      name: group.category,
      boxpoints: false,
      marker: { color: "lightblue" },
      line: { color: "darkblue" }
    });
    traces.push({
      y: group.points,
      x: Array(group.points.length).fill(group.category),
      mode: "markers",
      type: "scatter",
      marker: { size: 5, color: "rgba(0,0,0,0.5)" },
      showlegend: false
    });
    traces.push({
      y: [group.summary.mean],
      x: [group.category],
      mode: "markers+errorbars",
      type: "scatter",
      error_y: {
        type: "data",
        symmetric: false,
        array: [group.summary.ci_high - group.summary.mean],
        arrayminus: [group.summary.mean - group.summary.ci_low],
        color: "red"
      },
      marker: { color: "red", size: 8 },
      showlegend: false
    });
  });
  const layout = {
    title: `Residuals by ${varName}`,
    yaxis: { range: [-4, 4], zeroline: true },
    boxmode: "group"
  };
  Plotly.newPlot(containerId, traces, layout);
}

// Bins
fetch(`${API_BASE}/bins?n_bins=10`)
  .then(r => r.json())
  .then(data => {
    ["Age", "LVEF", "aus"].forEach(v => renderBoxplots(`bins-${v}`, data[v], v));
  });

// Categoricals
fetch(`${API_BASE}/categorical`)
  .then(r => r.json())
  .then(data => {
    ["Sex", "NYHA", "urgency", "surgery", "diabetes", "CKD"].forEach(v => renderBoxplots(`cat-${v}`, data[v], v));
  });

//-----------------------------------------
// 4. Linear regression
//-----------------------------------------
fetch(`${API_BASE}/lm`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#lmTable tbody");
    Object.keys(data.coef).forEach(varName => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${varName}</td>
        <td>${data.coef[varName]}</td>
        <td>${data.CI_lower[varName]} – ${data.CI_upper[varName]}</td>
        <td>${data.p_value[varName]}</td>`;
      tbody.appendChild(row);
    });
  });

//-----------------------------------------
// 5. Raw data toggle
//-----------------------------------------
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
