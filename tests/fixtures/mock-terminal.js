// @ts-check

Object.defineProperties(process.stdout, {
  columns: { configurable: true, value: 120 },
  rows: { configurable: true, value: 40 },
});
