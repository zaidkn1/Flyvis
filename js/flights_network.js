// ===== FLYVIS GLOBAL AIRPORTS & ROUTE CARRIER NETWORK =====

const GLOBAL_AIRPORTS = [
  // India Hubs
  { code: "COK", city: "Kochi", airport: "Cochin International Airport", country: "India", flag: "" },
  { code: "DEL", city: "New Delhi", airport: "Indira Gandhi International Airport", country: "India", flag: "" },
  { code: "BOM", city: "Mumbai", airport: "Chhatrapati Shivaji Maharaj Airport", country: "India", flag: "" },
  { code: "BLR", city: "Bangalore", airport: "Kempegowda International Airport", country: "India", flag: "" },
  { code: "MAA", city: "Chennai", airport: "Chennai International Airport", country: "India", flag: "" },
  { code: "HYD", city: "Hyderabad", airport: "Rajiv Gandhi International Airport", country: "India", flag: "" },
  { code: "CCU", city: "Kolkata", airport: "Netaji Subhash Chandra Bose Airport", country: "India", flag: "" },
  { code: "TRV", city: "Thiruvananthapuram", airport: "Trivandrum International Airport", country: "India", flag: "" },
  { code: "CCJ", city: "Kozhikode", airport: "Calicut International Airport", country: "India", flag: "" },
  { code: "GOI", city: "Goa", airport: "Dabolim / Manohar International Airport", country: "India", flag: "" },
  { code: "AMD", city: "Ahmedabad", airport: "Sardar Vallabhbhai Patel Airport", country: "India", flag: "" },

  // Middle East Hubs
  { code: "DXB", city: "Dubai", airport: "Dubai International Airport", country: "UAE", flag: "" },
  { code: "AUH", city: "Abu Dhabi", airport: "Zayed International Airport", country: "UAE", flag: "" },
  { code: "SHJ", city: "Sharjah", airport: "Sharjah International Airport", country: "UAE", flag: "" },
  { code: "DOH", city: "Doha", airport: "Hamad International Airport", country: "Qatar", flag: "" },
  { code: "BAH", city: "Bahrain", airport: "Bahrain International Airport", country: "Bahrain", flag: "" },
  { code: "KWI", city: "Kuwait City", airport: "Kuwait International Airport", country: "Kuwait", flag: "" },
  { code: "MCT", city: "Muscat", airport: "Muscat International Airport", country: "Oman", flag: "" },
  { code: "RUH", city: "Riyadh", airport: "King Khalid International Airport", country: "Saudi Arabia", flag: "" },
  { code: "JED", city: "Jeddah", airport: "King Abdulaziz International Airport", country: "Saudi Arabia", flag: "" },

  // Europe & UK
  { code: "LHR", city: "London", airport: "London Heathrow Airport", country: "United Kingdom", flag: "" },
  { code: "LGW", city: "London", airport: "London Gatwick Airport", country: "United Kingdom", flag: "" },
  { code: "CDG", city: "Paris", airport: "Charles de Gaulle Airport", country: "France", flag: "" },
  { code: "FRA", city: "Frankfurt", airport: "Frankfurt am Main Airport", country: "Germany", flag: "" },
  { code: "AMS", city: "Amsterdam", airport: "Schiphol Airport", country: "Netherlands", flag: "" },
  { code: "FCO", city: "Rome", airport: "Fiumicino Airport", country: "Italy", flag: "" },
  { code: "ZRH", city: "Zurich", airport: "Zurich Airport", country: "Switzerland", flag: "" },
  { code: "MAD", city: "Madrid", airport: "Adolfo Suárez Barajas Airport", country: "Spain", flag: "" },
  { code: "BCN", city: "Barcelona", airport: "El Prat Airport", country: "Spain", flag: "" },

  // Southeast Asia & Far East
  { code: "SIN", city: "Singapore", airport: "Singapore Changi Airport", country: "Singapore", flag: "" },
  { code: "BKK", city: "Bangkok", airport: "Suvarnabhumi Airport", country: "Thailand", flag: "" },
  { code: "DMK", city: "Bangkok", airport: "Don Mueang Airport", country: "Thailand", flag: "" },
  { code: "HKT", city: "Phuket", airport: "Phuket International Airport", country: "Thailand", flag: "" },
  { code: "KUL", city: "Kuala Lumpur", airport: "Kuala Lumpur International Airport", country: "Malaysia", flag: "" },
  { code: "DPS", city: "Bali", airport: "Ngurah Rai International Airport", country: "Indonesia", flag: "" },
  { code: "HAN", city: "Hanoi", airport: "Noi Bai International Airport", country: "Vietnam", flag: "" },
  { code: "SGN", city: "Ho Chi Minh City", airport: "Tan Son Nhat Airport", country: "Vietnam", flag: "" },
  { code: "NRT", city: "Tokyo", airport: "Narita International Airport", country: "Japan", flag: "" },
  { code: "HND", city: "Tokyo", airport: "Haneda Airport", country: "Japan", flag: "" },
  { code: "ICN", city: "Seoul", airport: "Incheon International Airport", country: "South Korea", flag: "" },
  { code: "HKG", city: "Hong Kong", airport: "Hong Kong International Airport", country: "Hong Kong", flag: "" },

  // Americas & Oceania
  { code: "JFK", city: "New York", airport: "John F. Kennedy International Airport", country: "USA", flag: "" },
  { code: "SFO", city: "San Francisco", airport: "San Francisco International Airport", country: "USA", flag: "" },
  { code: "ORD", city: "Chicago", airport: "O'Hare International Airport", country: "USA", flag: "" },
  { code: "YYZ", city: "Toronto", airport: "Toronto Pearson Airport", country: "Canada", flag: "" },
  { code: "YVR", city: "Vancouver", airport: "Vancouver International Airport", country: "Canada", flag: "" },
  { code: "SYD", city: "Sydney", airport: "Sydney Kingsford Smith Airport", country: "Australia", flag: "" },
  { code: "MEL", city: "Melbourne", airport: "Melbourne Tullamarine Airport", country: "Australia", flag: "" },
  { code: "AKL", city: "Auckland", airport: "Auckland International Airport", country: "New Zealand", flag: "" }
];

