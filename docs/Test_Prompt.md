## Test rules:

1. Assume that the app functionality is correct, only change the tests to align with the app. If you think the app is broken, or is missing functionality then STOP and ASK.
2. All tests should identify all elements using playwright test IDs (Do not identify elements using text content)
3. Do not skip any tests
4. Do not change the purpose or overall functionality of each test unless instructed - ie. don't simplify the test to make the test pass
5. Do not continue on to the next test until each test passes
6. Do not run all tests with `npm run test`
7. Do not run tests in headed mode unless required
8. Run 1 test at a time (in series, not in parallel) with 1 worker per test (unless the test requires multiple workers)

## Test process:

1. Refer to the test results provided via chat and found in `test-results/`
2. Run each failing or skipped test individually.
3. Implement or make fixes to the test
4. If you are confused or unsure, or if you plan to make significant changes to the app or the test the STOP and ASK
5. Re-run the test to verify that it passes, if it fails then fix it and repeat.
6. Once all tests from a given suite all pass in isolation, then run the full suite to verify that they pass together
