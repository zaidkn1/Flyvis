// ===== FIREBASE SETUP =====
const firebaseConfig = {
  apiKey: "AIzaSyBPGTMgZtu37v8IWy6P_iPqsJIZNC8cw2o",
  authDomain: "fly-s-8baec.firebaseapp.com",
  projectId: "fly-s-8baec",
  storageBucket: "fly-s-8baec.firebasestorage.app",
  messagingSenderId: "783074951735",
  appId: "1:783074951735:web:8880bd5a1a15fe3b43f5b2"
};

// Initialize Firebase using compat SDK
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== GLOBAL MULTI-CURRENCY ENGINE =====
const CURRENCY_CONFIG = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '', rate: 86.8 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '', rate: 1.0 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', flag: '', rate: 3.67 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '', rate: 0.95 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '', rate: 0.79 },
  SAR: { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', flag: '', rate: 3.75 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '', rate: 1.35 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '', rate: 1.42 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '', rate: 1.58 },
  QAR: { code: 'QAR', symbol: 'QAR ', name: 'Qatari Riyal', flag: '', rate: 3.64 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '', rate: 34.5 }
};

function detectUserCurrency() {
  const saved = localStorage.getItem('flyvis_currency');
  if (saved && CURRENCY_CONFIG[saved]) return saved;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/kolkata|calcutta|india/i.test(tz)) return 'INR';
    if (/dubai/i.test(tz)) return 'AED';
    if (/riyadh/i.test(tz)) return 'SAR';
    if (/singapore/i.test(tz)) return 'SGD';
    if (/bangkok/i.test(tz)) return 'THB';
    if (/london/i.test(tz)) return 'GBP';
    if (/toronto|vancouver|canada/i.test(tz)) return 'CAD';
    if (/sydney|melbourne|australia/i.test(tz)) return 'AUD';
    if (/paris|berlin|rome|madrid|amsterdam|brussels|vienna/i.test(tz)) return 'EUR';
    if (/new_york|chicago|los_angeles|denver|america/i.test(tz)) return 'USD';
  } catch (e) {}

  return 'INR'; // Default to INR
}

let activeCurrency = detectUserCurrency();

function getSelectedCurrency() {
  return activeCurrency;
}

function setSelectedCurrency(currencyCode) {
  if (CURRENCY_CONFIG[currencyCode]) {
    activeCurrency = currencyCode;
    localStorage.setItem('flyvis_currency', currencyCode);
    syncCurrencyDropdowns();
    window.dispatchEvent(new CustomEvent('flyvisCurrencyChanged', { detail: { currency: currencyCode } }));
  }
}

function formatCurrencyPrice(rawPrice, targetCurrency = activeCurrency) {
  if (rawPrice === null || rawPrice === undefined || rawPrice === '') return '—';
  const str = String(rawPrice).trim();
  
  if (/^free/i.test(str) || /^100%\s*free/i.test(str) || /^visa\s*free/i.test(str) || /^ask/i.test(str)) {
    return str;
  }

  const targetConfig = CURRENCY_CONFIG[targetCurrency] || CURRENCY_CONFIG.INR;
  
  const numMatch = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  if (!numMatch) return str;
  const amount = parseFloat(numMatch[1]);

  // Determine source currency of raw price (Default is INR - Rupees)
  let sourceCurrency = 'INR';
  if (str.includes('$') || /usd/i.test(str)) {
    sourceCurrency = 'USD';
  } else if (str.includes('AED') || /aed/i.test(str)) {
    sourceCurrency = 'AED';
  } else if (str.includes('€') || /eur/i.test(str)) {
    sourceCurrency = 'EUR';
  } else if (str.includes('£') || /gbp/i.test(str)) {
    sourceCurrency = 'GBP';
  } else if (str.includes('SAR') || /sar/i.test(str)) {
    sourceCurrency = 'SAR';
  }

  let convertedAmount = amount;
  if (sourceCurrency === targetCurrency) {
    // Exact same currency: NEVER apply exchange rate rounding
    convertedAmount = Math.round(amount);
  } else {
    // Convert source to USD first
    let baseUSD = amount;
    if (sourceCurrency !== 'USD') {
      const srcRate = CURRENCY_CONFIG[sourceCurrency]?.rate || 86.8;
      baseUSD = amount / srcRate;
    }
    const tgtRate = targetConfig.rate || 1;
    convertedAmount = Math.round(baseUSD * tgtRate);
  }

  const formattedNum = new Intl.NumberFormat('en-IN').format(convertedAmount);
  const prefix = /^from\s+/i.test(str) ? 'From ' : '';
  const suffix = /\s*\/\s*(person|adult|visa|pax)/i.test(str) ? str.match(/\s*\/\s*(person|adult|visa|pax)/i)[0] : '';

  return `${prefix}${targetConfig.symbol}${formattedNum}${suffix}`;
}