// Master Airline Carrier Definitions
const AIRLINE_PROFILES = {
  "Emirates": { code: "EK", alliance: "Independent", logoText: "Emirates", color: "#D71A21", aircraft: "Boeing 777-300ER / Airbus A380", baggage: "30 kg Check-in + 7 kg Cabin" },
  "IndiGo": { code: "6E", alliance: "Independent", logoText: "IndiGo", color: "#001B94", aircraft: "Airbus A321neo / A320", baggage: "20-30 kg Check-in + 7 kg Cabin" },
  "Air India": { code: "AI", alliance: "Star Alliance", logoText: "Air India", color: "#E31837", aircraft: "Airbus A350-900 / Boeing 787-8", baggage: "25-35 kg Check-in + 7 kg Cabin" },
  "Air India Express": { code: "IX", alliance: "Tata Group", logoText: "Air India Express", color: "#F26522", aircraft: "Boeing 737 MAX 8", baggage: "20-30 kg Check-in + 7 kg Cabin" },
  "Flydubai": { code: "FZ", alliance: "Emirates Partner", logoText: "flydubai", color: "#0066B3", aircraft: "Boeing 737 MAX 8", baggage: "20 kg Check-in + 7 kg Cabin" },
  "Qatar Airways": { code: "QR", alliance: "oneworld", logoText: "Qatar Airways", color: "#5C0632", aircraft: "Airbus A350-1000 / Boeing 777", baggage: "30-35 kg Check-in + 7 kg Cabin" },
  "Etihad Airways": { code: "EY", alliance: "Independent", logoText: "Etihad Airways", color: "#BD9B60", aircraft: "Boeing 787-9 / Airbus A350", baggage: "30 kg Check-in + 7 kg Cabin" },
  "Singapore Airlines": { code: "SQ", alliance: "Star Alliance", logoText: "Singapore Airlines", color: "#00205B", aircraft: "Airbus A350-900 / Boeing 787-10", baggage: "30 kg Check-in + 7 kg Cabin" },
  "British Airways": { code: "BA", alliance: "oneworld", logoText: "British Airways", color: "#075AAA", aircraft: "Boeing 787-9 / Airbus A350", baggage: "23 kg x 2 Check-in + 7 kg Cabin" },
  "Virgin Atlantic": { code: "VS", alliance: "SkyTeam", logoText: "Virgin Atlantic", color: "#C8102E", aircraft: "Airbus A350-1000 / Boeing 787", baggage: "23 kg Check-in + 10 kg Cabin" },
  "Thai Airways": { code: "TG", alliance: "Star Alliance", logoText: "Thai Airways", color: "#501A75", aircraft: "Boeing 777-300ER / A350", baggage: "30 kg Check-in + 7 kg Cabin" },
  "Malaysia Airlines": { code: "MH", alliance: "oneworld", logoText: "Malaysia Airlines", color: "#003399", aircraft: "Airbus A330-300 / Boeing 737", baggage: "30 kg Check-in + 7 kg Cabin" },
  "Lufthansa": { code: "LH", alliance: "Star Alliance", logoText: "Lufthansa", color: "#05164D", aircraft: "Boeing 747-8 / Airbus A350", baggage: "23 kg Check-in + 8 kg Cabin" },
  "Air France": { code: "AF", alliance: "SkyTeam", logoText: "Air France", color: "#002157", aircraft: "Boeing 777-300ER / A350", baggage: "23 kg Check-in + 12 kg Cabin" },
  "Saudia": { code: "SV", alliance: "SkyTeam", logoText: "Saudia", color: "#006838", aircraft: "Boeing 777-300ER / B787", baggage: "23 kg x 2 Check-in + 7 kg Cabin" },
  "Gulf Air": { code: "GF", alliance: "Independent", logoText: "Gulf Air", color: "#9E7B3B", aircraft: "Boeing 787-9 Dreamliner", baggage: "30 kg Check-in + 7 kg Cabin" },
  "Oman Air": { code: "WY", alliance: "oneworld", logoText: "Oman Air", color: "#BF1E2E", aircraft: "Boeing 787-9 / B737 MAX", baggage: "30 kg Check-in + 7 kg Cabin" },
  "Akasa Air": { code: "QP", alliance: "Independent", logoText: "Akasa Air", color: "#FF5F00", aircraft: "Boeing 737 MAX 8", baggage: "15-20 kg Check-in + 7 kg Cabin" },
  "SpiceJet": { code: "SG", alliance: "Independent", logoText: "SpiceJet", color: "#ED1C24", aircraft: "Boeing 737-800", baggage: "15-20 kg Check-in + 7 kg Cabin" }
};

