const fs = require('fs');
const path = require('path');

// Paths
const HISTORY_FILE = path.join(__dirname, 'history.json');
const FRONTEND_RESULTS = path.join(__dirname, '..', '..', 'temp', 'frontend', 'test-results.json');
const E2E_RESULTS = path.join(__dirname, '..', '..', 'temp', 'e2e', 'test-results.json');
const MAX_RUNS = 10;

function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (error) {
      console.warn('Failed to parse history.json, starting fresh:', error.message);
    }
  }
  return { runs: [] };
}

function parseFrontendResults() {
  if (!fs.existsSync(FRONTEND_RESULTS)) {
    console.warn('Frontend test results not found');
    return { passed: 0, failed: 0, total: 0 };
  }

  try {
    const data = JSON.parse(fs.readFileSync(FRONTEND_RESULTS, 'utf8'));
    
    // Vitest JSON reporter format
    let passed = 0;
    let failed = 0;
    
    if (data.testResults) {
      data.testResults.forEach(file => {
        if (file.assertionResults) {
          file.assertionResults.forEach(test => {
            if (test.status === 'passed') passed++;
            else if (test.status === 'failed') failed++;
          });
        }
      });
    } else if (data.numPassedTests !== undefined) {
      // Alternative format
      passed = data.numPassedTests || 0;
      failed = data.numFailedTests || 0;
    }

    const total = passed + failed;
    return { passed, failed, total };
  } catch (error) {
    console.error('Error parsing frontend results:', error.message);
    return { passed: 0, failed: 0, total: 0 };
  }
}

function parseE2EResults() {
  if (!fs.existsSync(E2E_RESULTS)) {
    console.warn('E2E test results not found');
    return { passed: 0, failed: 0, total: 0 };
  }

  try {
    const data = JSON.parse(fs.readFileSync(E2E_RESULTS, 'utf8'));
    
    // Playwright JSON reporter format
    let passed = 0;
    let failed = 0;

    if (data.suites) {
      function countTests(suites) {
        suites.forEach(suite => {
          if (suite.specs) {
            suite.specs.forEach(spec => {
              if (spec.tests) {
                spec.tests.forEach(test => {
                  if (test.results && test.results.length > 0) {
                    const result = test.results[0];
                    if (result.status === 'passed' || result.status === 'expected') {
                      passed++;
                    } else if (result.status === 'failed' || result.status === 'timedOut') {
                      failed++;
                    }
                  }
                });
              }
            });
          }
          if (suite.suites) {
            countTests(suite.suites);
          }
        });
      }
      countTests(data.suites);
    }

    const total = passed + failed;
    return { passed, failed, total };
  } catch (error) {
    console.error('Error parsing E2E results:', error.message);
    return { passed: 0, failed: 0, total: 0 };
  }
}

function formatDuration(ms) {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function aggregate() {
  const history = loadHistory();
  
  // Parse test results
  const frontend = parseFrontendResults();
  const e2e = parseE2EResults();

  // Get metadata from environment
  const runNumber = process.env.GITHUB_RUN_NUMBER || Date.now().toString();
  const commit = process.env.GITHUB_SHA || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Calculate duration (if available from test results)
  let totalDuration = 0;
  if (fs.existsSync(FRONTEND_RESULTS)) {
    try {
      const frontendData = JSON.parse(fs.readFileSync(FRONTEND_RESULTS, 'utf8'));
      totalDuration += frontendData.duration || 0;
    } catch (e) {}
  }
  if (fs.existsSync(E2E_RESULTS)) {
    try {
      const e2eData = JSON.parse(fs.readFileSync(E2E_RESULTS, 'utf8'));
      totalDuration += e2eData.duration || 0;
    } catch (e) {}
  }

  // Create new run entry
  const newRun = {
    runNumber: parseInt(runNumber, 10),
    commit,
    timestamp,
    frontend,
    e2e,
    duration: formatDuration(totalDuration),
    reportUrl: `reports/run-${runNumber}/index.html`
  };

  // Add to history (newest first)
  history.runs.unshift(newRun);

  // Keep only last MAX_RUNS
  if (history.runs.length > MAX_RUNS) {
    history.runs = history.runs.slice(0, MAX_RUNS);
  }

  // Save updated history
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  
  console.log('Test results aggregated successfully');
  console.log(`Frontend: ${frontend.passed}/${frontend.total} passed`);
  console.log(`E2E: ${e2e.passed}/${e2e.total} passed`);
  console.log(`Total runs in history: ${history.runs.length}`);
}

// Run aggregation
try {
  aggregate();
} catch (error) {
  console.error('Aggregation failed:', error);
  process.exit(1);
}
