// ===== CREDIT CARDS & BANK TRAVEL PROMOTIONS DATASET =====
const MASTER_CREDIT_CARDS = [
  // --- HDFC BANK ---
  {
    id: "hdfc_infinia",
    name: "HDFC Infinia Metal",
    bank: "HDFC Bank",
    network: "Visa Infinite / Mastercard",
    color: "#1E293B",
    bgGradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
    textColor: "#FFFFFF",
    badge: "Super Premium",
    rewardRate: "3.3%",
    flightMultiplier: "5X on SmartBuy (16.5% Net Return)",
    flightMultiplierValue: 0.165,
    capPerMonth: "10,000 Points/day, 15,000 Points/month",
    pointRedemptionRate: "1 Point = ₹1 on Flight Bookings",
    instantDiscounts: [
      { code: "HDFCFLY", discountPct: 0.10, maxDiscount: 2500, minSpend: 10000, platform: "SmartBuy / Cleartrip" },
      { code: "INFINIA5X", discountPct: 0.165, maxDiscount: 5000, minSpend: 5000, platform: "HDFC SmartBuy" }
    ],
    popular: true
  },
  {
    id: "hdfc_dcb",
    name: "HDFC Diners Club Black (DCB)",
    bank: "HDFC Bank",
    network: "Diners Club",
    color: "#0F172A",
    bgGradient: "linear-gradient(135deg, #020617 0%, #0F172A 60%, #1E293B 100%)",
    textColor: "#FFFFFF",
    badge: "Super Premium",
    rewardRate: "3.3%",
    flightMultiplier: "5X on SmartBuy (16.5% Net Return)",
    flightMultiplierValue: 0.165,
    capPerMonth: "7,500 Points/month",
    pointRedemptionRate: "1 Point = ₹1 on Flight Bookings",
    instantDiscounts: [
      { code: "DCBFLY", discountPct: 0.10, maxDiscount: 2000, minSpend: 10000, platform: "SmartBuy" }
    ],
    popular: true
  },
  {
    id: "hdfc_regalia_gold",
    name: "HDFC Regalia Gold",
    bank: "HDFC Bank",
    network: "Visa Signature / Mastercard",
    color: "#B45309",
    bgGradient: "linear-gradient(135deg, #78350F 0%, #B45309 60%, #D97706 100%)",
    textColor: "#FFFFFF",
    badge: "Premium Travel",
    rewardRate: "1.33%",
    flightMultiplier: "5X on SmartBuy (6.65% Net Return)",
    flightMultiplierValue: 0.0665,
    capPerMonth: "4,000 Points/month",
    pointRedemptionRate: "1 Point = ₹0.50 on Flights",
    instantDiscounts: [
      { code: "REGALIAFLY", discountPct: 0.08, maxDiscount: 1500, minSpend: 7500, platform: "SmartBuy" }
    ],
    popular: true
  },
  {
    id: "hdfc_millennia",
    name: "HDFC Millennia",
    bank: "HDFC Bank",
    network: "Visa Signature",
    color: "#2563EB",
    bgGradient: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)",
    textColor: "#FFFFFF",
    badge: "Cashback",
    rewardRate: "1.0%",
    flightMultiplier: "5% Direct Cashback on Flight Portals",
    flightMultiplierValue: 0.05,
    capPerMonth: "₹1,000 / month",
    pointRedemptionRate: "1 CashPoint = ₹1",
    instantDiscounts: [
      { code: "MILLENNIAFLY", discountPct: 0.05, maxDiscount: 1000, minSpend: 5000, platform: "Cleartrip / MMT" }
    ],
    popular: true
  },

  // --- AXIS BANK ---
  {
    id: "axis_atlas",
    name: "Axis Atlas",
    bank: "Axis Bank",
    network: "Visa Signature / Mastercard",
    color: "#831843",
    bgGradient: "linear-gradient(135deg, #831843 0%, #9D174D 50%, #BE185D 100%)",
    textColor: "#FFFFFF",
    badge: "Air Miles Champion",
    rewardRate: "4.0%",
    flightMultiplier: "5 EDGE Miles per ₹100 on Airline Bookings (10% Air Miles)",
    flightMultiplierValue: 0.10,
    capPerMonth: "Tier-based (Up to 10,000 EDGE Miles/month)",
    pointRedemptionRate: "1 EDGE Mile = 2 Partner Airline Miles (KrisFlyer, Avios, Etihad, Qatar)",
    instantDiscounts: [
      { code: "ATLAS5X", discountPct: 0.10, maxDiscount: 4000, minSpend: 8000, platform: "Direct Airline Bookings" }
    ],
    popular: true
  },
  {
    id: "axis_magnus",
    name: "Axis Magnus",
    bank: "Axis Bank",
    network: "Mastercard World Elite",
    color: "#4C1D95",
    bgGradient: "linear-gradient(135deg, #312E81 0%, #4C1D95 60%, #6D28D9 100%)",
    textColor: "#FFFFFF",
    badge: "Super Premium",
    rewardRate: "2.4%",
    flightMultiplier: "5X EDGE Rewards via Travel Edge (12% Return)",
    flightMultiplierValue: 0.12,
    capPerMonth: "Unlimited",
    pointRedemptionRate: "5:2 Air Miles Transfer Rate",
    instantDiscounts: [
      { code: "MAGNUSFLY", discountPct: 0.12, maxDiscount: 5000, minSpend: 15000, platform: "Axis Travel Edge" }
    ],
    popular: false
  },
  {
    id: "axis_vistara_infinite",
    name: "Axis Vistara / Air India Infinite",
    bank: "Axis Bank",
    network: "Visa Infinite",
    color: "#4A044E",
    bgGradient: "linear-gradient(135deg, #3B0764 0%, #4A044E 60%, #701A75 100%)",
    textColor: "#FFFFFF",
    badge: "Airline Co-Brand",
    rewardRate: "6.0%",
    flightMultiplier: "6 Club Vistara / Air India Points per ₹100",
    flightMultiplierValue: 0.08,
    capPerMonth: "Unlimited",
    pointRedemptionRate: "1 Point = ~₹0.80 - ₹1.20 Flight Award Seat",
    instantDiscounts: [
      { code: "VISTARABIZ", discountPct: 0.08, maxDiscount: 3000, minSpend: 6000, platform: "Direct Airline" }
    ],
    popular: false
  },
  {
    id: "axis_flipkart",
    name: "Flipkart Axis Bank",
    bank: "Axis Bank",
    network: "Visa / Mastercard",
    color: "#0284C7",
    bgGradient: "linear-gradient(135deg, #0369A1 0%, #0284C7 60%, #38BDF8 100%)",
    textColor: "#FFFFFF",
    badge: "Cashback",
    rewardRate: "1.5%",
    flightMultiplier: "4% Direct Cashback on Cleartrip Flights",
    flightMultiplierValue: 0.04,
    capPerMonth: "No Upper Limit",
    pointRedemptionRate: "Direct Statement Credit",
    instantDiscounts: [
      { code: "FKAXISFLY", discountPct: 0.04, maxDiscount: 1500, minSpend: 4000, platform: "Cleartrip" }
    ],
    popular: true
  },

  // --- ICICI BANK ---
  {
    id: "icici_emeralde",
    name: "ICICI Emeralde Private Metal",
    bank: "ICICI Bank",
    network: "Visa Infinite / Mastercard",
    color: "#1E3A5F",
    bgGradient: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #2E7D7E 100%)",
    textColor: "#FFFFFF",
    badge: "Super Premium",
    rewardRate: "3.0%",
    flightMultiplier: "6 Reward Points / ₹200 (3% Base + Instant Airline Promos)",
    flightMultiplierValue: 0.09,
    capPerMonth: "Unlimited",
    pointRedemptionRate: "1 Reward Point = ₹1 on Flight Bookings",
    instantDiscounts: [
      { code: "ICICIFLY", discountPct: 0.10, maxDiscount: 3000, minSpend: 10000, platform: "MakeMyTrip / EaseMyTrip" },
      { code: "EMIRATESICICI", discountPct: 0.10, maxDiscount: 6000, minSpend: 25000, platform: "Emirates Direct" }
    ],
    popular: true
  },
  {
    id: "icici_sapphiro",
    name: "ICICI Sapphiro",
    bank: "ICICI Bank",
    network: "Mastercard / Amex Dual",
    color: "#0369A1",
    bgGradient: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 60%, #0284C7 100%)",
    textColor: "#FFFFFF",
    badge: "Premium Travel",
    rewardRate: "2.0%",
    flightMultiplier: "4 Reward Points / ₹100 on International Flights",
    flightMultiplierValue: 0.06,
    capPerMonth: "Unlimited",
    pointRedemptionRate: "1 Point = ₹0.25",
    instantDiscounts: [
      { code: "SAPPHIROFLY", discountPct: 0.08, maxDiscount: 2000, minSpend: 8000, platform: "EaseMyTrip" }
    ],
    popular: true
  },
  {
    id: "icici_amazon_pay",
    name: "Amazon Pay ICICI",
    bank: "ICICI Bank",
    network: "Visa",
    color: "#D97706",
    bgGradient: "linear-gradient(135deg, #B45309 0%, #D97706 60%, #F59E0B 100%)",
    textColor: "#FFFFFF",
    badge: "Lifetime Free",
    rewardRate: "1.0%",
    flightMultiplier: "5% Unlimited Cashback on Amazon Flights",
    flightMultiplierValue: 0.05,
    capPerMonth: "No Cap (Unlimited)",
    pointRedemptionRate: "1:1 Amazon Pay Balance",
    instantDiscounts: [
      { code: "AMAZONFLY", discountPct: 0.05, maxDiscount: 2000, minSpend: 3000, platform: "Amazon Flights" }
    ],
    popular: true
  },

  // --- SBI CARD ---
  {
    id: "sbi_air_india_sig",
    name: "Air India SBI Signature",
    bank: "SBI Card",
    network: "Visa Signature",
    color: "#991B1B",
    bgGradient: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 60%, #B91C1C 100%)",
    textColor: "#FFFFFF",
    badge: "Airline Co-Brand",
    rewardRate: "7.5%",
    flightMultiplier: "30 Reward Points per ₹100 on Air India Tickets (7.5% - 15% value)",
    flightMultiplierValue: 0.12,
    capPerMonth: "100,000 Points/year",
    pointRedemptionRate: "1 Air India Flying Returns Point = 1 Reward Point",
    instantDiscounts: [
      { code: "SBIAIRINDIA", discountPct: 0.12, maxDiscount: 4000, minSpend: 8000, platform: "Air India Direct" }
    ],
    popular: true
  },
  {
    id: "sbi_cashback",
    name: "Cashback SBI Card",
    bank: "SBI Card",
    network: "Visa Signature",
    color: "#059669",
    bgGradient: "linear-gradient(135deg, #065F46 0%, #059669 60%, #10B981 100%)",
    textColor: "#FFFFFF",
    badge: "Pure Cashback",
    rewardRate: "5.0%",
    flightMultiplier: "Flat 5% Direct Statement Cashback on All Online Flight Portals",
    flightMultiplierValue: 0.05,
    capPerMonth: "₹5,000 / month",
    pointRedemptionRate: "Auto Statement Credit",
    instantDiscounts: [
      { code: "SBICASHBACK", discountPct: 0.05, maxDiscount: 5000, minSpend: 2000, platform: "All Airlines & OTAs" }
    ],
    popular: true
  },
  {
    id: "sbi_prime",
    name: "SBI Card PRIME",
    bank: "SBI Card",
    network: "Visa / Mastercard",
    color: "#374151",
    bgGradient: "linear-gradient(135deg, #1F2937 0%, #374151 60%, #4B5563 100%)",
    textColor: "#FFFFFF",
    badge: "Lifestyle",
    rewardRate: "2.5%",
    flightMultiplier: "10 Reward Points / ₹100 on Travel Bookings",
    flightMultiplierValue: 0.045,
    capPerMonth: "No Cap",
    pointRedemptionRate: "1 Point = ₹0.25",
    instantDiscounts: [
      { code: "SBIPRIMEFLY", discountPct: 0.06, maxDiscount: 1800, minSpend: 6000, platform: "Yatra / MMT" }
    ],
    popular: false
  },

  // --- AMERICAN EXPRESS ---
  {
    id: "amex_plat_travel",
    name: "Amex Platinum Travel",
    bank: "American Express",
    network: "American Express",
    color: "#475569",
    bgGradient: "linear-gradient(135deg, #334155 0%, #475569 60%, #64748B 100%)",
    textColor: "#FFFFFF",
    badge: "Milestone Powerhouse",
    rewardRate: "8.0%",
    flightMultiplier: "8% Net Return via ₹4 Lakh Annual Milestone + Taj Vouchers",
    flightMultiplierValue: 0.08,
    capPerMonth: "Annual Milestones (₹1.9L & ₹4L)",
    pointRedemptionRate: "Transfer to Marriott Bonvoy / Taj Vouchers / Airline Miles",
    instantDiscounts: [
      { code: "AMEXFLY", discountPct: 0.10, maxDiscount: 3500, minSpend: 12000, platform: "MakeMyTrip / Cleartrip" }
    ],
    popular: true
  },
  {
    id: "amex_platinum_charge",
    name: "Amex Platinum (Centurion Metal)",
    bank: "American Express",
    network: "American Express",
    color: "#0F172A",
    bgGradient: "linear-gradient(135deg, #020617 0%, #0F172A 50%, #1E293B 100%)",
    textColor: "#FFFFFF",
    badge: "Ultra Luxury",
    rewardRate: "6.25%",
    flightMultiplier: "3X Points on Overseas Flights + Amex International Airline Program (Up to 20% Off)",
    flightMultiplierValue: 0.15,
    capPerMonth: "No Pre-set Limit",
    pointRedemptionRate: "1:1 Air Miles (Virgin Atlantic, Singapore KrisFlyer, Emirates, Qatar)",
    instantDiscounts: [
      { code: "AMEXIAP", discountPct: 0.15, maxDiscount: 15000, minSpend: 30000, platform: "Amex Travel Concierge" }
    ],
    popular: false
  },

  // --- KOTAK / IDFC / SC / HSBC ---
  {
    id: "idfc_first_wealth",
    name: "IDFC FIRST Wealth",
    bank: "IDFC FIRST Bank",
    network: "Visa Infinite",
    color: "#881337",
    bgGradient: "linear-gradient(135deg, #4C0519 0%, #881337 60%, #9F1239 100%)",
    textColor: "#FFFFFF",
    badge: "Lifetime Free",
    rewardRate: "2.5%",
    flightMultiplier: "10X Reward Points (2.5% value) on Spends > ₹30,000",
    flightMultiplierValue: 0.04,
    capPerMonth: "No Cap, Points Never Expire",
    pointRedemptionRate: "1 Point = ₹0.25",
    instantDiscounts: [
      { code: "IDFCFLY", discountPct: 0.08, maxDiscount: 2000, minSpend: 7500, platform: "EaseMyTrip / Cleartrip" }
    ],
    popular: false
  },
  {
    id: "hsbc_travelone",
    name: "HSBC TravelOne / Premier",
    bank: "HSBC",
    network: "Mastercard World",
    color: "#B91C1C",
    bgGradient: "linear-gradient(135deg, #7F1D1D 0%, #B91C1C 60%, #DC2626 100%)",
    textColor: "#FFFFFF",
    badge: "Instant Air Miles",
    rewardRate: "4.0%",
    flightMultiplier: "Instant 1:1 Transfer to 16 Airline Partners (KrisFlyer, Asia Miles, British Airways)",
    flightMultiplierValue: 0.08,
    capPerMonth: "Unlimited",
    pointRedemptionRate: "1:1 Instant Air Miles",
    instantDiscounts: [
      { code: "HSBCFLY", discountPct: 0.10, maxDiscount: 2500, minSpend: 10000, platform: "Cleartrip / MMT" }
    ],
    popular: false
  }
];