async function fetchLiveExchangeRates() {
  try {
    const cached = localStorage.getItem('flyvis_rates_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000) {
        Object.keys(parsed.rates || {}).forEach(k => {
          if (CURRENCY_CONFIG[k]) CURRENCY_CONFIG[k].rate = parsed.rates[k];
        });
        return;
      }
    }
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.rates) {
      Object.keys(CURRENCY_CONFIG).forEach(k => {
        if (data.rates[k]) CURRENCY_CONFIG[k].rate = data.rates[k];
      });
      localStorage.setItem('flyvis_rates_cache', JSON.stringify({
        timestamp: Date.now(),
        rates: data.rates
      }));
    }
  } catch (err) {
    // Offline / fallback rates in CURRENCY_CONFIG used
  }
}

function syncCurrencyDropdowns() {
  document.querySelectorAll('.global-currency-select').forEach(sel => {
    sel.value = activeCurrency;
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    activeCurrency = detectUserCurrency();
    syncCurrencyDropdowns();
    fetchLiveExchangeRates();
  });
}

// ===== CACHED DATA =====
// We keep a local cache so filtering is instant
window.cachedVisas = (typeof FRESH_ALL_COUNTRIES_DATA !== 'undefined' && Array.isArray(FRESH_ALL_COUNTRIES_DATA)) 
  ? FRESH_ALL_COUNTRIES_DATA 
  : [];
window.cachedFlights = [];

