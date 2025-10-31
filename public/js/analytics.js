const dailyCanvas = document.querySelector('#daily-chart');
const weeklyCanvas = document.querySelector('#weekly-chart');
const monthlyCanvas = document.querySelector('#monthly-chart');
const windowSelect = document.querySelector('#window-select');

let dailyChart;
let weeklyChart;
let monthlyChart;

function buildChart(ctx, existingChart, config) {
  if (existingChart) {
    existingChart.data = config.data;
    existingChart.options = config.options;
    existingChart.update();
    return existingChart;
  }
  return new window.Chart(ctx, config);
}

function formatDailyLabel(value) {
  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(
    new Date(value)
  );
}

function formatWeeklyLabel(period) {
  const [year, week] = period.split('-');
  return `Week ${Number(week)} · ${year}`;
}

function formatMonthlyLabel(period) {
  const [year, month] = period.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString([], {
    month: 'short',
    year: 'numeric',
  });
}

async function fetchStats(windowSize) {
  const response = await fetch(`/api/stats?window=${windowSize}`);
  if (!response.ok) {
    throw new Error('Failed to load stats');
  }
  return response.json();
}

function totalsFrom(entries) {
  if (!entries.length) {
    return { labels: [], values: [] };
  }
  return {
    labels: entries.map((entry) => entry.period),
    values: entries.map((entry) => entry.count),
  };
}

function colors() {
  return {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  };
}

function renderCharts(data) {
  const daily = totalsFrom(data.daily);
  const weekly = totalsFrom(data.weekly);
  const monthly = totalsFrom(data.monthly);

  dailyChart = buildChart(
    dailyCanvas,
    dailyChart,
    {
      type: 'line',
      data: {
        labels: daily.labels.map(formatDailyLabel),
        datasets: [
          {
            label: 'Daily logs',
            data: daily.values,
            tension: 0.3,
            fill: true,
            ...colors(),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, precision: 0 },
        },
      },
    }
  );

  weeklyChart = buildChart(
    weeklyCanvas,
    weeklyChart,
    {
      type: 'bar',
      data: {
        labels: weekly.labels.map(formatWeeklyLabel),
        datasets: [
          {
            label: 'Weekly logs',
            data: weekly.values,
            ...colors(),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, precision: 0 },
        },
      },
    }
  );

  monthlyChart = buildChart(
    monthlyCanvas,
    monthlyChart,
    {
      type: 'bar',
      data: {
        labels: monthly.labels.map(formatMonthlyLabel),
        datasets: [
          {
            label: 'Monthly logs',
            data: monthly.values,
            ...colors(),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, precision: 0 },
        },
      },
    }
  );
}

async function refresh() {
  const windowSize = windowSelect.value;
  try {
    const stats = await fetchStats(windowSize);
    renderCharts(stats);
  } catch (error) {
    alert(error.message);
  }
}

windowSelect.addEventListener('change', refresh);

refresh();
