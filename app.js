// =========================================================
// Canadian Tax Calculator — 2026 Tax Year (Federal + Alberta)
// =========================================================

// --- 2026 Tax Data ---

const FEDERAL_BRACKETS = [
  { min: 0,       max: 58523,   rate: 0.14   },
  { min: 58523,   max: 117045,  rate: 0.205  },
  { min: 117045,  max: 181440,  rate: 0.26   },
  { min: 181440,  max: 258482,  rate: 0.29   },
  { min: 258482,  max: Infinity, rate: 0.33  },
];

const ALBERTA_BRACKETS = [
  { min: 0,       max: 61200,   rate: 0.08   },
  { min: 61200,   max: 154259,  rate: 0.10   },
  { min: 154259,  max: 185111,  rate: 0.12   },
  { min: 185111,  max: 246813,  rate: 0.13   },
  { min: 246813,  max: 370220,  rate: 0.14   },
  { min: 370220,  max: Infinity, rate: 0.15  },
];

const ONTARIO_BRACKETS = [
  { min: 0,       max: 61200,   rate: 0.10   },
  { min: 61200,   max: 154259,  rate: 0.15   },
  { min: 154259,  max: 185111,  rate: 0.12   },
  { min: 185111,  max: 246813,  rate: 0.13   },
  { min: 246813,  max: 370220,  rate: 0.14   },
  { min: 370220,  max: Infinity, rate: 0.15  },
];

const FEDERAL_BPA = 16452;
const ALBERTA_BPA = 22323;

// Lowest bracket rates for BPA credit calculation
const FEDERAL_LOWEST_RATE = 0.14;
const ALBERTA_LOWEST_RATE = 0.08;

// --- Tax Calculation ---

function calculateBracketTax(income, brackets, bpa, lowestRate) {
  // The BPA creates a non-refundable credit at the lowest bracket rate
  const bpaCredit = Math.min(bpa, income) * lowestRate;

  let remaining = income;
  const details = [];
  let totalTax = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) {
      details.push({ ...bracket, taxable: 0, tax: 0 });
      continue;
    }

    const bracketSize = bracket.max === Infinity ? Infinity : bracket.max - bracket.min;
    const taxable = Math.min(remaining, bracketSize);
    const tax = taxable * bracket.rate;

    details.push({ ...bracket, taxable, tax });
    totalTax += tax;
    remaining -= taxable;
  }

  // Apply BPA credit (tax cannot go below 0)
  totalTax = Math.max(0, totalTax - bpaCredit);

  return { totalTax, details, bpaCredit };
}

function getMarginalRate(income, brackets) {
  for (const bracket of brackets) {
    if (income <= bracket.max) return bracket.rate;
  }
  return brackets[brackets.length - 1].rate;
}

function calculate(annualIncome) {
  const federal = calculateBracketTax(annualIncome, FEDERAL_BRACKETS, FEDERAL_BPA, FEDERAL_LOWEST_RATE);
  const provincial = calculateBracketTax(annualIncome, ALBERTA_BRACKETS, ALBERTA_BPA, ALBERTA_LOWEST_RATE);

  const totalTax = federal.totalTax + provincial.totalTax;
  const netIncome = annualIncome - totalTax;

  const federalMarginal = annualIncome > 0 ? getMarginalRate(annualIncome, FEDERAL_BRACKETS) : 0;
  const provincialMarginal = annualIncome > 0 ? getMarginalRate(annualIncome, ALBERTA_BRACKETS) : 0;
  const marginalRate = federalMarginal + provincialMarginal;
  const averageRate = annualIncome > 0 ? totalTax / annualIncome : 0;

  return {
    grossIncome: annualIncome,
    federal,
    provincial,
    totalTax,
    netIncome,
    marginalRate,
    averageRate,
  };
}

// --- Formatting ---

function fmt(n) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

function pct(n) {
  return (n * 100).toFixed(2) + '%';
}

function adjustByProvince(province) {

}

function fmtBracket(bracket) {
  if (bracket.max === Infinity) return fmt(bracket.min) + '+';
  return fmt(bracket.min) + ' – ' + fmt(bracket.max);
}

// --- DOM ---

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const incomeInput = $('#income-amount');
const incomeLabel = $('#income-label');
const hourlyOptions = $('#hourly-options');
const hoursInput = $('#hours-per-week');
const weeksInput = $('#weeks-per-year');
const calculateBtn = $('#calculate-btn');
const inputSection = $('#input-section');
const resultsSection = $('#results-section');
const resetBtn = $('#reset-btn');

