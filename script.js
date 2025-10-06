// Render API URL
const API_BASE = "https://YOUR_API_URL";  

// --------------------
// 1. Basic stats chart
// --------------------
fetch(`${API_BASE}/stats`)
  .then(r => r.json())
  .then(data => {
    const labels = Object.keys(data);
    const means = labels.map(col => data[col].mean);
    const stds = labels.map(col => data[col].std);

    new Chart(document.getElementById("statsChart"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Mean", data: means, backgroundColor: "rgba(75, 192, 192, 0.6)" },
          { label: "Std Dev", data: stds, backgroundColor: "rgba(153, 102, 255, 0.6)" }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  });


// -----------------------------
// 2. Mortality by Sex bar chart
// -----------------------------
fetch(`${API_BASE}/mortality_by_group`)
  .then(r => r.json())
  .then(data => {
    const sexData = data["Sex"];
    const labels = sexData.map(d => d.Sex);
    const rates = sexData.map(d => d.percent);

    new Chart(document.getElementById("mortalitySexChart"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Mortality (%)", data: rates, backgroundColor: "rgba(255, 99, 132, 0.6)" }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  });


// -----------------------------
// 3. Calibration scatter plot
// -----------------------------
fetch(`${API_BASE}/calibration`)
  .then(r => r.json())
  .then(data => {
    const points = data.map(d => ({
      x: d.predicted_mean,
      y: d.observed_mean
    }));

    new Chart(document.getElementById("calibrationChart"), {
      type: "scatter",
      data: {
        datasets: [{
          label: "Calibration",
          data: points,
          backgroundColor: "rgba(54, 162, 235, 0.6)"
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Predicted mortality" }, min: 0, max: 0.2 },
          y: { title: { display: true, text: "Observed mortality" }, min: 0, max: 0.2 }
        }
      }
    });
  });

// -----------------------------
// 4. Logistic Regression table
// -----------------------------
fetch(`${API_BASE}/logistic_regression`)
  .then(r => r.json())
  .then(data => {
    const tbody = document.querySelector("#logitTable tbody");

    // data is a dict of variables → stats
    Object.keys(data.OR).forEach((variable) => {
      const or = data.OR[variable];
      const lower = data.CI_lower[variable];
      const upper = data.CI_upper[variable];
      const pval = data.p_value[variable];

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${variable}</td>
        <td>${or.toFixed(3)}</td>
        <td>${lower.toFixed(3)} – ${upper.toFixed(3)}</td>
        <td>${pval.toExponential(2)}</td>
      `;
      tbody.appendChild(row);
    });
  })
  .catch(err => console.error("Error fetching logistic regression:", err));