// ===== DEFAULT IMAGES (FALLBACK) =====
function getCountryImage(countryCode) {
  const images = {
    AF: 'https://images.unsplash.com/photo-1598890777032-bde13fbe3492?auto=format&fit=crop&q=80&w=800',
    DZ: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&q=80&w=800',
    AI: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    AQ: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&q=80&w=800',
    AG: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    AR: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?auto=format&fit=crop&q=80&w=800',
    AM: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800',
    AU: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?auto=format&fit=crop&q=80&w=800',
    AT: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&q=80&w=800',
    AZ: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=800',
    BS: 'https://images.unsplash.com/photo-1548574505-5e238613e17b?auto=format&fit=crop&q=80&w=800',
    BH: 'https://images.unsplash.com/photo-1512453979436-5a50ce8c8d05?auto=format&fit=crop&q=80&w=800',
    BD: 'https://images.unsplash.com/photo-1585123388867-3bfe6dd4bdbf?auto=format&fit=crop&q=80&w=800',
    BB: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    BY: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=800',
    BE: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    BJ: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    BT: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=800',
    BO: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
    BA: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    BR: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&q=80&w=800',
    BN: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&q=80&w=800',
    BG: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    BF: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    BI: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    KH: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&q=80&w=800',
    CM: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    CA: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&q=80&w=800',
    TD: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    CL: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    CN: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800',
    CO: 'https://images.unsplash.com/photo-1583531352515-8884af319dc1?auto=format&fit=crop&q=80&w=800',
    KM: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    CD: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    CK: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    CI: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    HR: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
    CU: 'https://images.unsplash.com/photo-1500759285222-a95626b934cb?auto=format&fit=crop&q=80&w=800',
    CY: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    CZ: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&q=80&w=800',
    DK: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&q=80&w=800',
    DJ: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    DM: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    DO: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    AE: 'https://images.unsplash.com/photo-1512453979436-5a50ce8c8d05?auto=format&fit=crop&q=80&w=800',
    EC: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    EG: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&q=80&w=800',
    SV: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    GQ: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    ER: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    EE: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    ET: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    FJ: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    FI: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&q=80&w=800',
    FR: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800',
    GA: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    GM: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    GE: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    DE: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    GH: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    GR: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&q=80&w=800',
    GT: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    GW: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    GN: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    HT: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    HN: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    HK: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&q=80&w=800',
    HU: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    IS: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&q=80&w=800',
    ID: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=800',
    IE: 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&q=80&w=800',
    IL: 'https://images.unsplash.com/photo-1544971587-b842c27f8e14?auto=format&fit=crop&q=80&w=800',
    IT: 'https://images.unsplash.com/photo-1499678329028-1014352c1599?auto=format&fit=crop&q=80&w=800',
    JM: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    JP: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800',
    JO: 'https://images.unsplash.com/photo-1579606032834-a212df8e47be?auto=format&fit=crop&q=80&w=800',
    KZ: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    KE: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800',
    KW: 'https://images.unsplash.com/photo-1512453979436-5a50ce8c8d05?auto=format&fit=crop&q=80&w=800',
    KG: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    LA: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&q=80&w=800',
    LV: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    LS: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    LR: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    LI: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&q=80&w=800',
    LT: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    LU: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    MO: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&q=80&w=800',
    MG: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    MW: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    MY: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&q=80&w=800',
    MV: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&q=80&w=800',
    ML: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    MT: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=800',
    MH: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    MR: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    MU: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    MX: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&q=80&w=800',
    FM: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    MD: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    MN: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    ME: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
    MS: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    MA: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&q=80&w=800',
    MZ: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    NA: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    NP: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&q=80&w=800',
    NL: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&q=80&w=800',
    NZ: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
    NG: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    NU: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    KP: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800',
    NO: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800',
    OM: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=800',
    PW: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    PG: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    PY: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?auto=format&fit=crop&q=80&w=800',
    PH: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=800',
    PL: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&q=80&w=800',
    PT: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&q=80&w=800',
    QA: 'https://images.unsplash.com/photo-1512453979436-5a50ce8c8d05?auto=format&fit=crop&q=80&w=800',
    RE: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    RO: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&q=80&w=800',
    RU: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&q=80&w=800',
    RW: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    KN: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    LC: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    VC: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    WS: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    ST: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    SA: 'https://images.unsplash.com/photo-1583422409516-15eba534927b?auto=format&fit=crop&q=80&w=800',
    SN: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    SC: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
    SL: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    SG: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&q=80&w=800',
    SK: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&q=80&w=800',
    SI: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
    SB: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    SO: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    ZA: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&q=80&w=800',
    KR: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&q=80&w=800',
    SS: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    ES: 'https://images.unsplash.com/photo-1539037116277-4db20202d03d?auto=format&fit=crop&q=80&w=800',
    LK: 'https://images.unsplash.com/photo-1586861635167-e5223aadc9fe?auto=format&fit=crop&q=80&w=800',
    SZ: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&q=80&w=800',
    SE: 'https://images.unsplash.com/photo-1509356843151-3e7d96241e11?auto=format&fit=crop&q=80&w=800',
    CH: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&q=80&w=800',
    TW: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800',
    TJ: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&q=80&w=800',
    TZ: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800',
    TH: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=800',
    TG: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&q=80&w=800',
    TT: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    TN: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&q=80&w=800',
    TR: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&q=80&w=800',
    TC: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    UG: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800',
    GB: 'https://images.unsplash.com/photo-1513635269975-5969336cd100?auto=format&fit=crop&q=80&w=800',
    UY: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?auto=format&fit=crop&q=80&w=800',
    US: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=800',
    UZ: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=800',
    VE: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
    VN: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&q=80&w=800',
    VG: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    ZM: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800',
    ZW: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&q=80&w=800'
  };
  return images[countryCode] || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800';
}

function getFlagUrl(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
}

// ===== DATABASE OPERATIONS =====

// Fetch visas from Firestore (Real-time Listener)
function loadVisasFromDB() {
  return new Promise((resolve, reject) => {
    db.collection('visas').onSnapshot(snapshot => {
      const visas = [];
      snapshot.forEach(doc => {
        visas.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort logic (featured first, then alphabetically)
      visas.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return a.country.localeCompare(b.country);
      });

      if (visas.length === 0 && typeof FRESH_ALL_COUNTRIES_DATA !== 'undefined' && Array.isArray(FRESH_ALL_COUNTRIES_DATA)) {
        window.cachedVisas = FRESH_ALL_COUNTRIES_DATA;
      } else {
        window.cachedVisas = visas;
      }
      
      // Dispatch event to re-render UI automatically
      window.dispatchEvent(new Event('visasUpdated'));
      resolve(window.cachedVisas);
    }, error => {
      console.error("Error loading visas:", error);
      window.cachedVisas = (typeof FRESH_ALL_COUNTRIES_DATA !== 'undefined' && Array.isArray(FRESH_ALL_COUNTRIES_DATA)) 
        ? FRESH_ALL_COUNTRIES_DATA 
        : [];
      resolve(window.cachedVisas);
    });
  });
}

// Synchronous getters (rely on the cache loaded initially)
function getVisas() {
  return window.cachedVisas || [];
}

function getActiveVisas() {
  return getVisas().filter(v => v.active !== false);
}