/**
 * Route-Specific Carrier Operating Matrix
 * Defines known scheduled flight numbers, flight times, and baseline fare bands for key routes.
 */
const ROUTE_SCHEDULES = {
  // Kochi (COK) <-> Dubai (DXB)
  "COK-DXB": [
    { airline: "Air India Express", flightNum: "IX 435", depTime: "08:30", arrTime: "11:15", duration: "4h 15m", nonStop: true, baseFare: 11800 },
    { airline: "IndiGo", flightNum: "6E 1475", depTime: "10:15", arrTime: "13:10", duration: "4h 25m", nonStop: true, baseFare: 12400 },
    { airline: "Flydubai", flightNum: "FZ 442", depTime: "15:40", arrTime: "18:25", duration: "4h 15m", nonStop: true, baseFare: 13900 },
    { airline: "Emirates", flightNum: "EK 531", depTime: "04:30", arrTime: "07:15", duration: "4h 15m", nonStop: true, baseFare: 18500 },
    { airline: "Emirates", flightNum: "EK 533", depTime: "19:55", arrTime: "22:40", duration: "4h 15m", nonStop: true, baseFare: 19800 },
    { airline: "Gulf Air", flightNum: "GF 68", depTime: "06:15", arrTime: "12:45", duration: "8h 00m", nonStop: false, stops: "1 Stop via BAH", baseFare: 10900 }
  ],
  "DXB-COK": [
    { airline: "Emirates", flightNum: "EK 530", depTime: "22:05", arrTime: "03:35", duration: "4h 00m", nonStop: true, baseFare: 18500 },
    { airline: "Air India Express", flightNum: "IX 434", depTime: "13:30", arrTime: "19:00", duration: "4h 00m", nonStop: true, baseFare: 11500 },
    { airline: "IndiGo", flightNum: "6E 1476", depTime: "14:10", arrTime: "19:40", duration: "4h 00m", nonStop: true, baseFare: 12100 },
    { airline: "Flydubai", flightNum: "FZ 441", depTime: "09:20", arrTime: "14:40", duration: "4h 00m", nonStop: true, baseFare: 13500 }
  ],

  // Delhi (DEL) <-> London (LHR)
  "DEL-LHR": [
    { airline: "Air India", flightNum: "AI 161", depTime: "02:45", arrTime: "07:30", duration: "9h 15m", nonStop: true, baseFare: 48500 },
    { airline: "British Airways", flightNum: "BA 142", depTime: "03:15", arrTime: "08:10", duration: "9h 25m", nonStop: true, baseFare: 54000 },
    { airline: "Virgin Atlantic", flightNum: "VS 301", depTime: "08:45", arrTime: "13:50", duration: "9h 35m", nonStop: true, baseFare: 52500 },
    { airline: "Air India", flightNum: "AI 111", depTime: "14:45", arrTime: "19:30", duration: "9h 15m", nonStop: true, baseFare: 49500 },
    { airline: "Qatar Airways", flightNum: "QR 571", depTime: "09:55", arrTime: "18:45", duration: "13h 20m", nonStop: false, stops: "1 Stop via DOH", baseFare: 41200 },
    { airline: "Gulf Air", flightNum: "GF 131", depTime: "05:40", arrTime: "15:20", duration: "14h 10m", nonStop: false, stops: "1 Stop via BAH", baseFare: 38900 }
  ],

  // Mumbai (BOM) <-> Singapore (SIN)
  "BOM-SIN": [
    { airline: "Singapore Airlines", flightNum: "SQ 421", depTime: "11:45", arrTime: "19:50", duration: "5h 35m", nonStop: true, baseFare: 24500 },
    { airline: "Singapore Airlines", flightNum: "SQ 423", depTime: "23:35", arrTime: "07:40", duration: "5h 35m", nonStop: true, baseFare: 26000 },
    { airline: "Air India", flightNum: "AI 342", depTime: "01:10", arrTime: "09:05", duration: "5h 25m", nonStop: true, baseFare: 19800 },
    { airline: "IndiGo", flightNum: "6E 1005", depTime: "08:25", arrTime: "16:40", duration: "5h 45m", nonStop: true, baseFare: 16900 },
    { airline: "Malaysia Airlines", flightNum: "MH 195", depTime: "06:10", arrTime: "17:15", duration: "8h 35m", nonStop: false, stops: "1 Stop via KUL", baseFare: 15200 }
  ],

  // Bangalore (BLR) <-> Bangkok (BKK)
  "BLR-BKK": [
    { airline: "Thai Airways", flightNum: "TG 326", depTime: "00:30", arrTime: "05:45", duration: "3h 45m", nonStop: true, baseFare: 18500 },
    { airline: "IndiGo", flightNum: "6E 1057", depTime: "11:20", arrTime: "16:45", duration: "3h 55m", nonStop: true, baseFare: 14200 },
    { airline: "Air India", flightNum: "AI 332", depTime: "16:05", arrTime: "21:30", duration: "3h 55m", nonStop: true, baseFare: 16500 },
    { airline: "Malaysia Airlines", flightNum: "MH 193", depTime: "00:15", arrTime: "09:40", duration: "7h 55m", nonStop: false, stops: "1 Stop via KUL", baseFare: 13500 }
  ]
};