let currentType = 'yearly';

const typeLabels = {
  yearly: 'Annual Salary',
  hourly: 'Hourly Wage',
  monthly: 'Monthly Income',
  biweekly: 'Biweekly Pay',
};

// --- Income Type Switching ---

$$('.type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.type-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    incomeLabel.textContent = typeLabels[currentType];

    if (currentType === 'hourly') {
      hourlyOptions.classList.remove('hidden');
    } else {
      hourlyOptions.classList.add('hidden');
    }

    incomeInput.focus();
  });
});

// --- Annualize ---

function getAnnualIncome() {
  const amount = parseFloat(incomeInput.value) || 0;
  switch (currentType) {
    case 'yearly':
      return amount;
    case 'hourly': {
      const hours = parseFloat(hoursInput.value) || 40;
      const weeks = parseFloat(weeksInput.value) || 52;
      return amount * hours * weeks;
    }
    case 'monthly':
      return amount * 12;
    case 'biweekly':
      return amount * 26;
    default:
      return amount;
  }
}

// --- Render Results ---

function renderBracketTable(tableId, details) {
  const tbody = $(`#${tableId} tbody`);
  tbody.innerHTML = '';

  let totalTaxable = 0;
  let totalTax = 0;

  details.forEach((d) => {
    if (d.taxable === 0 && d.min !== 0) return; // skip empty upper brackets but show first
    totalTaxable += d.taxable;
    totalTax += d.tax;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtBracket(d)}</td>
      <td>${(d.rate * 100).toFixed(1)}%</td>
      <td>${fmt(d.taxable)}</td>
      <td class="tax-amount">${fmt(d.tax)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPeriodTable(gross, tax, net) {
  const tbody = $('#period-table tbody');
  tbody.innerHTML = '';

  const periods = [
    { label: 'Annual',    div: 1 },
    { label: 'Monthly',   div: 12 },
    { label: 'Biweekly',  div: 26 },
    { label: 'Weekly',    div: 52 },
    { label: 'Daily',     div: 260 },
    { label: 'Hourly (40h/wk)', div: 2080 },
  ];

  periods.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.label}</td>
      <td>${fmt(gross / p.div)}</td>
      <td>${fmt(tax / p.div)}</td>
      <td>${fmt(net / p.div)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResults(result) {
  // Summary values
  $('#res-gross').textContent = fmt(result.grossIncome);
  $('#res-total-tax').textContent = fmt(result.totalTax);
  $('#res-net').textContent = fmt(result.netIncome);

  // Rates
  $('#res-marginal').textContent = pct(result.marginalRate);
  $('#res-average').textContent = pct(result.averageRate);

  // Federal breakdown
  $('#fed-summary').innerHTML = `
    <span class="label">Federal Tax (after BPA credit of ${fmt(result.federal.bpaCredit)})</span>
    <span class="value">${fmt(result.federal.totalTax)}</span>
  `;
  renderBracketTable('fed-table', result.federal.details);

  // Provincial breakdown
  $('#prov-summary').innerHTML = `
    <span class="label">Alberta Tax (after BPA credit of ${fmt(result.provincial.bpaCredit)})</span>
    <span class="value">${fmt(result.provincial.totalTax)}</span>
  `;
  renderBracketTable('prov-table', result.provincial.details);

  // Period table
  renderPeriodTable(result.grossIncome, result.totalTax, result.netIncome);

  // Show results, hide input
  inputSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Events ---

calculateBtn.addEventListener('click', () => {
  const annual = getAnnualIncome();
  if (annual <= 0) {
    incomeInput.focus();
    incomeInput.style.borderColor = 'var(--accent-red)';
    incomeInput.style.boxShadow = '0 0 0 3px var(--accent-red-glow)';
    setTimeout(() => {
      incomeInput.style.borderColor = '';
      incomeInput.style.boxShadow = '';
    }, 1500);
    return;
  }
  const result = calculate(annual);
  renderResults(result);
});

// Allow Enter key to trigger calculation
incomeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calculateBtn.click();
});

resetBtn.addEventListener('click', () => {
  resultsSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  incomeInput.value = '';
  incomeInput.focus();
});
