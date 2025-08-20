import { readFileSync, writeFileSync, existsSync } from 'fs';

console.log('📈 Updating Historical Performance Data...');

// Read current performance report
const currentReport = JSON.parse(readFileSync('performance-report.json', 'utf8'));

// Initialize or load historical data
let historicalData = [];
const historyFile = 'docs/performance-history.json';

if (existsSync(historyFile)) {
  try {
    historicalData = JSON.parse(readFileSync(historyFile, 'utf8'));
    console.log(`📚 Loaded ${historicalData.length} historical records`);
  } catch (e) {
    console.log('⚠️ Could not load historical data, starting fresh');
    historicalData = [];
  }
}

// Create new data point
const newDataPoint = {
  timestamp: currentReport.generatedAt,
  date: new Date(currentReport.generatedAt).toISOString().split('T')[0],
  time: new Date(currentReport.generatedAt).toLocaleTimeString(),
  version: currentReport.version,
  system: {
    platform: currentReport.system.platform,
    architecture: currentReport.system.architecture,
    nodeVersion: currentReport.system.nodeVersion,
    cpuCores: currentReport.system.cpuCount,
    totalMemory: currentReport.system.totalMemory
  },
  metrics: {
    bufferCreation: {
      throughput: currentReport.benchmarks.bufferCreation.throughput,
      duration: currentReport.benchmarks.bufferCreation.duration
    },
    getStatePerformance: {
      throughput: currentReport.benchmarks.getStatePerformance.throughput,
      duration: currentReport.benchmarks.getStatePerformance.duration
    },
    pipelineFactory: {
      throughput: currentReport.benchmarks.pipelineFactory.throughput,
      duration: currentReport.benchmarks.pipelineFactory.duration
    },
    documentProcessing: {
      throughput: currentReport.benchmarks.documentProcessing.throughput,
      characterThroughput: currentReport.benchmarks.documentProcessing.characterThroughput,
      duration: currentReport.benchmarks.documentProcessing.duration
    },
    binaryStreaming: {
      throughput: currentReport.benchmarks.binaryStreaming.throughput,
      dataThroughput: currentReport.benchmarks.binaryStreaming.dataThroughput,
      duration: currentReport.benchmarks.binaryStreaming.duration
    }
  }
};

// Add new data point
historicalData.push(newDataPoint);

// Keep only last 100 records to prevent file from growing too large
if (historicalData.length > 100) {
  historicalData = historicalData.slice(-100);
  console.log('🗂️ Trimmed to last 100 records');
}

// Save updated historical data
writeFileSync(historyFile, JSON.stringify(historicalData, null, 2));

// Generate aggregated statistics
const recentData = historicalData.slice(-30); // Last 30 runs
const metrics = ['bufferCreation', 'getStatePerformance', 'pipelineFactory', 'documentProcessing', 'binaryStreaming'];

const statistics = {
  generatedAt: new Date().toISOString(),
  totalRecords: historicalData.length,
  recentRecords: recentData.length,
  dateRange: {
    first: historicalData[0]?.timestamp,
    last: historicalData[historicalData.length - 1]?.timestamp
  },
  trends: {}
};

// Calculate trends for each metric
metrics.forEach(metric => {
  if (recentData.length >= 2) {
    const values = recentData.map(d => d.metrics[metric].throughput);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate trend (simple linear regression slope)
    const n = values.length;
    const sumX = n * (n + 1) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = n * (n + 1) * (2 * n + 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trend = slope > 0 ? 'improving' : slope < 0 ? 'declining' : 'stable';
    
    statistics.trends[metric] = {
      current: values[values.length - 1],
      average: Math.round(avg),
      minimum: min,
      maximum: max,
      trend: trend,
      trendValue: slope,
      improvement: ((values[values.length - 1] - values[0]) / values[0] * 100).toFixed(2) + '%'
    };
  }
});

// Save statistics
writeFileSync('docs/performance-statistics.json', JSON.stringify(statistics, null, 2));

console.log('✅ Historical data updated:');
console.log(`📊 Total records: ${historicalData.length}`);
console.log(`📈 Recent average (Buffer Creation): ${statistics.trends.bufferCreation?.average?.toLocaleString() || 'N/A'} buffers/sec`);
console.log(`📈 Recent average (getState): ${statistics.trends.getStatePerformance?.average?.toLocaleString() || 'N/A'} ops/sec`);
console.log(`📈 Recent average (Pipeline): ${statistics.trends.pipelineFactory?.average?.toLocaleString() || 'N/A'} pipelines/sec`);

// Generate Chart.js data format
const chartData = {
  labels: historicalData.map(d => new Date(d.timestamp).toLocaleDateString()),
  datasets: [
    {
      label: 'Buffer Creation (K/sec)',
      data: historicalData.map(d => Math.round(d.metrics.bufferCreation.throughput / 1000)),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1
    },
    {
      label: 'getState() Performance (M/sec)',
      data: historicalData.map(d => Math.round(d.metrics.getStatePerformance.throughput / 1000000)),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.1
    },
    {
      label: 'Pipeline Factory (K/sec)',
      data: historicalData.map(d => Math.round(d.metrics.pipelineFactory.throughput / 1000)),
      borderColor: 'rgb(255, 205, 86)',
      backgroundColor: 'rgba(255, 205, 86, 0.2)',
      tension: 0.1
    },
    {
      label: 'Document Processing (K/sec)',
      data: historicalData.map(d => Math.round(d.metrics.documentProcessing.throughput / 1000)),
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      tension: 0.1
    }
  ]
};

writeFileSync('docs/chart-data.json', JSON.stringify(chartData, null, 2));
console.log('📊 Chart data generated: docs/chart-data.json');