// Clean undefined fields before Firestore operations
function cleanDocData(obj) {
  const clean = {};
  if (!obj || typeof obj !== 'object') return clean;
  Object.keys(obj).forEach(k => {
    if (obj[k] !== undefined) {
      clean[k] = obj[k];
    }
  });
  return clean;
}

// Async Write Operations
async function addVisaDB(visaData) {
  try {
    const data = cleanDocData(visaData);
    const docRef = await db.collection('visas').add(data);
    visaData.id = docRef.id;
    return true;
  } catch (error) {
    console.error("Error adding visa:", error);
    throw error;
  }
}

async function updateVisaDB(id, updates) {
  try {
    const data = cleanDocData(updates);
    await db.collection('visas').doc(id).set(data, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating visa:", error);
    throw error;
  }
}

async function deleteVisaDB(id) {
  try {
    await db.collection('visas').doc(id).delete();
    return true;
  } catch (error) {
    console.error("Error deleting visa:", error);
    throw error;
  }
}

// ===== FLIGHTS DATABASE OPERATIONS (Real-time Listener) =====

function loadFlightsFromDB() {
  return new Promise((resolve, reject) => {
    db.collection('flights').onSnapshot(snapshot => {
      const flights = [];
      snapshot.forEach(doc => {
        flights.push({ id: doc.id, ...doc.data() });
      });
      window.cachedFlights = flights;
      // Dispatch event to re-render UI automatically
      window.dispatchEvent(new Event('flightsUpdated'));
      resolve(flights);
    }, error => {
      console.error("Error loading flights:", error);
      window.cachedFlights = [];
      resolve([]);
    });
  });
}

function getFlights() {
  return window.cachedFlights || [];
}

async function addFlightDB(flightData) {
  try {
    const docRef = await db.collection('flights').add(flightData);
    flightData.id = docRef.id;
    return true;
  } catch (error) {
    console.error("Error adding flight:", error);
    throw error;
  }
}

async function updateFlightDB(id, updates) {
  try {
    await db.collection('flights').doc(id).update(updates);
    return true;
  } catch (error) {
    console.error("Error updating flight:", error);
    throw error;
  }
}

async function deleteFlightDB(id) {
  try {
    await db.collection('flights').doc(id).delete();
    return true;
  } catch (error) {
    console.error("Error deleting flight:", error);
    throw error;
  }
}


// ===== ADMIN SETTINGS OPERATIONS =====
window.cachedAdminSettings = {
  username: 'admin',
  password: 'admin123',
  email: 'admin@flyvis.com',
  phone: '919207021258',
  businessName: 'Flyvis Travel & Visas'
};

function loadAdminSettingsFromDB() {
  return new Promise((resolve) => {
    db.collection('settings').doc('admin_info').onSnapshot(doc => {
      if (doc.exists) {
        window.cachedAdminSettings = { ...window.cachedAdminSettings, ...doc.data() };
      }
      window.dispatchEvent(new Event('adminSettingsUpdated'));
      resolve(window.cachedAdminSettings);
    }, error => {
      console.warn("Could not load admin settings:", error);
      resolve(window.cachedAdminSettings);
    });
  });
}

async function saveAdminSettingsToDB(settingsData) {
  try {
    await db.collection('settings').doc('admin_info').set(settingsData, { merge: true });
    window.cachedAdminSettings = { ...window.cachedAdminSettings, ...settingsData };
    return true;
  } catch (error) {
    console.error("Error saving admin settings:", error);
    throw error;
  }
}

// ===== ARRIVAL CARDS DATABASE OPERATIONS =====
window.cachedArrivalCards = [];

function loadArrivalCardsFromDB() {
  return new Promise((resolve) => {
    db.collection('arrival_cards').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
      const cards = [];
      snapshot.forEach(doc => {
        cards.push({ id: doc.id, ...doc.data() });
      });
      window.cachedArrivalCards = cards;
      window.dispatchEvent(new Event('arrivalCardsUpdated'));
      resolve(cards);
    }, error => {
      console.warn("Error loading arrival cards:", error);
      window.cachedArrivalCards = [];
      resolve([]);
    });
  });
}

async function submitArrivalCardDB(applicationData) {
  try {
    applicationData.createdAt = new Date().toISOString();
    applicationData.status = 'Pending';
    const docRef = await db.collection('arrival_cards').add(applicationData);
    applicationData.id = docRef.id;
    return applicationData;
  } catch (error) {
    console.error("Error submitting arrival card:", error);
    throw error;
  }
}