/**
 * Searches and generates live flight schedules for any origin, destination, and date.
 */
function searchLiveFlightsNetwork(params) {
  const { originCode, destCode, departureDate, returnDate, cabinClass = "economy", userCardIds = [] } = params;

  const originAirport = GLOBAL_AIRPORTS.find(a => a.code === originCode) || { code: originCode, city: originCode, country: "" };
  const destAirport = GLOBAL_AIRPORTS.find(a => a.code === destCode) || { code: destCode, city: destCode, country: "" };

  const routeKey = `${originCode}-${destCode}`;
  let baseSchedules = ROUTE_SCHEDULES[routeKey] || [];

  // If no hardcoded direct timetable exists, synthesize a dynamic realistic multi-airline timetable
  if (!baseSchedules.length) {
    baseSchedules = generateDynamicFlightSchedules(originAirport, destAirport);
  }

  // Calculate dynamic date seasonality multiplier
  const dateObj = departureDate ? new Date(departureDate) : new Date();
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat (weekend peak)
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
  const weekendMultiplier = isWeekend ? 1.12 : 1.0;

  // Cabin Class multipliers
  const classMultiplier = cabinClass === "business" ? 2.8 : (cabinClass === "premium" ? 1.6 : 1.0);

  // Process and evaluate each flight with Credit Card calculations
  const flightResults = baseSchedules.map((item, idx) => {
    const airlineProfile = AIRLINE_PROFILES[item.airline] || {
      code: item.airline.substring(0, 2).toUpperCase(),
      alliance: "Commercial",
      color: "#0F172A",
      aircraft: "Boeing 737 / Airbus A320",
      baggage: "20 kg Check-in + 7 kg Cabin"
    };

    // Calculate final cash base fare
    const calculatedBaseFare = Math.round((item.baseFare || 14500) * weekendMultiplier * classMultiplier);

    const flightData = {
      id: `fl_${originCode}_${destCode}_${idx}`,
      airline: item.airline,
      airlineCode: airlineProfile.code,
      airlineColor: airlineProfile.color,
      aircraft: airlineProfile.aircraft,
      baggage: airlineProfile.baggage,
      flightNum: item.flightNum || `${airlineProfile.code} ${200 + idx * 35}`,
      originCity: originAirport.city,
      originCode: originAirport.code,
      originAirport: originAirport.airport,
      destCity: destAirport.city,
      destCode: destAirport.code,
      destAirport: destAirport.airport,
      depTime: item.depTime,
      arrTime: item.arrTime,
      duration: item.duration,
      nonStop: item.nonStop !== false,
      stops: item.stops || (item.nonStop === false ? "1 Stop" : "Non-stop"),
      departureDate: departureDate || new Date().toISOString().split('T')[0],
      price: calculatedBaseFare,
      cabinClass: cabinClass.toUpperCase()
    };

    // Evaluate Credit Card Savings for this specific flight
    const cardEvaluation = typeof evaluateFlightCardOffers === 'function' 
      ? evaluateFlightCardOffers(flightData, userCardIds)
      : { bestOffer: null, hasSavings: false };

    return {
      ...flightData,
      cardEvaluation
    };
  });

  return {
    origin: originAirport,
    destination: destAirport,
    departureDate,
    returnDate,
    cabinClass,
    totalFlightsFound: flightResults.length,
    flights: flightResults
  };
}