// Active Global Bank & Airline Promo Matrix (Updated Automatically)
const GLOBAL_BANK_FLIGHT_PROMOS = [
  {
    id: "promo_indigo_kotak",
    airline: "IndiGo",
    bank: "Kotak Mahindra Bank",
    cardIds: ["all_kotak"],
    code: "6EKOTAK",
    title: "Flat 10% Off on IndiGo Domestic & International",
    discountPct: 0.10,
    maxDiscount: 1500,
    minSpend: 5000,
    validDays: "Thursdays",
    description: "Use code 6EKOTAK on IndiGo website/app with Kotak Credit Cards."
  },
  {
    id: "promo_emirates_icici",
    airline: "Emirates",
    bank: "ICICI Bank",
    cardIds: ["icici_emeralde", "icici_sapphiro"],
    code: "INICICI24",
    title: "Up to 10% Off on Emirates Economy & Business",
    discountPct: 0.10,
    maxDiscount: 6000,
    minSpend: 20000,
    validDays: "All Days",
    description: "Book on Emirates.com using promo code INICICI24 with ICICI Premium Credit Cards."
  },
  {
    id: "promo_qatar_amex",
    airline: "Qatar Airways",
    bank: "American Express",
    cardIds: ["amex_plat_travel", "amex_platinum_charge"],
    code: "AMEXQR24",
    title: "Up to 12% Off on Qatar Airways Flights",
    discountPct: 0.12,
    maxDiscount: 8000,
    minSpend: 25000,
    validDays: "All Days",
    description: "Special discount on Qatar Airways global destinations with Amex cards."
  },
  {
    id: "promo_mmt_hdfc",
    airline: "All Airlines",
    bank: "HDFC Bank",
    cardIds: ["hdfc_infinia", "hdfc_dcb", "hdfc_regalia_gold", "hdfc_millennia"],
    code: "HDFCDOM / HDFCINT",
    title: "Instant 10% Off on MakeMyTrip / Cleartrip",
    discountPct: 0.10,
    maxDiscount: 2500,
    minSpend: 7500,
    validDays: "Tuesdays & Weekends",
    description: "Apply HDFC bank promo codes on checkout for instant price deduction."
  },
  {
    id: "promo_airindia_sbi",
    airline: "Air India",
    bank: "SBI Card",
    cardIds: ["sbi_air_india_sig"],
    code: "SBIAIR",
    title: "Up to 30 Reward Points/₹100 (15% Net Savings)",
    discountPct: 0.12,
    maxDiscount: 5000,
    minSpend: 6000,
    validDays: "All Days",
    description: "Direct booking on Air India with SBI Signature card grants maximum Flying Returns miles."
  }
];

if (typeof window !== 'undefined') {
  window.MASTER_CREDIT_CARDS = MASTER_CREDIT_CARDS;
  window.GLOBAL_BANK_FLIGHT_PROMOS = GLOBAL_BANK_FLIGHT_PROMOS;
}
