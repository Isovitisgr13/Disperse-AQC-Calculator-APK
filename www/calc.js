/*
 * Aquachron disperse-dye wash-off calculator (PES, Sclavos Athena).
 * Same model as workbook/PES_Disperse_WashOff.xlsx (corrected version).
 *
 * AQC model: fresh water fed continuously through a perfectly mixed bath,
 *   C = C0 · exp(−W / VTL)   →   W = VTL · ln(C0 / Cend)
 */
(function (root) {
  "use strict";

  var DEFAULTS = {
    chamber: 250,          // Athena3A chamber size
    load: 250,             // fabric load K (kg)
    carryLR: 3,            // carry-over liquor ratio LRf (L/kg)
    flowCap: 180,          // max AQC water flow (L/min)

    shade: 1,              // % o.w.f.
    rcTemp: 80,            // °C — RC, 1st AQC and AQC-only step
    lightBreak: 1, darkBreak: 3,
    fLight: 0.95, fMedium: 0.9, fDark: 0.85,

    causticMode: "be",     // "be" | "pct"
    causticBe: 48,
    causticPct: 50,

    causticConsumed: 30,   // % of dosed caustic consumed in RC
    causticWo1: 0.45,      // caustic target after WO1 (g/L commercial)
    causticEnd: 0.2,       // caustic target after WO2 (g/L commercial)
    wo1Time: 8,            // min
    coolFrom: 80, coolTo: 60, coolRate: 2,

    rinseTime: 10,
    dyeTarget: 0.01,       // g/L

    refTemp: 25,
    alkFactor: 3,
    targetPH: 6,
    aceticPurity: 99.5,
    formicPurity: 85
  };

  var NAOH_M = 40;
  var ACIDS = [
    { key: "acetic", name: "Acetic acid", formula: "CH₃COOH", pKa: 4.76, M: 60.05, purityKey: "aceticPurity" },
    { key: "formic", name: "Formic acid", formula: "HCOOH", pKa: 3.75, M: 46.03, purityKey: "formicPurity" }
  ];

  function pKw(tC) {
    var T = tC + 273.15;
    return 4787.3 / T + 7.1321 * Math.log10(T) + 0.010365 * T - 22.801;
  }
  // Perry's Handbook fit, valid 25–52 °Bé
  function beToPct(be) { return 0.000384159718 * be * be * be - 0.027172392 * be * be + 1.60225559 * be - 10.0779744; }
  function pctToBe(p) { return 0.0000304444997 * p * p * p - 0.0116847267 * p * p + 1.49582175 * p + 0.537562548; }
  function lnPos(a, b) { return a > 0 && b > 0 ? Math.max(0, Math.log(a / b)) : 0; }

  function doses(shade) {
    if (shade < 0.3) return { caustic: 0, hydros: 0 };
    if (shade <= 2) return { caustic: 1.5, hydros: 2 };
    if (shade <= 4) return { caustic: 2.25, hydros: 3 };
    return { caustic: 3, hydros: 4 };
  }

  // One AQC step: planned time, required log-reduction → flow, actual time, water.
  function phase(V, plannedTime, need, cap) {
    var wanted = plannedTime > 0 ? (V / plannedTime) * need : (need > 0 ? Infinity : 0);
    return {
      need: need,
      plannedTime: plannedTime,
      flow: Math.min(cap, wanted),
      capped: wanted > cap,
      time: need > 0 ? Math.max(plannedTime, (V * need) / cap) : plannedTime,
      water: V * need
    };
  }

  function phAt(causticComm, pct, tC, pKwRef) {
    var naoh = causticComm * pct / 100;
    var oh = naoh / NAOH_M;
    return {
      caustic: causticComm, naoh: naoh, oh: oh, temp: tC,
      pHprocess: oh > 0 ? pKw(tC) + Math.log10(oh) : null,
      pH25: oh > 0 ? pKwRef + Math.log10(oh) : null
    };
  }

  function compute(input) {
    var p = Object.assign({}, DEFAULTS, input || {});
    var warnings = [];

    // Machine & liquor
    var deadVol = Number(p.chamber) === 250 ? 370 : 410;
    var carryVol = p.load * p.carryLR;
    var V = deadVol + carryVol;
    var machine = { deadVol: deadVol, carryVol: carryVol, V: V, LRa: p.load > 0 ? V / p.load : 0 };

    // Shade → path, doses, exhaustion
    var path = p.shade < 0.3 ? "rinse" : "rc";
    var d = doses(p.shade);
    var f = p.shade < p.lightBreak ? p.fLight : (p.shade < p.darkBreak ? p.fMedium : p.fDark);
    var shadeBand = p.shade < 0.3 ? "Very light" : p.shade <= 2 ? "Light–medium" : p.shade <= 4 ? "Medium–dark" : "Dark";

    // Commercial caustic strength
    var bePart = p.causticMode === "be";
    var pct = bePart ? beToPct(p.causticBe) : p.causticPct;
    var beEq = bePart ? p.causticBe : pctToBe(p.causticPct);
    var density = 145 / (145 - beEq);
    if (bePart && (p.causticBe < 25 || p.causticBe > 52)) warnings.push("Caustic strength is outside 25–52 °Bé, where the °Bé → % NaOH fit is valid.");
    var caustic = { pct: pct, be: beEq, density: density };

    var rcBath = {
      causticDose: d.caustic,
      causticNaOH: d.caustic * pct / 100,
      causticKg: d.caustic * V / 1000,
      causticL: d.caustic * V / 1000 / density,
      hydrosDose: d.hydros,
      hydrosKg: d.hydros * V / 1000
    };

    // Dye mass balance
    var dyeApplied = p.shade / 100 * p.load;
    var dyeC0 = V > 0 ? dyeApplied * (1 - f) * 1000 / V : 0;
    var dye = { applied: dyeApplied, fixed: f, unfixed: 1 - f, C0: dyeC0, target: p.dyeTarget };

    var result = {
      inputs: p, machine: machine, path: path, shadeBand: shadeBand,
      caustic: caustic, rcBath: rcBath, dye: dye, warnings: warnings
    };

    if (path === "rc") {
      // Wash-off 1 at RC temperature
      var c0 = d.caustic * (1 - p.causticConsumed / 100);
      var L1c = lnPos(c0, p.causticWo1);
      var L2c = lnPos(p.causticWo1, p.causticEnd);
      var coolTime = p.coolRate > 0 ? (p.coolFrom - p.coolTo) / p.coolRate : 0;
      var split = L1c + L2c > 0 ? L1c / (L1c + L2c) : (p.wo1Time + coolTime > 0 ? p.wo1Time / (p.wo1Time + coolTime) : 0.5);
      var dyeMidPlan = dyeC0 > 0 ? dyeC0 * Math.pow(p.dyeTarget / dyeC0, split) : 0;
      var Ld1 = lnPos(dyeC0, dyeMidPlan);
      var wo1 = phase(V, p.wo1Time, Math.max(L1c, Ld1), p.flowCap);
      wo1.governs = wo1.need === 0 ? "none" : (Ld1 > L1c ? "dye" : "caustic");
      wo1.temp = p.rcTemp;
      wo1.causticStart = c0;
      wo1.causticEnd = c0 * Math.exp(-wo1.water / V);
      wo1.dyeStart = dyeC0;
      wo1.dyeEnd = dyeC0 * Math.exp(-wo1.water / V);

      // Wash-off 2 while cooling — starts from the ACTUAL residuals after WO1
      var L2cAct = lnPos(wo1.causticEnd, p.causticEnd);
      var Ld2 = lnPos(wo1.dyeEnd, p.dyeTarget);
      var wo2 = phase(V, coolTime, Math.max(L2cAct, Ld2), p.flowCap);
      wo2.governs = wo2.need === 0 ? "none" : (Ld2 > L2cAct ? "dye" : "caustic");
      wo2.tempFrom = p.coolFrom;
      wo2.tempTo = p.coolTo;
      wo2.causticStart = wo1.causticEnd;
      wo2.causticEnd = wo1.causticEnd * Math.exp(-wo2.water / V);
      wo2.dyeStart = wo1.dyeEnd;
      wo2.dyeEnd = wo1.dyeEnd * Math.exp(-wo2.water / V);
      if (wo2.time > coolTime + 1e-9) warnings.push("The 2nd AQC needs more time than the cooling ramp at the flow cap; keep running AQC at " + p.coolTo + " °C until it finishes.");

      // pH through the wash-off (actual caustic)
      var pKwRef = pKw(p.refTemp);
      var ph = [
        Object.assign({ stage: "After reduction clearing" }, phAt(c0, pct, p.rcTemp, pKwRef)),
        Object.assign({ stage: "After 1st AQC" }, phAt(wo1.causticEnd, pct, p.rcTemp, pKwRef)),
        Object.assign({ stage: "After 2nd AQC (cooled)" }, phAt(wo2.causticEnd, pct, p.coolTo, pKwRef))
      ];

      // Acid neutralisation to target pH (weak-acid charge balance)
      var alk = wo2.causticEnd * pct / 100 * p.alkFactor;
      var Cb = alk / NAOH_M;
      var H = Math.pow(10, -p.targetPH);
      var OH = Math.pow(10, p.targetPH - pKwRef);
      var acids = ACIDS.map(function (a) {
        var Ka = Math.pow(10, -a.pKa);
        var mol = Math.max(0, (Cb + H - OH) * (Ka + H) / Ka);
        var pure = mol * a.M;
        var purity = p[a.purityKey];
        var supplied = purity > 0 ? pure / (purity / 100) : 0;
        return {
          key: a.key, name: a.name, formula: a.formula, pKa: a.pKa, M: a.M, purity: purity,
          mol: mol, pureGL: pure, suppliedGL: supplied,
          pureKg: pure * V / 1000, suppliedKg: supplied * V / 1000
        };
      });

      result.wo1 = wo1;
      result.wo2 = wo2;
      result.coolTime = coolTime;
      result.ph = ph;
      result.neutral = { naoh: wo2.causticEnd * pct / 100, alk: alk, Cb: Cb, targetPH: p.targetPH, acids: acids };
      result.totals = { time: wo1.time + wo2.time, water: wo1.water + wo2.water, dyeFinal: wo2.dyeEnd, causticFinal: wo2.causticEnd };
    } else {
      var need = lnPos(dyeC0, p.dyeTarget);
      var rinse = phase(V, need > 0 ? p.rinseTime : 0, need, p.flowCap);
      rinse.temp = p.rcTemp;
      rinse.dyeStart = dyeC0;
      rinse.dyeEnd = dyeC0 * Math.exp(-rinse.water / V);
      rinse.notNeeded = need === 0;
      result.rinse = rinse;
      result.totals = { time: rinse.time, water: rinse.water, dyeFinal: rinse.dyeEnd, causticFinal: 0 };
    }
    result.totals.waterPerKg = p.load > 0 ? result.totals.water / p.load : 0;
    return result;
  }

  var api = { compute: compute, DEFAULTS: DEFAULTS, pKw: pKw, beToPct: beToPct, pctToBe: pctToBe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AquachronCalc = api;
})(this);