/**
 * Dynamic Flight Generator for any arbitrary origin-destination pair
 */
function generateDynamicFlightSchedules(orig, dest) {
  const carriers = [
    { airline: "IndiGo", base: 13500, nonStop: true, dep: "07:15", arr: "11:45", dur: "4h 30m" },
    { airline: "Air India", base: 16800, nonStop: true, dep: "13:30", arr: "18:10", dur: "4h 40m" },
    { airline: "Emirates", base: 22500, nonStop: false, stops: "1 Stop via DXB", dep: "04:30", arr: "14:15", dur: "9h 45m" },
    { airline: "Qatar Airways", base: 21900, nonStop: false, stops: "1 Stop via DOH", dep: "09:45", arr: "19:30", dur: "9h 45m" },
    { airline: "Singapore Airlines", base: 24000, nonStop: false, stops: "1 Stop via SIN", dep: "23:15", arr: "09:40", dur: "10h 25m" }
  ];

  return carriers.map((c, i) => ({
    airline: c.airline,
    flightNum: `${AIRLINE_PROFILES[c.airline]?.code || 'FL' } ${300 + i * 42}`,
    depTime: c.dep,
    arrTime: c.arr,
    duration: c.dur,
    nonStop: c.nonStop,
    stops: c.stops || "Non-stop",
    baseFare: c.base
  }));
}

if (typeof window !== 'undefined') {
  window.GLOBAL_AIRPORTS = GLOBAL_AIRPORTS;
  window.AIRLINE_PROFILES = AIRLINE_PROFILES;
  window.searchLiveFlightsNetwork = searchLiveFlightsNetwork;
}
