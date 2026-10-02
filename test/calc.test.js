// Checks calc.js against values computed by the corrected workbook
// (workbook/PES_Disperse_WashOff.xlsx). Run: node test/calc.test.js
const assert = require("assert");
const { compute } = require("../www/calc.js");

const close = (a, b, label) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), `${label}: ${a} ≠ ${b}`);

// Workbook defaults
let r = compute();
close(r.machine.V, 1120, "VTL");
assert.strictEqual(r.path, "rc");
close(r.wo1.flow, 180, "WO1 flow"); assert.ok(r.wo1.capped);
close(r.wo1.time, 9.873599087366344, "WO1 time");
close(r.wo1.water, 1777.247835725942, "W1");
assert.strictEqual(r.wo1.governs, "dye");
close(r.wo1.causticEnd, 0.21480207406759516, "caustic after WO1");
close(r.wo2.flow, 170.0964960582599, "WO2 flow");
close(r.wo2.time, 10, "WO2 time");
close(r.wo2.water, 1700.9649605825991, "W2");
close(r.wo2.causticEnd, 0.04704, "caustic final");
close(r.totals.dyeFinal, 0.01, "dye final");
close(r.totals.water, 3478.2127963085413, "total water");
close(r.ph[0].pH25, 12.08246421406662, "pH start");
close(r.ph[1].pH25, 11.393313385468161, "pH WO1");
close(r.ph[2].pH25, 10.733742228064765, "pH final");
close(r.ph[2].pHprocess, 9.753440650659117, "pH final @60");
close(r.neutral.acids[0].suppliedGL, 0.10524185215141961, "acetic g/L");
close(r.neutral.acids[0].suppliedKg, 0.11787087440958996, "acetic kg");
close(r.neutral.acids[1].suppliedGL, 0.08979611220888323, "formic g/L");

// High caustic consumption: caustic already below targets
r = compute({ causticConsumed: 90 });
assert.strictEqual(r.wo1.governs, "none");
close(r.wo1.time, 8, "edge1 WO1 time");
close(r.wo2.time, 19.32340442393634, "edge1 WO2 time");
close(r.wo2.causticEnd, 0.00672, "edge1 caustic final");

// Rinse only
r = compute({ shade: 0.2 });
assert.strictEqual(r.path, "rinse");
close(r.rinse.flow, 89.93174921552111, "rinse flow");
close(r.rinse.water, 899.3174921552111, "rinse water");

// Dark shade, 300 chamber
r = compute({ shade: 5, chamber: 300 });
close(r.wo1.time, 21.46996578183412, "edge3 WO1 time");
close(r.totals.water, 5899.016254738943, "edge3 water");
close(r.ph[2].pH25, 10.174950926893782, "edge3 pH");

// Nothing to rinse
r = compute({ shade: 0.05 });
assert.ok(r.rinse.notNeeded); close(r.totals.water, 0, "no rinse");

console.log("all calc checks passed");
