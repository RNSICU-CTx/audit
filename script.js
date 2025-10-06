// Replace with your actual Render API URL
const API_URL = "https://stats-api-nh00.onrender.com/stats";

fetch(API_URL)
  .then(response => response.json())
  .then(data => {
    const labels = Object.keys(data);
    const means = labels.map(col => data[col].mean);
    const stds = labels.map(col => data[col].std);

    const ctx = document.getElementById('statsChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Mean',
            data: means,
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          },
          {
            label: 'Standard Deviation',
            data: stds,
            backgroundColor: 'rgba(153, 102, 255, 0.6)'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  })
  .catch(error => console.error('Error loading stats:', error));
