// Render API URL
const API_BASE = "https://stats-api-nh00.onrender.com";  

//-----------------------------------------
// 1. Combined summary table
//-----------------------------------------
fetch(`${API_BASE}/summary`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#summaryTable tbody");

    data.forEach(row => {
      const tr = document.createElement("tr");

      // Continuous variables
      if (row.type === "continuous") {
        tr.innerHTML = `
          <td>${row.variable}</td>
          <td>${row.type}</td>
          <td>-</td>
          <td>${row.mean}</td>
          <td>${row.median}</td>
          <td>${row.std}</td>
          <td>${row.iqr}</td>
          <td>${row.min}</td>
          <td>${row.max}</td>
          <td>${row.n}</td>
          <td>-</td>
          <td>-</td>
        `;
      }

      // Categorical variables
      if (row.type === "categorical") {
        tr.innerHTML = `
          <td>${row.variable}</td>
          <td>${row.type}</td>
          <td>${row.category}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>${row.count}</td>
          <td>${row.percent}%</td>
        `;
      }

      tbody.appendChild(tr);
    });
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


//-----------------------------------------
// 6. Raw data display (de-identified)
//-----------------------------------------
document.getElementById("toggleRaw").addEventListener("click", () => {
  const container = document.getElementById("rawDataContainer");

  if (container.style.display === "none") {
    container.style.display = "block";

    // Only fetch once
    if (!container.dataset.loaded) {
      fetch(`${API_BASE}/data`)
        .then(r => r.json())
        .then(data => {
          const headerRow = document.getElementById("rawDataHeader");
          const tbody = document.querySelector("#rawDataTable tbody");

          // Build header
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

          container.dataset.loaded = true; // mark as loaded
        });
    }
  } else {
    container.style.display = "none";
  }
});
