# Test Dashboard

This directory contains the GitHub Pages test dashboard for ImmichVR.

## Files

- **index.html** - Static dashboard page displaying test results
- **aggregate.js** - Node.js script that aggregates test results into history.json
- **history.json** - Stores the last 10 test run results (auto-generated)

## How It Works

1. GitHub Actions runs tests and generates JSON reports
2. The `aggregate.js` script parses the JSON results
3. Results are added to `history.json` (keeping last 10 runs)
4. Dashboard and reports are deployed to the `gh-pages` branch
5. GitHub Pages serves the static site

## Local Testing

To test the aggregation script locally:

```bash
# Create mock test results
mkdir -p ../../temp/frontend ../../temp/e2e

# Run aggregation
node aggregate.js

# Serve the dashboard locally
npx serve .
```

## Dashboard Features

- **Separate test type statistics** - Frontend (Vitest) and E2E (Playwright) shown separately
- **Visual history chart** - Stacked bar chart showing last 10 runs
- **Detailed results table** - Per-run breakdown with links to full Playwright reports
- **Dark theme** - Matches GitHub's design language
