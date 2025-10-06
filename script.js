// Render API URL
const API_BASE = "https://stats-api-nh00.onrender.com";  

//-----------------------------------------
// 1. Summary tables
//-----------------------------------------
fetch(`${API_BASE}/summary`)
  .then(r => r.json())
  .then(data => {
    const numericTable = document.querySelector("#summaryNumeric tbody");
    const categoricalTable = document.querySelector("#summaryCategorical tbody");

    for (const [varName, stats] of Object.entries(data)) {
      // Numeric
      if ("mean" in stats) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${varName}</td>
          <td>${stats.mean}</td>
          <td>${stats.median}</td>
          <td>${stats.std}</td>
          <td>${stats.iqr}</td>
          <td>${stats.min}</td>
          <td>${stats.max}</td>
          <td>${stats.n}</td>
        `;
        numericTable.appendChild(row);
      } 
      // Categorical
      else {
        for (const [cat, vals] of Object.entries(stats)) {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${varName}</td>
            <td>${cat}</td>
            <td>${vals.count}</td>
            <td>${vals.percent}%</td>
          `;
          categoricalTable.appendChild(row);
        }
      }
    }
  });


//-----------------------------------------
// 2. Scatter plots: pres vs continuous vars
//-----------------------------------------
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
      plugins: {
        title: { display: true, text: `${xvar} vs Pearson Residuals` }
      },
      scales: {
        x: { title: { display: true, text: xvar } },
        y: { title: { display: true, text: "Residuals" } }
      }
    }
  });
}

fetch(`${API_BASE}/scatter`)
  .then(r => r.json())
  .then(data => {
    makeScatter("scatterAge", data.Age, "Age");
    makeScatter("scatterLVEF", data.LVEF, "LVEF");
    makeScatter("scatterAus", data.aus, "aus");
  });


//-----------------------------------------
// 3. Binned mean residual plots
//-----------------------------------------
function makeBinnedBar(canvasId, groupedData, xvar) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  const labels = groupedData.map(d => d.bin);
  const means = groupedData.map(d => d.mean);
  const errors = groupedData.map(d => d.se);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: `Mean Residuals`,
        data: means,
        backgroundColor: "rgba(255, 159, 64, 0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: `${xvar} (Binned) vs Residuals` },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => `SE: ${errors[ctx.dataIndex].toFixed(3)}`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Residuals" } }
      }
    }
  });
}

fetch(`${API_BASE}/bins?n_bins=10`)
  .then(r => r.json())
  .then(data => {
    makeBinnedBar("binsAge", data.Age, "Age");
    makeBinnedBar("binsLVEF", data.LVEF, "LVEF");
    makeBinnedBar("binsAus", data.aus, "AusScore");
  });


//-----------------------------------------
// 4. Residuals by categorical vars
//-----------------------------------------
function makeCategoricalBar(canvasId, groupedData, xvar) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  const labels = groupedData.map(d => d[xvar]);
  const means = groupedData.map(d => d.mean);
  const errors = groupedData.map(d => d.se);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Mean Residual",
        data: means,
        backgroundColor: "rgba(75, 192, 192, 0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: `Residuals by ${xvar}` },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => `SE: ${errors[ctx.dataIndex].toFixed(3)}`
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Residuals" } }
      }
    }
  });
}

fetch(`${API_BASE}/categorical`)
  .then(r => r.json())
  .then(data => {
    makeCategoricalBar("catSex", data.Sex, "Sex");
    makeCategoricalBar("catNYHA", data.NYHA, "NYHA");
    makeCategoricalBar("catUrgency", data.urgency, "urgency");
    makeCategoricalBar("catSurgery", data.surgery, "surgery");
    makeCategoricalBar("catDiabetes", data.diabetes, "diabetes");
    makeCategoricalBar("catCKD", data.CKD, "CKD");
  });


//-----------------------------------------
// 5. Linear regression results table
//-----------------------------------------
fetch(`${API_BASE}/lm`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#lmTable tbody");
    Object.keys(data.coef).forEach(varName => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${varName}</td>
        <td>${data.coef[varName].toFixed(3)}</td>
        <td>${data.CI_lower[varName].toFixed(3)} – ${data.CI_upper[varName].toFixed(3)}</td>
        <td>${data.p_value[varName].toExponential(2)}</td>
      `;
      tbody.appendChild(row);
    });
  });
