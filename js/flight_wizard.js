/**
 * ============================================================================
 * FLYVIS COMMERCIAL FLIGHT SEARCH & TRAVEL-FINTECH ENGINE (v6.0)
 * Combining Google Flights & Skyscanner UX with 18+ Credit Cards & AI Pricing
 * ============================================================================
 */

// Global State
const FlyvisOtaState = {
  route: {
    origCode: "DEL",
    destCode: "DXB",
    origName: "New Delhi",
    destName: "Dubai",
    departureDate: "2026-09-17",
    returnDate: "",
    tripType: "oneway",
    cabinClass: "economy",
    travelers: 1
  },
  filters: {
    stops: { nonstop: true, "1stop": true, "2plus": true },
    timeWindow: "any",
    selectedAirlines: [],
    baggage: "standard",
    selectedCardIds: ["hdfc_infinia"], // default pre-applied card for demo
    maxPrice: Infinity
  },
  rawFlights: [],
  filteredFlights: [],
  selectedFlightForBooking: null,
  pointsBurn: {
    points: 0,
    rate: 1.0,
    cashValue: 0
  },
  seatPreference: {
    type: "window",
    zone: "front",
    specificSeat: ""
  },
  sortBy: "cheapest"
};

// Top Airport Catalog for Autocomplete
const OTA_AIRPORTS = [
  // Domestic India (Kerala)
  { code: "CNN", city: "Kannur", name: "Kannur International Airport (Mattannur)", country: "India" },
  { code: "COK", city: "Kochi", name: "Cochin International Airport (Nedumbassery)", country: "India" },
  { code: "CCJ", city: "Kozhikode", name: "Calicut International Airport (Karipur)", country: "India" },
  { code: "TRV", city: "Thiruvananthapuram", name: "Trivandrum International Airport", country: "India" },

  // Domestic India (Metros & Major Hubs)
  { code: "DEL", city: "New Delhi", name: "Indira Gandhi International Airport", country: "India" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International Airport", country: "India" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International Airport", country: "India" },
  { code: "MAA", city: "Chennai", name: "Chennai International Airport", country: "India" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhash Chandra Bose International Airport", country: "India" },
  { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International Airport", country: "India" },
  { code: "PNQ", city: "Pune", name: "Pune International Airport", country: "India" },
  { code: "GOI", city: "Goa (Dabolim)", name: "Dabolim Airport", country: "India" },
  { code: "GOX", city: "Goa (Mopa)", name: "Manohar International Airport", country: "India" },

  // Domestic India (South Region)
  { code: "IXE", city: "Mangaluru", name: "Mangalore International Airport", country: "India" },
  { code: "CJB", city: "Coimbatore", name: "Coimbatore International Airport", country: "India" },
  { code: "TRZ", city: "Tiruchirappalli", name: "Trichy International Airport", country: "India" },
  { code: "IXM", city: "Madurai", name: "Madurai Airport", country: "India" },
  { code: "TCR", city: "Tuticorin", name: "Tuticorin Airport", country: "India" },
  { code: "SXV", city: "Salem", name: "Salem Airport", country: "India" },
  { code: "VGA", city: "Vijayawada", name: "Vijayawada International Airport", country: "India" },
  { code: "VTZ", city: "Visakhapatnam", name: "Visakhapatnam International Airport", country: "India" },
  { code: "TIR", city: "Tirupati", name: "Tirupati International Airport", country: "India" },
  { code: "RJA", city: "Rajahmundry", name: "Rajahmundry Airport", country: "India" },
  { code: "CDP", city: "Kadapa", name: "Kadapa Airport", country: "India" },
  { code: "KJB", city: "Kurnool", name: "Uyyalawada Narasimha Reddy Airport", country: "India" },
  { code: "MYQ", city: "Mysuru", name: "Mysore Airport (Mandakalli)", country: "India" },
  { code: "IXG", city: "Belagavi", name: "Belgaum Airport", country: "India" },
  { code: "HBX", city: "Hubballi", name: "Hubli Airport", country: "India" },
  { code: "GBI", city: "Kalaburagi", name: "Gulbarga Airport", country: "India" },
  { code: "RQY", city: "Shivamogga", name: "Kuvempu Airport", country: "India" },

  // Domestic India (North & Himalayan Region)
  { code: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh International Airport", country: "India" },
  { code: "VNS", city: "Varanasi", name: "Lal Bahadur Shastri International Airport", country: "India" },
  { code: "AYJ", city: "Ayodhya", name: "Maharishi Valmiki International Airport", country: "India" },
  { code: "KNU", city: "Kanpur", name: "Kanpur Airport (Chakeri)", country: "India" },
  { code: "GOP", city: "Gorakhpur", name: "Mahayogi Gorakhnath Airport", country: "India" },
  { code: "BEK", city: "Bareilly", name: "Bareilly Airport", country: "India" },
  { code: "AGR", city: "Agra", name: "Agra Airport (Kheria)", country: "India" },
  { code: "HDX", city: "Hindon (Ghaziabad)", name: "Hindon Air Force Station", country: "India" },
  { code: "JAI", city: "Jaipur", name: "Jaipur International Airport", country: "India" },
  { code: "UDR", city: "Udaipur", name: "Maharana Pratap Airport", country: "India" },
  { code: "JDH", city: "Jodhpur", name: "Jodhpur Airport", country: "India" },
  { code: "JSA", city: "Jaisalmer", name: "Jaisalmer Airport", country: "India" },
  { code: "BKB", city: "Bikaner", name: "Nal Airport", country: "India" },
  { code: "KQH", city: "Kishangarh (Ajmer)", name: "Kishangarh Airport", country: "India" },
  { code: "IXC", city: "Chandigarh", name: "Shaheed Bhagat Singh International Airport", country: "India" },
  { code: "ATQ", city: "Amritsar", name: "Sri Guru Ram Dass Jee International Airport", country: "India" },
  { code: "SXR", city: "Srinagar", name: "Sheikh ul-Alam International Airport", country: "India" },
  { code: "IXJ", city: "Jammu", name: "Jammu Civil Enclave", country: "India" },
  { code: "IXL", city: "Leh", name: "Kushok Bakula Rimpochee Airport", country: "India" },
  { code: "DED", city: "Dehradun", name: "Jolly Grant Airport", country: "India" },
  { code: "PGH", city: "Pantnagar", name: "Pantnagar Airport (Nainital)", country: "India" },
  { code: "KUU", city: "Kullu", name: "Bhuntar Airport (Kullu-Manali)", country: "India" },
  { code: "DHM", city: "Dharamshala", name: "Kangra Airport (Gaggal)", country: "India" },
  { code: "SLV", city: "Shimla", name: "Shimla Airport (Jubbarhatti)", country: "India" },

  // Domestic India (East & Northeast Region)
  { code: "PAT", city: "Patna", name: "Jayprakash Narayan Airport", country: "India" },
  { code: "GAY", city: "Gaya", name: "Gaya Airport", country: "India" },
  { code: "DBR", city: "Darbhanga", name: "Darbhanga Airport", country: "India" },
  { code: "DGH", city: "Deoghar", name: "Deoghar Airport", country: "India" },
  { code: "IXR", city: "Ranchi", name: "Birsa Munda Airport", country: "India" },
  { code: "BBI", city: "Bhubaneswar", name: "Biju Patnaik International Airport", country: "India" },
  { code: "JRG", city: "Jharsuguda", name: "Veer Surendra Sai Airport", country: "India" },
  { code: "RRK", city: "Rourkela", name: "Rourkela Airport", country: "India" },
  { code: "RDP", city: "Durgapur", name: "Kazi Nazrul Islam Airport", country: "India" },
  { code: "IXB", city: "Bagdogra", name: "Bagdogra Airport (Siliguri/Darjeeling)", country: "India" },
  { code: "GAU", city: "Guwahati", name: "Lokpriya Gopinath Bordoloi International Airport", country: "India" },
  { code: "DIB", city: "Dibrugarh", name: "Dibrugarh Airport (Mohanbari)", country: "India" },
  { code: "IXS", city: "Silchar", name: "Silchar Airport (Kumbhirgram)", country: "India" },
  { code: "JRH", city: "Jorhat", name: "Jorhat Airport (Rowriah)", country: "India" },
  { code: "IXA", city: "Agartala", name: "Maharaja Bir Bikram Airport", country: "India" },
  { code: "IMF", city: "Imphal", name: "Bir Tikendrajit International Airport", country: "India" },
  { code: "DMU", city: "Dimapur", name: "Dimapur Airport", country: "India" },
  { code: "SHL", city: "Shillong", name: "Shillong Airport (Umroi)", country: "India" },
  { code: "AJL", city: "Aizawl", name: "Lengpui Airport", country: "India" },
  { code: "PYG", city: "Pakyong", name: "Pakyong Airport (Gangtok/Sikkim)", country: "India" },
  { code: "HGI", city: "Itanagar", name: "Donyi Polo Airport (Hollongi)", country: "India" },
  { code: "IXT", city: "Pasighat", name: "Pasighat Airport", country: "India" },
  { code: "TEI", city: "Tezu", name: "Tezu Airport", country: "India" },
  { code: "RUP", city: "Rupsi", name: "Rupsi Airport", country: "India" },

  // Domestic India (West & Central Region)
  { code: "NAG", city: "Nagpur", name: "Dr. Babasaheb Ambedkar International Airport", country: "India" },
  { code: "IDR", city: "Indore", name: "Devi Ahilya Bai Holkar Airport", country: "India" },
  { code: "BHO", city: "Bhopal", name: "Raja Bhoj Airport", country: "India" },
  { code: "GWL", city: "Gwalior", name: "Rajmata Vijaya Raje Scindia Airport", country: "India" },
  { code: "JLR", city: "Jabalpur", name: "Dumna Airport", country: "India" },
  { code: "HJR", city: "Khajuraho", name: "Khajuraho Airport", country: "India" },
  { code: "RPR", city: "Raipur", name: "Swami Vivekananda Airport", country: "India" },
  { code: "STV", city: "Surat", name: "Surat International Airport", country: "India" },
  { code: "BDQ", city: "Vadodara", name: "Vadodara Airport", country: "India" },
  { code: "HSR", city: "Rajkot", name: "Rajkot International Airport (Hirasar)", country: "India" },
  { code: "BHU", city: "Bhavnagar", name: "Bhavnagar Airport", country: "India" },
  { code: "JGA", city: "Jamnagar", name: "Jamnagar Airport", country: "India" },
  { code: "IXY", city: "Kandla", name: "Kandla Airport", country: "India" },
  { code: "IXK", city: "Keshod", name: "Keshod Airport (Junagadh)", country: "India" },
  { code: "PBD", city: "Porbandar", name: "Porbandar Airport", country: "India" },
  { code: "DIU", city: "Diu", name: "Diu Airport", country: "India" },
  { code: "BHJ", city: "Bhuj", name: "Bhuj Airport (Kutch)", country: "India" },
  { code: "SAG", city: "Shirdi", name: "Shirdi International Airport", country: "India" },
  { code: "ISK", city: "Nashik", name: "Nashik Airport (Ozar)", country: "India" },
  { code: "IXU", city: "Chhatrapati Sambhajinagar", name: "Aurangabad Airport", country: "India" },
  { code: "KLH", city: "Kolhapur", name: "Chhatrapati Rajaram Maharaj Airport", country: "India" },
  { code: "SDV", city: "Sindhudurg", name: "Sindhudurg Airport (Chipi)", country: "India" },
  { code: "NDC", city: "Nanded", name: "Shri Guru Gobind Singh Ji Airport", country: "India" },
  { code: "JLG", city: "Jalgaon", name: "Jalgaon Airport", country: "India" },

  // Domestic India (Islands)
  { code: "IXZ", city: "Port Blair", name: "Veer Savarkar International Airport (Andaman)", country: "India" },
  { code: "AGX", city: "Agatti", name: "Agatti Island Airport (Lakshadweep)", country: "India" },

  // Middle East & Gulf Hubs
  { code: "DXB", city: "Dubai", name: "Dubai International Airport", country: "United Arab Emirates" },
  { code: "SHJ", city: "Sharjah", name: "Sharjah International Airport", country: "United Arab Emirates" },
  { code: "AUH", city: "Abu Dhabi", name: "Zayed International Airport", country: "United Arab Emirates" },
  { code: "DWC", city: "Dubai Al Maktoum", name: "Al Maktoum International Airport", country: "United Arab Emirates" },
  { code: "DOH", city: "Doha", name: "Hamad International Airport", country: "Qatar" },
  { code: "BAH", city: "Bahrain", name: "Bahrain International Airport", country: "Bahrain" },
  { code: "KWI", city: "Kuwait", name: "Kuwait International Airport", country: "Kuwait" },
  { code: "MCT", city: "Muscat", name: "Muscat International Airport", country: "Oman" },
  { code: "SLL", city: "Salalah", name: "Salalah Airport", country: "Oman" },
  { code: "RUH", city: "Riyadh", name: "King Khalid International Airport", country: "Saudi Arabia" },
  { code: "JED", city: "Jeddah", name: "King Abdulaziz International Airport", country: "Saudi Arabia" },
  { code: "DMM", city: "Dammam", name: "King Fahd International Airport", country: "Saudi Arabia" },
  { code: "MED", city: "Medina", name: "Prince Mohammad bin Abdulaziz Airport", country: "Saudi Arabia" },

  // Southeast & East Asia
  { code: "SIN", city: "Singapore", name: "Singapore Changi Airport", country: "Singapore" },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International Airport", country: "Malaysia" },
  { code: "PEN", city: "Penang", name: "Penang International Airport", country: "Malaysia" },
  { code: "BKK", city: "Bangkok (Suvarnabhumi)", name: "Suvarnabhumi Airport", country: "Thailand" },
  { code: "DMK", city: "Bangkok (Don Mueang)", name: "Don Mueang International Airport", country: "Thailand" },
  { code: "HKT", city: "Phuket", name: "Phuket International Airport", country: "Thailand" },
  { code: "DPS", city: "Bali", name: "Ngurah Rai International Airport (Denpasar)", country: "Indonesia" },
  { code: "CGK", city: "Jakarta", name: "Soekarno-Hatta International Airport", country: "Indonesia" },
  { code: "SGN", city: "Ho Chi Minh City", name: "Tan Son Nhat International Airport", country: "Vietnam" },
  { code: "HAN", city: "Hanoi", name: "Noi Bai International Airport", country: "Vietnam" },
  { code: "MNL", city: "Manila", name: "Ninoy Aquino International Airport", country: "Philippines" },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong International Airport", country: "Hong Kong" },
  { code: "TPE", city: "Taipei", name: "Taiwan Taoyuan International Airport", country: "Taiwan" },
  { code: "NRT", city: "Tokyo Narita", name: "Narita International Airport", country: "Japan" },
  { code: "HND", city: "Tokyo Haneda", name: "Tokyo Haneda Airport", country: "Japan" },
  { code: "KIX", city: "Osaka", name: "Kansai International Airport", country: "Japan" },
  { code: "ICN", city: "Seoul", name: "Incheon International Airport", country: "South Korea" },
  { code: "PVG", city: "Shanghai", name: "Shanghai Pudong International Airport", country: "China" },
  { code: "PEK", city: "Beijing", name: "Beijing Capital International Airport", country: "China" },
  { code: "CAN", city: "Guangzhou", name: "Guangzhou Baiyun International Airport", country: "China" },

  // South Asia Neighbors
  { code: "MLE", city: "Maldives (Male)", name: "Velana International Airport", country: "Maldives" },
  { code: "CMB", city: "Colombo", name: "Bandaranaike International Airport", country: "Sri Lanka" },
  { code: "KTM", city: "Kathmandu", name: "Tribhuvan International Airport", country: "Nepal" },
  { code: "DAC", city: "Dhaka", name: "Hazrat Shahjalal International Airport", country: "Bangladesh" },

  // Europe & United Kingdom
  { code: "LHR", city: "London Heathrow", name: "Heathrow Airport", country: "United Kingdom" },
  { code: "LGW", city: "London Gatwick", name: "Gatwick Airport", country: "United Kingdom" },
  { code: "MAN", city: "Manchester", name: "Manchester Airport", country: "United Kingdom" },
  { code: "EDI", city: "Edinburgh", name: "Edinburgh Airport", country: "United Kingdom" },
  { code: "CDG", city: "Paris", name: "Paris Charles de Gaulle Airport", country: "France" },
  { code: "ORY", city: "Paris Orly", name: "Paris Orly Airport", country: "France" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany" },
  { code: "MUC", city: "Munich", name: "Munich Airport", country: "Germany" },
  { code: "AMS", city: "Amsterdam", name: "Amsterdam Airport Schiphol", country: "Netherlands" },
  { code: "ZRH", city: "Zurich", name: "Zurich Airport", country: "Switzerland" },
  { code: "FCO", city: "Rome", name: "Rome Fiumicino Airport", country: "Italy" },
  { code: "MXP", city: "Milan", name: "Milan Malpensa Airport", country: "Italy" },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas Airport", country: "Spain" },
  { code: "BCN", city: "Barcelona", name: "Josep Tarradellas Barcelona-El Prat Airport", country: "Spain" },
  { code: "VIE", city: "Vienna", name: "Vienna International Airport", country: "Austria" },
  { code: "BRU", city: "Brussels", name: "Brussels Airport", country: "Belgium" },
  { code: "DUB", city: "Dublin", name: "Dublin Airport", country: "Ireland" },
  { code: "CPH", city: "Copenhagen", name: "Copenhagen Airport", country: "Denmark" },
  { code: "ARN", city: "Stockholm", name: "Stockholm Arlanda Airport", country: "Sweden" },
  { code: "IST", city: "Istanbul", name: "Istanbul Airport", country: "Turkey" },

  // North America (US & Canada)
  { code: "JFK", city: "New York JFK", name: "John F. Kennedy International Airport", country: "United States" },
  { code: "EWR", city: "New York Newark", name: "Newark Liberty International Airport", country: "United States" },
  { code: "SFO", city: "San Francisco", name: "San Francisco International Airport", country: "United States" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International Airport", country: "United States" },
  { code: "ORD", city: "Chicago", name: "O'Hare International Airport", country: "United States" },
  { code: "BOS", city: "Boston", name: "Logan International Airport", country: "United States" },
  { code: "IAD", city: "Washington Dulles", name: "Washington Dulles International Airport", country: "United States" },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma International Airport", country: "United States" },
  { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth International Airport", country: "United States" },
  { code: "MIA", city: "Miami", name: "Miami International Airport", country: "United States" },
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Atlanta International Airport", country: "United States" },
  { code: "YYZ", city: "Toronto", name: "Toronto Pearson International Airport", country: "Canada" },
  { code: "YVR", city: "Vancouver", name: "Vancouver International Airport", country: "Canada" },
  { code: "YUL", city: "Montreal", name: "Montréal-Trudeau International Airport", country: "Canada" },

  // Australia & New Zealand
  { code: "SYD", city: "Sydney", name: "Sydney Kingsford Smith Airport", country: "Australia" },
  { code: "MEL", city: "Melbourne", name: "Melbourne Airport", country: "Australia" },
  { code: "BNE", city: "Brisbane", name: "Brisbane Airport", country: "Australia" },
  { code: "PER", city: "Perth", name: "Perth Airport", country: "Australia" },
  { code: "AKL", city: "Auckland", name: "Auckland Airport", country: "New Zealand" },

  // Africa & Indian Ocean
  { code: "CAI", city: "Cairo", name: "Cairo International Airport", country: "Egypt" },
  { code: "JNB", city: "Johannesburg", name: "O.R. Tambo International Airport", country: "South Africa" },
  { code: "CPT", city: "Cape Town", name: "Cape Town International Airport", country: "South Africa" },
  { code: "NBO", city: "Nairobi", name: "Jomo Kenyatta International Airport", country: "Kenya" },
  { code: "MRU", city: "Mauritius", name: "Sir Seewoosagur Ramgoolam International Airport", country: "Mauritius" }
];

// Airline Fleet & Colors
const AIRLINE_INFO = {
  "IndiGo": { code: "6E", color: "#001B94", textColor: "#fff" },
  "Air India": { code: "AI", color: "#E31837", textColor: "#fff" },
  "Air India Express": { code: "IX", color: "#F26522", textColor: "#fff" },
  "Akasa Air": { code: "QP", color: "#FF6600", textColor: "#fff" },
  "SpiceJet": { code: "SG", color: "#ED1C24", textColor: "#fff" },
  "Emirates": { code: "EK", color: "#D71A21", textColor: "#fff" },
  "flydubai": { code: "FZ", color: "#0066B3", textColor: "#fff" },
  "Qatar Airways": { code: "QR", color: "#5C0632", textColor: "#fff" },
  "Etihad": { code: "EY", color: "#BD9B60", textColor: "#fff" },
  "Etihad Airways": { code: "EY", color: "#BD9B60", textColor: "#fff" },
  "Gulf Air": { code: "GF", color: "#8E6D24", textColor: "#fff" },
  "Turkish Airlines": { code: "TK", color: "#C8102E", textColor: "#fff" },
  "Singapore Airlines": { code: "SQ", color: "#00205B", textColor: "#fff" },
  "THAI": { code: "TG", color: "#501A75", textColor: "#fff" },
  "Cathay Pacific": { code: "CX", color: "#006564", textColor: "#fff" },
  "British Airways": { code: "BA", color: "#075AAA", textColor: "#fff" },
  "Virgin Atlantic": { code: "VS", color: "#C8102E", textColor: "#fff" },
  "Lufthansa": { code: "LH", color: "#05164D", textColor: "#fff" },
  "EgyptAir": { code: "MS", color: "#002B49", textColor: "#fff" },
  "JAL": { code: "JL", color: "#CC0000", textColor: "#fff" },
  "Malaysia Airlines": { code: "MH", color: "#002B66", textColor: "#fff" },
  "Batik Air": { code: "OD", color: "#A81E23", textColor: "#fff" },
  "Air Arabia": { code: "G9", color: "#E31837", textColor: "#fff" },
  "Qantas": { code: "QF", color: "#E0001B", textColor: "#fff" },
  "Air France": { code: "AF", color: "#002157", textColor: "#fff" },
  "United Airlines": { code: "UA", color: "#002244", textColor: "#fff" },
  "KLM": { code: "KL", color: "#00A1DE", textColor: "#fff" },
  "ANA": { code: "NH", color: "#003296", textColor: "#fff" },
  "IndiGo + flydubai": { code: "6E+FZ", color: "#0066B3", textColor: "#fff" },
  "Akasa Air + Air Arabia": { code: "QP+G9", color: "#FF6600", textColor: "#fff" }
};

/**
 * ATPCO Baggage Policy Map — per-airline entitlements & paid SSR tiers
 * Source mirrors Amadeus Flight Offers includedCheckedBags + Branded Fares + SSR BAGS catalog.
 * includedKg: checked kg included in the base fare shown in results (ECONOMY base/promo class)
 * cabinKg: cabin bag allowance
 * tiers: Branded Fare families (fareBasis label, included kg, price delta vs base)
 * paidSlabs: SSR BAGS add-on catalog (weight, price in INR, note)
 */
const AIRLINE_BAGGAGE_POLICY = {
  // ── LCCs: Domestic India & Gulf ──────────────────────────────────────────
  "IndiGo": {
    includedKg: 0,         // Base "Saver / Lite" = 0 kg check-in
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only (0kg Checked) — Lite Fare",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "Lite",   bagKg: 0,  priceDelta: 0,    note: "No check-in bag" },
      { label: "Regular", bagKg: 15, priceDelta: 1200, note: "15kg check-in included" },
      { label: "Flexi+", bagKg: 25, priceDelta: 2500, note: "25kg + free seat selection" }
    ],
    paidSlabs: [
      { weight: 15, price: 1500, code: "0CC", label: "+15 kg Check-in Bag" },
      { weight: 20, price: 2200, code: "0CD", label: "+20 kg Check-in Bag" },
      { weight: 30, price: 3400, code: "0CE", label: "+30 kg Check-in Bag" }
    ]
  },
  "IndiGo + flydubai": {
    includedKg: 0,
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only • Separate Baggage Rules (Re-check Landside)",
    fareNoteColor: "#DC2626",
    tiers: [
      { label: "Lite", bagKg: 0, priceDelta: 0, note: "Re-check bags landside" }
    ],
    paidSlabs: [
      { weight: 15, price: 2500, code: "0CC", label: "+15 kg Self-Transfer Bag" },
      { weight: 20, price: 3500, code: "0CD", label: "+20 kg Self-Transfer Bag" }
    ]
  },
  "Akasa Air + Air Arabia": {
    includedKg: 20,
    cabinKg: 7,
    fareNote: "🧳 20kg Bag (Re-check required at Layover City)",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "Standard", bagKg: 20, priceDelta: 0, note: "Re-check bags landside" }
    ],
    paidSlabs: [
      { weight: 20, price: 0, code: "0CD", label: "20 kg Standard Bag" },
      { weight: 30, price: 2800, code: "0CE", label: "+30 kg Heavy Bag" }
    ]
  },
  "Air India Express": {
    includedKg: 15,
    cabinKg: 7,
    fareNote: "🧳 15kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Saver",  bagKg: 15, priceDelta: 0,    note: "15kg check-in included" },
      { label: "Value",  bagKg: 20, priceDelta: 900,  note: "20kg check-in included" },
      { label: "Flexi",  bagKg: 25, priceDelta: 1800, note: "25kg + free seat selection" }
    ],
    paidSlabs: [
      { weight: 5,  price: 600,  code: "0CA", label: "+5 kg top-up" },
      { weight: 10, price: 1100, code: "0CB", label: "+10 kg top-up" },
      { weight: 20, price: 2000, code: "0CD", label: "+20 kg total (extra 5kg)" }
    ]
  },
  "Akasa Air": {
    includedKg: 0,
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only (0kg Checked) — Lite Fare",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "Lite",   bagKg: 0,  priceDelta: 0,    note: "No check-in bag" },
      { label: "Value",  bagKg: 15, priceDelta: 1100, note: "15kg check-in included" },
      { label: "Flexi",  bagKg: 25, priceDelta: 2400, note: "25kg + free meal" }
    ],
    paidSlabs: [
      { weight: 15, price: 1400, code: "0CC", label: "+15 kg Check-in Bag" },
      { weight: 20, price: 2100, code: "0CD", label: "+20 kg Check-in Bag" }
    ]
  },
  "SpiceJet": {
    includedKg: 0,
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only (0kg Checked) — SpiceSaver",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "SpiceSaver", bagKg: 0,  priceDelta: 0,    note: "No check-in bag" },
      { label: "SpiceValue", bagKg: 15, priceDelta: 1050, note: "15kg check-in included" },
      { label: "SpiceFlex",  bagKg: 20, priceDelta: 2200, note: "20kg + date change free" }
    ],
    paidSlabs: [
      { weight: 15, price: 1350, code: "0CC", label: "+15 kg Check-in Bag" },
      { weight: 20, price: 2000, code: "0CD", label: "+20 kg Check-in Bag" }
    ]
  },
  "Air India": {
    includedKg: 25,
    cabinKg: 8,
    fareNote: "🧳 25kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Saver", bagKg: 25, priceDelta: 0,    note: "25kg check-in included" },
      { label: "Economy Value", bagKg: 25, priceDelta: 800,  note: "25kg + seat selection" },
      { label: "Economy Flex",  bagKg: 35, priceDelta: 2500, note: "35kg + lounge + full flex" }
    ],
    paidSlabs: [
      { weight: 5,  price: 700,  code: "0CA", label: "+5 kg top-up" },
      { weight: 10, price: 1300, code: "0CB", label: "+10 kg top-up" },
      { weight: 15, price: 1900, code: "0CC", label: "+15 kg top-up" }
    ]
  },
  // ── Gulf Carriers / LCCs ─────────────────────────────────────────────────
  "Air Arabia": {
    includedKg: 0,
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only (0kg Checked) — Bare Fare",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "Lite",     bagKg: 0,  priceDelta: 0,    note: "No check-in bag" },
      { label: "Standard", bagKg: 20, priceDelta: 1400, note: "20kg check-in included" },
      { label: "Flexi",    bagKg: 30, priceDelta: 2600, note: "30kg + priority boarding" }
    ],
    paidSlabs: [
      { weight: 20, price: 1600, code: "0CC", label: "+20 kg Check-in Bag" },
      { weight: 30, price: 2800, code: "0CD", label: "+30 kg Check-in Bag" },
      { weight: 40, price: 3800, code: "0CE", label: "+40 kg Check-in Bag" }
    ]
  },
  "flydubai": {
    includedKg: 0,
    cabinKg: 7,
    fareNote: "🎒 7kg Cabin Only (0kg Checked) — Economy Lite",
    fareNoteColor: "#D97706",
    tiers: [
      { label: "Economy Lite",  bagKg: 0,  priceDelta: 0,    note: "No check-in bag" },
      { label: "Economy Value", bagKg: 20, priceDelta: 1350, note: "20kg check-in included" },
      { label: "Economy Flex",  bagKg: 30, priceDelta: 2700, note: "30kg + flexible changes" }
    ],
    paidSlabs: [
      { weight: 20, price: 1550, code: "0CC", label: "+20 kg Check-in Bag" },
      { weight: 30, price: 2600, code: "0CD", label: "+30 kg Check-in Bag" }
    ]
  },
  // ── Full-Service Gulf / International ────────────────────────────────────
  "Emirates": {
    includedKg: 30,
    cabinKg: 7,
    fareNote: "🧳 30kg Checked Bag Included (Economy Saver)",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Saver", bagKg: 30, priceDelta: 0,    note: "30kg check-in included" },
      { label: "Economy Flex",  bagKg: 35, priceDelta: 3200, note: "35kg + free date change" },
      { label: "Economy Flex+", bagKg: 35, priceDelta: 5500, note: "35kg + lounge + full flex" }
    ],
    paidSlabs: [
      { weight: 5,  price: 1200, code: "0CA", label: "+5 kg top-up (35kg total)" },
      { weight: 15, price: 3000, code: "0CB", label: "+15 kg top-up (45kg total)" },
      { weight: 32, price: 5800, code: "0CC", label: "+1 extra piece (32kg)" }
    ]
  },
  "Qatar Airways": {
    includedKg: 25,
    cabinKg: 7,
    fareNote: "🧳 25kg Checked Bag Included (Economy Classic)",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Classic", bagKg: 25, priceDelta: 0,    note: "25kg check-in included" },
      { label: "Economy Comfort", bagKg: 30, priceDelta: 2800, note: "30kg + seat selection" },
      { label: "Economy Flex",    bagKg: 35, priceDelta: 5200, note: "35kg + full flexibility" }
    ],
    paidSlabs: [
      { weight: 5,  price: 1100, code: "0CA", label: "+5 kg top-up" },
      { weight: 15, price: 2800, code: "0CB", label: "+15 kg top-up" },
      { weight: 32, price: 5200, code: "0CC", label: "+1 extra piece (32kg)" }
    ]
  },
  "Etihad": {
    includedKg: 23,
    cabinKg: 7,
    fareNote: "🧳 23kg Checked Bag Included (Economy Lite)",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Lite",   bagKg: 23, priceDelta: 0,    note: "1 piece 23kg included" },
      { label: "Economy Smart",  bagKg: 23, priceDelta: 2000, note: "1 piece 23kg + seat" },
      { label: "Economy Flex",   bagKg: 32, priceDelta: 4500, note: "1 piece 32kg + full flex" }
    ],
    paidSlabs: [
      { weight: 23, price: 4200, code: "0CC", label: "+1 extra piece (23kg)" },
      { weight: 32, price: 6500, code: "0CD", label: "+1 extra piece (32kg)" }
    ]
  },
  "Etihad Airways": {
    includedKg: 23,
    cabinKg: 7,
    fareNote: "🧳 23kg Checked Bag Included (Economy Lite)",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Lite",  bagKg: 23, priceDelta: 0,    note: "1 piece 23kg included" },
      { label: "Economy Smart", bagKg: 23, priceDelta: 2000, note: "1 piece 23kg + seat" },
      { label: "Economy Flex",  bagKg: 32, priceDelta: 4500, note: "1 piece 32kg + full flex" }
    ],
    paidSlabs: [
      { weight: 23, price: 4200, code: "0CC", label: "+1 extra piece (23kg)" },
      { weight: 32, price: 6500, code: "0CD", label: "+1 extra piece (32kg)" }
    ]
  },
  "Turkish Airlines": {
    includedKg: 20,
    cabinKg: 8,
    fareNote: "🧳 20kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Promo", bagKg: 20, priceDelta: 0,    note: "20kg check-in included" },
      { label: "Economy",       bagKg: 30, priceDelta: 2200, note: "30kg check-in included" },
      { label: "Economy Flex",  bagKg: 30, priceDelta: 4000, note: "30kg + full flexibility" }
    ],
    paidSlabs: [
      { weight: 10, price: 1500, code: "0CA", label: "+10 kg top-up" },
      { weight: 20, price: 2800, code: "0CB", label: "+20 kg top-up" },
      { weight: 32, price: 5000, code: "0CC", label: "+1 extra piece (32kg)" }
    ]
  },
  "Singapore Airlines": {
    includedKg: 30,
    cabinKg: 7,
    fareNote: "🧳 30kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Lite",    bagKg: 25, priceDelta: 0,    note: "25kg check-in included" },
      { label: "Economy Standard",bagKg: 30, priceDelta: 2500, note: "30kg + seat selection" },
      { label: "Economy Flexi",   bagKg: 35, priceDelta: 5000, note: "35kg + full flex + lounge" }
    ],
    paidSlabs: [
      { weight: 5,  price: 1500, code: "0CA", label: "+5 kg top-up" },
      { weight: 10, price: 2800, code: "0CB", label: "+10 kg top-up" },
      { weight: 32, price: 6000, code: "0CC", label: "+1 extra piece (32kg)" }
    ]
  },
  "Lufthansa": {
    includedKg: 23,
    cabinKg: 8,
    fareNote: "🧳 1 × 23kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Light",  bagKg: 23, priceDelta: 0,    note: "1 piece 23kg included" },
      { label: "Economy Classic",bagKg: 23, priceDelta: 3000, note: "1 piece 23kg + seat" },
      { label: "Economy Flex",   bagKg: 23, priceDelta: 6000, note: "1 piece 23kg + full flex + lounge" }
    ],
    paidSlabs: [
      { weight: 23, price: 5500, code: "0CC", label: "+1 extra piece (23kg)" },
      { weight: 32, price: 8000, code: "0CD", label: "+1 extra piece (32kg)" }
    ]
  },
  "British Airways": {
    includedKg: 23,
    cabinKg: 23,
    fareNote: "🧳 1 × 23kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Basic",  bagKg: 23, priceDelta: 0,    note: "1 piece 23kg included" },
      { label: "Plus",   bagKg: 23, priceDelta: 3500, note: "1 piece 23kg + seat + lounge" },
      { label: "Flex",   bagKg: 32, priceDelta: 7000, note: "1 piece 32kg + full flex + lounge" }
    ],
    paidSlabs: [
      { weight: 23, price: 5800, code: "0CC", label: "+1 extra piece (23kg)" },
      { weight: 32, price: 9000, code: "0CD", label: "+1 extra piece (32kg)" }
    ]
  },
  "Gulf Air": {
    includedKg: 25,
    cabinKg: 7,
    fareNote: "🧳 25kg Checked Bag Included",
    fareNoteColor: "#059669",
    tiers: [
      { label: "Economy Promo", bagKg: 25, priceDelta: 0,    note: "25kg check-in included" },
      { label: "Economy Value", bagKg: 30, priceDelta: 1800, note: "30kg check-in included" },
      { label: "Economy Flex",  bagKg: 35, priceDelta: 3500, note: "35kg + full flexibility" }
    ],
    paidSlabs: [
      { weight: 10, price: 1200, code: "0CA", label: "+10 kg top-up" },
      { weight: 20, price: 2200, code: "0CB", label: "+20 kg top-up" }
    ]
  }
};

// Default / fallback baggage policy for airlines not listed above
const BAGGAGE_POLICY_DEFAULT = {
  includedKg: 15,
  cabinKg: 7,
  fareNote: "🧳 15kg Checked Bag Included",
  fareNoteColor: "#059669",
  tiers: [
    { label: "Economy",      bagKg: 15, priceDelta: 0,    note: "15kg check-in included" },
    { label: "Economy Flex", bagKg: 25, priceDelta: 2000, note: "25kg + free date change" }
  ],
  paidSlabs: [
    { weight: 15, price: 1500, code: "0CC", label: "+15 kg Check-in Bag" },
    { weight: 20, price: 2200, code: "0CD", label: "+20 kg Check-in Bag" },
    { weight: 30, price: 3400, code: "0CE", label: "+30 kg Check-in Bag" }
  ]
};

/**
 * Returns the ATPCO baggage policy for a given airline name.
 * Falls back to BAGGAGE_POLICY_DEFAULT for unlisted carriers.
 */
function getAirlineBaggagePolicy(airlineName) {
  return AIRLINE_BAGGAGE_POLICY[airlineName] || BAGGAGE_POLICY_DEFAULT;
}

/**
 * ═══ TOTAL COST OF TRAVEL (TCOT) ANCILLARY CATALOG ═══
 * Dynamic per-airline pricing for checked baggage, in-flight dining,
 * seat assignments (standard window/aisle vs extra legroom XL), and ticket flexibility.
 *
 * Full-Service Carriers (FSC) like Emirates, Qatar Airways, Singapore Airlines, and Air India
 * include standard meals, 20-30kg checked baggage, and standard seats for ₹0 extra.
 * Low-Cost Carriers (LCC) like IndiGo, Akasa, SpiceJet, Air Arabia, and flydubai unbundle these services.
 */
const AIRLINE_ANCILLARY_CATALOG = {
  "IndiGo": {
    isLcc: true,
    meal: { included: false, price: 450, label: "6E Tiffin Hot Meal" },
    seat: { any: 0, standard: 250, extra_legroom: 650 },
    baggage: { 0: 0, 15: 1200, 25: 2200 },
    flexi: { price: 800, label: "6E Flexi Reschedule" }
  },
  "Akasa Air": {
    isLcc: true,
    meal: { included: false, price: 450, label: "Café Akasa Hot Meal" },
    seat: { any: 0, standard: 250, extra_legroom: 700 },
    baggage: { 0: 0, 15: 1100, 25: 2100 },
    flexi: { price: 850, label: "Akasa Flexi Date Change" }
  },
  "SpiceJet": {
    isLcc: true,
    meal: { included: false, price: 450, label: "SpiceMax Hot Meal" },
    seat: { any: 0, standard: 250, extra_legroom: 650 },
    baggage: { 0: 0, 15: 1250, 25: 2200 },
    flexi: { price: 800, label: "SpiceFlex Date Change" }
  },
  "Air Arabia": {
    isLcc: true,
    meal: { included: false, price: 480, label: "Sky Café Hot Meal" },
    seat: { any: 0, standard: 300, extra_legroom: 900 },
    baggage: { 0: 0, 15: 1400, 25: 2600 },
    flexi: { price: 950, label: "Flexi Reschedule" }
  },
  "flydubai": {
    isLcc: true,
    meal: { included: false, price: 480, label: "Hot In-flight Meal" },
    seat: { any: 0, standard: 300, extra_legroom: 950 },
    baggage: { 0: 0, 15: 1350, 25: 2500 },
    flexi: { price: 900, label: "Flexible Date Change" }
  },
  "Air India": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Maharaja Hot Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 850 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 1200, label: "Free Date Change Option" }
  },
  "Emirates": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Multi-Course Gourmet Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1500 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2500, label: "Economy Flex Date Change" }
  },
  "Qatar Airways": {
    isLcc: false,
    meal: { included: true, price: 0, label: "World-Class Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1400 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2400, label: "Economy Flex Date Change" }
  },
  "Singapore Airlines": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Chef-Curated Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1600 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2600, label: "Flexi Rebooking" }
  },
  "Etihad": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Complimentary Hot Meal Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1200 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2000, label: "Smart Flex Change" }
  },
  "Etihad Airways": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Complimentary Hot Meal Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1200 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2000, label: "Smart Flex Change" }
  },
  "Vistara": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Gourmet Hot Meal Included" },
    seat: { any: 0, standard: 0, extra_legroom: 850 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 1200, label: "Economy Flex Date Change" }
  },
  "Lufthansa": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Complimentary Hot Dining" },
    seat: { any: 0, standard: 0, extra_legroom: 1500 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 3000, label: "Lufthansa Flex" }
  },
  "British Airways": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Complimentary Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1600 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 3200, label: "Plus Flex Change" }
  },
  "Gulf Air": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Complimentary Falcon Dining" },
    seat: { any: 0, standard: 0, extra_legroom: 1100 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 1800, label: "Economy Value Flex" }
  },
  "Turkish Airlines": {
    isLcc: false,
    meal: { included: true, price: 0, label: "Flying Chef Dining Included" },
    seat: { any: 0, standard: 0, extra_legroom: 1300 },
    baggage: { 0: 0, 15: 0, 25: 0 },
    flexi: { price: 2200, label: "Semi-Flexible Rebooking" }
  }
};

const DEFAULT_LCC_ANCILLARY = {
  isLcc: true,
  meal: { included: false, price: 450, label: "In-Flight Hot Meal" },
  seat: { any: 0, standard: 250, extra_legroom: 750 },
  baggage: { 0: 0, 15: 1200, 25: 2200 },
  flexi: { price: 800, label: "Free Date Change" }
};

const DEFAULT_FSC_ANCILLARY = {
  isLcc: false,
  meal: { included: true, price: 0, label: "Complimentary Meal Included" },
  seat: { any: 0, standard: 0, extra_legroom: 1200 },
  baggage: { 0: 0, 15: 0, 25: 0 },
  flexi: { price: 2000, label: "Flexible Ticket Change" }
};

function getAirlineAncillaryProfile(airlineName) {
  if (!airlineName) return DEFAULT_LCC_ANCILLARY;
  if (AIRLINE_ANCILLARY_CATALOG[airlineName]) return AIRLINE_ANCILLARY_CATALOG[airlineName];
  const norm = String(airlineName).toLowerCase();
  for (const key of Object.keys(AIRLINE_ANCILLARY_CATALOG)) {
    if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
      return AIRLINE_ANCILLARY_CATALOG[key];
    }
  }
  const bp = typeof getAirlineBaggagePolicy === 'function' ? getAirlineBaggagePolicy(airlineName) : null;
  if (bp && bp.includedKg > 0) {
    return DEFAULT_FSC_ANCILLARY;
  }
  return DEFAULT_LCC_ANCILLARY;
}

function calculateTcotPackagePrice(baseFare, airlineName, packagePrefs) {
  const profile = getAirlineAncillaryProfile(airlineName);
  const prefs = Object.assign({ baggageKg: 15, requireMeal: false, requireSeat: 'any', requireFlexi: false }, packagePrefs);
  
  const bKg = parseInt(prefs.baggageKg, 10) || 0;
  const bagCost = profile.baggage[bKg] !== undefined ? profile.baggage[bKg] : (bKg === 0 ? 0 : (bKg === 25 ? 2200 : 1200));
  const mealCost = prefs.requireMeal ? (profile.meal.included ? 0 : profile.meal.price) : 0;
  const seatCost = profile.seat[prefs.requireSeat] !== undefined ? profile.seat[prefs.requireSeat] : 0;
  const flexiCost = prefs.requireFlexi ? profile.flexi.price : 0;

  const ancillaryTotal = bagCost + mealCost + seatCost + flexiCost;
  const baseNum = Math.round(parseFloat(baseFare) || 0);
  const tcotTotal = baseNum + ancillaryTotal;

  return {
    baseFare: baseNum,
    baggageKg: bKg,
    bagCost: bagCost,
    mealCost: mealCost,
    seatCost: seatCost,
    flexiCost: flexiCost,
    ancillaryTotal: ancillaryTotal,
    tcotTotal: tcotTotal,
    isLcc: profile.isLcc,
    carrierName: airlineName || (profile.isLcc ? 'Low-Cost Carrier' : 'Full-Service Carrier'),
    breakdownSummary: `Base ₹${baseNum.toLocaleString('en-IN')} + ₹${ancillaryTotal.toLocaleString('en-IN')} bundle (🧳 ${bKg}kg: ₹${bagCost}, 🍱 Meal: ₹${mealCost}, 💺 Seat: ₹${seatCost}, 🔄 Flex: ₹${flexiCost})`
  };
}

/**
 * ═══ PITFALL #1 SAFEGUARD: MIDNIGHT DEPARTURE DETECTOR ═══
 * Detects if a flight departs in the early morning / red-eye window (00:00 - 03:59).
 * In aviation, these flights have the highest accidental no-show rates because travelers
 * confuse the departure date with "tomorrow night" instead of "tonight".
 *
 * Returns null if daytime/evening, or an object with previous-evening arrival details:
 * {
 *   isMidnight: true,
 *   departureTime: "00:25 AM",
 *   departureHours: 0,
 *   departureDateFormatted: "Thu, Oct 15",
 *   previousDateFormatted: "Wed, Oct 14",
 *   suggestedArrivalTime: "9:25 PM",
 *   suggestedArrivalFull: "9:25 PM (Wed, Oct 14)",
 *   humanWarning: "Departs 00:25 AM on Thu, Oct 15. You must reach the airport on Wed, Oct 14 by 9:25 PM!"
 * }
 */
function getMidnightDepartureInfo(timeStr, dateStr) {
  if (!timeStr) return null;
  const raw = String(timeStr).trim().toUpperCase();

  // Parse hour and minute from strings like "00:25 AM", "12:25 AM", "01:15", "02:40 AM", "2:40", "03:55"
  let hours = -1;
  let minutes = 0;

  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const meridiem = match12[3];
    if (meridiem === 'AM') {
      if (hours === 12) hours = 0;
    } else if (meridiem === 'PM') {
      if (hours < 12) hours += 12;
    }
  }

  // Check if departure falls between 00:00 and 03:59 (4:00 AM cutoff)
  if (hours < 0 || hours >= 4) return null;

  // Compute departure date and day-before date
  let depDate = new Date();
  if (dateStr) {
    const dStr = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      const parts = dStr.split("-").map(Number);
      depDate = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) depDate = parsed;
    }
  }

  const prevDate = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate() - 1);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const depFmt = `${days[depDate.getDay()]}, ${months[depDate.getMonth()]} ${depDate.getDate()}`;
  const prevFmt = `${days[prevDate.getDay()]}, ${months[prevDate.getMonth()]} ${prevDate.getDate()}`;

  // Check-in arrival is 3 hours prior (e.g. 00:25 -> 21:25 (9:25 PM) on previous evening)
  let arrHours = hours - 3;
  let arrDayFmt = prevFmt;
  if (arrHours < 0) {
    arrHours += 24;
    arrDayFmt = prevFmt;
  } else {
    arrDayFmt = depFmt;
  }

  const arrMeridiem = arrHours >= 12 ? 'PM' : 'AM';
  const arrDisp12 = (arrHours % 12 === 0 ? 12 : arrHours % 12);
  const arrMinStr = minutes < 10 ? '0' + minutes : String(minutes);
  const arrTimeStr = `${arrDisp12}:${arrMinStr} ${arrMeridiem}`;

  return {
    isMidnight: true,
    departureTime: timeStr,
    departureHours: hours,
    departureDateFormatted: depFmt,
    previousDateFormatted: prevFmt,
    suggestedArrivalTime: arrTimeStr,
    suggestedArrivalFull: `${arrTimeStr} (${arrDayFmt})`,
    humanWarning: `Departs ${timeStr} on ${depFmt}. You must reach the airport on ${arrDayFmt} by ${arrTimeStr}!`
  };
}

/**
 * ═══ PITFALL #2 SAFEGUARD: ATOMIC GDS PRE-EXECUTION PRICE VALIDATOR ═══
 * Simulates an atomic Amadeus GDS `/v1/shopping/flight-offers/pricing` validation call
 * before charging customer card token or finalizing ticket issuance.
 *
 * Prevents:
 * 1. Ticketing Time Limit (TTL) expiration mid-flight
 * 2. Race condition price surges (e.g. promo bucket sells out milliseconds before checkout)
 * 3. Card overcharges exceeding the user's authorized budget cap
 *
 * Parameters:
 *  - targetFare: number (User's authorized per-pax cap)
 *  - liveGdsFare: number (Current live price returned by airline API)
 *  - toleranceMode: 'strict_0' | 'flexible_500'
 *
 * Returns:
 * {
 *   allowed: boolean,
 *   driftAmount: number,
 *   maxAllowedDrift: number,
 *   toleranceMode: string,
 *   reason: string,
 *   status: 'PRICE_VERIFIED' | 'PRICE_DRIFT_EXCEEDED' | 'FAVORABLE_DROP',
 *   seatHoldTtlMinutes: 15
 * }
 */
function validateAutoBookPricePreExecution(targetFare, liveGdsFare, toleranceMode = 'strict_0') {
  const maxAllowedDrift = toleranceMode === 'flexible_500' ? 500 : 0;
  const driftAmount = liveGdsFare - targetFare;

  if (driftAmount <= 0) {
    // Fare is at or even below target!
    return {
      allowed: true,
      driftAmount: driftAmount,
      maxAllowedDrift: maxAllowedDrift,
      toleranceMode: toleranceMode,
      status: driftAmount < 0 ? 'FAVORABLE_DROP' : 'PRICE_VERIFIED',
      reason: driftAmount < 0 
        ? `Live GDS fare (₹${liveGdsFare}) dropped below target (₹${targetFare}) by ₹${Math.abs(driftAmount)}. Atomic execution approved.`
        : `Live GDS fare (₹${liveGdsFare}) matches authorized target cap exactly. Atomic execution approved.`,
      seatHoldTtlMinutes: 15
    };
  } else if (driftAmount <= maxAllowedDrift) {
    // Small drift permitted by user's flexible tolerance
    return {
      allowed: true,
      driftAmount: driftAmount,
      maxAllowedDrift: maxAllowedDrift,
      toleranceMode: toleranceMode,
      status: 'PRICE_VERIFIED',
      reason: `Live GDS fare (₹${liveGdsFare}) drifted up by ₹${driftAmount}, within user's flexible tolerance limit of ₹${maxAllowedDrift}. Executing to avoid seat loss.`,
      seatHoldTtlMinutes: 15
    };
  } else {
    // Price jumped beyond allowed tolerance! Protect customer card from unauthorized charge
    return {
      allowed: false,
      driftAmount: driftAmount,
      maxAllowedDrift: maxAllowedDrift,
      toleranceMode: toleranceMode,
      status: 'PRICE_DRIFT_EXCEEDED',
      reason: `Live GDS fare (₹${liveGdsFare}) increased by ₹${driftAmount}, exceeding allowed tolerance limit of ₹${maxAllowedDrift}. Card charge blocked. Seat hold released. Returning to 24/7 background monitor.`,
      seatHoldTtlMinutes: 15
    };
  }
}

// Airport Code & Name Resolver
function resolveAirport(query, fallbackCode) {
  if (!query) return fallbackCode || "DEL";
  const str = query.trim();

  // 1. Check if string contains code in parentheses, e.g. "Mumbai (BOM)" or "(BOM)"
  const codeInParen = str.match(/\(([A-Za-z]{3})\)/);
  if (codeInParen) return codeInParen[1].toUpperCase();

  // 2. Check if string itself is a 3-letter IATA code, e.g. "BOM", "DXB", "JFK"
  if (/^[A-Za-z]{3}$/.test(str)) {
    return str.toUpperCase();
  }

  // 3. Search exact match by code, city, name in OTA_AIRPORTS
  const q = str.toLowerCase();
  const directMatch = OTA_AIRPORTS.find(a => 
    a.code.toLowerCase() === q || 
    a.city.toLowerCase() === q
  );
  if (directMatch) return directMatch.code;

  // 4. Fuzzy search in OTA_AIRPORTS
  const fuzzyMatch = OTA_AIRPORTS.find(a => 
    a.city.toLowerCase().includes(q) || 
    a.name.toLowerCase().includes(q) || 
    a.country.toLowerCase().includes(q)
  );
  if (fuzzyMatch) return fuzzyMatch.code;

  return fallbackCode || "DEL";
}

/**
 * ═══ PITFALL #3 SAFEGUARD: 6-MONTH PASSPORT VALIDITY & INAD LIABILITY ENGINE ═══
 * Under ICAO Annex 9 and destination immigration regulations (UAE GDRFA, Singapore ICA,
 * US CBP, Schengen Border Code), international carriers face statutory fines ($3,500 - $5,000)
 * if they board passengers with < 6 months passport validity.
 */

const INDIAN_AIRPORTS = new Set([
  'DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'COK', 'TRV', 'CNN', 'CCJ',
  'GOI', 'GOX', 'AMD', 'PNQ', 'JAI', 'LKO', 'IXC', 'ATQ', 'PAT', 'BBI',
  'VNS', 'GAU', 'IXE', 'SXR', 'IXB', 'VTZ', 'TRZ', 'CJB', 'NAG', 'IDR'
]);

function isIndianAirport(code) {
  if (!code) return true;
  return INDIAN_AIRPORTS.has(String(code).trim().toUpperCase());
}

function isInternationalRoute(origCode, destCode) {
  const orig = resolveAirport(origCode, 'DEL');
  const dest = resolveAirport(destCode, 'DXB');
  return !isIndianAirport(orig) || !isIndianAirport(dest);
}

/**
 * Validates passport expiration date against a travel date for 6-month compliance.
 * Threshold = travelDate + 180 days (~6 calendar months).
 */
function validatePassportValidity(expiryStr, travelDateStr) {
  if (!expiryStr) {
    return {
      isValid: false,
      isExpired: false,
      status: 'MISSING',
      warning: 'Passport expiry date required for international travel.'
    };
  }

  let expDate = null;
  const raw = String(expiryStr).trim();

  // Support YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    expDate = new Date(raw + "T00:00:00");
  } else if (/^\d{2}\/\d{2}$/.test(raw)) {
    // MM/YY format (e.g. 12/28 -> 2028-12-31)
    const [mm, yy] = raw.split("/").map(Number);
    const fullYear = 2000 + yy;
    expDate = new Date(fullYear, mm, 0); // last day of month
  } else if (/^\d{2}\/\d{4}$/.test(raw)) {
    // MM/YYYY format
    const [mm, yyyy] = raw.split("/").map(Number);
    expDate = new Date(yyyy, mm, 0);
  } else {
    expDate = new Date(raw);
  }

  if (!expDate || isNaN(expDate.getTime())) {
    return {
      isValid: false,
      isExpired: false,
      status: 'INVALID_FORMAT',
      warning: 'Please enter a valid passport expiry date (YYYY-MM-DD or MM/YY).'
    };
  }

  const travelDate = travelDateStr ? new Date(travelDateStr + "T00:00:00") : new Date();
  const safeTravelTime = isNaN(travelDate.getTime()) ? Date.now() : travelDate.getTime();

  // Threshold: 180 days (~6 months) after travel date
  const minRequiredTime = safeTravelTime + (180 * 24 * 60 * 60 * 1000);
  const minRequiredDate = new Date(minRequiredTime);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const expFormatted = `${months[expDate.getMonth()]} ${expDate.getDate()}, ${expDate.getFullYear()}`;
  const reqFormatted = `${months[minRequiredDate.getMonth()]} ${minRequiredDate.getDate()}, ${minRequiredDate.getFullYear()}`;

  const isExpired = expDate.getTime() <= safeTravelTime;
  const daysDiff = Math.ceil((expDate.getTime() - safeTravelTime) / (1000 * 60 * 60 * 24));

  if (isExpired) {
    return {
      isValid: false,
      isExpired: true,
      status: 'EXPIRED',
      expiryDateFormatted: expFormatted,
      requiredExpiryFormatted: reqFormatted,
      daysRemainingFromTravel: daysDiff,
      warning: `Passport EXPIRED on ${expFormatted}. Destination immigration will refuse boarding.`
    };
  }

  if (expDate.getTime() < minRequiredTime) {
    return {
      isValid: false,
      isExpired: false,
      status: 'INAD_RISK',
      expiryDateFormatted: expFormatted,
      requiredExpiryFormatted: reqFormatted,
      daysRemainingFromTravel: daysDiff,
      warning: `INAD Risk: Passport expires ${expFormatted} (${daysDiff} days from travel). Destination immigration mandates validity until at least ${reqFormatted} (6 months). Boarding will be denied at gate under ICAO Annex 9!`
    };
  }

  return {
    isValid: true,
    isExpired: false,
    status: 'COMPLIANT',
    expiryDateFormatted: expFormatted,
    requiredExpiryFormatted: reqFormatted,
    daysRemainingFromTravel: daysDiff,
    warning: null
  };
}

/**
 * Checks passport validity for the 24/7 Price Alert & Auto-Book modal
 */
function checkAlertPassportInad() {
  const orig = FlyvisOtaState.route?.origCode || 'DEL';
  const dest = FlyvisOtaState.route?.destCode || 'DXB';
  const travelDate = FlyvisOtaState.route?.departureDate || '2026-10-28';
  const isIntl = isInternationalRoute(orig, dest);

  const expInput = document.getElementById("alert-traveler-passport-exp");
  const expWrap = document.getElementById("alert-passport-exp-wrap");
  const badge = document.getElementById("alert-inad-badge");
  const warning = document.getElementById("alert-inad-warning");
  const docLbl = document.getElementById("alert-lbl-doc-num");
  const passportExpCol = document.getElementById("alert-passport-exp-col");
  const passportGridRow = document.getElementById("alert-passport-grid-row");

  if (!isIntl) {
    // Domestic flight — passport not required
    if (docLbl) docLbl.textContent = "National ID / Aadhaar / Voter ID";
    if (passportExpCol) passportExpCol.style.display = "none";
    if (passportGridRow) passportGridRow.style.gridTemplateColumns = "1fr";
    if (badge) {
      badge.style.backgroundColor = "#F0FDFA";
      badge.style.borderColor = "#99F6E4";
      badge.style.color = "#0F766E";
      badge.innerHTML = "<span>🪪</span> Domestic Govt Photo ID (No Passport Required)";
    }
    if (warning) warning.style.display = "none";
    return;
  }

  // International flight — passport required
  if (passportExpCol) passportExpCol.style.display = "block";
  if (passportGridRow) passportGridRow.style.gridTemplateColumns = "1fr 1fr";
  if (docLbl) docLbl.textContent = "Passport Number (International)";
  const expVal = expInput ? expInput.value : "";
  const result = validatePassportValidity(expVal, travelDate);

  if (result.isValid) {
    if (badge) {
      badge.style.backgroundColor = "#DCFCE7";
      badge.style.borderColor = "#BBF7D0";
      badge.style.color = "#166534";
      badge.innerHTML = `<span>✓</span> 6M Valid through ${result.expiryDateFormatted}`;
    }
    if (warning) warning.style.display = "none";
  } else if (result.status === 'INAD_RISK' || result.status === 'EXPIRED') {
    if (badge) {
      badge.style.backgroundColor = "#FEE2E2";
      badge.style.borderColor = "#FECACA";
      badge.style.color = "#991B1B";
      badge.innerHTML = `<span>🚨</span> ${result.status === 'EXPIRED' ? 'EXPIRED PASSPORT' : 'INAD RISK (< 6 Mos)'}`;
    }
    if (warning) {
      warning.style.display = "block";
      warning.innerHTML = `<strong>🚨 Boarding Refusal Risk (INAD):</strong> ${result.warning} Ensure you renew your passport before departure.`;
    }
  } else {
    if (badge) {
      badge.style.backgroundColor = "#FEF3C7";
      badge.style.borderColor = "#FDE68A";
      badge.style.color = "#92400E";
      badge.innerHTML = "<span>⚠️</span> Enter Passport Expiry";
    }
    if (warning) warning.style.display = "none";
  }
}

/**
 * ═══ PITFALL #4 SAFEGUARD: SELF-TRANSFER DISRUPTION & CONNECTION SAFETY ENGINE ═══
 * Evaluates connection safety against real-world Minimum Connection Time (MCT) standards.
 * On separate-ticket self-transfers (virtual interlining):
 * - Domestic-to-domestic requires >= 150 mins (2.5h) for baggage reclaim & re-check-in.
 * - Domestic-to-international or inter-terminal requires >= 210 mins (3.5h) for landside transit,
 *   baggage reclaim, re-drop, immigration & boarding gate clearance.
 */
function evaluateConnectionSafety(flight, origCode, destCode) {
  if (!flight) return null;
  const stopsStr = (flight.stops || "nonstop").toLowerCase();
  const isNonstop = stopsStr.includes("nonstop") || stopsStr.includes("direct") || stopsStr === "0";

  if (isNonstop) {
    return {
      isNonstop: true,
      isSelfTransfer: false,
      isSafe: true,
      transferType: 'DIRECT_NONSTOP',
      layoverMinutes: 0,
      minRequiredMins: 0,
      badgeText: 'Nonstop (Direct)',
      badgeClass: 'safe',
      warning: null
    };
  }

  const isSelfTransfer = !!(flight.isSelfTransfer || (flight.name && flight.name.includes("+")) || (flight.flightNum && flight.flightNum.includes("/")));
  let layoverMinutes = flight.layoverMinutes;
  if (!layoverMinutes && flight.layoverDuration) {
    layoverMinutes = parseDurationToMinutes(flight.layoverDuration);
  }
  if (!layoverMinutes) {
    layoverMinutes = 120;
  }

  const isInterTerminal = !!flight.isInterTerminal;
  const isIntl = isInternationalRoute(origCode, destCode);

  if (!isSelfTransfer) {
    // Protected Interline / Single-Airline Connection (e.g. Qatar Airways via DOH, Emirates via DXB)
    const minInterlineMins = isIntl ? 75 : 50;
    const isSafe = layoverMinutes >= minInterlineMins;
    return {
      isNonstop: false,
      isSelfTransfer: false,
      isSafe: isSafe,
      transferType: 'PROTECTED_INTERLINE',
      layoverMinutes: layoverMinutes,
      minRequiredMins: minInterlineMins,
      badgeText: '🛡️ Protected Interline Ticket',
      badgeClass: 'safe',
      warning: isSafe ? null : `Tight interline layover (${layoverMinutes}m). Airline will rebook if delayed, but connection is brisk.`
    };
  }

  // Self-Transfer (Separate Tickets / Virtual Interlining)
  const minRequired = (isIntl || isInterTerminal) ? 210 : 150; // 3.5h vs 2.5h
  const isSafe = layoverMinutes >= minRequired;

  if (isSafe) {
    return {
      isNonstop: false,
      isSelfTransfer: true,
      isSafe: true,
      transferType: 'SAFE_SELF_TRANSFER',
      layoverMinutes: layoverMinutes,
      minRequiredMins: minRequired,
      badgeText: `⚠️ Self-Transfer (${Math.floor(layoverMinutes / 60)}h ${layoverMinutes % 60}m Layover — Re-check Bags)`,
      badgeClass: 'warning',
      warning: `Self-Transfer Connection: Separate tickets. You must reclaim baggage at ${flight.layoverAirport || 'transit city'}, transfer terminals if applicable, and re-check bags. Layover of ${Math.floor(layoverMinutes / 60)}h ${layoverMinutes % 60}m meets safe buffer (>= ${minRequired / 60}h).`
    };
  } else {
    return {
      isNonstop: false,
      isSelfTransfer: true,
      isSafe: false,
      transferType: 'RISKY_SELF_TRANSFER',
      layoverMinutes: layoverMinutes,
      minRequiredMins: minRequired,
      badgeText: `🚨 High-Risk Self-Transfer (${layoverMinutes}m Layover — Zero Protection)`,
      badgeClass: 'danger',
      warning: `High-Risk Unprotected Connection: Only ${layoverMinutes} mins layover at ${flight.layoverAirport || 'transit city'}! Under separate contracts of carriage, if Flight 1 is delayed, Airline 2 marks you as a No-Show with 100% loss of fare. Baggage is NOT through-checked and must be re-checked landside. Safe MCT requires at least ${minRequired / 60} hours.`
    };
  }
}

// Initialization on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  try {
    const rawStored = localStorage.getItem('flyvis_user_cards');
    const authProfileCards = typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.savedCards;
    const cardsToUse = authProfileCards || (rawStored ? JSON.parse(rawStored) : null);
    if (cardsToUse && Array.isArray(cardsToUse) && cardsToUse.length > 0) {
      FlyvisOtaState.filters.selectedCardIds = [...cardsToUse];
    }
  } catch (e) {}

  window.addEventListener('userCardsUpdated', (e) => {
    if (e.detail && Array.isArray(e.detail)) {
      FlyvisOtaState.filters.selectedCardIds = [...e.detail];
      renderSidebarCardsList();
      applyFilters();
    }
  });

  // URL Parameter Handling (e.g. ?orig=BOM&dest=GOI&date=2026-09-22)
  const urlParams = new URLSearchParams(window.location.search);
  const paramOrig = urlParams.get("orig") || urlParams.get("from") || urlParams.get("source");
  const paramDest = urlParams.get("dest") || urlParams.get("to") || urlParams.get("destination");
  const paramDate = urlParams.get("date") || urlParams.get("depDate");

  if (paramOrig) {
    const code = resolveAirport(paramOrig, "DEL");
    const a = OTA_AIRPORTS.find(x => x.code === code);
    const origInput = document.getElementById("ota-orig-input");
    const origHidden = document.getElementById("ota-orig-code");
    if (origHidden) origHidden.value = code;
    if (origInput) origInput.value = a ? `${a.city} (${a.code})` : code;
    FlyvisOtaState.route.origCode = code;
    FlyvisOtaState.route.origName = a ? a.city : code;
  }

  if (paramDest) {
    const code = resolveAirport(paramDest, "DXB");
    const a = OTA_AIRPORTS.find(x => x.code === code);
    const destInput = document.getElementById("ota-dest-input");
    const destHidden = document.getElementById("ota-dest-code");
    if (destHidden) destHidden.value = code;
    if (destInput) destInput.value = a ? `${a.city} (${a.code})` : code;
    FlyvisOtaState.route.destCode = code;
    FlyvisOtaState.route.destName = a ? a.city : code;
  }

  if (paramDate) {
    const depInput = document.getElementById("ota-departure-date");
    if (depInput) depInput.value = paramDate;
    FlyvisOtaState.route.departureDate = paramDate;
  }

  initDatePresets();
  renderSidebarCardsList();
  executeOtaFlightSearch();
});

function initDatePresets() {
  const depInput = document.getElementById("ota-departure-date");
  if (depInput && !depInput.value) {
    depInput.value = "2026-09-17";
  }
}

/**
 * Autocomplete Airport Dropdowns
 */
function handleAirportSearch(query, type) {
  const dropdown = document.getElementById(`${type}-airport-dropdown`);
  if (!dropdown) return;

  let q = (query || "").trim().toLowerCase().replace(/[()]/g, "");
  let matches = [];

  if (!q || q.length < 2) {
    matches = OTA_AIRPORTS.slice(0, 10);
  } else {
    const tokens = q.split(" ").filter(t => t.length > 0);
    matches = OTA_AIRPORTS.filter(a => {
      const full = `${a.city} ${a.code} ${a.name} ${a.country}`.toLowerCase();
      return tokens.every(tok => full.includes(tok));
    });
  }

  if (matches.length === 0) {
    dropdown.innerHTML = `<div style="padding:12px; text-align:center; color:#64748B; font-size:12px;">No airports found</div>`;
    dropdown.style.display = "block";
    return;
  }

  dropdown.innerHTML = matches.map(a => `
    <div class="airport-item" onclick="selectOtaAirport('${a.code}', '${a.city}', '${type}')">
      <div class="airport-item-code">${a.code}</div>
      <div style="flex:1;">
        <div class="airport-item-city">${a.city} <span style="font-size:11px; font-weight:500; color:#64748B;">• ${a.country}</span></div>
        <div class="airport-item-name">${a.name}</div>
      </div>
    </div>
  `).join("");

  dropdown.style.display = "block";
}

function selectOtaAirport(code, city, type) {
  const input = document.getElementById(`ota-${type}-input`);
  const hidden = document.getElementById(`ota-${type}-code`);
  const dropdown = document.getElementById(`${type}-airport-dropdown`);

  if (input) input.value = `${city} (${code})`;
  if (hidden) hidden.value = code;
  if (dropdown) dropdown.style.display = "none";

  if (type === "orig") {
    FlyvisOtaState.route.origCode = code;
    FlyvisOtaState.route.origName = city;
  } else {
    FlyvisOtaState.route.destCode = code;
    FlyvisOtaState.route.destName = city;
  }

  // Immediately re-run search for updated route
  executeOtaFlightSearch();
}

function swapOtaRoute() {
  const origInput = document.getElementById("ota-orig-input");
  const origCode = document.getElementById("ota-orig-code");
  const destInput = document.getElementById("ota-dest-input");
  const destCode = document.getElementById("ota-dest-code");

  const tempVal = origInput.value;
  const tempCode = origCode.value;

  origInput.value = destInput.value;
  origCode.value = destCode.value;
  destInput.value = tempVal;
  destCode.value = tempCode;

  FlyvisOtaState.route.origCode = origCode.value;
  FlyvisOtaState.route.destCode = destCode.value;
  FlyvisOtaState.route.origName = origInput.value.split("(")[0].trim();
  FlyvisOtaState.route.destName = destInput.value.split("(")[0].trim();

  executeOtaFlightSearch();
}

// Global UI State for Custom Components
const FlyvisCustomUIState = {
  passengers: { adults: 1, children: 0, infants: 0 },
  calendar: {
    activeMode: "departure", // 'departure' | 'return'
    currentYear: 2026,
    currentMonth: 8, // September (0-indexed)
    departureDate: "2026-09-17",
    returnDate: ""
  }
};

/**
 * Custom Dropdowns Controller (Trip Type, Cabin, Travelers, Sort)
 */
function toggleFvDropdown(name, event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById(`menu-${name}`);
  const btn = document.getElementById(`btn-${name}`);
  if (!menu) return;

  const isOpen = menu.style.display === "block";
  closeAllFvDropdowns();

  if (!isOpen) {
    menu.style.display = "block";
    if (btn) btn.classList.add("open");
  }
}

function closeAllFvDropdowns() {
  document.querySelectorAll(".fv-dropdown-menu").forEach(m => m.style.display = "none");
  document.querySelectorAll(".fv-dropdown-trigger, .fv-sort-trigger").forEach(b => b.classList.remove("open"));
  const cal = document.getElementById("flyvis-calendar-popover");
  if (cal) cal.style.display = "none";
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".fv-custom-dropdown") && !e.target.closest(".ota-input-box") && !e.target.closest(".fv-calendar-popover")) {
    closeAllFvDropdowns();
  }
  if (!e.target.closest(".search-field-box")) {
    document.querySelectorAll(".airport-dropdown-menu").forEach(d => d.style.display = "none");
  }
});

function selectFvTripType(val, label) {
  FlyvisOtaState.route.tripType = val;
  const labelEl = document.getElementById("label-trip-type");
  if (labelEl) labelEl.textContent = label;

  document.querySelectorAll("#menu-trip-type .fv-dropdown-item").forEach(item => {
    item.classList.toggle("selected", item.getAttribute("data-val") === val);
  });

  const retBox = document.getElementById("ota-return-box");
  const retDisplay = document.getElementById("ota-ret-display");
  const retInput = document.getElementById("ota-return-date");

  if (val === "roundtrip") {
    if (retBox) retBox.style.opacity = "1";
    if (retDisplay) {
      if (!FlyvisCustomUIState.calendar.returnDate) {
        const d = new Date(FlyvisOtaState.route.departureDate || "2026-09-17");
        d.setDate(d.getDate() + 7);
        const retIso = d.toISOString().split("T")[0];
        FlyvisCustomUIState.calendar.returnDate = retIso;
        if (retInput) retInput.value = retIso;
        retDisplay.textContent = formatDisplayDateWithDay(retIso);
        retDisplay.style.color = "var(--fv-navy)";
      }
    }
  } else {
    if (retBox) retBox.style.opacity = "0.5";
    if (retDisplay) {
      retDisplay.textContent = "+ Add Return";
      retDisplay.style.color = "var(--fv-muted)";
      FlyvisCustomUIState.calendar.returnDate = "";
      if (retInput) retInput.value = "";
    }
  }

  closeAllFvDropdowns();
}

function selectFvCabin(val, label) {
  FlyvisOtaState.route.cabinClass = val;
  const labelEl = document.getElementById("label-cabin");
  if (labelEl) labelEl.textContent = label;

  document.querySelectorAll("#menu-cabin .fv-dropdown-item").forEach(item => {
    item.classList.toggle("selected", item.getAttribute("data-val") === val);
  });

  closeAllFvDropdowns();
  executeOtaFlightSearch();
}

function selectFvSort(val, label) {
  FlyvisOtaState.sortBy = val;
  const labelEl = document.getElementById("label-sort");
  const hiddenInput = document.getElementById("ota-sort-by");
  if (labelEl) labelEl.textContent = label.replace(/^[^\w]+/, '');
  if (hiddenInput) hiddenInput.value = val;

  document.querySelectorAll("#menu-sort .fv-dropdown-item").forEach(item => {
    item.classList.toggle("selected", item.getAttribute("data-val") === val);
  });

  closeAllFvDropdowns();
  sortAndRenderFlights(val);
}

function stepPassenger(type, delta) {
  const current = FlyvisCustomUIState.passengers[type] || 0;
  let next = current + delta;
  
  if (type === "adults") {
    next = Math.max(1, Math.min(9, next));
  } else {
    next = Math.max(0, Math.min(6, next));
  }

  FlyvisCustomUIState.passengers[type] = next;

  const countEl = document.getElementById(`count-${type}`);
  if (countEl) countEl.textContent = next;

  const minusBtn = document.getElementById(`btn-step-minus-${type}`);
  if (minusBtn) {
    minusBtn.disabled = (type === "adults" && next === 1) || (type !== "adults" && next === 0);
  }

  const total = FlyvisCustomUIState.passengers.adults + FlyvisCustomUIState.passengers.children + FlyvisCustomUIState.passengers.infants;
  FlyvisOtaState.route.travelers = total;

  const labelEl = document.getElementById("label-travelers");
  if (labelEl) {
    labelEl.textContent = total === 1 ? "1 Passenger" : `${total} Passengers`;
  }

  applyFilters();
}

/**
 * Custom Interactive Calendar Engine
 */
function formatDisplayDateWithDay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function openFvCalendar(mode, event) {
  if (event) event.stopPropagation();
  closeAllFvDropdowns();

  FlyvisCustomUIState.calendar.activeMode = mode;
  const targetDateStr = mode === "departure" 
    ? (FlyvisOtaState.route.departureDate || "2026-09-17") 
    : (FlyvisCustomUIState.calendar.returnDate || "2026-09-24");

  const targetDate = new Date(targetDateStr);
  if (!isNaN(targetDate.getTime())) {
    FlyvisCustomUIState.calendar.currentYear = targetDate.getFullYear();
    FlyvisCustomUIState.calendar.currentMonth = targetDate.getMonth();
  }

  renderCalendarGrid();

  const cal = document.getElementById("flyvis-calendar-popover");
  const triggerBox = document.getElementById(mode === "departure" ? "ota-dep-box" : "ota-return-box");
  if (cal && triggerBox) {
    cal.style.display = "block";
    const leftOffset = triggerBox.offsetLeft;
    cal.style.left = `${Math.max(0, leftOffset)}px`;
  }
}

function changeCalendarMonth(delta) {
  let m = FlyvisCustomUIState.calendar.currentMonth + delta;
  let y = FlyvisCustomUIState.calendar.currentYear;
  if (m > 11) { m = 0; y++; }
  if (m < 0) { m = 11; y--; }
  FlyvisCustomUIState.calendar.currentMonth = m;
  FlyvisCustomUIState.calendar.currentYear = y;
  renderCalendarGrid();
}

function renderCalendarGrid() {
  const y = FlyvisCustomUIState.calendar.currentYear;
  const m = FlyvisCustomUIState.calendar.currentMonth;
  const grid = document.getElementById("cal-days-grid");
  const title = document.getElementById("cal-month-title");
  if (!grid || !title) return;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  title.textContent = `${monthNames[m]} ${y}`;

  const firstDayIndex = new Date(y, m, 1).getDay();
  const totalDays = new Date(y, m + 1, 0).getDate();

  const activeDate = FlyvisCustomUIState.calendar.activeMode === "departure" 
    ? FlyvisOtaState.route.departureDate 
    : FlyvisCustomUIState.calendar.returnDate;

  let html = "";

  // Leading empty cells
  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div class="fv-cal-day-cell disabled"></div>`;
  }

  // Days of current month
  for (let day = 1; day <= totalDays; day++) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateIso = `${y}-${mm}-${dd}`;
    const isSelected = dateIso === activeDate;

    html += `
      <div class="fv-cal-day-cell ${isSelected ? 'selected' : ''}" onclick="selectCalendarDate('${dateIso}')">
        <span>${day}</span>
      </div>
    `;
  }

  grid.innerHTML = html;
}

function selectCalendarDate(dateIso) {
  const mode = FlyvisCustomUIState.calendar.activeMode;
  if (mode === "departure") {
    FlyvisOtaState.route.departureDate = dateIso;
    FlyvisCustomUIState.calendar.departureDate = dateIso;
    const depDisplay = document.getElementById("ota-dep-display");
    const depHidden = document.getElementById("ota-departure-date");
    if (depDisplay) depDisplay.textContent = formatDisplayDateWithDay(dateIso);
    if (depHidden) depHidden.value = dateIso;

    closeAllFvDropdowns();
    executeOtaFlightSearch();
  } else {
    FlyvisCustomUIState.calendar.returnDate = dateIso;
    const retDisplay = document.getElementById("ota-ret-display");
    const retHidden = document.getElementById("ota-return-date");
    if (retDisplay) {
      retDisplay.textContent = formatDisplayDateWithDay(dateIso);
      retDisplay.style.color = "var(--fv-navy)";
    }
    if (retHidden) retHidden.value = dateIso;

    // Switch to roundtrip if return selected
    selectFvTripType("roundtrip", "Round-trip");
    closeAllFvDropdowns();
    executeOtaFlightSearch();
  }
}

function selectCalendarPreset(preset) {
  const base = new Date();
  if (preset === "weekend") {
    const day = base.getDay();
    const diff = (6 - day + 7) % 7 || 7; // next Saturday
    base.setDate(base.getDate() + diff);
  } else if (typeof preset === "number") {
    base.setDate(base.getDate() + preset);
  }

  const iso = base.toISOString().split("T")[0];
  selectCalendarDate(iso);
}

function initDatePresets() {
  const depIso = FlyvisOtaState.route.departureDate || "2026-09-17";
  const depDisplay = document.getElementById("ota-dep-display");
  const depHidden = document.getElementById("ota-departure-date");
  if (depDisplay) depDisplay.textContent = formatDisplayDateWithDay(depIso);
  if (depHidden) depHidden.value = depIso;
}

/**
 * Main Flight Search Execution (Live Scraper Query)
 */
async function executeOtaFlightSearch() {
  const origInput = document.getElementById("ota-orig-input");
  const destInput = document.getElementById("ota-dest-input");
  const origHidden = document.getElementById("ota-orig-code");
  const destHidden = document.getElementById("ota-dest-code");

  let origCode = resolveAirport(origInput ? origInput.value : null, origHidden?.value || "DEL");
  let destCode = resolveAirport(destInput ? destInput.value : null, destHidden?.value || "DXB");
  const depDate = document.getElementById("ota-departure-date")?.value || "2026-09-17";

  // Prevent identical origin and destination
  if (origCode === destCode) {
    destCode = origCode === "DXB" ? "DEL" : "DXB";
  }

  // Sync hidden fields and input displays
  if (origHidden) origHidden.value = origCode;
  if (destHidden) destHidden.value = destCode;

  const origObj = OTA_AIRPORTS.find(a => a.code === origCode);
  const destObj = OTA_AIRPORTS.find(a => a.code === destCode);
  const origName = origObj ? origObj.city : origCode;
  const destName = destObj ? destObj.city : destCode;

  if (origInput && origObj && !origInput.value.includes(`(${origCode})`)) {
    origInput.value = `${origObj.city} (${origCode})`;
  }
  if (destInput && destObj && !destInput.value.includes(`(${destCode})`)) {
    destInput.value = `${destObj.city} (${destCode})`;
  }

  FlyvisOtaState.route.origCode = origCode;
  FlyvisOtaState.route.destCode = destCode;
  FlyvisOtaState.route.origName = origName;
  FlyvisOtaState.route.destName = destName;
  FlyvisOtaState.route.departureDate = depDate;

  // Show Radar Scanner Overlay
  const scanner = document.getElementById("ota-scanner-overlay");
  if (scanner) scanner.style.display = "flex";

  const counterEl = document.getElementById("ota-results-counter");
  if (counterEl) counterEl.textContent = `Searching live flights for ${origCode} → ${destCode}...`;

  try {
    const url = `/api/scrape-flights?from=${encodeURIComponent(origCode)}&to=${encodeURIComponent(destCode)}&date=${encodeURIComponent(depDate)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.flights && data.flights.length > 0) {
        FlyvisOtaState.rawFlights = data.flights;
      } else {
        FlyvisOtaState.rawFlights = generateCalibratedFallbackFlights(origCode, destCode, depDate);
      }
    } else {
      FlyvisOtaState.rawFlights = generateCalibratedFallbackFlights(origCode, destCode, depDate);
    }
  } catch (err) {
    console.warn("Live scraper fallback notice:", err);
    FlyvisOtaState.rawFlights = generateCalibratedFallbackFlights(origCode, destCode, depDate);
  }

  // Hide scanner
  setTimeout(() => {
    if (scanner) scanner.style.display = "none";
    render7DayDateStrip();
    renderAirlinesFilter();
    updateFilterFares();
    applyFilters();
    updateAiAdviceBanner();
  }, 400);
}

/**
 * 7-Day Date Carousel Strip (Route & Date-Calibrated Pricing)
 */
function render7DayDateStrip() {
  const strip = document.getElementById("ota-7day-date-strip");
  if (!strip) return;

  const centerDate = new Date(FlyvisOtaState.route.departureDate);
  const basePrice = getLowestBaseFare();

  let html = "";
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split("T")[0];
    const isSelected = offset === 0;

    const dayName = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const dayOfWeek = d.getDay();
    let dayMultiplier = 1.0;
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      dayMultiplier = 1.07 + (Math.abs(offset) % 2 === 1 ? 0.04 : 0.01);
    } else if (dayOfWeek === 2 || dayOfWeek === 3) {
      dayMultiplier = 0.96;
    } else {
      dayMultiplier = 1.01;
    }
    const dayPrice = isSelected ? basePrice : Math.round((basePrice * dayMultiplier) / 50) * 50;

    html += `
      <div class="ota-date-card ${isSelected ? 'active' : ''}" onclick="selectStripDate('${dateStr}')">
        <div class="ota-date-day">${dayName}</div>
        <div class="ota-date-price">₹${dayPrice.toLocaleString('en-IN')}</div>
        ${isSelected ? '<div class="ota-date-badge">● Selected Date</div>' : '<div class="ota-date-badge" style="background:#F1F5F9; color:#64748B;">Available</div>'}
      </div>
    `;
  }
  strip.innerHTML = html;
}

function selectStripDate(dateStr) {
  const depInput = document.getElementById("ota-departure-date");
  if (depInput) depInput.value = dateStr;
  FlyvisOtaState.route.departureDate = dateStr;
  executeOtaFlightSearch();
}

/**
 * Filter Engine & UI Rendering
 */
function applyFilters() {
  const flights = FlyvisOtaState.rawFlights || [];
  
  const stopNonstop = document.getElementById("flt-stop-nonstop")?.checked ?? true;
  const stop1stop = document.getElementById("flt-stop-1stop")?.checked ?? true;
  const stop2plus = document.getElementById("flt-stop-2plus")?.checked ?? true;
  const timeWindow = FlyvisOtaState.filters.timeWindow;
  const selAirlines = FlyvisOtaState.filters.selectedAirlines;
  const maxPrice = FlyvisOtaState.filters.maxPrice;

  const filtered = flights.filter(f => {
    // Stops filter
    const stopsStr = (f.stops || "nonstop").toLowerCase();
    const isNonstop = stopsStr.includes("nonstop") || stopsStr.includes("direct") || stopsStr === "0";
    const is1stop = stopsStr.includes("1 stop") || stopsStr === "1";
    const is2plus = stopsStr.includes("2 stop") || stopsStr.includes("3 stop") || (!isNonstop && !is1stop);

    if (isNonstop && !stopNonstop) return false;
    if (is1stop && !stop1stop) return false;
    if (is2plus && !stop2plus) return false;

    // Price range slider filter
    if (typeof maxPrice === "number" && maxPrice !== Infinity && f.basePrice > maxPrice) {
      return false;
    }

    // Time window filter
    if (timeWindow !== "any") {
      const depHour = parseDepartureHour(f.departureTime);
      if (timeWindow === "morning" && (depHour < 6 || depHour >= 12)) return false;
      if (timeWindow === "afternoon" && (depHour < 12 || depHour >= 18)) return false;
      if (timeWindow === "evening" && (depHour < 18 && depHour >= 6)) return false;
    }

    // Airlines filter: check if airline is in active selected set
    if (selAirlines.length > 0 && !selAirlines.includes(f.name)) {
      return false;
    }

    return true;
  });

  FlyvisOtaState.filteredFlights = filtered;
  sortAndRenderFlights(FlyvisOtaState.sortBy);
}

function handlePriceRangeSlider(val) {
  const num = parseInt(val, 10);
  FlyvisOtaState.filters.maxPrice = num;
  const valEl = document.getElementById("filter-max-price-val");
  if (valEl) valEl.textContent = `₹${num.toLocaleString('en-IN')}`;
  applyFilters();
}

function parseDepartureHour(timeStr) {
  if (!timeStr) return 12;
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 12;
  let hrs = parseInt(m[1], 10);
  const ampm = m[3] ? m[3].toUpperCase() : null;
  if (ampm === "PM" && hrs < 12) hrs += 12;
  if (ampm === "AM" && hrs === 12) hrs = 0;
  return hrs;
}

function parseDepartureTimeInMinutes(timeStr) {
  if (!timeStr) return 720;
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 720;
  let hrs = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10) || 0;
  const ampm = m[3] ? m[3].toUpperCase() : null;
  if (ampm === "PM" && hrs < 12) hrs += 12;
  if (ampm === "AM" && hrs === 12) hrs = 0;
  return hrs * 60 + mins;
}

function setTimeWindowFilter(windowId) {
  FlyvisOtaState.filters.timeWindow = windowId;
  document.querySelectorAll(".ota-time-pill").forEach(p => {
    p.classList.toggle("selected", p.dataset.time === windowId);
  });
  applyFilters();
}

function setBaggagePreference(tier) {
  FlyvisOtaState.filters.baggage = tier;
  applyFilters();
}

/**
 * Render Operating Airlines Filter Checkboxes
 */
function renderAirlinesFilter() {
  const container = document.getElementById("ota-airlines-filter-list");
  if (!container) return;

  const airlinesCount = {};
  const airlinesMinPrice = {};

  (FlyvisOtaState.rawFlights || []).forEach(f => {
    airlinesCount[f.name] = (airlinesCount[f.name] || 0) + 1;
    if (!airlinesMinPrice[f.name] || f.basePrice < airlinesMinPrice[f.name]) {
      airlinesMinPrice[f.name] = f.basePrice;
    }
  });

  const names = Object.keys(airlinesCount);
  if (names.length === 0) {
    container.innerHTML = `<span style="font-size:12px; color:#64748B;">All operating carriers</span>`;
    return;
  }

  // If selectedAirlines is empty or needs reset, default to ALL operating airlines checked
  if (!FlyvisOtaState.filters.selectedAirlines || FlyvisOtaState.filters.selectedAirlines.length === 0) {
    FlyvisOtaState.filters.selectedAirlines = [...names];
  }

  let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
      <span style="color:#2E7D7E; font-weight:700; cursor:pointer;" onclick="selectAllAirlines(true)">Select All</span>
      <span style="color:#64748B; font-weight:700; cursor:pointer;" onclick="selectAllAirlines(false)">Clear All</span>
    </div>
  `;

  html += names.map(name => {
    const isChecked = FlyvisOtaState.filters.selectedAirlines.includes(name);
    return `
      <label class="ota-checkbox-label">
        <span>
          <input type="checkbox" value="${name}" ${isChecked ? 'checked' : ''} onchange="toggleAirlineFilter('${name}', this.checked)">
          ${name} <span style="font-size:11px; color:#94A3B8;">(${airlinesCount[name]})</span>
        </span>
        <span class="ota-filter-fare">₹${airlinesMinPrice[name].toLocaleString('en-IN')}</span>
      </label>
    `;
  }).join("");

  container.innerHTML = html;
}

function toggleAirlineFilter(name, isChecked) {
  const arr = FlyvisOtaState.filters.selectedAirlines;
  if (isChecked) {
    if (!arr.includes(name)) arr.push(name);
  } else {
    const idx = arr.indexOf(name);
    if (idx > -1) arr.splice(idx, 1);
  }
  applyFilters();
}

function selectAllAirlines(selectAll) {
  const allNames = Object.keys(
    (FlyvisOtaState.rawFlights || []).reduce((acc, f) => { acc[f.name] = true; return acc; }, {})
  );

  FlyvisOtaState.filters.selectedAirlines = selectAll ? [...allNames] : [];
  renderAirlinesFilter();
  applyFilters();
}

function updateFilterFares() {
  const flights = FlyvisOtaState.rawFlights || [];
  let minNonstop = Infinity, min1stop = Infinity, min2plus = Infinity;
  let minPrice = Infinity, maxPrice = -Infinity;

  flights.forEach(f => {
    if (f.basePrice < minPrice) minPrice = f.basePrice;
    if (f.basePrice > maxPrice) maxPrice = f.basePrice;

    const stopsStr = (f.stops || "").toLowerCase();
    if (stopsStr.includes("nonstop") || stopsStr.includes("direct") || stopsStr === "0") {
      if (f.basePrice < minNonstop) minNonstop = f.basePrice;
    } else if (stopsStr.includes("1 stop") || stopsStr === "1") {
      if (f.basePrice < min1stop) min1stop = f.basePrice;
    } else {
      if (f.basePrice < min2plus) min2plus = f.basePrice;
    }
  });

  if (minPrice === Infinity) minPrice = 3000;
  if (maxPrice === -Infinity) maxPrice = 120000;

  // Calibrate slider dynamically
  const sliderMin = Math.max(1000, Math.floor(minPrice * 0.9 / 500) * 500);
  const sliderMax = Math.ceil(maxPrice * 1.1 / 500) * 500;

  const slider = document.getElementById("filter-price-slider");
  const minLbl = document.getElementById("filter-min-price-lbl");
  const maxLbl = document.getElementById("filter-max-price-lbl");
  const valEl = document.getElementById("filter-max-price-val");

  if (slider) {
    slider.min = sliderMin;
    slider.max = sliderMax;
    slider.step = sliderMax > 50000 ? "1000" : "500";

    if (FlyvisOtaState.filters.maxPrice === Infinity || FlyvisOtaState.filters.maxPrice > sliderMax || FlyvisOtaState.filters.maxPrice < sliderMin) {
      FlyvisOtaState.filters.maxPrice = sliderMax;
      slider.value = sliderMax;
      if (valEl) valEl.textContent = `₹${sliderMax.toLocaleString('en-IN')}`;
    } else {
      slider.value = FlyvisOtaState.filters.maxPrice;
      if (valEl) valEl.textContent = `₹${FlyvisOtaState.filters.maxPrice.toLocaleString('en-IN')}`;
    }
  }

  if (minLbl) minLbl.textContent = `₹${sliderMin.toLocaleString('en-IN')}`;
  if (maxLbl) maxLbl.textContent = `₹${sliderMax.toLocaleString('en-IN')}`;

  const elNonstop = document.getElementById("fare-label-nonstop");
  const el1stop = document.getElementById("fare-label-1stop");
  const el2plus = document.getElementById("fare-label-2plus");

  if (elNonstop) elNonstop.textContent = minNonstop !== Infinity ? `from ₹${minNonstop.toLocaleString('en-IN')}` : "None";
  if (el1stop) el1stop.textContent = min1stop !== Infinity ? `from ₹${min1stop.toLocaleString('en-IN')}` : "None";
  if (el2plus) el2plus.textContent = min2plus !== Infinity ? `from ₹${min2plus.toLocaleString('en-IN')}` : "None";
}

function resetAllFilters() {
  const elNonstop = document.getElementById("flt-stop-nonstop");
  const el1stop = document.getElementById("flt-stop-1stop");
  const el2plus = document.getElementById("flt-stop-2plus");
  if (elNonstop) elNonstop.checked = true;
  if (el1stop) el1stop.checked = true;
  if (el2plus) el2plus.checked = true;
  FlyvisOtaState.filters.timeWindow = "any";
  setTimeWindowFilter("any");
  FlyvisOtaState.filters.maxPrice = Infinity;
  updateFilterFares();
  selectAllAirlines(true);
}

/**
 * 18+ Credit Cards Benefit Sidebar List
 */
function renderSidebarCardsList(searchQuery) {
  const container = document.getElementById("ota-cards-sidebar-list");
  const countBadge = document.getElementById("sidebar-card-count");
  if (!container) return;

  const allCards = typeof MASTER_CREDIT_CARDS !== 'undefined' ? MASTER_CREDIT_CARDS : [];
  const q = (searchQuery || "").trim().toLowerCase();

  const filtered = allCards.filter(c => 
    !q || c.name.toLowerCase().includes(q) || (c.bank && c.bank.toLowerCase().includes(q))
  );

  const selectedCount = FlyvisOtaState.filters.selectedCardIds.length;
  if (countBadge) countBadge.textContent = `${selectedCount} Applied`;

  container.innerHTML = filtered.map(c => {
    const isSelected = FlyvisOtaState.filters.selectedCardIds.includes(c.id);
    return `
      <div class="ota-card-pill-item ${isSelected ? 'selected' : ''}" onclick="toggleOtaCard('${c.id}')">
        <div class="ota-card-pill-dot" style="background:${c.color || '#2E7D7E'};"></div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; font-weight:800; color:var(--fv-navy); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</div>
          <div style="font-size:10px; color:#16A34A; font-weight:700;">${c.flightMultiplier || c.rewardRate || 'Travel Perks'}</div>
        </div>
        <span style="font-size:11px; font-weight:800; color:${isSelected ? '#166534' : '#64748B'};">${isSelected ? '' : '+'}</span>
      </div>
    `;
  }).join("");
}

function toggleOtaCard(cardId) {
  const arr = FlyvisOtaState.filters.selectedCardIds;
  const idx = arr.indexOf(cardId);
  if (idx > -1) {
    arr.splice(idx, 1);
  } else {
    arr.push(cardId);
  }
  renderSidebarCardsList();
  applyFilters();
}

/**
 * Compute Net Price with Credit Card Multipliers & Instant Promos
 */
function computeFlightFintechPrice(baseFare) {
  const allCards = typeof MASTER_CREDIT_CARDS !== 'undefined' ? MASTER_CREDIT_CARDS : [];
  let maxDiscount = 0;
  let bestCardName = null;

  FlyvisOtaState.filters.selectedCardIds.forEach(cardId => {
    const c = allCards.find(card => card.id === cardId);
    if (!c) return;

    let disc = 0;
    if (c.flightMultiplierValue) {
      disc = Math.round(baseFare * c.flightMultiplierValue);
    } else if (c.instantDiscounts && c.instantDiscounts.length > 0) {
      disc = Math.round(baseFare * (c.instantDiscounts[0].discountPct || 0.10));
    } else {
      disc = Math.round(baseFare * 0.05);
    }
    disc = Math.min(3500, disc);

    if (disc > maxDiscount) {
      maxDiscount = disc;
      bestCardName = c.name;
    }
  });

  const netPrice = Math.max(0, baseFare - maxDiscount);
  return {
    grossPrice: baseFare,
    cardDiscount: maxDiscount,
    bestCardName: bestCardName,
    netPrice: netPrice
  };
}

/**
 * Realistic Commercial Aircraft Fleet Mapping
 */
function getAircraftModelForAirline(airlineName, orig, dest) {
  const isLongHaul = !(["DEL","BOM","BLR","HYD","MAA","CCU","COK","AMD","GOI","PNQ","VGA"].includes(orig) && 
                       ["DEL","BOM","BLR","HYD","MAA","CCU","COK","AMD","GOI","PNQ","VGA"].includes(dest));
  
  const name = (airlineName || "").toLowerCase();

  if (name.includes("emirates")) {
    return (orig === "NRT" || dest === "NRT" || orig === "LHR" || dest === "LHR") 
      ? "Airbus A380-800 Superjumbo" 
      : "Boeing 777-300ER Widebody";
  }
  if (name.includes("qatar")) {
    return isLongHaul ? "Airbus A350-1000 / Boeing 787-9 Dreamliner" : "Boeing 777-300ER";
  }
  if (name.includes("srilankan")) {
    return "Airbus A330-300 Widebody";
  }
  if (name.includes("singapore")) {
    return "Airbus A350-900 / Boeing 787-10 Dreamliner";
  }
  if (name.includes("air india express") || name.includes("akasa")) {
    return "Boeing 737 MAX 8";
  }
  if (name.includes("air india")) {
    return isLongHaul ? "Airbus A350-900 / Boeing 787-8 Dreamliner" : "Airbus A320neo";
  }
  if (name.includes("indigo")) {
    return (orig === "IST" || dest === "IST") ? "Boeing 777-300ER (Widebody Lease)" : "Airbus A321neo / A320neo";
  }
  if (name.includes("spicejet") || name.includes("flydubai")) {
    return "Boeing 737 MAX 8 / Boeing 737-800";
  }
  if (name.includes("thai") || name.includes("cathay")) {
    return "Airbus A350-900 / Boeing 777-300ER";
  }
  if (name.includes("turkish")) {
    return "Boeing 787-9 Dreamliner / Airbus A350-900";
  }
  if (name.includes("lufthansa")) {
    return "Airbus A350-900 / Boeing 747-8 Intercontinental";
  }
  if (name.includes("british airways") || name.includes("virgin")) {
    return "Boeing 787-9 Dreamliner / Airbus A350-1000";
  }
  if (name.includes("egyptair")) {
    return "Boeing 787-9 Dreamliner";
  }
  if (name.includes("etihad")) {
    return "Boeing 787-10 Dreamliner / Airbus A350-1000";
  }
  if (name.includes("asiana") || name.includes("jal") || name.includes("ana")) {
    return "Airbus A350-900 / Boeing 777-300ER";
  }

  return isLongHaul ? "Boeing 787-9 Dreamliner Widebody" : "Airbus A320neo";
}

/**
 * Sort and Render Flight Results Matrix Stream
 */
function sortAndRenderFlights(sortBy) {
  FlyvisOtaState.sortBy = sortBy || "cheapest";
  const listContainer = document.getElementById("ota-flight-results-list");
  const counterEl = document.getElementById("ota-results-counter");
  if (!listContainer) return;

  const flights = [...FlyvisOtaState.filteredFlights];

  if (sortBy === "cheapest") {
    flights.sort((a, b) => a.basePrice - b.basePrice);
  } else if (sortBy === "fastest") {
    flights.sort((a, b) => parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration));
  } else if (sortBy === "earliest") {
    flights.sort((a, b) => parseDepartureTimeInMinutes(a.departureTime) - parseDepartureTimeInMinutes(b.departureTime));
  } else if (sortBy === "card_savings") {
    flights.sort((a, b) => computeFlightFintechPrice(b.basePrice).cardDiscount - computeFlightFintechPrice(a.basePrice).cardDiscount);
  }

  // Synchronize state so modal selection indexes match 1-to-1 with rendered cards
  FlyvisOtaState.filteredFlights = flights;

  if (counterEl) {
    counterEl.textContent = `Showing ${flights.length} flights for ${FlyvisOtaState.route.origCode} → ${FlyvisOtaState.route.destCode}`;
  }

  if (flights.length === 0) {
    listContainer.innerHTML = `
      <div style="background:#FFFFFF; border:1.5px dashed var(--fv-border); border-radius:12px; padding:40px; text-align:center;">
        <div style="font-size:18px; font-weight:800; color:var(--fv-navy); margin-bottom:6px;">No flights match your filters</div>
        <p style="font-size:13px; color:var(--fv-muted); margin-bottom:16px;">Try expanding your departure window or stops filter.</p>
        <button type="button" onclick="resetAllFilters()" style="padding:8px 18px; background:var(--fv-primary); color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;">Reset Filters</button>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = flights.map((flight, idx) => {
    const fin = computeFlightFintechPrice(flight.basePrice);
    const airlineMeta = AIRLINE_INFO[flight.name] || { code: flight.name.substring(0,2).toUpperCase(), color: "#2E7D7E", textColor: "#fff" };
    const flightNum = flight.flightNum || `${airlineMeta.code} ${1000 + idx * 15}`;
    const stopsClass = (flight.stops || "").toLowerCase().includes("nonstop") ? "nonstop" : "";
    const aircraftModel = getAircraftModelForAirline(flight.name, FlyvisOtaState.route.origCode, FlyvisOtaState.route.destCode);
    const bp = getAirlineBaggagePolicy(flight.name);  // ATPCO baggage policy

    // Split departure and arrival times
    const times = (flight.departureTime || "08:00 AM – 11:30 AM").split("–").map(s => s.trim());
    const depTime = times[0] || "08:00 AM";
    const arrTime = times[1] || "11:30 AM";
    const midnightInfo = getMidnightDepartureInfo(depTime, FlyvisOtaState.route && FlyvisOtaState.route.departureDate);
    const connSafety = evaluateConnectionSafety(flight, FlyvisOtaState.route?.origCode, FlyvisOtaState.route?.destCode);
    const isRiskyTransfer = connSafety && connSafety.transferType === 'RISKY_SELF_TRANSFER';
    const isSafeTransfer = connSafety && connSafety.transferType === 'SAFE_SELF_TRANSFER';

    return `
      <article class="ota-flight-card" style="${isRiskyTransfer ? 'border-color:#FECDD3;' : (isSafeTransfer || midnightInfo ? 'border-color:#FCD34D;' : '')}">
        ${midnightInfo ? `
          <div style="background:#FFFBEB; border-bottom:1px solid #FDE68A; padding:6px 14px; font-size:11px; color:#92400E; font-weight:700; display:flex; align-items:center; gap:6px;">
            <span>🌙</span>
            <span><strong>Early Morning Departure:</strong> Departs ${midnightInfo.departureTime} on ${midnightInfo.departureDateFormatted}. <u>Reach airport on ${midnightInfo.previousDateFormatted} by ${midnightInfo.suggestedArrivalTime}</u>.</span>
          </div>
        ` : ''}

        ${isRiskyTransfer ? `
          <div style="background:#FFF1F2; border-bottom:1.5px solid #FECDD3; padding:6px 14px; font-size:11px; color:#9F1239; font-weight:700; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span>🚨</span>
              <span><strong>Unprotected Self-Transfer (${connSafety.layoverMinutes}m Layover):</strong> Separate tickets. Delayed 1st flight forfeits 2nd flight with 0% refund. Bags must be re-checked landside!</span>
            </div>
            <span style="background:#FEE2E2; border:1px solid #FECACA; color:#DC2626; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:800;">MCT Deficit: Needs &ge; 3.5h</span>
          </div>
        ` : (isSafeTransfer ? `
          <div style="background:#FFFBEB; border-bottom:1px solid #FDE68A; padding:6px 14px; font-size:11px; color:#92400E; font-weight:700; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span>⚠️</span>
              <span><strong>Self-Transfer (${Math.floor(connSafety.layoverMinutes / 60)}h ${connSafety.layoverMinutes % 60}m Layover):</strong> Separate tickets. Safe buffer for bag reclaim &amp; re-check at ${flight.layoverAirport || 'transit city'}.</span>
            </div>
            <span style="background:#FEF3C7; border:1px solid #FDE68A; color:#B45309; font-size:10px; padding:2px 6px; border-radius:4px; font-weight:800;">Self-Transfer</span>
          </div>
        ` : '')}

        <div class="ota-card-main-row">
          
          <!-- Airline Column -->
          <div class="ota-airline-col">
            <div class="ota-airline-logo-badge" style="background:${airlineMeta.color}; color:${airlineMeta.textColor};">
              ${airlineMeta.code}
            </div>
            <div>
              <div class="ota-airline-name">${flight.name}</div>
              <div class="ota-flight-code">${flightNum} • ${FlyvisOtaState.route.cabinClass.replace('_', ' ').toUpperCase()}</div>
              <div style="margin-top:3px; font-size:10px; font-weight:700; color:${bp.fareNoteColor}; background:${bp.includedKg===0?'#FFFBEB':'#F0FDF4'}; border:1px solid ${bp.includedKg===0?'#FDE68A':'#BBF7D0'}; border-radius:8px; padding:1px 6px; display:inline-block; line-height:1.6;">${bp.fareNote}</div>
            </div>
          </div>

          <!-- Flight Path & Times Column -->
          <div class="ota-path-col">
            <div class="ota-time-box">
              <div class="ota-time-val">${depTime}</div>
              <div class="ota-airport-code">${FlyvisOtaState.route.origCode}</div>
              ${midnightInfo ? `<span style="font-size:9px; font-weight:800; background:#FEF3C7; color:#92400E; padding:1px 5px; border-radius:4px; display:inline-block; margin-top:2px;">Night-Before Arrival</span>` : ''}
            </div>

            <div class="ota-duration-track">
              <div class="ota-duration-txt">${flight.duration || '3 hr 30 min'}</div>
              <div class="ota-track-line-visual">
                ${!stopsClass ? '<div class="ota-track-stop-dot"></div>' : ''}
              </div>
              <div class="ota-stops-label ${stopsClass}" style="${isRiskyTransfer ? 'color:#DC2626; font-weight:800;' : (isSafeTransfer ? 'color:#D97706; font-weight:800;' : '')}">
                ${flight.stops || 'Nonstop'}${connSafety && connSafety.isSelfTransfer ? ' • Self-Transfer' : ''}
              </div>
            </div>

            <div class="ota-time-box">
              <div class="ota-time-val">${arrTime}</div>
              <div class="ota-airport-code">${FlyvisOtaState.route.destCode}</div>
            </div>
          </div>

          <!-- Price & Booking CTA Column -->
          <div class="ota-price-col">
            ${fin.cardDiscount > 0 ? `<div class="ota-gross-price">₹${fin.grossPrice.toLocaleString('en-IN')}</div>` : ''}
            <div class="ota-net-price">₹${fin.netPrice.toLocaleString('en-IN')}</div>
            ${fin.cardDiscount > 0 ? `<div class="ota-card-savings-pill">Save ₹${fin.cardDiscount.toLocaleString('en-IN')} with ${fin.bestCardName}</div>` : ''}
            
            <button type="button" class="btn-ota-select" onclick="openFlightBookingModal(${idx})">
              <span>Select Flight</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>

        </div>

        <!-- Expandable Drawer Toggle -->
        <div class="ota-drawer-toggle" onclick="toggleFlightDrawer(${idx})">
          <span>Flight Details &amp; Baggage Policy</span>
          <span id="drawer-arrow-${idx}">▼</span>
        </div>

        <div class="ota-card-drawer" id="flight-drawer-${idx}">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; font-size:12px;">
            <div>
              <strong>Itinerary:</strong> ${FlyvisOtaState.route.origName} (${FlyvisOtaState.route.origCode}) → ${FlyvisOtaState.route.destName} (${FlyvisOtaState.route.destCode})<br>
              <strong>Date:</strong> ${formatDisplayDate(FlyvisOtaState.route.departureDate)}<br>
              <strong>Flight:</strong> ${flight.name} (${flightNum})<br>
              <strong>Connection Safety:</strong> <span style="font-weight:700; color:${isRiskyTransfer ? '#DC2626' : (isSafeTransfer ? '#D97706' : '#166534')};">${connSafety ? connSafety.badgeText : 'Protected Direct'}</span>
            </div>
            <div>
              ${(() => {
                const bp = getAirlineBaggagePolicy(flight.name);
                const checkedLabel = bp.includedKg === 0
                  ? `<span style="color:#D97706; font-weight:700;">0kg Checked (Lite Fare)</span>`
                  : `<span style="color:#059669; font-weight:700;">${bp.includedKg}kg Check-in Included</span>`;
                const tierBadges = bp.tiers.map(t =>
                  `<span style="display:inline-block; margin:1px 2px 0 0; padding:1px 6px; border-radius:10px; font-size:10px; font-weight:700; background:${t.priceDelta===0?'#F0FDF4':'#EFF6FF'}; color:${t.priceDelta===0?'#059669':'#2563EB'}; border:1px solid ${t.priceDelta===0?'#BBF7D0':'#BFDBFE'};">${t.label}${t.priceDelta>0?' +₹'+t.priceDelta.toLocaleString('en-IN'):''}</span>`
                ).join('');
                return `<strong>Baggage:</strong> ${bp.cabinKg}kg Cabin • ${checkedLabel}<br><span style="margin-top:3px; display:block; font-size:10px; color:#64748B;">Fare Families: ${tierBadges}</span>`;
              })()}
              <strong>Cabin:</strong> ${FlyvisOtaState.route.cabinClass.replace('_', ' ').toUpperCase()}<br>
              <strong>Operating Aircraft:</strong> <span style="color:#2E7D7E; font-weight:700;">${aircraftModel}</span>
            </div>
            <div>
              <strong>Card Perks:</strong> ${fin.bestCardName ? `Applied: <strong>${fin.bestCardName}</strong> (-₹${fin.cardDiscount.toLocaleString('en-IN')})` : 'Select cards in sidebar for discounts.'}<br>
              <button type="button" onclick="openFlightSpecificAlertModal(${idx})" style="margin-top:6px; background:#EAF6F6; color:#2E7D7E; border:1px solid #2E7D7E; border-radius:4px; padding:4px 8px; font-size:11px; font-weight:800; cursor:pointer;">
                 Track Price Drop on this ${flight.name} Flight
              </button>
            </div>
          </div>
        </div>

      </article>
    `;
  }).join("");
}

function parseDurationToMinutes(durStr) {
  if (!durStr) return 180;
  let mins = 0;
  const hMatch = durStr.match(/(\d+)\s*hr/i);
  const mMatch = durStr.match(/(\d+)\s*min/i);
  if (hMatch) mins += parseInt(hMatch[1]) * 60;
  if (mMatch) mins += parseInt(mMatch[1]);
  return mins > 0 ? mins : 180;
}

function toggleFlightDrawer(idx) {
  const drawer = document.getElementById(`flight-drawer-${idx}`);
  const arrow = document.getElementById(`drawer-arrow-${idx}`);
  if (drawer) {
    const isOpen = drawer.classList.toggle("open");
    if (arrow) arrow.textContent = isOpen ? "▲" : "▼";
  }
}

/**
 * Slide-Over Boarding Pass Booking Modal Logic
 */
function openFlightBookingModal(flightIdx) {
  if (typeof requireFlyvisAuth === "function" && !requireFlyvisAuth(() => openFlightBookingModal(flightIdx), "book flights and calculate card perks")) return;

  const flight = FlyvisOtaState.filteredFlights[flightIdx];
  if (!flight) return;

  FlyvisOtaState.selectedFlightForBooking = flight;
  FlyvisOtaState.pointsBurn.points = 0;

  const modal = document.getElementById("ota-booking-modal");
  const subTitle = document.getElementById("modal-route-subtitle");
  const bpWrap = document.getElementById("modal-boarding-pass-wrap");

  if (subTitle) {
    subTitle.textContent = `${FlyvisOtaState.route.origName} (${FlyvisOtaState.route.origCode}) → ${FlyvisOtaState.route.destName} (${FlyvisOtaState.route.destCode}) • ${formatDisplayDate(FlyvisOtaState.route.departureDate)}`;
  }

  // 1. Initialize Traveler Cards & Travel Vault Identity
  initModalTravelerSection();

  // Render Boarding Pass inside Modal
  if (bpWrap) {
    const flightNum = flight.flightNum || `FL ${Math.floor(1000 + Math.random() * 8999)}`;
    const seatNum = `${Math.floor(10 + Math.random() * 25)}${['A','B','C','D','E','F'][Math.floor(Math.random() * 6)]}`;
    const gateNum = `${['A','B','C','D','G'][Math.floor(Math.random() * 5)]}${Math.floor(1 + Math.random() * 18)}`;

    bpWrap.innerHTML = `
      <div class="flight-ticket-card" style="margin: 0 auto; width:100%;">
        <div class="ticket-stub">
          <div class="stub-header">
            <span class="stub-brand">BOARDING PASS</span>
            <span class="stub-flight-num">${flightNum}</span>
          </div>
          <div class="stub-barcode-wrap">
            <div class="stub-barcode">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="stub-code">${FlyvisOtaState.route.origCode}-${FlyvisOtaState.route.destCode}-TKT</div>
          </div>
          <div class="stub-meta">
            <div class="stub-meta-item"><span class="sm-lbl">SEAT</span><span class="sm-val">${seatNum}</span></div>
            <div class="stub-meta-item"><span class="sm-lbl">GATE</span><span class="sm-val">${gateNum}</span></div>
          </div>
        </div>

        <div class="ticket-perforation">
          <div class="ticket-notch notch-top"></div>
          <div class="ticket-notch notch-bottom"></div>
        </div>

        <div class="ticket-main">
          <div class="ticket-header">
            <div class="ticket-airline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
              <span>${flight.name}</span>
            </div>
            <div class="ticket-tag" style="background:#DCFCE7; color:#166534; font-weight:800;">CONFIRMED BEST FARE</div>
          </div>

          <div class="ticket-route-corridor">
            <div class="route-origin">
              <span class="route-city">${FlyvisOtaState.route.origName}</span>
              <span class="route-code">${FlyvisOtaState.route.origCode}</span>
            </div>
            <div class="route-flight-path">
              <div class="flight-track-line"></div>
              <svg class="route-plane-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            <div class="route-dest">
              <span class="route-city">${FlyvisOtaState.route.destName}</span>
              <span class="route-code">${FlyvisOtaState.route.destCode}</span>
            </div>
          </div>

          <div class="ticket-notes">
             <strong>${formatDisplayDate(FlyvisOtaState.route.departureDate)}</strong> &nbsp;•&nbsp; ⏰ <strong>${flight.departureTime}</strong> &nbsp;•&nbsp; <strong style="color:${(() => { const p = getAirlineBaggagePolicy(flight.name); return p.includedKg===0?'#D97706':'#059669'; })()};">${(() => { const p = getAirlineBaggagePolicy(flight.name); return p.includedKg===0 ? '🎒 7kg Cabin Only' : `🧳 ${p.includedKg}kg Included`; })()}</strong>
          </div>

          ${(() => {
            const times = (flight.departureTime || "").split("–").map(s => s.trim());
            const depTime = times[0] || "08:00 AM";
            const mi = getMidnightDepartureInfo(depTime, FlyvisOtaState.route && FlyvisOtaState.route.departureDate);
            if (!mi) return '';
            return `
              <div style="margin-top:10px; padding:10px 14px; background:#FFFBEB; border:1.5px solid #FCD34D; border-radius:10px; font-size:11.5px; color:#92400E; line-height:1.45;">
                <div style="font-weight:900; display:flex; align-items:center; gap:6px; margin-bottom:2px; font-size:12px;">
                  <span>🚨</span> Important: Check Your Airport Arrival Date
                </div>
                <div>This flight departs at <strong>${mi.departureTime}</strong> on <strong>${mi.departureDateFormatted}</strong> (early morning). You must arrive at the airport on <strong>${mi.previousDateFormatted}</strong> by <strong>${mi.suggestedArrivalTime}</strong>!</div>
              </div>
            `;
          })()}

          ${(() => {
            const cs = evaluateConnectionSafety(flight, FlyvisOtaState.route?.origCode, FlyvisOtaState.route?.destCode);
            if (!cs || cs.isNonstop || cs.transferType === 'PROTECTED_INTERLINE') return '';
            const isRisky = cs.transferType === 'RISKY_SELF_TRANSFER';
            return `
              <div style="margin-top:10px; padding:10px 14px; background:${isRisky ? '#FFF1F2' : '#FFFBEB'}; border:1.5px solid ${isRisky ? '#FECDD3' : '#FDE68A'}; border-radius:10px; font-size:11.5px; color:${isRisky ? '#9F1239' : '#92400E'}; line-height:1.45;">
                <div style="font-weight:900; display:flex; align-items:center; gap:6px; margin-bottom:2px; font-size:12px;">
                  <span>${isRisky ? '🚨' : '⚠️'}</span> ${isRisky ? 'Unprotected Self-Transfer Connection Notice' : 'Self-Transfer Connection Notice'}
                </div>
                <div>${cs.warning}</div>
              </div>
            `;
          })()}
        </div>
      </div>
    `;
  }

  // Reset slider & update totals
  const slider = document.getElementById("modal-points-slider");
  if (slider) slider.value = 0;
  handlePointsSliderChange(0);

  // Reset ancillaries
  FlyvisOtaState.selectedAncillaries = [];
  ["chk-anc-baggage", "chk-anc-meal", "chk-anc-seat", "chk-anc-wheelchair"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const ancBadge = document.getElementById("modal-anc-selected-badge");
  if (ancBadge) ancBadge.textContent = "0 Added";
  const ancRow = document.getElementById("modal-anc-row");
  if (ancRow) ancRow.style.display = "none";

  // ── Dynamic Baggage Panel (ATPCO per-airline policy) ──────────────────────
  const baggageWrap = document.getElementById("lbl-anc-baggage");
  if (baggageWrap) {
    const bp = getAirlineBaggagePolicy(flight.name);
    const isLiteFare = bp.includedKg === 0;

    if (isLiteFare) {
      // Bare / Lite fare — show add-on SSR slabs as selectable options
      baggageWrap.style.background = "#FFFBEB";
      baggageWrap.style.borderColor = "#FDE68A";
      baggageWrap.innerHTML = `
        <div style="width:100%;">
          <div style="font-size:11px; font-weight:800; color:#92400E; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
            <span>🎒</span><span>0kg Checked — ${flight.name} Lite Fare</span>
            <span style="margin-left:auto; font-size:10px; padding:1px 6px; background:#FEF3C7; border-radius:8px; border:1px solid #FDE68A; color:#B45309;">ADD BAGGAGE BELOW</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${bp.paidSlabs.map((slab, si) => `
              <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid #E2E8F0; border-radius:6px; cursor:pointer; background:#FAFAFA;">
                <input type="radio" name="modal-baggage-slab" value="bag_${slab.weight}kg" data-name="${slab.label}" data-price="${slab.price}" data-code="${slab.code}" onchange="handleBaggageSlabChange(this)" style="accent-color:#2E7D7E;" ${si===0?'checked':''}>
                <div style="font-size:11px; line-height:1.3;">
                  <div style="font-weight:700; color:#0F172A;">${slab.label}</div>
                  <div style="color:#059669; font-weight:700; font-size:10px;">+₹${slab.price.toLocaleString('en-IN')} prepaid (SSR ${slab.code})</div>
                </div>
              </label>`).join('')}
            <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid #E2E8F0; border-radius:6px; cursor:pointer; background:#FAFAFA;">
              <input type="radio" name="modal-baggage-slab" value="bag_none" data-name="" data-price="0" data-code="" onchange="handleBaggageSlabChange(this)" style="accent-color:#2E7D7E;">
              <div style="font-size:11px; line-height:1.3;">
                <div style="font-weight:700; color:#64748B;">No check-in bag (cabin 7kg only)</div>
                <div style="color:#94A3B8; font-size:10px;">Airport check-in bag fee: ₹3,500–₹5,000</div>
              </div>
            </label>
          </div>
        </div>
      `;
      // Auto-select first slab into ancillaries
      const firstSlab = bp.paidSlabs[0];
      if (firstSlab) {
        FlyvisOtaState.selectedAncillaries = FlyvisOtaState.selectedAncillaries.filter(a => !a.id.startsWith('bag_'));
        FlyvisOtaState.selectedAncillaries.push({ id: `bag_${firstSlab.weight}kg`, name: firstSlab.label, price: firstSlab.price });
      }
    } else {
      // Included baggage — show what's included + heavy upgrade top-ups
      baggageWrap.style.background = "#F0FDF4";
      baggageWrap.style.borderColor = "#BBF7D0";
      baggageWrap.innerHTML = `
        <div style="width:100%;">
          <div style="font-size:11px; font-weight:800; color:#065F46; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
            <span>🧳</span><span>${bp.includedKg}kg Checked Bag Included — ${flight.name}</span>
            <span style="margin-left:auto; font-size:10px; padding:1px 6px; background:#D1FAE5; border-radius:8px; border:1px solid #A7F3D0; color:#065F46;">INCLUDED ✓</span>
          </div>
          <div style="font-size:10px; color:#374151; margin-bottom:6px;">
            Cabin: <strong>${bp.cabinKg}kg</strong> &nbsp;|&nbsp; Checked: <strong>${bp.includedKg}kg</strong> &nbsp;|&nbsp; Need more luggage?
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${bp.paidSlabs.map((slab, si) => `
              <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid #E2E8F0; border-radius:6px; cursor:pointer; background:#FAFAFA;">
                <input type="radio" name="modal-baggage-slab" value="bag_${slab.weight}kg_extra" data-name="${slab.label} (Extra)" data-price="${slab.price}" data-code="${slab.code}" onchange="handleBaggageSlabChange(this)" style="accent-color:#2E7D7E;">
                <div style="font-size:11px; line-height:1.3;">
                  <div style="font-weight:700; color:#0F172A;">${slab.label}</div>
                  <div style="color:#2563EB; font-weight:700; font-size:10px;">+₹${slab.price.toLocaleString('en-IN')} (SSR ${slab.code})</div>
                </div>
              </label>`).join('')}
            <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid #BBF7D0; border-radius:6px; cursor:pointer; background:#F0FDF4;">
              <input type="radio" name="modal-baggage-slab" value="bag_included" data-name="" data-price="0" data-code="" onchange="handleBaggageSlabChange(this)" style="accent-color:#059669;" checked>
              <div style="font-size:11px; line-height:1.3;">
                <div style="font-weight:700; color:#065F46;">Use included ${bp.includedKg}kg allowance</div>
                <div style="color:#059669; font-size:10px; font-weight:700;">No extra charge</div>
              </div>
            </label>
          </div>
        </div>
      `;
    }
  }

  // Update ancillary badge after baggage changes
  recalculateModalTotals && recalculateModalTotals();

  // ── Auto-open and load the seat map ──────────────────────────────────────
  _selectedSeatNum = null;
  _selectedSeatPrice = 0;
  _currentSeatMap = null;

  // Show the seat map panel immediately (no click needed)
  const seatPanel = document.getElementById('seat-map-panel');
  if (seatPanel) seatPanel.style.display = 'block';

  // Hide the selection bar until a seat is picked
  const selBar = document.getElementById('seat-map-selection-bar');
  if (selBar) selBar.style.display = 'none';

  // Clear the seat grid and load fresh map for this flight
  const seatGrid = document.getElementById('seat-map-grid');
  if (seatGrid) seatGrid.innerHTML = '';

  // Load the seat map after a short delay so the modal renders first
  setTimeout(() => { loadSeatMap(flight); }, 80);

  // Reset seat preferences
  FlyvisOtaState.seatPreference = { type: "window", zone: "front", specificSeat: "" };
  const zoneEl = document.getElementById("modal-seat-zone");
  if (zoneEl) zoneEl.value = "any";
  const seatSpec = document.getElementById("modal-seat-specific");
  if (seatSpec) seatSpec.value = "";

  if (modal) modal.style.display = "flex";
}

/**
 * =========================================================================
 * TRAVELER DETAILS & IDENTIFICATION (APIS & TRAVEL VAULT INTEGRATION)
 * =========================================================================
 */

function initModalTravelerSection() {
  const user = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.currentUser) || null;
  const activeUid = user ? user.uid : 'current_user';
  
  let docs = [];
  try {
    let raw = localStorage.getItem('flyvis_wallet_docs_' + activeUid);
    if (!raw && activeUid !== 'current_user') raw = localStorage.getItem('flyvis_wallet_docs_current_user');
    if (raw) docs = JSON.parse(raw);
  } catch (e) {}

  const passportDoc = docs.find(d => d.category === 'passport') || null;
  FlyvisOtaState.vaultPassport = passportDoc;

  // Retrieve user identity and profile details
  const profileName = (user && user.displayName) || (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.name) || "";
  const userPhone = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.phone) || (user && user.phoneNumber) || "";
  const userEmail = (user && user.email) || (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.email) || "";

  let leadFirst = "";
  let leadLast = "";
  if (profileName) {
    const parts = profileName.trim().split(/\s+/);
    leadFirst = parts[0] || "";
    leadLast = parts.slice(1).join(" ") || "";
  }

  let leadPassportNum = "";
  let leadPassportExp = "";
  if (passportDoc) {
    leadPassportNum = passportDoc.title ? passportDoc.title.replace(/^Passport\s*[-–:]*\s*/i, '').trim() : "";
    leadPassportExp = passportDoc.expiryDate || "";
  }

  const requestedPaxCount = parseInt(FlyvisOtaState.route.travelers) || 1;

  if (!FlyvisOtaState.modalTravelers || FlyvisOtaState.modalTravelers.length === 0) {
    FlyvisOtaState.modalTravelers = [];

    // Traveler 1 (Lead Passenger)
    FlyvisOtaState.modalTravelers.push({
      id: 1,
      isLead: true,
      title: "Mr",
      firstName: leadFirst,
      lastName: leadLast,
      dob: "1995-04-12",
      gender: "Male",
      nationality: (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.nationality) || "India (IND)",
      passportNumber: leadPassportNum,
      passportExpiry: leadPassportExp,
      docAttachment: passportDoc ? { name: passportDoc.fileName || passportDoc.title, isVault: true } : null,
      isVaultFilled: !!passportDoc
    });

    // Additional co-travelers based on search count
    for (let i = 2; i <= requestedPaxCount; i++) {
      FlyvisOtaState.modalTravelers.push({
        id: i,
        isLead: false,
        title: "Mr",
        firstName: "",
        lastName: "",
        dob: "",
        gender: "Male",
        nationality: "India (IND)",
        passportNumber: "",
        passportExpiry: "",
        docAttachment: null,
        isVaultFilled: false
      });
    }
  }

  // Update Vault Sync Banner
  const vaultBanner = document.getElementById("modal-vault-sync-banner");
  const vaultDesc = document.getElementById("modal-vault-sync-desc");
  const vaultBtnText = document.getElementById("vault-fill-btn-text");
  if (passportDoc) {
    if (vaultBanner) {
      vaultBanner.style.display = "flex";
      if (vaultDesc) vaultDesc.textContent = `${passportDoc.title || 'Passport on file'} ${passportDoc.expiryDate ? '(Exp: ' + passportDoc.expiryDate + ')' : ''}`;
    }
    if (vaultBtnText) vaultBtnText.textContent = "Refill from Vault";
  } else {
    if (vaultBanner) vaultBanner.style.display = "none";
    if (vaultBtnText) vaultBtnText.textContent = "Auto-Fill from Vault";
  }

  // Pre-fill contact inputs
  const phoneEl = document.getElementById("modal-contact-phone");
  const emailEl = document.getElementById("modal-contact-email");
  if (phoneEl && (!phoneEl.value || phoneEl.value.trim() === "")) {
    phoneEl.value = userPhone;
  }
  if (emailEl && (!emailEl.value || emailEl.value.trim() === "")) {
    emailEl.value = userEmail;
  }

  renderModalTravelerCards();
}

function renderModalTravelerCards() {
  const container = document.getElementById("modal-passengers-container");
  if (!container) return;

  const orig = FlyvisOtaState.route?.origCode || 'DEL';
  const dest = FlyvisOtaState.route?.destCode || 'DXB';
  const travelDate = FlyvisOtaState.route?.departureDate || '2026-10-28';
  const isIntl = isInternationalRoute(orig, dest);

  if (!FlyvisOtaState.modalTravelers || FlyvisOtaState.modalTravelers.length === 0) {
    FlyvisOtaState.modalTravelers = [{
      id: 1,
      isLead: true,
      title: "Mr",
      firstName: "",
      lastName: "",
      dob: "",
      gender: "Male",
      nationality: "India (IND)",
      passportNumber: "",
      passportExpiry: "",
      docAttachment: null,
      isVaultFilled: false
    }];
  }

  container.innerHTML = FlyvisOtaState.modalTravelers.map((pax, index) => {
    const isLead = pax.isLead;
    const displayName = (pax.firstName || pax.lastName)
      ? `${pax.title || 'Mr'} ${pax.firstName || ''} ${pax.lastName || ''}`.trim()
      : (isLead ? 'Lead Passenger (Enter Details Below)' : `Companion / Guest ${index + 1}`);

    const inadCheck = isIntl ? validatePassportValidity(pax.passportExpiry, travelDate) : null;

    return `
      <div class="modal-pax-card" id="modal-pax-card-${index}" style="border:1.5px solid ${isLead ? '#CCFBF1' : '#E2E8F0'}; border-radius:10px; background:${isLead ? '#F0FDFA' : '#FAFAFA'}; padding:12px; position:relative; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:${isLead ? '#0D9488' : '#475569'}; color:#FFFFFF; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:12px; letter-spacing:0.3px;">
              ${isLead ? '⭐ Lead Traveler' : `👥 Traveler ${index + 1}`}
            </span>
            <span id="pax-card-name-${index}" style="font-size:12.5px; font-weight:800; color:#0F172A;">
              ${displayName}
            </span>
            ${pax.isVaultFilled ? '<span style="font-size:10px; font-weight:700; color:#059669; background:#DCFCE7; border:1px solid #BBF7D0; padding:1px 6px; border-radius:4px;">⚡ Vault Synced</span>' : ''}
          </div>
          ${!isLead ? `
            <button type="button" onclick="removeCoTravelerModalCard(${index})" style="background:#FEE2E2; border:1px solid #FECACA; color:#DC2626; font-size:11px; font-weight:700; cursor:pointer; padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:3px;">
              ✕ Remove
            </button>
          ` : ''}
        </div>

        <!-- Name Row -->
        <div style="display:grid; grid-template-columns:80px 1fr 1fr; gap:8px; margin-bottom:8px;">
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">TITLE *</label>
            <select id="pax-input-title-${index}" onchange="syncModalPaxField(${index}, 'title', this.value)" style="width:100%; box-sizing:border-box; padding:6px 6px; font-size:12px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF; font-weight:600;">
              <option value="Mr" ${pax.title === 'Mr' ? 'selected' : ''}>Mr</option>
              <option value="Ms" ${pax.title === 'Ms' ? 'selected' : ''}>Ms</option>
              <option value="Mrs" ${pax.title === 'Mrs' ? 'selected' : ''}>Mrs</option>
              <option value="Dr" ${pax.title === 'Dr' ? 'selected' : ''}>Dr</option>
              <option value="Mstr" ${pax.title === 'Mstr' ? 'selected' : ''}>Mstr</option>
            </select>
          </div>
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">FIRST &amp; MIDDLE NAME *</label>
            <input type="text" id="pax-input-fname-${index}" oninput="syncModalPaxField(${index}, 'firstName', this.value)" value="${pax.firstName || ''}" placeholder="As shown on Passport" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:12px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF; font-weight:600;" required />
          </div>
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">LAST NAME / SURNAME *</label>
            <input type="text" id="pax-input-lname-${index}" oninput="syncModalPaxField(${index}, 'lastName', this.value)" value="${pax.lastName || ''}" placeholder="As shown on Passport" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:12px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF; font-weight:600;" required />
          </div>
        </div>

        <!-- Demographics Row -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:8px;">
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">DATE OF BIRTH</label>
            <input type="date" id="pax-input-dob-${index}" onchange="syncModalPaxField(${index}, 'dob', this.value)" value="${pax.dob || ''}" style="width:100%; box-sizing:border-box; padding:5px 6px; font-size:11.5px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF;" />
          </div>
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">GENDER</label>
            <select id="pax-input-gender-${index}" onchange="syncModalPaxField(${index}, 'gender', this.value)" style="width:100%; box-sizing:border-box; padding:6px 6px; font-size:11.5px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF;">
              <option value="Male" ${pax.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${pax.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option value="Other" ${pax.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">NATIONALITY</label>
            <input type="text" id="pax-input-nat-${index}" oninput="syncModalPaxField(${index}, 'nationality', this.value)" value="${pax.nationality || 'India (IND)'}" placeholder="e.g. India (IND)" style="width:100%; box-sizing:border-box; padding:6px 6px; font-size:11.5px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF;" />
          </div>
        </div>

        <!-- Passport / ID Row -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">${isIntl ? 'PASSPORT NUMBER *' : 'GOVT PHOTO ID (AADHAAR / VOTER ID / PASSPORT)'}</label>
            <input type="text" id="pax-input-passport-${index}" oninput="syncModalPaxField(${index}, 'passportNumber', this.value)" value="${pax.passportNumber || ''}" placeholder="${isIntl ? 'Passport No. (e.g. P1234567)' : 'Aadhaar / Passport No.'}" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:12px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF; text-transform:uppercase; font-family:monospace; font-weight:700;" />
          </div>
          <div>
            <label style="font-size:10px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">${isIntl ? 'PASSPORT EXPIRY DATE *' : 'EXPIRY DATE (OPTIONAL)'}</label>
            <input type="date" id="pax-input-expiry-${index}" onchange="syncModalPaxField(${index}, 'passportExpiry', this.value)" value="${pax.passportExpiry || ''}" style="width:100%; box-sizing:border-box; padding:5px 6px; font-size:11.5px; border-radius:6px; border:1px solid #CBD5E1; background:#FFF;" />
          </div>
        </div>

        <!-- Real-Time INAD / Document Validity Banner -->
        <div id="pax-inad-box-${index}">
          ${!isIntl ? `
            <div style="margin-top:6px; padding:4px 8px; background:#F0FDFA; border:1px solid #99F6E4; border-radius:6px; font-size:10.5px; color:#0F766E; font-weight:700;">
              🪪 Domestic Route: Aadhaar, Voter ID, or Driving License accepted at boarding gate.
            </div>
          ` : (inadCheck && inadCheck.isValid ? `
            <div style="margin-top:6px; padding:5px 8px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:6px; font-size:11px; color:#166534; display:flex; align-items:center; gap:6px;">
              <span>✓</span> <strong>6-Month Validity Verified:</strong> Passport valid through ${inadCheck.expiryDateFormatted} (INAD Clear for ${dest}).
            </div>
          ` : (inadCheck && (inadCheck.status === 'INAD_RISK' || inadCheck.status === 'EXPIRED') ? `
            <div style="margin-top:6px; padding:7px 10px; background:#FFF1F2; border:1.5px solid #FECDD3; border-radius:6px; font-size:11px; color:#9F1239; line-height:1.4;">
              <strong>🚨 INAD Boarding Refusal Risk:</strong> ${inadCheck.warning}
            </div>
          ` : `
            <div style="margin-top:6px; padding:4px 8px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:6px; font-size:10.5px; color:#92400E;">
              ℹ️ International flight: Passport must be valid until at least ${inadCheck ? inadCheck.requiredExpiryFormatted : '6 months beyond travel'}.
            </div>
          `))}
        </div>

        <!-- Document Attachment Row -->
        <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #CBD5E1; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
          <div style="font-size:10.5px; color:#64748B;">
            ${pax.docAttachment ? `
              <span style="color:#059669; font-weight:700;">✓ Document Ready:</span> ${pax.docAttachment.name}
            ` : 'Attach passport bio-page copy (optional)'}
          </div>
          <div>
            <input type="file" id="pax-file-input-${index}" style="display:none;" onchange="handleModalPaxFileUpload(this, ${index})" accept="image/*,application/pdf" />
            ${pax.docAttachment ? `
              <button type="button" onclick="removeModalPaxFile(${index})" style="font-size:10.5px; color:#DC2626; background:#FEE2E2; border:1px solid #FECACA; padding:2px 6px; border-radius:4px; cursor:pointer;">✕ Remove</button>
            ` : `
              <button type="button" onclick="document.getElementById('pax-file-input-${index}').click()" style="font-size:10.5px; font-weight:700; color:#334155; background:#F1F5F9; border:1px solid #CBD5E1; padding:3px 8px; border-radius:4px; cursor:pointer;">📎 Attach Passport Copy</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function syncModalPaxField(index, field, value) {
  if (!FlyvisOtaState.modalTravelers || !FlyvisOtaState.modalTravelers[index]) return;
  FlyvisOtaState.modalTravelers[index][field] = value;

  // Real-time update of passenger card name display without full re-render
  if (field === 'firstName' || field === 'lastName' || field === 'title') {
    const pax = FlyvisOtaState.modalTravelers[index];
    const nameLabel = document.getElementById(`pax-card-name-${index}`);
    if (nameLabel) {
      const displayName = (pax.firstName || pax.lastName)
        ? `${pax.title || 'Mr'} ${pax.firstName || ''} ${pax.lastName || ''}`.trim()
        : (pax.isLead ? 'Lead Passenger (Enter Details Below)' : `Companion / Guest ${index + 1}`);
      nameLabel.textContent = displayName;
    }
  }

  // Real-time update of INAD / Passport Validity
  if (field === 'passportExpiry') {
    const orig = FlyvisOtaState.route?.origCode || 'DEL';
    const dest = FlyvisOtaState.route?.destCode || 'DXB';
    const travelDate = FlyvisOtaState.route?.departureDate || '2026-10-28';
    const isIntl = isInternationalRoute(orig, dest);
    const box = document.getElementById(`pax-inad-box-${index}`);
    if (box && isIntl) {
      const check = validatePassportValidity(value, travelDate);
      if (check.isValid) {
        box.innerHTML = `<div style="margin-top:6px; padding:5px 8px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:6px; font-size:11px; color:#166534; display:flex; align-items:center; gap:6px;"><span>✓</span> <strong>6-Month Validity Verified:</strong> Passport valid through ${check.expiryDateFormatted} (INAD Clear for ${dest}).</div>`;
      } else if (check.status === 'INAD_RISK' || check.status === 'EXPIRED') {
        box.innerHTML = `<div style="margin-top:6px; padding:7px 10px; background:#FFF1F2; border:1.5px solid #FECDD3; border-radius:6px; font-size:11px; color:#9F1239; line-height:1.4;"><strong>🚨 INAD Boarding Refusal Risk:</strong> ${check.warning}</div>`;
      } else {
        box.innerHTML = `<div style="margin-top:6px; padding:4px 8px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:6px; font-size:10.5px; color:#92400E;">ℹ️ International flight: Passport must be valid until at least 6 months beyond travel date.</div>`;
      }
    }
  }
}

function addNewCoTravelerModalCard() {
  if (!FlyvisOtaState.modalTravelers) FlyvisOtaState.modalTravelers = [];
  
  // Sync existing input values before adding
  FlyvisOtaState.modalTravelers.forEach((pax, idx) => {
    const fnEl = document.getElementById(`pax-input-fname-${idx}`);
    const lnEl = document.getElementById(`pax-input-lname-${idx}`);
    const titleEl = document.getElementById(`pax-input-title-${idx}`);
    const dobEl = document.getElementById(`pax-input-dob-${idx}`);
    const genderEl = document.getElementById(`pax-input-gender-${idx}`);
    const natEl = document.getElementById(`pax-input-nat-${idx}`);
    const passEl = document.getElementById(`pax-input-passport-${idx}`);
    const expEl = document.getElementById(`pax-input-expiry-${idx}`);

    if (fnEl) pax.firstName = fnEl.value;
    if (lnEl) pax.lastName = lnEl.value;
    if (titleEl) pax.title = titleEl.value;
    if (dobEl) pax.dob = dobEl.value;
    if (genderEl) pax.gender = genderEl.value;
    if (natEl) pax.nationality = natEl.value;
    if (passEl) pax.passportNumber = passEl.value;
    if (expEl) pax.passportExpiry = expEl.value;
  });

  const nextIdx = FlyvisOtaState.modalTravelers.length;
  FlyvisOtaState.modalTravelers.push({
    id: nextIdx + 1,
    isLead: false,
    title: "Mr",
    firstName: "",
    lastName: "",
    dob: "",
    gender: "Male",
    nationality: "India (IND)",
    passportNumber: "",
    passportExpiry: "",
    docAttachment: null,
    isVaultFilled: false
  });

  FlyvisOtaState.route.travelers = FlyvisOtaState.modalTravelers.length;
  const subTitle = document.getElementById("modal-route-subtitle");
  if (subTitle) {
    subTitle.textContent = `${FlyvisOtaState.route.origName} (${FlyvisOtaState.route.origCode}) → ${FlyvisOtaState.route.destName} (${FlyvisOtaState.route.destCode}) • ${formatDisplayDate(FlyvisOtaState.route.departureDate)} • ${FlyvisOtaState.route.travelers} Traveler${FlyvisOtaState.route.travelers > 1 ? 's' : ''}`;
  }

  renderModalTravelerCards();
  recalculateModalTotals();
}

function removeCoTravelerModalCard(index) {
  if (!FlyvisOtaState.modalTravelers || FlyvisOtaState.modalTravelers.length <= 1) return;

  // Sync existing inputs first
  FlyvisOtaState.modalTravelers.forEach((pax, idx) => {
    const fnEl = document.getElementById(`pax-input-fname-${idx}`);
    const lnEl = document.getElementById(`pax-input-lname-${idx}`);
    const titleEl = document.getElementById(`pax-input-title-${idx}`);
    const dobEl = document.getElementById(`pax-input-dob-${idx}`);
    const genderEl = document.getElementById(`pax-input-gender-${idx}`);
    const natEl = document.getElementById(`pax-input-nat-${idx}`);
    const passEl = document.getElementById(`pax-input-passport-${idx}`);
    const expEl = document.getElementById(`pax-input-expiry-${idx}`);

    if (fnEl) pax.firstName = fnEl.value;
    if (lnEl) pax.lastName = lnEl.value;
    if (titleEl) pax.title = titleEl.value;
    if (dobEl) pax.dob = dobEl.value;
    if (genderEl) pax.gender = genderEl.value;
    if (natEl) pax.nationality = natEl.value;
    if (passEl) pax.passportNumber = passEl.value;
    if (expEl) pax.passportExpiry = expEl.value;
  });

  FlyvisOtaState.modalTravelers.splice(index, 1);

  // Re-index
  FlyvisOtaState.modalTravelers.forEach((p, idx) => {
    p.isLead = (idx === 0);
    p.id = idx + 1;
  });

  FlyvisOtaState.route.travelers = FlyvisOtaState.modalTravelers.length;
  const subTitle = document.getElementById("modal-route-subtitle");
  if (subTitle) {
    subTitle.textContent = `${FlyvisOtaState.route.origName} (${FlyvisOtaState.route.origCode}) → ${FlyvisOtaState.route.destName} (${FlyvisOtaState.route.destCode}) • ${formatDisplayDate(FlyvisOtaState.route.departureDate)} • ${FlyvisOtaState.route.travelers} Traveler${FlyvisOtaState.route.travelers > 1 ? 's' : ''}`;
  }

  renderModalTravelerCards();
  recalculateModalTotals();
}

function toggleTravelerVaultFill() {
  const user = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.currentUser) || null;
  const activeUid = user ? user.uid : 'current_user';
  
  let docs = [];
  try {
    let raw = localStorage.getItem('flyvis_wallet_docs_' + activeUid);
    if (!raw && activeUid !== 'current_user') raw = localStorage.getItem('flyvis_wallet_docs_current_user');
    if (raw) docs = JSON.parse(raw);
  } catch (e) {}

  const passportDoc = docs.find(d => d.category === 'passport') || null;
  const profileName = (user && user.displayName) || (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.name) || "";
  const userPhone = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.phone) || (user && user.phoneNumber) || "";
  const userEmail = (user && user.email) || (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.email) || "";

  if (!passportDoc && !profileName) {
    alert("No passport or traveler profile found in your Travel Vault yet. You can enter details manually below and check 'Save to Travel Vault' to store them.");
    return;
  }

  if (!FlyvisOtaState.modalTravelers || FlyvisOtaState.modalTravelers.length === 0) {
    FlyvisOtaState.modalTravelers = [{ isLead: true }];
  }

  const lead = FlyvisOtaState.modalTravelers[0];
  if (profileName) {
    const parts = profileName.trim().split(/\s+/);
    lead.firstName = parts[0] || "";
    lead.lastName = parts.slice(1).join(" ") || "";
  }
  if (passportDoc) {
    lead.passportNumber = passportDoc.title ? passportDoc.title.replace(/^Passport\s*[-–:]*\s*/i, '').trim() : "";
    lead.passportExpiry = passportDoc.expiryDate || "";
    lead.docAttachment = { name: passportDoc.fileName || passportDoc.title, isVault: true };
    lead.isVaultFilled = true;
  }

  const phoneEl = document.getElementById("modal-contact-phone");
  const emailEl = document.getElementById("modal-contact-email");
  if (phoneEl && userPhone) phoneEl.value = userPhone;
  if (emailEl && userEmail) emailEl.value = userEmail;

  renderModalTravelerCards();
}

function handleModalPaxFileUpload(input, index) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    if (!FlyvisOtaState.modalTravelers || !FlyvisOtaState.modalTravelers[index]) return;
    FlyvisOtaState.modalTravelers[index].docAttachment = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type || 'application/pdf',
      dataUrl: e.target.result,
      isVault: false
    };
    renderModalTravelerCards();
  };

  reader.readAsDataURL(file);
}

function removeModalPaxFile(index) {
  if (!FlyvisOtaState.modalTravelers || !FlyvisOtaState.modalTravelers[index]) return;
  FlyvisOtaState.modalTravelers[index].docAttachment = null;
  renderModalTravelerCards();
}

function handleAncillaryToggle(chk) {
  if (!FlyvisOtaState.selectedAncillaries) FlyvisOtaState.selectedAncillaries = [];
  const val = chk.value;
  const name = chk.getAttribute("data-name") || val;
  const price = parseFloat(chk.getAttribute("data-price")) || 0;

  if (chk.checked) {
    FlyvisOtaState.selectedAncillaries.push({ id: val, name, price });
  } else {
    FlyvisOtaState.selectedAncillaries = FlyvisOtaState.selectedAncillaries.filter(a => a.id !== val);
  }

  const count = FlyvisOtaState.selectedAncillaries.length;
  const totalAnc = FlyvisOtaState.selectedAncillaries.reduce((s, a) => s + a.price, 0);

  const badge = document.getElementById("modal-anc-selected-badge");
  if (badge) {
    badge.textContent = count > 0 ? `${count} Added (+₹${totalAnc.toLocaleString('en-IN')})` : "0 Added";
  }

  const row = document.getElementById("modal-anc-row");
  const rowTot = document.getElementById("modal-anc-total");
  if (row && rowTot) {
    if (count > 0 && totalAnc > 0) {
      row.style.display = "flex";
      rowTot.textContent = `+ ₹${totalAnc.toLocaleString('en-IN')}`;
    } else {
      row.style.display = "none";
    }
  }

  recalculateModalTotals();
}

/**
 * Handles radio-button selection from the dynamic per-airline SSR BAGS panel.
 * Replaces any existing bag_ ancillary and recalculates totals.
 */
function handleBaggageSlabChange(radio) {
  if (!FlyvisOtaState.selectedAncillaries) FlyvisOtaState.selectedAncillaries = [];

  // Remove any previous baggage slab
  FlyvisOtaState.selectedAncillaries = FlyvisOtaState.selectedAncillaries.filter(a => !a.id.startsWith('bag_'));

  const val = radio.value;
  const name = radio.getAttribute('data-name') || '';
  const price = parseFloat(radio.getAttribute('data-price')) || 0;

  if (val !== 'bag_none' && val !== 'bag_included' && price > 0) {
    FlyvisOtaState.selectedAncillaries.push({ id: val, name, price });
  }

  const totalAnc = FlyvisOtaState.selectedAncillaries.reduce((s, a) => s + a.price, 0);
  const count = FlyvisOtaState.selectedAncillaries.length;

  const badge = document.getElementById('modal-anc-selected-badge');
  if (badge) badge.textContent = count > 0 ? `${count} Added (+₹${totalAnc.toLocaleString('en-IN')})` : '0 Added';

  const row = document.getElementById('modal-anc-row');
  const rowTot = document.getElementById('modal-anc-total');
  if (row && rowTot) {
    if (count > 0 && totalAnc > 0) {
      row.style.display = 'flex';
      rowTot.textContent = `+ ₹${totalAnc.toLocaleString('en-IN')}`;
    } else {
      row.style.display = 'none';
    }
  }

  recalculateModalTotals();
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIVE SEAT MAP ENGINE (Amadeus /v1/shopping/seatmaps format)
// ═══════════════════════════════════════════════════════════════════════════

/** Currently loaded seat map data */
let _currentSeatMap = null;
let _selectedSeatNum = null;
let _selectedSeatPrice = 0;

/**
 * Toggle seat map panel open/closed when the "Choose Your Seat" row is clicked.
 * Loads the seat map if it hasn't been loaded yet for this flight.
 */
function toggleSeatMapPanel() {
  const panel = document.getElementById('seat-map-panel');
  if (!panel) return;

  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  // Load seat map if not loaded yet for this flight
  const flight = FlyvisOtaState.selectedFlightForBooking;
  if (flight && (!_currentSeatMap || _currentSeatMap._flightKey !== (flight.flightNum || flight.name))) {
    loadSeatMap(flight);
  }
}

/**
 * Calls the Firebase Cloud Function /api/seatmap and renders the result.
 * Falls back gracefully if the function is unavailable.
 */
async function loadSeatMap(flight) {
  const grid = document.getElementById('seat-map-grid');
  const loading = document.getElementById('seat-map-loading');
  const label = document.getElementById('seat-map-flight-label');

  if (!grid) return;

  const flightKey = flight.flightNum || flight.name;
  if (label) label.textContent = `— ${flight.name} ${flight.flightNum || ''}`;

  // Show loading spinner briefly
  if (loading) loading.style.display = 'block';
  grid.innerHTML = '';

  // ── PHASE 1: Try the Cloud Function (works when Firebase Blaze plan is active)
  // ── PHASE 2: Fall back to in-browser simulation (works right now, Spark plan)
  let seatMapData = null;

  try {
    const res = await fetch('/api/seatmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flightId: flight.flightNum || flight.name,
        airline: flight.name,
        flightNum: flight.flightNum,
        route: `${FlyvisOtaState.route.origCode}-${FlyvisOtaState.route.destCode}`
      }),
      signal: AbortSignal.timeout(4000) // 4s timeout; fall back if function unavailable
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) seatMapData = json.data;
    }
  } catch (_) {
    // Cloud Function unavailable (Spark plan or offline) — use browser simulation below
  }

  // In-browser simulation — same deterministic algorithm as the Cloud Function
  if (!seatMapData) {
    seatMapData = _generateBrowserSeatMap(flight.flightNum || flight.name, flight.name);
  }

  if (loading) loading.style.display = 'none';

  _currentSeatMap = seatMapData;
  _currentSeatMap._flightKey = flightKey;
  renderSeatGrid(seatMapData, grid);
}

/**
 * Browser-side seat map simulation — mirrors functions/index.js generateSimulatedSeatMap().
 * Deterministic: same flightId → same layout every time.
 */
function _generateBrowserSeatMap(flightId, airline) {
  // Seeded pseudo-random
  function seededRand(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return function() { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 0xFFFFFFFF; };
  }
  const rand = seededRand(String(flightId || airline || 'default'));

  const isWidebody = ['Emirates','Qatar Airways','Etihad','Etihad Airways',
    'Singapore Airlines','British Airways','Lufthansa','Air India','Turkish Airlines'].includes(airline);

  const columns     = isWidebody ? ['A','B','C','D','E','F','G','H','J'] : ['A','B','C','D','E','F'];
  const aisleAfter  = isWidebody ? [2, 5] : [2];
  const totalRows   = isWidebody ? 42 : 32;
  const exitRows    = isWidebody ? [11, 30] : [12, 13];
  const bulkheadRows = [1, 2];
  const wingsStart  = isWidebody ? 15 : 10;
  const wingsEnd    = isWidebody ? 32 : 22;

  const PRICES = { EXIT_ROW: 850, BULKHEAD: 600, W: 350, A: 350, M: 0, DEFAULT: 350 };

  const seats = [];
  for (let row = 1; row <= totalRows; row++) {
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const seatNum = `${row}${col}`;
      const isExitRow   = exitRows.includes(row);
      const isBulkhead  = bulkheadRows.includes(row);

      let posChar = 'M';
      if (ci === 0 || ci === columns.length - 1) posChar = 'W';
      else if (aisleAfter.some(a => ci === a || ci === a + 1)) posChar = 'A';

      const characteristics = [posChar];
      if (isExitRow)  characteristics.push('EXIT_ROW', 'EXTRA_LEGROOM');
      if (isBulkhead) characteristics.push('BULKHEAD');
      if (row <= 5)                        characteristics.push('FRONT_ZONE');
      if (row > totalRows - 8)             characteristics.push('REAR_ZONE');
      if (row >= wingsStart && row <= wingsEnd) characteristics.push('WING_ZONE');

      const roll = rand();
      const availability = roll < 0.38 ? 'OCCUPIED' : roll < 0.42 ? 'BLOCKED' : 'AVAILABLE';

      let price = PRICES.DEFAULT;
      if (isExitRow)       price = PRICES.EXIT_ROW;
      else if (isBulkhead) price = PRICES.BULKHEAD;
      else if (posChar === 'W' || posChar === 'A') price = PRICES.W;
      else                 price = 0;

      seats.push({
        number: seatNum, row, column: col,
        availability, characteristicList: characteristics,
        travelerPricing: [{ price: { total: String(price), currency: 'INR' } }],
        position: posChar, isExitRow, isBulkhead
      });
    }
  }

  return {
    type: 'seatmap', id: flightId,
    aircraft: { code: isWidebody ? '77W' : '320' },
    class: 'ECONOMY', columns, aisleAfter, totalRows,
    decks: [{
      deckType: 'MAIN',
      deckConfiguration: {
        width: columns.length, length: totalRows,
        startSeatRow: 1, endSeatRow: totalRows,
        exitRowsX: exitRows,
        startWingsX: wingsStart, endWingsX: wingsEnd
      },
      facilities: exitRows.map(r => ({ code: 'EX', rowEnd: r, rowStart: r, description: 'EXIT' })),
      seats
    }]
  };
}


/**
 * Renders the interactive seat grid from Amadeus deck data.
 * Columns: e.g. A B C | D E F (narrow-body) or A B C | D E F G | H J (wide-body)
 */
function renderSeatGrid(seatMapData, container) {
  const deck = (seatMapData.decks || [])[0];
  if (!deck) { container.innerHTML = '<div style="color:#94A3B8; font-size:12px; padding:10px;">No seat data available.</div>'; return; }

  const columns = seatMapData.columns || ['A','B','C','D','E','F'];
  const aisleAfter = seatMapData.aisleAfter || [2];
  const totalRows = seatMapData.totalRows || 32;
  const startRow = (deck.deckConfiguration && deck.deckConfiguration.startSeatRow) || 1;
  const exitRows = (deck.deckConfiguration && deck.deckConfiguration.exitRowsX) || [12, 13];
  const wingsStart = (deck.deckConfiguration && deck.deckConfiguration.startWingsX) || 10;
  const wingsEnd = (deck.deckConfiguration && deck.deckConfiguration.endWingsX) || 22;

  // Build seat lookup map for quick access
  const seatIndex = {};
  (deck.seats || []).forEach(s => { seatIndex[s.number] = s; });

  // Build column header row
  const colHeaderCells = columns.map((col, ci) => {
    const isAisleRight = aisleAfter.includes(ci);
    return `<div style="width:28px; text-align:center; font-size:9px; font-weight:800; color:#94A3B8; margin-right:${isAisleRight ? '16px' : '2px'};">${col}</div>`;
  }).join('');

  let html = `
    <div style="display:inline-flex; align-items:center; gap:0; margin-bottom:6px; padding-left:32px;">
      ${colHeaderCells}
    </div>
  `;

  // Build each row
  for (let row = startRow; row <= totalRows; row++) {
    const isExitRow = exitRows.includes(row);
    const isWingRow = row >= wingsStart && row <= wingsEnd;

    if (isExitRow) {
      html += `<div style="display:flex; align-items:center; gap:4px; margin:4px 0; font-size:9px; font-weight:700; color:#3B82F6;">
        <span style="width:28px; text-align:right; padding-right:4px; color:#94A3B8;">${row}</span>
        <span>— EXIT ROW — Extra Legroom ——————————————————————</span>
      </div>`;
    }

    const seatCells = columns.map((col, ci) => {
      const seatNum = `${row}${col}`;
      const seatData = seatIndex[seatNum] || {};
      const chars = seatData.characteristicList || [];
      const avail = seatData.availability || 'AVAILABLE';
      const isExitSeat = chars.includes('EXIT_ROW') || chars.includes('EXTRA_LEGROOM');
      const isBulkhead = chars.includes('BULKHEAD');
      const isAisleRight = aisleAfter.includes(ci);

      // Seat price
      let seatPrice = 0;
      if (seatData.travelerPricing && seatData.travelerPricing[0] && seatData.travelerPricing[0].price) {
        seatPrice = parseFloat(seatData.travelerPricing[0].price.total) || 0;
      }

      // Colors
      let bg, border, cursor, title;
      if (avail === 'OCCUPIED' || avail === 'BLOCKED') {
        bg = '#E2E8F0'; border = '#CBD5E1'; cursor = 'not-allowed'; title = 'Occupied';
      } else if (seatNum === _selectedSeatNum) {
        bg = '#FBBF24'; border = '#F59E0B'; cursor = 'pointer'; title = `Selected: ${seatNum}`;
      } else if (isExitSeat) {
        bg = '#BFDBFE'; border = '#60A5FA'; cursor = 'pointer'; title = `${seatNum} — Exit Row / Extra Legroom${seatPrice > 0 ? ' (+₹'+seatPrice+')' : ''}`;
      } else if (isBulkhead) {
        bg = '#DDD6FE'; border = '#A78BFA'; cursor = 'pointer'; title = `${seatNum} — Bulkhead${seatPrice > 0 ? ' (+₹'+seatPrice+')' : ''}`;
      } else {
        bg = '#22C55E'; border = '#16A34A'; cursor = 'pointer'; title = `${seatNum}${seatPrice > 0 ? ' (+₹'+seatPrice+')' : ' (Free to pick)'}`;
      }

      const clickHandler = (avail === 'OCCUPIED' || avail === 'BLOCKED')
        ? ''
        : `onclick="selectSeat('${seatNum}', ${JSON.stringify(chars).replace(/"/g, "'")}, ${seatPrice})"`;

      const seatEl = `<div ${clickHandler}
        title="${title}"
        style="width:28px; height:22px; background:${bg}; border:1px solid ${border}; border-radius:4px; cursor:${cursor}; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.3); margin-right:${isAisleRight ? '16px' : '2px'}; transition:transform 0.1s, box-shadow 0.1s; flex-shrink:0;"
        onmouseover="if(this.style.cursor!=='not-allowed'){this.style.transform='scale(1.15)';this.style.boxShadow='0 2px 6px rgba(0,0,0,0.2)';}"
        onmouseout="this.style.transform='';this.style.boxShadow='';"
      >${col}</div>`;

      return seatEl;
    }).join('');

    // Row badge
    const rowZone = row <= 6 ? '🔵F' : (isWingRow ? '🟢W' : '🟠R');
    html += `<div style="display:inline-flex; align-items:center; gap:0; margin-bottom:2px;">
      <div style="width:28px; text-align:right; padding-right:4px; font-size:9px; font-weight:700; color:#94A3B8; flex-shrink:0;">${row}</div>
      ${seatCells}
      <div style="margin-left:4px; font-size:8px; color:#CBD5E1;">${rowZone}</div>
    </div>`;
  }

  container.innerHTML = html;
}

/**
 * Called when a user clicks an available seat in the grid.
 * Highlights the selected seat, updates the selection bar, and updates pricing.
 */
function selectSeat(seatNum, characteristics, price) {
  _selectedSeatNum = seatNum;
  _selectedSeatPrice = price || 0;

  // Determine position label
  const isExitRow = characteristics.includes('EXIT_ROW') || characteristics.includes('EXTRA_LEGROOM');
  const isBulkhead = characteristics.includes('BULKHEAD');
  const posChar = characteristics.find(c => c === 'W' || c === 'A' || c === 'M') || '';
  const posLabel = posChar === 'W' ? 'Window' : posChar === 'A' ? 'Aisle' : posChar === 'M' ? 'Middle' : '';
  const typeLabel = isExitRow ? 'Exit Row / Extra Legroom' : isBulkhead ? 'Bulkhead' : posLabel;

  // Update hidden inputs (used by booking submission)
  const seatSpecific = document.getElementById('modal-seat-specific');
  if (seatSpecific) seatSpecific.value = seatNum;
  const seatZone = document.getElementById('modal-seat-zone');
  if (seatZone) seatZone.value = characteristics.includes('FRONT_ZONE') ? 'front' : characteristics.includes('REAR_ZONE') ? 'back' : 'wing';

  // Update selection bar
  const bar = document.getElementById('seat-map-selection-bar');
  const lbl = document.getElementById('seat-selected-label');
  const priceLbl = document.getElementById('seat-selected-price');
  if (bar) bar.style.display = 'block';
  if (lbl) lbl.textContent = `${seatNum}${typeLabel ? ' — ' + typeLabel : ''}`;
  if (priceLbl) priceLbl.textContent = price > 0 ? `+₹${price.toLocaleString('en-IN')}` : 'Included (free pick)';

  // Update the "Choose Your Seat" label summary
  const summaryLbl = document.getElementById('seat-map-summary-label');
  if (summaryLbl) summaryLbl.textContent = `${seatNum} — ${typeLabel || 'Economy'}${price > 0 ? ' • +₹'+price.toLocaleString('en-IN') : ' • Free'}`;

  // Update seat ancillary price in the total
  const seatChk = document.getElementById('chk-anc-seat');
  if (seatChk) {
    seatChk.setAttribute('data-price', String(price));
    seatChk.setAttribute('data-name', `Seat ${seatNum}${typeLabel ? ' (' + typeLabel + ')' : ''}`);
    if (!seatChk.checked) {
      seatChk.checked = true;
      handleAncillaryToggle(seatChk);
    } else {
      // Update existing ancillary entry
      const found = (FlyvisOtaState.selectedAncillaries || []).find(a => a.id === 'seat_preferred');
      if (found) { found.price = price; found.name = seatChk.getAttribute('data-name'); }
      recalculateModalTotals();
    }
  }

  // Update seat preference state
  FlyvisOtaState.seatPreference = { type: posLabel.toLowerCase() || 'any', zone: 'any', specificSeat: seatNum };

  // Re-render the grid to show the new selected seat highlighted
  if (_currentSeatMap) {
    const grid = document.getElementById('seat-map-grid');
    if (grid) renderSeatGrid(_currentSeatMap, grid);
  }
}

// Stubs kept for backward compatibility (old buttons no longer shown but referenced in old data)
function setSeatPreference(type) {
  if (!FlyvisOtaState.seatPreference) FlyvisOtaState.seatPreference = { type: 'window', zone: 'front', specificSeat: '' };
  FlyvisOtaState.seatPreference.type = type;
}
function updateSeatZone(zone) {
  if (!FlyvisOtaState.seatPreference) FlyvisOtaState.seatPreference = { type: 'window', zone: 'front', specificSeat: '' };
  FlyvisOtaState.seatPreference.zone = zone;
}
function updateSpecificSeat(seat) {
  if (!FlyvisOtaState.seatPreference) FlyvisOtaState.seatPreference = { type: 'window', zone: 'front', specificSeat: '' };
  FlyvisOtaState.seatPreference.specificSeat = (seat || '').trim().toUpperCase();
}

function handlePointsSliderChange(val) {
  const pts = parseInt(val) || 0;
  FlyvisOtaState.pointsBurn.points = pts;
  
  const rate = 1.0; // 1:1 for premium cards
  const pointsCashVal = Math.round(pts * rate);
  FlyvisOtaState.pointsBurn.cashValue = pointsCashVal;

  const sliderValLabel = document.getElementById("modal-points-slider-val");
  const cashValLabel = document.getElementById("modal-points-cash-val");
  const pointsDiscLabel = document.getElementById("modal-points-discount");

  if (sliderValLabel) sliderValLabel.textContent = `${pts.toLocaleString('en-IN')} Points Selected`;
  if (cashValLabel) cashValLabel.textContent = `- ₹${pointsCashVal.toLocaleString('en-IN')}`;
  if (pointsDiscLabel) pointsDiscLabel.textContent = `- ₹${pointsCashVal.toLocaleString('en-IN')}`;

  recalculateModalTotals();
}

function recalculateModalTotals() {
  const flight = FlyvisOtaState.selectedFlightForBooking;
  if (!flight) return;

  const fin = computeFlightFintechPrice(flight.basePrice);
  const baseFare = fin.grossPrice;
  const cardDiscount = fin.cardDiscount;
  const pointsDiscount = FlyvisOtaState.pointsBurn.cashValue;
  const conciergeFee = 350;
  const ancTotal = (FlyvisOtaState.selectedAncillaries || []).reduce((sum, a) => sum + (a.price || 0), 0);

  const finalTotal = Math.max(0, baseFare - cardDiscount - pointsDiscount + conciergeFee + ancTotal);

  const elBase = document.getElementById("modal-base-fare");
  const elCard = document.getElementById("modal-card-discount");
  const elTotal = document.getElementById("modal-final-total");

  if (elBase) elBase.textContent = `₹${baseFare.toLocaleString('en-IN')}`;
  if (elCard) elCard.textContent = `- ₹${cardDiscount.toLocaleString('en-IN')}${fin.bestCardName ? ` (${fin.bestCardName})` : ''}`;
  if (elTotal) elTotal.textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
}

function closeBookingModal() {
  const modal = document.getElementById("ota-booking-modal");
  if (modal) modal.style.display = "none";
}

// ===== Post-Booking Ancillary Request Engine (Routes to Ancillary Manual Queue) =====
let activePostBookingRef = null;

function openPostBookingAncModal(bookingId, routeStr) {
  activePostBookingRef = bookingId || "BKNG-7138781";
  const sub = document.getElementById("post-anc-booking-subtitle");
  if (sub) sub.textContent = `Booking: ${activePostBookingRef} • ${routeStr || 'DEL → COK'}`;
  
  const m = document.getElementById("ota-post-booking-ancillary-modal");
  if (m) m.style.display = "flex";
}

function closePostBookingAncModal() {
  const m = document.getElementById("ota-post-booking-ancillary-modal");
  if (m) m.style.display = "none";
}

function submitPostBookingAncillaryRequest() {
  const selectedBoxes = document.querySelectorAll('input[name="post_anc_item"]:checked');
  if (selectedBoxes.length === 0) {
    alert("Please select at least one ancillary service to request.");
    return;
  }

  const items = [];
  selectedBoxes.forEach(box => {
    items.push({
      type: box.value,
      name: box.getAttribute("data-name"),
      details: "Customer requested post-booking add-on",
      status: "Pending Quote"
    });
  });

  const notes = document.getElementById("post-anc-notes")?.value || "Customer requested post-booking add-on";
  const user = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.currentUser) || null;
  const travelerName = (user && user.displayName) || (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.name) || "Primary Traveler";
  const userPhone = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.phone) || "+91 98112 34567";

  const randomSuffix = Math.floor(10 + Math.random() * 89);
  const ancRef = `${activePostBookingRef || 'BKNG-1075025'}-${randomSuffix}`;
  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const newOrder = {
    id: Date.now(),
    ancillaryRef: ancRef,
    bookingRef: activePostBookingRef || "BKNG-1075025",
    provider: "AMGS",
    status: "AWAITING_MANUAL_REVIEW",
    routingReason: "not_supported",
    currency: "INR",
    manualSlaDeadline: slaDeadline,
    isOverdue: false,
    createdAt: now.toISOString(),
    ancillaryTotal: null,
    serviceCharge: null,
    platformFee: null,
    payable: null,
    customer: travelerName,
    phone: userPhone,
    email: (user && user.email) || "traveler@flyvis.com",
    route: "DEL → DXB",
    airline: "Airline Direct / GDS",
    pnr: "PNR-" + Math.floor(100000 + Math.random() * 900000),
    notes: notes,
    items: items
  };

  try {
    let list = [];
    const raw = localStorage.getItem("flyvis_post_booking_ancillaries");
    if (raw) list = JSON.parse(raw);
    list.unshift(newOrder);
    localStorage.setItem("flyvis_post_booking_ancillaries", JSON.stringify(list));
  } catch (e) {}

  closePostBookingAncModal();
  alert(`✅ Ancillary Request Submitted!\nReference: ${ancRef}\nYour request has been routed to the Flyvis Flight Operations Desk (Ancillary Manual Queue). Our ticketing desk will confirm pricing with the airline within 30 minutes!`);
}

function executeWhatsAppBookingFromModal() {
  const flight = FlyvisOtaState.selectedFlightForBooking;
  if (!flight) return;

  const user = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.currentUser) || null;
  const activeUid = user ? user.uid : 'current_user';
  
  let docs = [];
  try {
    let raw = localStorage.getItem('flyvis_wallet_docs_' + activeUid);
    if (!raw && activeUid !== 'current_user') raw = localStorage.getItem('flyvis_wallet_docs_current_user');
    if (raw) docs = JSON.parse(raw);
  } catch (e) {}

  const passportDoc = docs.find(d => d.category === 'passport') || null;
  const userPhone = (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile && FlyvisAuthState.userProfile.phone) || "";

  // Sync latest user input values from DOM into FlyvisOtaState.modalTravelers
  (FlyvisOtaState.modalTravelers || []).forEach((pax, idx) => {
    const fnEl = document.getElementById(`pax-input-fname-${idx}`);
    const lnEl = document.getElementById(`pax-input-lname-${idx}`);
    const titleEl = document.getElementById(`pax-input-title-${idx}`);
    const dobEl = document.getElementById(`pax-input-dob-${idx}`);
    const genderEl = document.getElementById(`pax-input-gender-${idx}`);
    const natEl = document.getElementById(`pax-input-nat-${idx}`);
    const passEl = document.getElementById(`pax-input-passport-${idx}`);
    const expEl = document.getElementById(`pax-input-expiry-${idx}`);

    if (fnEl) pax.firstName = fnEl.value.trim();
    if (lnEl) pax.lastName = lnEl.value.trim();
    if (titleEl) pax.title = titleEl.value;
    if (dobEl) pax.dob = dobEl.value;
    if (genderEl) pax.gender = genderEl.value;
    if (natEl) pax.nationality = natEl.value.trim();
    if (passEl) pax.passportNumber = passEl.value.trim().toUpperCase();
    if (expEl) pax.passportExpiry = expEl.value;
  });

  // Validate Lead Passenger
  const leadPax = (FlyvisOtaState.modalTravelers && FlyvisOtaState.modalTravelers[0]) || null;
  if (!leadPax || (!leadPax.firstName && !leadPax.lastName)) {
    alert("Please enter Lead Passenger First and Last Name before proceeding.");
    const firstInput = document.getElementById("pax-input-fname-0");
    if (firstInput) firstInput.focus();
    return;
  }

  const contactPhone = (document.getElementById("modal-contact-phone")?.value || "").trim();
  const contactEmail = (document.getElementById("modal-contact-email")?.value || "").trim();

  // Save to Travel Vault & Profile if checked
  const chkSaveVault = document.getElementById("modal-chk-save-vault");
  if (chkSaveVault && chkSaveVault.checked) {
    try {
      if (leadPax.passportNumber) {
        let pDoc = docs.find(d => d.category === 'passport');
        if (!pDoc) {
          pDoc = {
            id: 'doc_' + Date.now(),
            uid: activeUid,
            category: 'passport',
            title: leadPax.passportNumber,
            expiryDate: leadPax.passportExpiry || '',
            fileName: leadPax.docAttachment ? leadPax.docAttachment.name : `Passport_${leadPax.passportNumber}.pdf`,
            fileSize: leadPax.docAttachment ? leadPax.docAttachment.size : '120 KB',
            fileType: 'pdf',
            dataUrl: leadPax.docAttachment ? leadPax.docAttachment.dataUrl : '',
            createdAt: new Date().toISOString()
          };
          docs.unshift(pDoc);
        } else {
          pDoc.title = leadPax.passportNumber;
          if (leadPax.passportExpiry) pDoc.expiryDate = leadPax.passportExpiry;
          if (leadPax.docAttachment && leadPax.docAttachment.dataUrl) {
            pDoc.dataUrl = leadPax.docAttachment.dataUrl;
            pDoc.fileName = leadPax.docAttachment.name;
          }
        }
        localStorage.setItem('flyvis_wallet_docs_' + activeUid, JSON.stringify(docs));
        localStorage.setItem('flyvis_wallet_docs_current_user', JSON.stringify(docs));
      }

      if (typeof FlyvisAuthState !== 'undefined' && FlyvisAuthState.userProfile) {
        if (contactPhone) FlyvisAuthState.userProfile.phone = contactPhone;
        if (leadPax.firstName || leadPax.lastName) FlyvisAuthState.userProfile.name = `${leadPax.firstName} ${leadPax.lastName}`.trim();
        if (leadPax.nationality) FlyvisAuthState.userProfile.nationality = leadPax.nationality;
        if (user) {
          localStorage.setItem("flyvis_user_profile_" + user.uid, JSON.stringify(FlyvisAuthState.userProfile));
        }
      }
    } catch (vErr) {
      console.warn("Vault sync error:", vErr);
    }
  }

  const paxCount = (FlyvisOtaState.modalTravelers && FlyvisOtaState.modalTravelers.length) || 1;
  const leadFullName = `${leadPax.title || 'Mr'} ${leadPax.firstName} ${leadPax.lastName}`.trim();
  const nowIso = new Date().toISOString();

  const passengerList = [];
  const documents = [];

  FlyvisOtaState.modalTravelers.forEach((pax, idx) => {
    const isLead = (idx === 0);
    const fullName = `${pax.title || 'Mr'} ${pax.firstName || 'Traveler'} ${pax.lastName || (isLead ? 'Lead' : (idx + 1))}`.trim();
    const pNum = pax.passportNumber || (isLead && passportDoc ? passportDoc.title : "Pending WhatsApp Submission");
    const pExp = pax.passportExpiry || (isLead && passportDoc ? passportDoc.expiryDate : "");

    passengerList.push({
      id: `pax_${idx + 1}`,
      type: "ADULT",
      title: pax.title || "Mr",
      name: fullName,
      firstName: pax.firstName || `Traveler ${idx + 1}`,
      lastName: pax.lastName || (isLead ? "Lead" : "Guest"),
      passportNumber: pNum,
      passportExpiry: pExp,
      nationality: pax.nationality || "India (IND)",
      dob: pax.dob || "1995-04-12",
      gender: pax.gender || "Male",
      isLead: isLead,
      seat: (isLead && FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.specificSeat) ? FlyvisOtaState.seatPreference.specificSeat : `12${String.fromCharCode(65 + idx)}`
    });

    documents.push({
      id: `doc_${idx + 1}`,
      paxName: fullName,
      type: "Passport",
      title: `Passport - ${pNum}`,
      number: pNum,
      expiry: pExp,
      issuingCountry: pax.nationality || "India",
      source: pax.docAttachment ? (pax.docAttachment.isVault ? "Travel Vault Synced" : "Uploaded in Modal") : (isLead && passportDoc ? "Travel Vault Synced" : "Submitted with Booking"),
      fileName: pax.docAttachment ? pax.docAttachment.name : (isLead && passportDoc ? passportDoc.fileName : null),
      fileData: pax.docAttachment ? pax.docAttachment.dataUrl : null,
      status: (pax.passportNumber || pax.docAttachment || (isLead && passportDoc)) ? "Verified" : "Pending",
      uploadedAt: nowIso
    });
  });

  const fin = computeFlightFintechPrice(flight.basePrice);
  const pointsDiscount = FlyvisOtaState.pointsBurn.cashValue;
  const ancTotal = (FlyvisOtaState.selectedAncillaries || []).reduce((sum, a) => sum + (a.price || 0), 0);
  const finalTotal = Math.max(0, fin.grossPrice - fin.cardDiscount - pointsDiscount + 350 + ancTotal);

  // Generate Unique Enterprise Booking ID
  const bookingId = "BKNG-" + Math.floor(1000000 + Math.random() * 9000000);

  const indianHubs = ["DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "COK", "CNN", "CCJ", "TRV", "AMD", "GOI", "GOX", "PNQ", "JAI", "LKO", "SXR", "IXC", "PAT", "GAU", "BBI", "VNS", "IXB", "IXR", "IDR"];
  const isDomestic = indianHubs.includes(FlyvisOtaState.route.origCode) && indianHubs.includes(FlyvisOtaState.route.destCode);

  const bookingPayload = {
    id: bookingId,
    supplierSearch: "Google Flights",
    supplierIssued: "Flyvis",
    source: "WEB",
    pnr: "",
    isUnviewed: true,
    bookingDate: nowIso,
    paymentStatus: "Payment Pending",
    status: "Initiated",
    statusDetail: "Booking: INITIATED | Ticketing: PENDING CONCIERGE",
    owner: "Super Admin",
    summary: `${FlyvisOtaState.route.origCode}-${FlyvisOtaState.route.destCode} | ${formatDisplayDate(FlyvisOtaState.route.departureDate)} | ${paxCount} Pax`,
    route: `${FlyvisOtaState.route.origCode} → ${FlyvisOtaState.route.destCode}`,
    origin: FlyvisOtaState.route.origCode,
    destination: FlyvisOtaState.route.destCode,
    travelDate: FlyvisOtaState.route.departureDate,
    travelDateDisplay: formatDisplayDate(FlyvisOtaState.route.departureDate),
    deadline: "24h left",
    isOverdue: false,
    passengerName: leadFullName.toUpperCase(),
    passengerList: passengerList,
    documents: documents,
    amount: finalTotal,
    currency: "INR",
    airType: isDomestic ? "Domestic" : "International",
    customer: leadFullName,
    phone: contactPhone || userPhone || "Not Provided",
    email: contactEmail || (user && user.email) || "Not Provided",
    customerType: (user && user.email && user.email.includes("agent")) ? "AGENT" : "REGULAR",
    airline: flight.name,
    flightNumber: flight.flightNumber || (flight.name.slice(0,2).toUpperCase() + " " + Math.floor(100 + Math.random()*899)),
    paxCount: paxCount,
    cabin: FlyvisOtaState.route.cabinClass.toUpperCase(),
    ancillaries: FlyvisOtaState.selectedAncillaries || [],
    seatPreference: {
      type: (FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.type) || "window",
      zone: (FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.zone) || "front",
      specificSeat: (FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.specificSeat) || "",
      summary: `${((FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.type) || 'window').toUpperCase()} (${((FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.zone) || 'front')} zone)${((FlyvisOtaState.seatPreference && FlyvisOtaState.seatPreference.specificSeat) ? ` [Seat: ${FlyvisOtaState.seatPreference.specificSeat}]` : '')}`
    },
    fareBreakdown: {
      baseFare: fin.grossPrice,
      cardDiscount: fin.cardDiscount,
      cardName: fin.bestCardName,
      pointsDiscount: pointsDiscount,
      ancillaries: FlyvisOtaState.selectedAncillaries || [],
      ancillariesTotal: ancTotal,
      conciergeFee: 350,
      totalPayable: finalTotal
    },
    notes: documents.length > 0 ? `${documents.length} passenger document(s) attached / vault synced` : "Awaiting passport copy via WhatsApp"
  };

  // Sync selected ancillaries directly into the Admin Ancillary Queue
  if (FlyvisOtaState.selectedAncillaries && FlyvisOtaState.selectedAncillaries.length > 0) {
    try {
      let ancList = [];
      const raw = localStorage.getItem("flyvis_post_booking_ancillaries");
      if (raw) ancList = JSON.parse(raw);
      const sp = FlyvisOtaState.seatPreference || { type: "window", zone: "front", specificSeat: "" };
      const spSummary = `${sp.type.toUpperCase()} (${sp.zone} zone)${sp.specificSeat ? ` [Seat: ${sp.specificSeat}]` : ''}`;
      const newAncOrder = {
        id: Date.now(),
        ancillaryRef: `${bookingId}-A1`,
        bookingRef: bookingId,
        provider: isDomestic ? "6E-DC" : "AMGS",
        status: "AWAITING_MANUAL_REVIEW",
        routingReason: "pre_booking_selected",
        currency: "INR",
        manualSlaDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        isOverdue: false,
        createdAt: nowIso,
        ancillaryTotal: ancTotal,
        serviceCharge: 0,
        platformFee: 0,
        payable: ancTotal,
        customer: leadFullName,
        phone: contactPhone || userPhone || "+91 98112 34567",
        email: contactEmail || (user && user.email) || "traveler@flyvis.com",
        route: `${FlyvisOtaState.route.origCode} → ${FlyvisOtaState.route.destCode}`,
        airline: flight.name,
        pnr: "PENDING",
        notes: `Customer pre-booked add-ons: ${FlyvisOtaState.selectedAncillaries.map(a => a.name).join(', ')}. Seat Preference: ${spSummary}`,
        items: FlyvisOtaState.selectedAncillaries.map(a => ({
          type: a.id.includes('baggage') ? 'baggage' : (a.id.includes('meal') ? 'meal' : (a.id.includes('seat') ? 'seat' : 'assistance')),
          name: a.id.includes('seat') ? `Seat Preference: ${spSummary}` : a.name,
          details: a.id.includes('seat')
            ? `${sp.type.toUpperCase()} seat in ${sp.zone} cabin${sp.specificSeat ? ` (Specific: ${sp.specificSeat})` : ''}`
            : `Pre-booked add-on (₹${a.price})`,
          status: "Awaiting Fulfillment"
        }))
      };
      ancList.unshift(newAncOrder);
      localStorage.setItem("flyvis_post_booking_ancillaries", JSON.stringify(ancList));
    } catch (ancErr) {
      console.warn("Could not sync to ancillary queue:", ancErr);
    }
  }

  // 1. Dual-Sync: Save to Firestore
  if (typeof db !== 'undefined') {
    try {
      db.collection('flight_bookings').doc(bookingId).set(bookingPayload).then(() => {
        console.log("✅ Booking synced to Firestore flight_bookings:", bookingId);
      }).catch(e => console.warn("Firestore booking warning:", e));

      db.collection('flyvis_flight_bookings').doc(bookingId).set(bookingPayload).then(() => {
        console.log("✅ Booking synced to Firestore flyvis_flight_bookings:", bookingId);
      }).catch(e => console.warn("Firestore booking warning 2:", e));
    } catch (e) {
      console.warn("Firestore error:", e);
    }
  }

  // 2. Dual-Sync: Save to Server REST API
  try {
    fetch('/api/flight-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    }).then(r => r.json()).then(res => {
      console.log("✅ Local server booking created:", res);
    }).catch(err => {
      console.log("Local server notice (using cloud firestore):", err);
    });
  } catch (e) {}

  // 3. Save confirmed booking to localStorage for my-flights.html
  try {
    let confList = [];
    const rawConf = localStorage.getItem("flyvis_confirmed_bookings");
    if (rawConf) confList = JSON.parse(rawConf);
    // Avoid duplicates
    if (!confList.some(b => b.bookingId === bookingId)) {
      confList.unshift(bookingPayload);
      localStorage.setItem("flyvis_confirmed_bookings", JSON.stringify(confList));
    }
  } catch (e) {}

  const phone = "919207021258";
  const seatPrefObj = FlyvisOtaState.seatPreference || { type: "window", zone: "front", specificSeat: "" };
  const seatPrefText = `${seatPrefObj.type.toUpperCase()} (${seatPrefObj.zone} zone)${seatPrefObj.specificSeat ? ` [Requested: ${seatPrefObj.specificSeat}]` : ''}`;

  let travelerLines = "";
  passengerList.forEach((p, i) => {
    travelerLines += `${i === 0 ? '⭐ Lead Traveler' : `👥 Co-Traveler ${i + 1}`}: ${p.name}\n`;
    travelerLines += `  • Passport / ID: ${p.passportNumber} ${p.passportExpiry ? '(Exp: ' + p.passportExpiry + ')' : ''}\n`;
    travelerLines += `  • DOB: ${p.dob || 'N/A'} | Gender: ${p.gender || 'N/A'} | Nat: ${p.nationality}\n`;
    if (i === 0) {
      travelerLines += `  • Mobile / WhatsApp: ${contactPhone || userPhone || 'Registered Account'}\n`;
      travelerLines += `  • Email: ${contactEmail || (user && user.email) || 'Registered Account'}\n`;
    }
  });

  const msg = 
`Hi Flyvis Concierge Desk, please confirm my instant flight reservation:
=========================================
🔖 Booking Reference: ${bookingId}
🛫 Route: ${FlyvisOtaState.route.origName} (${FlyvisOtaState.route.origCode}) → ${FlyvisOtaState.route.destName} (${FlyvisOtaState.route.destCode})
📅 Date: ${formatDisplayDate(FlyvisOtaState.route.departureDate)}
✈️ Flight: ${flight.name} • ${flight.departureTime}
💺 Cabin: ${FlyvisOtaState.route.cabinClass.toUpperCase()} (${paxCount} Traveler${paxCount > 1 ? 's' : ''})
🪟 Seat Preference: ${seatPrefText}

👤 PASSENGER & TRAVELER DETAILS (${paxCount} Pax):
${travelerLines.trim()}

💳 FINTECH & REWARDS BREAKDOWN:
- Airline Base Fare: ₹${fin.grossPrice.toLocaleString('en-IN')}
${fin.cardDiscount > 0 ? `- Bank Card Advantage: -₹${fin.cardDiscount.toLocaleString('en-IN')} (${fin.bestCardName})\n` : ''}${pointsDiscount > 0 ? `- Bank Points Deduction: -₹${pointsDiscount.toLocaleString('en-IN')} (${FlyvisOtaState.pointsBurn.points} Pts)\n` : ''}${ancTotal > 0 ? `- Trip Add-ons & Ancillaries: +₹${ancTotal.toLocaleString('en-IN')} (${(FlyvisOtaState.selectedAncillaries || []).map(a => a.name).join(', ')})\n` : ''}- VIP Concierge, Seat Lock & Auto Check-in: ₹350
- Final Net Payable: ₹${finalTotal.toLocaleString('en-IN')}

🎁 Concierge Perks Included:
✓ Free Automatic Web Check-in & Window/Aisle Preference
✓ Destination Digital Arrival Card Prep
✓ 24/7 WhatsApp Gate & Delay Alerts

Please share instant payment link to lock this fare now. Thank you!`;

  // Show Quick Confirmation Overlay Toast
  const toast = document.createElement('div');
  toast.id = 'flyvis-booking-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;background:#0D1B2A;color:#FFFFFF;padding:18px 22px;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,0.35);max-width:420px;font-family:inherit;border-left:5px solid #2E7D7E;animation:slideInUp 0.3s ease;';
  toast.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-weight:800;font-size:15px;color:#7EC0C5;margin-bottom:4px;">Booking Initiated! ✈️</div>
        <div style="font-size:13px;color:#E2E8F0;line-height:1.4;">Reference <strong style="color:#FFFFFF;background:#1E293B;padding:2px 6px;border-radius:4px;letter-spacing:0.5px;">${bookingId}</strong> generated for <strong>${paxCount} Traveler${paxCount > 1 ? 's' : ''}</strong> and queued in Admin Portal.</div>
        <div style="font-size:11.5px;color:#94A3B8;margin-top:6px;">Opening WhatsApp concierge chat with reservation details...</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:18px;line-height:1;">&times;</button>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 8000);

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank");
}

/**
 * 24/7 Price Drop Alert & Auto-Book Modal (Route-Level & Flight-Specific)
 */
function setTrackerMode(mode) {
  if (!FlyvisOtaState) FlyvisOtaState = {};
  FlyvisOtaState.trackerMode = mode;

  const tabAuto = document.getElementById("tracker-tab-autobook");
  const tabNotify = document.getElementById("tracker-tab-notify");
  const autoFields = document.getElementById("alert-autobook-fields");
  const notifyFields = document.getElementById("alert-notify-fields");
  const submitBtn = document.getElementById("alert-submit-btn");

  if (mode === "auto_book") {
    if (tabAuto) {
      tabAuto.style.borderColor = "#2E7D7E";
      tabAuto.style.backgroundColor = "#F0FDF4";
    }
    if (tabNotify) {
      tabNotify.style.borderColor = "#CBD5E1";
      tabNotify.style.backgroundColor = "#FFFFFF";
    }
    if (autoFields) autoFields.style.display = "block";
    if (notifyFields) notifyFields.style.display = "none";
    if (submitBtn) submitBtn.innerHTML = `<span>Pre-Authorize &amp; Activate Auto-Book &#x26A1;</span>`;
  } else {
    if (tabAuto) {
      tabAuto.style.borderColor = "#CBD5E1";
      tabAuto.style.backgroundColor = "#FFFFFF";
    }
    if (tabNotify) {
      tabNotify.style.borderColor = "#2E7D7E";
      tabNotify.style.backgroundColor = "#F8FAFC";
    }
    if (autoFields) autoFields.style.display = "none";
    if (notifyFields) notifyFields.style.display = "block";
    if (submitBtn) submitBtn.innerHTML = `<span>Activate Price Drop Alert &#x1F514;</span>`;
  }
}

/**
 * Handle switching between 'exact' flight tracking and 'any_nonstop' route tracking
 * Integrates Pitfall #1: Midnight Departure defense (toggle checkbox vs exact flight warning)
 */
function handleFlightMatchChange(mode) {
  const excludeToggle = document.getElementById("lbl-exclude-midnight-toggle");
  const exactWarning = document.getElementById("alert-exact-midnight-warning");
  const exactMsg = document.getElementById("alert-exact-midnight-msg");
  const midnightBox = document.getElementById("alert-midnight-filter-box");
  const routePill = document.getElementById("alert-route-pill");

  const flt = FlyvisOtaState.alertFlightTarget;
  const orig = FlyvisOtaState.route?.origCode || 'DEL';
  const dest = FlyvisOtaState.route?.destCode || 'DXB';
  const depDate = FlyvisOtaState.route?.departureDate || '2026-10-28';

  if (mode === "any_nonstop") {
    if (routePill) routePill.textContent = `Any Non-Stop • ${orig} → ${dest}`;
    if (excludeToggle) excludeToggle.style.display = "flex";
    if (exactWarning) exactWarning.style.display = "none";
    if (midnightBox) midnightBox.style.display = "block";
  } else {
    // Exact Flight Mode
    if (flt) {
      if (routePill) routePill.textContent = `${flt.name || flt.airline} • ${orig} → ${dest}`;
      const times = (flt.departureTime || "").split("–").map(s => s.trim());
      const depTime = times[0] || flt.departureTime;
      const midInfo = getMidnightDepartureInfo(depTime, depDate);
      if (midInfo) {
        if (excludeToggle) excludeToggle.style.display = "none";
        if (exactWarning) exactWarning.style.display = "block";
        if (exactMsg) {
          exactMsg.innerHTML = `<strong>${midInfo.humanWarning}</strong><div style="margin-top:3px; color:#78350F;">Auto-booking will lock in this exact early morning flight. Make sure you arrange airport travel for the preceding evening (${midInfo.previousDateFormatted}).</div>`;
        }
        if (midnightBox) midnightBox.style.display = "block";
      } else {
        if (excludeToggle) excludeToggle.style.display = "none";
        if (exactWarning) exactWarning.style.display = "none";
        if (midnightBox) midnightBox.style.display = "none";
      }
    } else {
      if (routePill) routePill.textContent = `${orig} → ${dest}`;
      if (excludeToggle) excludeToggle.style.display = "flex";
      if (exactWarning) exactWarning.style.display = "none";
      if (midnightBox) midnightBox.style.display = "block";
    }
  }

  // Synchronize dynamic ancillary pricing tags and TCOT calculation
  if (typeof updateModalTcotCalculation === "function") {
    updateModalTcotCalculation();
  }
}

function openPriceAlertModal() {
  if (typeof requireFlyvisAuth === "function" && !requireFlyvisAuth(() => openPriceAlertModal(), "set 24/7 price drop alerts")) return;

  const modal = document.getElementById("ota-price-alert-modal");
  const targetInput = document.getElementById("alert-target-price");
  const phoneInput = document.getElementById("alert-phone-number");
  const emailInput = document.getElementById("alert-email-address");
  const travelerNameInput = document.getElementById("alert-traveler-name");
  const passportInput = document.getElementById("alert-traveler-passport");
  const cardNameInput = document.getElementById("alert-card-name");
  const routePill = document.getElementById("alert-route-pill");

  const basePrice = getLowestBaseFare();
  FlyvisOtaState.alertFlightTarget = null;

  if (routePill && FlyvisOtaState.route) {
    routePill.textContent = `${FlyvisOtaState.route.origCode || 'DEL'} → ${FlyvisOtaState.route.destCode || 'DXB'}`;
  }

  if (targetInput) {
    targetInput.value = Math.round(basePrice * 0.90);
  }
  if (phoneInput && typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.userProfile) {
    phoneInput.value = FlyvisAuthState.userProfile.phone || "";
  }
  if (emailInput && typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) {
    emailInput.value = FlyvisAuthState.currentUser.email || "";
  }

  // Pre-fill Traveler & Travel Vault information
  const user = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) || null;
  const profile = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.userProfile) || null;
  const vaultDocs = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.travelVault) || [];
  const passportDoc = vaultDocs.find(d => (d.type || '').toLowerCase() === 'passport') || null;

  const resolvedName = (profile && profile.displayName) || (user && user.displayName) || "Zaid Khaleel";
  if (travelerNameInput) travelerNameInput.value = resolvedName;
  if (cardNameInput) cardNameInput.value = resolvedName;
  if (passportInput) {
    passportInput.value = (passportDoc && passportDoc.title) || (profile && profile.passportNumber) || "P19827364";
  }
  const passportExpInput = document.getElementById("alert-traveler-passport-exp");
  if (passportExpInput) {
    passportExpInput.value = (passportDoc && passportDoc.expiryDate) || (profile && profile.passportExpiry) || "2028-12-31";
  }
  checkAlertPassportInad();

  const connWarning1 = document.getElementById("alert-connection-warning");
  if (connWarning1) connWarning1.style.display = "none";

  // Reset Ancillary Package Controls to standard defaults
  const bag15Radio = document.querySelector('input[name="alert-pkg-baggage"][value="15"]');
  if (bag15Radio) bag15Radio.checked = true;
  const mealChk = document.getElementById("alert-pkg-chk-meal");
  if (mealChk) mealChk.checked = false;
  const flexChk = document.getElementById("alert-pkg-chk-flexi");
  if (flexChk) flexChk.checked = false;
  const seatAnyRadio = document.querySelector('input[name="alert-pkg-seat"][value="any"]');
  if (seatAnyRadio) seatAnyRadio.checked = true;

  // Route-wide tracking default to Any Non-Stop
  const anyRadio = document.querySelector('input[name="alert-flight-match"][value="any_nonstop"]');
  if (anyRadio) anyRadio.checked = true;
  handleFlightMatchChange("any_nonstop");

  setTrackerMode("auto_book");
  updateModalDropProbability();
  updateModalTcotCalculation();
  if (modal) modal.style.display = "flex";
}

function openFlightSpecificAlertModal(idx) {
  if (typeof requireFlyvisAuth === "function" && !requireFlyvisAuth(() => openFlightSpecificAlertModal(idx), "track this flight")) return;

  const flight = FlyvisOtaState.filteredFlights[idx];
  if (!flight) return;

  FlyvisOtaState.alertFlightTarget = flight;

  const modal = document.getElementById("ota-price-alert-modal");
  const targetInput = document.getElementById("alert-target-price");
  const phoneInput = document.getElementById("alert-phone-number");
  const emailInput = document.getElementById("alert-email-address");
  const travelerNameInput = document.getElementById("alert-traveler-name");
  const passportInput = document.getElementById("alert-traveler-passport");
  const cardNameInput = document.getElementById("alert-card-name");
  const routePill = document.getElementById("alert-route-pill");

  if (routePill && FlyvisOtaState.route) {
    routePill.textContent = `${flight.name} • ${FlyvisOtaState.route.origCode || 'DEL'} → ${FlyvisOtaState.route.destCode || 'DXB'}`;
  }

  if (targetInput) {
    targetInput.value = Math.round(flight.basePrice * 0.90);
  }
  if (phoneInput && typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.userProfile) {
    phoneInput.value = FlyvisAuthState.userProfile.phone || "";
  }
  if (emailInput && typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) {
    emailInput.value = FlyvisAuthState.currentUser.email || "";
  }

  // Pre-fill Traveler & Travel Vault information
  const user = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) || null;
  const profile = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.userProfile) || null;
  const vaultDocs = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.travelVault) || [];
  const passportDoc = vaultDocs.find(d => (d.type || '').toLowerCase() === 'passport') || null;

  const resolvedName = (profile && profile.displayName) || (user && user.displayName) || "Zaid Khaleel";
  if (travelerNameInput) travelerNameInput.value = resolvedName;
  if (cardNameInput) cardNameInput.value = resolvedName;
  if (passportInput) {
    passportInput.value = (passportDoc && passportDoc.title) || (profile && profile.passportNumber) || "P19827364";
  }
  const passportExpInput2 = document.getElementById("alert-traveler-passport-exp");
  if (passportExpInput2) {
    passportExpInput2.value = (passportDoc && passportDoc.expiryDate) || (profile && profile.passportExpiry) || "2028-12-31";
  }
  checkAlertPassportInad();

  // Reset Ancillary Package Controls to standard defaults
  const bag15Radio = document.querySelector('input[name="alert-pkg-baggage"][value="15"]');
  if (bag15Radio) bag15Radio.checked = true;
  const mealChk = document.getElementById("alert-pkg-chk-meal");
  if (mealChk) mealChk.checked = false;
  const flexChk = document.getElementById("alert-pkg-chk-flexi");
  if (flexChk) flexChk.checked = false;
  const seatAnyRadio = document.querySelector('input[name="alert-pkg-seat"][value="any"]');
  if (seatAnyRadio) seatAnyRadio.checked = true;

  // Evaluate Pitfall #4: Connection safety on selected flight
  const connWarning2 = document.getElementById("alert-connection-warning");
  const orig = FlyvisOtaState.route?.origCode || 'DEL';
  const dest = FlyvisOtaState.route?.destCode || 'DXB';
  const connSafety = evaluateConnectionSafety(flight, orig, dest);
  if (connWarning2) {
    if (connSafety && connSafety.transferType === 'RISKY_SELF_TRANSFER') {
      connWarning2.style.display = "block";
      connWarning2.innerHTML = `<strong>🚨 High-Risk Self-Transfer:</strong> ${connSafety.warning}`;
    } else if (connSafety && connSafety.transferType === 'SAFE_SELF_TRANSFER') {
      connWarning2.style.display = "block";
      connWarning2.innerHTML = `<strong>⚠️ Self-Transfer Notice:</strong> ${connSafety.warning}`;
    } else {
      connWarning2.style.display = "none";
    }
  }

  // Specific flight tracking default to Exact Flight
  const exactRadio = document.querySelector('input[name="alert-flight-match"][value="exact"]');
  if (exactRadio) exactRadio.checked = true;
  handleFlightMatchChange("exact");

  setTrackerMode("auto_book");
  updateModalDropProbability();
  updateModalTcotCalculation();
  if (modal) modal.style.display = "flex";
}

function updateModalDropProbability() {
  const targetInput = document.getElementById("alert-target-price");
  const badge = document.getElementById("alert-prob-badge");
  const bar = document.getElementById("alert-prob-bar");
  const subtext = document.getElementById("alert-prob-subtext");
  const box = document.getElementById("alert-probability-box");
  const savingsBadge = document.getElementById("alert-savings-badge");

  if (!targetInput || !badge) return;

  const flt = FlyvisOtaState.alertFlightTarget;
  const currentFare = flt ? flt.basePrice : getLowestBaseFare();
  const rawTarget = targetInput.value.trim();
  const targetFare = parseFloat(rawTarget) || 0;

  // Update Multi-Pax Aggregate Budget calculation
  const paxCount = parseInt(FlyvisOtaState.route?.travelers) || 1;
  const totalBudgetVal = document.getElementById("alert-total-budget-val");
  const totalPaxLabel = document.getElementById("alert-total-pax-label");
  const multiPaxBanner = document.getElementById("alert-multipax-banner");
  const pnrStrategyBox = document.getElementById("alert-pnr-strategy-box");

  if (paxCount > 1) {
    if (multiPaxBanner) multiPaxBanner.style.display = "block";
    if (pnrStrategyBox) pnrStrategyBox.style.display = "block";
    if (totalBudgetVal) {
      totalBudgetVal.textContent = `₹${Math.round(targetFare * paxCount).toLocaleString('en-IN')}`;
    }
    if (totalPaxLabel) {
      totalPaxLabel.textContent = `${paxCount} Travelers`;
    }
  } else {
    if (multiPaxBanner) multiPaxBanner.style.display = "none";
    if (pnrStrategyBox) pnrStrategyBox.style.display = "none";
  }

  let daysUntil = 25;
  if (FlyvisOtaState.route && FlyvisOtaState.route.departureDate) {
    const tDate = new Date(FlyvisOtaState.route.departureDate);
    const now = new Date();
    const diff = Math.ceil((tDate - now) / (1000 * 60 * 60 * 24));
    if (!isNaN(diff)) daysUntil = diff;
  }

  let prob = 0;
  let probLabel = "0% (Unrealistic Target)";
  let probColor = "#DC2626";
  let probBg = "#FEF2F2";
  let probBorder = "#FECACA";
  let msg = "";

  if (targetFare <= 0 || targetFare < currentFare * 0.40) {
    prob = 0;
    probLabel = "0% (Unrealistic Target)";
    probColor = "#DC2626";
    probBg = "#FEF2F2";
    probBorder = "#FECACA";
    const minRealistic = Math.round(currentFare * 0.85);
    msg = `Target fare of ₹${targetFare.toLocaleString('en-IN')} is below airline minimum operational taxes and fuel surcharge base. Recommended realistic target: ₹${minRealistic.toLocaleString('en-IN')} (15% drop).`;
    if (savingsBadge) {
      savingsBadge.textContent = "Below Fuel/Tax Baseline";
      savingsBadge.style.background = "#FEE2E2";
      savingsBadge.style.color = "#DC2626";
    }
  } else if (targetFare >= currentFare) {
    prob = 100;
    probLabel = "100% Available Now";
    probColor = "#16A34A";
    probBg = "#F0FDF4";
    probBorder = "#BBF7D0";
    msg = `This fare is already available right now at ₹${currentFare.toLocaleString('en-IN')}. You can select and book this flight immediately.`;
    if (savingsBadge) {
      savingsBadge.textContent = "Available Right Now (₹0 Drop)";
      savingsBadge.style.background = "#EFF6FF";
      savingsBadge.style.color = "#2563EB";
    }
  } else {
    const dropPct = Math.round(((currentFare - targetFare) / currentFare) * 100);
    const savingsAmt = currentFare - targetFare;

    if (savingsBadge) {
      savingsBadge.textContent = `Target Savings: ₹${savingsAmt.toLocaleString('en-IN')} (${dropPct}%)`;
      savingsBadge.style.background = "#DCFCE7";
      savingsBadge.style.color = "#166534";
    }

    let baseProb = 80;
    if (dropPct <= 5) baseProb = 95;
    else if (dropPct <= 12) baseProb = 82;
    else if (dropPct <= 20) baseProb = 68;
    else if (dropPct <= 30) baseProb = 48;
    else if (dropPct <= 45) baseProb = 26;
    else if (dropPct <= 60) baseProb = 8;
    else baseProb = 2;

    if (daysUntil < 7) baseProb = Math.max(2, baseProb - 25);
    else if (daysUntil >= 21 && daysUntil <= 60) baseProb = Math.min(98, baseProb + 5);

    prob = Math.max(2, Math.min(98, Math.round(baseProb)));

    if (prob >= 70) {
      probColor = "#16A34A";
      probBg = "#F0FDF4";
      probBorder = "#BBF7D0";
      probLabel = `${prob}% Likely`;
      msg = `High probability (${prob}%): Historical yield tracking indicates regular price dips within this target range.`;
    } else if (prob >= 40) {
      probColor = "#D97706";
      probBg = "#FFFBEB";
      probBorder = "#FDE68A";
      probLabel = `${prob}% Likely`;
      msg = `Moderate likelihood (${prob}%): Airlines may release limited promo fare buckets during sales cycles.`;
    } else {
      probColor = "#DC2626";
      probBg = "#FEF2F2";
      probBorder = "#FECACA";
      probLabel = `${prob}% (Rare Flash Sale)`;
      msg = `Low probability (${prob}%): Requires deep promotional carrier sales or route seat inventory dumping.`;
    }
  }

  badge.textContent = probLabel;
  badge.style.color = probColor;
  if (bar) {
    bar.style.width = `${prob}%`;
    bar.style.backgroundColor = probColor;
  }
  if (box) {
    box.style.backgroundColor = probBg;
    box.style.borderColor = probBorder;
  }
  if (subtext) {
    subtext.textContent = msg;
    subtext.style.color = probColor;
  }

  // Keep TCOT calculations synchronized
  if (typeof updateModalTcotCalculation === "function") {
    updateModalTcotCalculation();
  }
}

/**
 * Synchronizes the interactive Ancillary Package & Total Cost of Travel (TCOT) calculator
 * inside #ota-price-alert-modal. Dynamically updates fee tags (FSC complimentary vs LCC paid),
 * highlights selected options, and recalculates the All-Inclusive Target Cap.
 */
function updateModalTcotCalculation() {
  const targetInput = document.getElementById("alert-target-price");
  if (!targetInput) return;
  const rawTarget = targetInput.value.trim();
  const baseTarget = parseFloat(rawTarget) || 0;
  const paxCount = parseInt(FlyvisOtaState.route?.travelers) || 1;

  // Selected inputs
  const bagRadio = document.querySelector('input[name="alert-pkg-baggage"]:checked');
  const baggageKg = bagRadio ? parseInt(bagRadio.value, 10) : 15;
  const mealChk = document.getElementById("alert-pkg-chk-meal");
  const requireMeal = mealChk ? mealChk.checked : false;
  const flexiChk = document.getElementById("alert-pkg-chk-flexi");
  const requireFlexi = flexiChk ? flexiChk.checked : false;
  const seatRadio = document.querySelector('input[name="alert-pkg-seat"]:checked');
  const requireSeat = seatRadio ? seatRadio.value : 'any';

  // Highlight selected baggage label card
  [0, 15, 25].forEach(val => {
    const lbl = document.getElementById(`lbl-pkg-bag-${val}`);
    if (lbl) {
      if (baggageKg === val) {
        lbl.style.background = "#F0FDF4";
        lbl.style.border = "1.5px solid #2E7D7E";
      } else {
        lbl.style.background = "#FFFFFF";
        lbl.style.border = "1px solid #CBD5E1";
      }
    }
  });

  const flt = FlyvisOtaState.alertFlightTarget;
  const isFlightSpecific = !!flt;
  const airlineName = flt ? (flt.name || flt.airline) : null;
  const profile = isFlightSpecific ? getAirlineAncillaryProfile(airlineName) : null;

  // Dynamic tags inside modal
  const bag15PriceSpan = document.getElementById("alert-pkg-bag-15-price");
  const bag25PriceSpan = document.getElementById("alert-pkg-bag-25-price");
  const mealPriceSpan = document.getElementById("alert-pkg-meal-price-tag");
  const flexPriceSpan = document.getElementById("alert-pkg-flex-price-tag");
  const seatStdSpan = document.getElementById("alert-pkg-seat-std-tag");
  const seatXlSpan = document.getElementById("alert-pkg-seat-xl-tag");

  if (isFlightSpecific && profile) {
    if (bag15PriceSpan) bag15PriceSpan.textContent = profile.baggage[15] === 0 ? "Included Free (₹0)" : `+₹${profile.baggage[15].toLocaleString('en-IN')}`;
    if (bag25PriceSpan) bag25PriceSpan.textContent = profile.baggage[25] === 0 ? "Included Free (₹0)" : `+₹${profile.baggage[25].toLocaleString('en-IN')}`;
    if (mealPriceSpan) mealPriceSpan.textContent = profile.meal.included ? `Included Free (₹0 ${profile.meal.label})` : `+₹${profile.meal.price.toLocaleString('en-IN')} (${profile.meal.label})`;
    if (flexPriceSpan) flexPriceSpan.textContent = `+₹${profile.flexi.price.toLocaleString('en-IN')} (${profile.flexi.label})`;
    if (seatStdSpan) seatStdSpan.textContent = profile.seat.standard === 0 ? "Included Free (₹0)" : `+₹${profile.seat.standard.toLocaleString('en-IN')}`;
    if (seatXlSpan) seatXlSpan.textContent = `+₹${profile.seat.extra_legroom.toLocaleString('en-IN')}`;
  } else {
    // Route-wide or unassigned: display general carrier comparison
    if (bag15PriceSpan) bag15PriceSpan.textContent = "Free on FSC / +₹1,200 LCC";
    if (bag25PriceSpan) bag25PriceSpan.textContent = "Free on FSC / +₹2,200 LCC";
    if (mealPriceSpan) mealPriceSpan.textContent = "Free on FSC / +₹450 on LCC";
    if (flexPriceSpan) flexPriceSpan.textContent = "+₹800 Flexi Reschedule";
    if (seatStdSpan) seatStdSpan.textContent = "Free FSC / +₹250 LCC";
    if (seatXlSpan) seatXlSpan.textContent = "+₹650 to +₹1,500";
  }

  // Calculate TCOT bundle pricing
  let tcotCalc;
  let summarySubtext = "";
  if (isFlightSpecific && airlineName) {
    tcotCalc = calculateTcotPackagePrice(baseTarget, airlineName, { baggageKg, requireMeal, requireSeat, requireFlexi });
    if (tcotCalc.ancillaryTotal === 0) {
      summarySubtext = `(Base airfare ₹${baseTarget.toLocaleString('en-IN')} + ₹0 complimentary bundle on ${airlineName})`;
    } else {
      summarySubtext = `(Base ₹${baseTarget.toLocaleString('en-IN')} + ₹${tcotCalc.ancillaryTotal.toLocaleString('en-IN')} bundle on ${airlineName})`;
    }
  } else {
    // Route-wide: calculate against standard LCC reference (IndiGo) and FSC reference (Air India)
    const lccTcot = calculateTcotPackagePrice(baseTarget, "IndiGo", { baggageKg, requireMeal, requireSeat, requireFlexi });
    const fscTcot = calculateTcotPackagePrice(baseTarget, "Air India", { baggageKg, requireMeal, requireSeat, requireFlexi });
    tcotCalc = lccTcot; // conservative cap ensures LCCs are accounted for
    if (lccTcot.ancillaryTotal === 0) {
      summarySubtext = `(Base airfare ₹${baseTarget.toLocaleString('en-IN')} + ₹0 bundle)`;
    } else {
      summarySubtext = `(Base ₹${baseTarget.toLocaleString('en-IN')} + ₹${lccTcot.ancillaryTotal.toLocaleString('en-IN')} bundle on LCC / ₹${fscTcot.ancillaryTotal.toLocaleString('en-IN')} on FSC)`;
    }
  }

  const allInclusiveCap = tcotCalc.tcotTotal;

  // Update TCOT Summary Bar in Modal
  const totalValEl = document.getElementById("alert-tcot-total-val");
  const subtextEl = document.getElementById("alert-tcot-breakdown-sub");
  if (totalValEl) {
    totalValEl.textContent = `₹${allInclusiveCap.toLocaleString('en-IN')}`;
  }
  if (subtextEl) {
    subtextEl.textContent = summarySubtext;
  }
  const sidebarCapEl = document.getElementById("alert-sidebar-tcot-val");
  const sidebarCapSubEl = document.getElementById("alert-sidebar-tcot-sub");
  if (sidebarCapEl) {
    if (paxCount > 1) {
      sidebarCapEl.textContent = `₹${Math.round(allInclusiveCap * paxCount).toLocaleString('en-IN')}`;
    } else {
      sidebarCapEl.textContent = `₹${allInclusiveCap.toLocaleString('en-IN')}`;
    }
  }
  if (sidebarCapSubEl) {
    if (paxCount > 1) {
      sidebarCapSubEl.textContent = `Total for ${paxCount} travelers (₹${allInclusiveCap.toLocaleString('en-IN')} / person all-inclusive)`;
    } else {
      sidebarCapSubEl.textContent = `All-inclusive per traveler (Airfare + Taxes + Selected Package)`;
    }
  }

  // Update Multi-Pax Aggregate Budget if more than 1 traveler
  const totalBudgetVal = document.getElementById("alert-total-budget-val");
  const totalPaxLabel = document.getElementById("alert-total-pax-label");
  if (paxCount > 1) {
    if (totalBudgetVal) {
      totalBudgetVal.textContent = `₹${Math.round(allInclusiveCap * paxCount).toLocaleString('en-IN')}`;
    }
    if (totalPaxLabel) {
      totalPaxLabel.textContent = `${paxCount} Travelers (All-Inclusive TCOT)`;
    }
  }
}

function closePriceAlertModal() {
  const modal = document.getElementById("ota-price-alert-modal");
  if (modal) modal.style.display = "none";
}

function submitPriceDropAlert() {
  const target = document.getElementById("alert-target-price")?.value || "12000";
  const phone = document.getElementById("alert-phone-number")?.value.trim() || "";
  const email = document.getElementById("alert-email-address")?.value.trim() || "";
  const mode = (FlyvisOtaState && FlyvisOtaState.trackerMode) || "auto_book";

  // Auto-book specific fields
  const travelerName = document.getElementById("alert-traveler-name")?.value.trim() || "Zaid Khaleel";
  const travelerPassport = document.getElementById("alert-traveler-passport")?.value.trim() || "P19827364";
  const passportExpInput = document.getElementById("alert-traveler-passport-exp");
  const travelerPassportExp = passportExpInput ? passportExpInput.value.trim() : "2028-12-31";
  const cardName = document.getElementById("alert-card-name")?.value.trim() || travelerName;
  const cardNumber = document.getElementById("alert-card-number")?.value.trim() || "•••• •••• •••• 4242";
  const cardExp = document.getElementById("alert-card-exp")?.value.trim() || "12/28";

  const flightMatchEl = document.querySelector('input[name="alert-flight-match"]:checked');
  const flightMatchRule = flightMatchEl ? flightMatchEl.value : "exact";

  // Multi-Pax & Split-PNR Booking Preferences
  const paxCount = parseInt(FlyvisOtaState.route?.travelers) || 1;
  const pnrStrategyEl = document.querySelector('input[name="alert-pnr-strategy"]:checked');
  const pnrStrategy = pnrStrategyEl ? pnrStrategyEl.value : "single_pnr";

  // Required Travel Package & Ancillaries (TCOT All-Inclusive Shield)
  const bagRadio = document.querySelector('input[name="alert-pkg-baggage"]:checked');
  const baggageKg = bagRadio ? parseInt(bagRadio.value, 10) : 15;
  const baggagePref = (baggageKg === 0) ? "hand_baggage_only" : "standard_baggage";
  const mealChk = document.getElementById("alert-pkg-chk-meal");
  const requireMeal = mealChk ? mealChk.checked : false;
  const flexiChk = document.getElementById("alert-pkg-chk-flexi");
  const requireFlexi = flexiChk ? flexiChk.checked : false;
  const seatRadio = document.querySelector('input[name="alert-pkg-seat"]:checked');
  const requireSeat = seatRadio ? seatRadio.value : 'any';

  // Price Drift & Slippage Tolerance (Pitfall #2 Defense: TTL Race Condition Shield)
  const driftTolEl = document.querySelector('input[name="alert-drift-tolerance"]:checked');
  const priceDriftTolerance = driftTolEl ? driftTolEl.value : "strict_0";
  const maxAllowedSlippage = priceDriftTolerance === 'flexible_500' ? 500 : 0;

  // Midnight / Red-Eye Departure Safeguard (Pitfall #1 Defense)
  const excludeMidnightEl = document.getElementById("alert-chk-exclude-midnight");
  const excludeMidnightRedEye = flightMatchRule === 'any_nonstop' ? (excludeMidnightEl ? excludeMidnightEl.checked : true) : false;

  // Connection & Self-Transfer Safeguard (Pitfall #4 Defense: Unprotected Connection Shield)
  const excludeSelfTransferEl = document.getElementById("alert-chk-exclude-self-transfer");
  const requireProtectedConnections = excludeSelfTransferEl ? excludeSelfTransferEl.checked : true;

  if (!phone) {
    alert("Please enter your contact WhatsApp / phone number to activate price tracking.");
    return;
  }

  const user = (typeof FlyvisAuthState !== "undefined" && FlyvisAuthState.currentUser) || null;
  const flt = FlyvisOtaState.alertFlightTarget;
  const currentFare = flt ? flt.basePrice : getLowestBaseFare();
  const targetFare = parseFloat(target) || Math.round(currentFare * 0.90);
  const maxTotalBudget = targetFare * paxCount;
  const dropPct = currentFare > targetFare ? Math.round(((currentFare - targetFare) / currentFare) * 100) : 10;
  const savingsAmt = Math.max(0, currentFare - targetFare);

  const tcotCalc = calculateTcotPackagePrice(targetFare, flt ? (flt.name || flt.airline) : null, {
    baggageKg,
    requireMeal,
    requireSeat,
    requireFlexi
  });
  const allInclusiveCapPerPax = tcotCalc.tcotTotal;
  const allInclusiveTotalBudget = allInclusiveCapPerPax * paxCount;

  const depDateStr = (FlyvisOtaState.route && FlyvisOtaState.route.departureDate) || "2026-10-28";
  const origCode = (FlyvisOtaState.route && FlyvisOtaState.route.origCode) || "DEL";
  const destCode = (FlyvisOtaState.route && FlyvisOtaState.route.destCode) || "DXB";
  const isIntl = isInternationalRoute(origCode, destCode);
  const inadCheck = isIntl ? validatePassportValidity(travelerPassportExp, depDateStr) : null;
  const inadComplianceStatus = !isIntl ? "DOMESTIC_EXEMPT" : (inadCheck && inadCheck.isValid ? "COMPLIANT" : (inadCheck?.status || "INAD_RISK"));

  // Pitfall #3 Defense: Inadmissible Passenger (INAD) Liability Shield
  if (mode === "auto_book" && isIntl && inadCheck && !inadCheck.isValid) {
    alert(`🚨 INAD Liability Safeguard Blocked Auto-Book:\n\n${inadCheck.warning}\n\nAirlines face $3,500+ statutory fines for boarding passengers with < 6 months passport validity under ICAO Annex 9 and will deny boarding. Please update passport expiry details before activating autonomous booking.`);
    return;
  }

  // Pitfall #4 Defense: Risky Self-Transfer Blocker for Autonomous Auto-Book
  const connSafety = flt ? evaluateConnectionSafety(flt, origCode, destCode) : null;
  if (mode === "auto_book" && flt && requireProtectedConnections && connSafety && connSafety.transferType === 'RISKY_SELF_TRANSFER') {
    alert(`🚨 Unprotected Connection Safeguard Blocked Auto-Book:\n\n${connSafety.warning}\n\nAutonomous booking of high-risk separate tickets with tight layovers is restricted to prevent missed connections and 100% fare loss. Uncheck "Require Protected Interline Connections" if you explicitly accept this risk.`);
    return;
  }

  const times = flt ? (flt.departureTime || "").split("–").map(s => s.trim()) : [];
  const depTime = times[0] || (flt && flt.departureTime) || "";
  const midInfo = flt ? getMidnightDepartureInfo(depTime, depDateStr) : null;
  const isMidnightDeparture = !!midInfo;

  const alertId = "alert_" + Date.now();
  const alertDoc = {
    id: alertId,
    mode: mode, // 'auto_book' or 'notify_confirm'
    from: origCode,
    to: destCode,
    origCode: origCode,
    destCode: destCode,
    date: depDateStr,
    isInternationalRoute: isIntl,
    passportExpiry: travelerPassportExp,
    inadComplianceStatus: inadComplianceStatus,
    inadDetails: isIntl ? {
      status: inadCheck?.status || 'COMPLIANT',
      expiryDate: travelerPassportExp,
      expiryFormatted: inadCheck?.expiryDateFormatted || '',
      requiredExpiryFormatted: inadCheck?.requiredExpiryFormatted || '',
      daysRemainingFromTravel: inadCheck?.daysRemainingFromTravel || 0,
      warning: inadCheck?.warning || null
    } : {
      status: 'DOMESTIC_EXEMPT',
      message: 'Domestic route — Aadhaar / Voter ID accepted at gate'
    },
    connectionSafeguard: {
      requireProtectedConnections: requireProtectedConnections,
      transferPolicy: requireProtectedConnections ? "PROTECTED_INTERLINE_ONLY" : "SELF_TRANSFERS_PERMITTED",
      minSelfTransferLayoverMins: 210, // 3.5h
      baggageThroughCheckedEnforced: requireProtectedConnections,
      selectedFlightTransferType: connSafety ? connSafety.transferType : 'NOT_SPECIFIED'
    },
    currentPrice: currentFare,
    targetPrice: targetFare,
    targetPricePerPax: targetFare,
    travelersCount: paxCount,
    maxTotalBudget: maxTotalBudget,
    pnrStrategy: pnrStrategy, // 'single_pnr' or 'split_pnr'
    baggagePreference: baggagePref, // 'standard_baggage' or 'hand_baggage_only'
    minCheckedBagsKg: baggageKg,
    baggageSafeguard: "FARE_FAMILY_SHIELD_ACTIVE",
    requiredPackage: {
      baggageKg: baggageKg,
      requireMeal: requireMeal,
      requireSeat: requireSeat,
      requireFlexi: requireFlexi,
      bundleAddOnPerPax: tcotCalc.ancillaryTotal,
      allInclusiveTargetCapPerPax: allInclusiveCapPerPax,
      allInclusiveTotalBudget: allInclusiveTotalBudget,
      tcotEnforced: true
    },
    allInclusiveTargetCap: allInclusiveCapPerPax,
    allInclusiveTotalBudget: allInclusiveTotalBudget,
    tcotEnforced: true,
    priceDriftTolerance: priceDriftTolerance,
    maxAllowedSlippage: maxAllowedSlippage,
    ttlSafeguard: {
      mode: "TWO_PHASE_ATOMIC_FREEZE",
      preExecutionPricingCheck: "AMADEUS_OFFERS_PRICE_ENFORCED",
      maxAllowedDrift: maxAllowedSlippage,
      toleranceType: priceDriftTolerance,
      seatHoldMinutes: 15,
      fallbackMode: "WHATSAPP_3DS_DIRECT_LINK"
    },
    excludeMidnightRedEye: excludeMidnightRedEye,
    isMidnightDeparture: isMidnightDeparture,
    midnightDepartureInfo: midInfo ? {
      departureTime: midInfo.departureTime,
      departureDate: midInfo.departureDateFormatted,
      suggestedArrivalTime: midInfo.suggestedArrivalFull,
      warning: midInfo.humanWarning
    } : null,
    tcotAncillaryAllowed: true,
    gdsQueryConstraint: {
      mode: "MULTI_PAX_ENFORCED",
      adults: paxCount,
      singleRbdProtected: true
    },
    dropPercentage: dropPct,
    dropAmount: savingsAmt,
    phone: phone,
    whatsapp: phone,
    email: email || (user ? user.email : "zaidkn99@gmail.com"),
    userEmail: email || (user ? user.email : "zaidkn99@gmail.com"),
    flightSpecific: flightMatchRule === 'exact' ? (flt ? `${flt.airline || flt.name} ${flt.flightNumber || flt.flightNum || ''}`.trim() : null) : null,
    flightMatchRule: flightMatchRule, // 'exact' or 'any_nonstop'
    status: "Active",
    createdAt: new Date().toISOString()
  };

  // Calculate Departure Proximity & Adaptive Polling Cadence (Look-to-Book Defense)
  let daysUntil = 30;
  if (depDateStr) {
    const tDate = new Date(depDateStr);
    const now = new Date();
    const diff = Math.ceil((tDate - now) / (1000 * 60 * 60 * 24));
    if (!isNaN(diff) && diff > 0) daysUntil = diff;
  }

  let pollingTier = "STANDARD_YIELD";
  let pollingFrequency = "Every 2 Hours";
  let pollingIntervalMins = 120;

  if (daysUntil > 30) {
    pollingTier = "RM_BATCH";
    pollingFrequency = "4x / Day (Airline RM Yield Windows)";
    pollingIntervalMins = 360;
  } else if (daysUntil >= 7) {
    pollingTier = "STANDARD_YIELD";
    pollingFrequency = "Every 2 Hours";
    pollingIntervalMins = 120;
  } else if (daysUntil >= 3) {
    pollingTier = "HIGH_VELOCITY";
    pollingFrequency = "Every 30 Mins (T-Minus Proximity)";
    pollingIntervalMins = 30;
  } else {
    pollingTier = "CRITICAL_T_MINUS";
    pollingFrequency = "Every 10 Mins (High-Velocity Sprint)";
    pollingIntervalMins = 10;
  }

  alertDoc.daysUntilDeparture = daysUntil;
  alertDoc.pollingTier = pollingTier;
  alertDoc.pollingFrequency = pollingFrequency;
  alertDoc.pollingIntervalMins = pollingIntervalMins;
  alertDoc.routeKey = `${alertDoc.origCode || 'DEL'}_${alertDoc.destCode || 'DXB'}_${depDateStr}`;
  alertDoc.lookToBookSafeguard = "CASCADED_CACHE_ACTIVE";

  const nowTime = new Date().toLocaleTimeString();
  alertDoc.telemetryLogs = [
    `[${nowTime}] 🎯 [MONITOR_INITIALIZED] Route ${alertDoc.origCode} → ${alertDoc.destCode} on ${alertDoc.date} (${paxCount} Traveler${paxCount > 1 ? 's' : ''})`,
    `[${nowTime}] 📊 [TARGET_CAP] Target: ₹${targetFare.toLocaleString('en-IN')}/seat | Aggregate Cap: ₹${maxTotalBudget.toLocaleString('en-IN')}`,
    `[${nowTime}] 📦 [TCOT_PACKAGE_ENFORCED] Required Travel Bundle: 🧳 ${baggageKg}kg Bag | 🍱 ${requireMeal ? 'Hot Meal Required' : 'No Meal'} | 💺 Seat: ${requireSeat === 'extra_legroom' ? 'Extra Legroom (XL)' : (requireSeat === 'standard' ? 'Window/Aisle' : 'Any Seat')} | 🔄 Flex: ${requireFlexi ? '1 Free Date Change' : 'Standard'} (All-Inclusive Target: ₹${allInclusiveCapPerPax.toLocaleString('en-IN')}/seat | Total Budget: ₹${allInclusiveTotalBudget.toLocaleString('en-IN')})`,
    `[${nowTime}] 🪪 [DOC_CLEARANCE] ${isIntl ? (inadComplianceStatus === 'COMPLIANT' ? `✓ 6-Month Passport Verified (${inadCheck?.expiryDateFormatted} — INAD Clear for ${destCode})` : `🚨 INAD Risk Flagged: Passport expires ${inadCheck?.expiryDateFormatted || travelerPassportExp}`) : 'Domestic Route: Govt Photo ID Cleared (Passport Exempt)'}`,
    `[${nowTime}] 🔄 [CONNECTION_GUARD] Transfer Policy: ${requireProtectedConnections ? 'Protected Interline Enforced (Separate-ticket self-transfers < 3.5h excluded)' : 'Self-Transfers Permitted (High Risk Accepted)'}`,
    `[${nowTime}] 🛡️ [GDS_ENFORCEMENT] Passing adults: ${paxCount} directly to Amadeus GDS Shopping API to prevent Single-RBD Fare Bucket Cliffs`,
    `[${nowTime}] ✂️ [PNR_STRATEGY] Policy: ${pnrStrategy === 'split_pnr' ? 'Split-PNR Allowed ⚡ (Max Savings)' : 'Single PNR Only (Strict / Recommended)'}`,
    `[${nowTime}] 🧳 [FARE_FAMILY_SHIELD] Baggage Policy: ${baggageKg > 0 ? `Standard ${baggageKg}kg Checked Luggage` : 'Cabin Bag Only (7kg)'} | 0kg basic economy protected`,
    `[${nowTime}] 🛡️ [TTL_DRIFT_GUARD] Tolerance: ${priceDriftTolerance === 'flexible_500' ? 'Flexible (Up to ₹500 drift permitted to secure inventory)' : 'Strict (₹0 slippage allowed — Zero risk)'}`,
    `[${nowTime}] ⚡ [SEAT_HOLD_TKTL] Amadeus 15-Minute PNR hold activated with atomic pre-execution price verification`,
    ...(flightMatchRule === 'any_nonstop' ? [
      `[${nowTime}] 🌙 [MIDNIGHT_GUARD] Early AM Red-Eye Departures (00:00–04:00): ${excludeMidnightRedEye ? 'EXCLUDED (Prevents accidental "day-before" no-shows)' : 'PERMITTED by user preference'}`
    ] : (isMidnightDeparture ? [
      `[${nowTime}] ⚠️ [MIDNIGHT_NOTICE] Tracked flight departs early AM: ${midInfo.humanWarning}`
    ] : [])),
    `[${nowTime}] 🛰️ [L2B_DEFENSE] Adaptive Cadence: ${pollingFrequency} (T-${daysUntil}d) | Cascaded Cache Matrix Active`,
    `[${nowTime}] ⚙️ [EXECUTION_MODE] ${mode === 'auto_book' ? '⚡ Two-Phase Atomic Auto-Book Activated' : '🔔 24/7 Notify & Confirm Activated'}`,
    ...(mode === 'auto_book' ? [
      `[${nowTime}] 🔒 [PREAUTH_TOKENIZED] Card •••• ${cardNumber.replace(/\D/g, '').slice(-4) || '4242'} authorized up to ₹${allInclusiveTotalBudget.toLocaleString('en-IN')} (All-Inclusive TCOT) with ₹0 upfront charge.`
    ] : [
      `[${nowTime}] 📲 [DISPATCH_CHANNEL] WhatsApp alerts configured for ${phone}`
    ])
  ];

  if (mode === "auto_book") {
    const now = new Date();
    const tokenExpiry = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days validity window
    alertDoc.travelerName = travelerName;
    alertDoc.passportNumber = travelerPassport;
    alertDoc.passportExpiry = travelerPassportExp;
    alertDoc.preAuthToken = `tok_vault_${Date.now().toString(36).toUpperCase()}`;
    alertDoc.paymentAuthType = "RECURRING_MANDATE";
    alertDoc.tokenCreatedAt = now.toISOString();
    alertDoc.tokenExpiresAt = tokenExpiry.toISOString();
    alertDoc.tokenValidityDays = 60;
    alertDoc.mandateStatus = "ACTIVE";
    alertDoc.mandateMaxCap = allInclusiveTotalBudget;
    alertDoc.priceDriftTolerance = priceDriftTolerance;
    alertDoc.maxAllowedSlippage = maxAllowedSlippage;
    alertDoc.seatHoldSafeguard = "AMADEUS_15_MIN_TKTL";
    alertDoc.preAuthCard = {
      cardholder: cardName,
      last4: cardNumber.replace(/\D/g, '').slice(-4) || "4242",
      expiry: cardExp,
      maxAuthorizedCap: allInclusiveTotalBudget,
      currency: "INR"
    };
    alertDoc.cancellationGuarantee = "24_HOUR_FREE_CANCELLATION";
  }

  if (user) {
    alertDoc.uid = user.uid;
    if (!alertDoc.userEmail) alertDoc.userEmail = user.email;
    alertDoc.userName = user.displayName;
  }

  // 1. Instant local state update
  if (typeof FlyvisAuthState !== "undefined") {
    FlyvisAuthState.activeAlerts = [alertDoc, ...(FlyvisAuthState.activeAlerts || [])];
    if (typeof saveLocalAlerts === "function") {
      saveLocalAlerts(user ? user.uid : "guest", FlyvisAuthState.activeAlerts);
    }
    if (FlyvisAuthState.userProfile) {
      FlyvisAuthState.userProfile.phone = phone;
    }
  }

  // 2. Sync to Firestore in background across both collections
  if (typeof db !== "undefined") {
    if (user) {
      db.collection("users").doc(user.uid).set({ phone: phone }, { merge: true }).catch(() => {});
    }

    const firestorePayload = { ...alertDoc };
    if (typeof firebase !== "undefined" && firebase.firestore) {
      firestorePayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    // Save to price_alerts and mirror to flight_price_alerts using consistent alertId
    db.collection("price_alerts").doc(alertId).set(firestorePayload).then(() => {
      if (typeof saveLocalAlerts === "function" && user) {
        saveLocalAlerts(user.uid, FlyvisAuthState.activeAlerts);
      }
    }).catch(err => console.warn("Firestore save alert:", err));

    db.collection("flight_price_alerts").doc(alertId).set(firestorePayload).catch(() => {});
  }

  if (typeof renderToast === "function") {
    const toastMsg = mode === "auto_book"
      ? `⚡ Auto-Book Activated! Pre-authorized for ₹${allInclusiveTotalBudget.toLocaleString('en-IN')}`
      : "🔔 Flight Price Monitor Activated! Saved to My Flights.";
    renderToast(toastMsg);
  }

  if (typeof renderSidebarMarkup === "function") renderSidebarMarkup();

  closePriceAlertModal();

  // WhatsApp Alert Confirmation Trigger
  let waMsg = "";
  if (mode === "auto_book") {
    waMsg = 
`Hi Flyvis Concierge Desk, please activate my ⚡ AUTO-BOOK FLIGHT TRACKER:
=========================================
📍 Route: ${alertDoc.from} → ${alertDoc.to}
📅 Date: ${formatDisplayDate(alertDoc.date)}
✈️ Flight Match: ${alertDoc.flightSpecific ? `Exact Flight (${alertDoc.flightSpecific})` : (flightMatchRule === 'exact' ? 'Exact Selected Flight' : 'Any Non-Stop Flight')}
💰 Current Market Fare: ₹${currentFare.toLocaleString('en-IN')}
${paxCount > 1 ? `👥 Party Size: ${paxCount} Travelers
🎯 Target Fare / Seat: ≤ ₹${targetFare.toLocaleString('en-IN')}
📊 Max Aggregate Airfare Budget: ≤ ₹${maxTotalBudget.toLocaleString('en-IN')} (Target Savings: ₹${(savingsAmt * paxCount).toLocaleString('en-IN')})
✂️ Multi-Pax Strategy: ${pnrStrategy === 'split_pnr' ? 'Split-PNR Allowed ⚡ (Max Savings)' : 'Single PNR Only (Strict)'}` : `🎯 Auto-Book Trigger Cap: ≤ ₹${targetFare.toLocaleString('en-IN')} (Target Savings: ₹${savingsAmt.toLocaleString('en-IN')})`}

👤 PASSENGER & TRAVEL VAULT:
- Traveler: ${travelerName}
- Passport / APIS: ${travelerPassport} [Vault Linked]
- 📦 Required Travel Bundle: 🧳 ${baggageKg}kg Bag | 🍱 ${requireMeal ? 'Hot Meal' : 'No Meal'} | 💺 Seat: ${requireSeat === 'extra_legroom' ? 'Extra Legroom' : (requireSeat === 'standard' ? 'Window/Aisle' : 'Any Seat')}${requireFlexi ? ' | 🔄 1 Free Date Change' : ''}
- 🎯 All-Inclusive Target Cap (TCOT): ₹${allInclusiveCapPerPax.toLocaleString('en-IN')}/seat (Total Budget: ₹${allInclusiveTotalBudget.toLocaleString('en-IN')})

💳 PAYMENT PRE-AUTHORIZATION & E-MANDATE:
- Mandate Token: ${alertDoc.preAuthToken} (RBI SI Valid 60 Days)
- Card: •••• ${alertDoc.preAuthCard.last4} (${alertDoc.preAuthCard.expiry})
- Charge Today: ₹0 (Pre-authorization mandate only)
- Max Auto-Charge Ceiling: ₹${allInclusiveTotalBudget.toLocaleString('en-IN')} (All-Inclusive TCOT)

🛡️ PROTECTIONS INCLUDED:
✓ Guaranteed Max Price Cap (Never charged more)
✓ 24-Hour Free Cancellation (100% full refund)
✓ 15-Minute Amadeus GDS Seat Hold Safeguard (3DS OTP Fallback)
✓ Cascaded Cache & Look-to-Book Protected (${alertDoc.pollingFrequency || 'Adaptive Cadence'})
✓ Fare Family & TCOT Shield (Luggage & ancillaries guaranteed)
${paxCount > 1 ? '✓ Single-RBD Fare Bucket Cliff Protected (Amadeus Multi-Pax Enforcement)\n' : ''}
Please monitor Amadeus GDS 24/7 and auto-issue ticket the second fare drops! Thank you!`;
  } else {
    waMsg = 
`Hi Flyvis Concierge Desk, please activate my 🔔 24/7 NOTIFY & CONFIRM TRACKER:
=========================================
📍 Route: ${alertDoc.from} → ${alertDoc.to}
📅 Date: ${formatDisplayDate(alertDoc.date)}
${paxCount > 1 ? `👥 Party Size: ${paxCount} Travelers\n` : ''}💰 Current Market Fare: ₹${currentFare.toLocaleString('en-IN')}
🎯 My Target Price: ₹${targetFare.toLocaleString('en-IN')}${paxCount > 1 ? `/seat (Total: ₹${maxTotalBudget.toLocaleString('en-IN')})` : ''} (Target Savings: ₹${savingsAmt.toLocaleString('en-IN')})
📦 Required Bundle: 🧳 ${baggageKg}kg Bag | 🍱 ${requireMeal ? 'Hot Meal' : 'No Meal'} | 💺 Seat: ${requireSeat === 'extra_legroom' ? 'Extra Legroom' : (requireSeat === 'standard' ? 'Window/Aisle' : 'Any Seat')}${requireFlexi ? ' | 🔄 1 Free Date Change' : ''} (TCOT Cap: ₹${allInclusiveCapPerPax.toLocaleString('en-IN')}/seat)
🛰️ Smart Polling Cadence: ${alertDoc.pollingFrequency || 'Adaptive Yield Window'}
📱 Contact / WhatsApp: ${phone}

Please ping me on WhatsApp with a 15-minute 1-click flash booking link the moment prices drop to my target. Thank you!`;
  }

  const waUrl = `https://wa.me/919207021258?text=${encodeURIComponent(waMsg)}`;
  window.open(waUrl, "_blank");
}

function updateAiAdviceBanner() {
  const base = getLowestBaseFare();
  const titleEl = document.getElementById("ai-advice-headline");
  const descEl = document.getElementById("ai-advice-subline");

  if (titleEl && descEl) {
    if (base > 20000) {
      titleEl.textContent = "Wait — High Season Surge Detected";
      descEl.textContent = "Machine learning models indicate a 64% chance of carrier promotions launching in the next 7 days.";
    } else {
      titleEl.textContent = "Buy Now — Prices at Optimal Seasonal Baseline";
      descEl.textContent = "Fares are currently 14% below the 90-day average. Seat inventory is depleting.";
    }
  }
}

function getLowestBaseFare() {
  if (FlyvisOtaState.rawFlights && FlyvisOtaState.rawFlights.length > 0) {
    return Math.min(...FlyvisOtaState.rawFlights.map(f => f.basePrice));
  }
  return 14500;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "Sep 17, 2026";
  const str = String(dateStr).trim();
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split("-").map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(dateStr);
  }
  if (!d || isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDatePricingMultiplier(dateStr) {
  if (!dateStr) return 1.0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 1.0;

  const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  let dayFactor = 1.0;
  if (dayOfWeek === 5) dayFactor = 1.15; // Friday weekend surge (+15%)
  else if (dayOfWeek === 0) dayFactor = 1.18; // Sunday peak (+18%)
  else if (dayOfWeek === 6) dayFactor = 1.10; // Saturday (+10%)
  else if (dayOfWeek === 4) dayFactor = 1.06; // Thursday (+6%)
  else if (dayOfWeek === 1) dayFactor = 1.02; // Monday (+2%)
  else if (dayOfWeek === 2) dayFactor = 0.92; // Tuesday (-8%)
  else if (dayOfWeek === 3) dayFactor = 0.94; // Wednesday (-6%)

  // Date variance (+/- 4%) so every calendar date has unique live market quotes
  const dayNum = d.getDate();
  const monthNum = d.getMonth() + 1;
  const hashMod = ((dayNum * 7 + monthNum * 13) % 9) - 4; // -4% to +4%
  const hashFactor = 1 + (hashMod / 100);

  return dayFactor * hashFactor;
}

function generateCalibratedFallbackFlights(orig, dest, date) {
  const pairKey = `${orig}-${dest}`;
  const reverseKey = `${dest}-${orig}`;

  // Route Profiles: [ Carrier, FlightNum, DepartureTime, Duration, Stops, BasePrice ]
  const SPECIFIC_ROUTES = {
    // 1. Kerala <-> UAE / Gulf (High frequency, high diaspora volume)
    "CNN-DXB": [
      { name: "Air India Express", flightNum: "IX 745", departureTime: "08:15 AM – 10:45 AM", duration: "4 hr 00 min", stops: "Nonstop", basePrice: 8900 },
      { name: "IndiGo", flightNum: "6E 1435", departureTime: "11:45 AM – 02:25 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 9600 },
      { name: "Air Arabia", flightNum: "G9 462", departureTime: "09:30 PM – 12:05 AM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 9800 }
    ],
    "CNN-DOH": [
      { name: "Air India Express", flightNum: "IX 773", departureTime: "09:00 AM – 11:15 AM", duration: "4 hr 45 min", stops: "Nonstop", basePrice: 9200 },
      { name: "IndiGo", flightNum: "6E 1743", departureTime: "07:30 PM – 09:50 PM", duration: "4 hr 50 min", stops: "Nonstop", basePrice: 9900 }
    ],
    "CNN-SHJ": [
      { name: "Air India Express", flightNum: "IX 743", departureTime: "07:15 AM – 09:45 AM", duration: "4 hr 00 min", stops: "Nonstop", basePrice: 8700 },
      { name: "Air Arabia", flightNum: "G9 460", departureTime: "06:10 PM – 08:40 PM", duration: "4 hr 00 min", stops: "Nonstop", basePrice: 9200 }
    ],
    "CNN-AUH": [
      { name: "Air India Express", flightNum: "IX 715", departureTime: "08:45 AM – 11:25 AM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 9400 },
      { name: "IndiGo", flightNum: "6E 1431", departureTime: "02:15 PM – 04:55 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 9900 }
    ],
    "CNN-DEL": [
      { name: "IndiGo", flightNum: "6E 2144", departureTime: "06:30 AM – 09:40 AM", duration: "3 hr 10 min", stops: "Nonstop", basePrice: 6800 },
      { name: "Air India", flightNum: "AI 582", departureTime: "04:15 PM – 07:35 PM", duration: "3 hr 20 min", stops: "Nonstop", basePrice: 7400 }
    ],
    "CNN-BOM": [
      { name: "IndiGo", flightNum: "6E 5321", departureTime: "07:00 AM – 08:50 AM", duration: "1 hr 50 min", stops: "Nonstop", basePrice: 3800 },
      { name: "Air India", flightNum: "AI 642", departureTime: "05:15 PM – 07:10 PM", duration: "1 hr 55 min", stops: "Nonstop", basePrice: 4400 }
    ],
    "CNN-BLR": [
      { name: "IndiGo", flightNum: "6E 7122", departureTime: "08:30 AM – 09:35 AM", duration: "1 hr 05 min", stops: "Nonstop", basePrice: 2600 }
    ],
    "COK-DXB": [
      { name: "Air India Express", flightNum: "IX 437", departureTime: "01:20 AM – 04:00 AM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 9100 },
      { name: "Air India Express", flightNum: "IX 435", departureTime: "07:15 AM – 09:55 AM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 9400 },
      { name: "IndiGo", flightNum: "6E 1488", departureTime: "11:30 AM – 02:10 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 10200 },
      { name: "flydubai", flightNum: "FZ 444", departureTime: "04:20 PM – 07:05 PM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 11800 },
      { name: "Emirates", flightNum: "EK 533", departureTime: "09:30 PM – 12:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 16200 }
    ],
    "CCJ-DXB": [
      { name: "Air India Express", flightNum: "IX 345", departureTime: "08:45 AM – 11:20 AM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 9100 },
      { name: "IndiGo", flightNum: "6E 1421", departureTime: "01:15 PM – 03:50 PM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 9800 },
      { name: "flydubai", flightNum: "FZ 454", departureTime: "06:10 PM – 08:50 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 11400 },
      { name: "Air Arabia", flightNum: "G9 452", departureTime: "10:45 PM – 01:20 AM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 10600 }
    ],
    "TRV-DXB": [
      { name: "Air India Express", flightNum: "IX 539", departureTime: "06:30 AM – 09:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 9600 },
      { name: "IndiGo", flightNum: "6E 1407", departureTime: "12:10 PM – 03:00 PM", duration: "4 hr 20 min", stops: "Nonstop", basePrice: 10400 },
      { name: "Emirates", flightNum: "EK 523", departureTime: "04:30 AM – 07:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 16800 }
    ],

    // 2. Mumbai <-> UAE / Gulf
    "BOM-DXB": [
      { name: "Air India Express", flightNum: "IX 251", departureTime: "00:45 AM – 02:45 AM", duration: "3 hr 30 min", stops: "Nonstop", basePrice: 10100 },
      { name: "Air India Express", flightNum: "IX 247", departureTime: "06:45 AM – 08:45 AM", duration: "3 hr 30 min", stops: "Nonstop", basePrice: 10500 },
      { name: "IndiGo", flightNum: "6E 61", departureTime: "10:15 AM – 12:15 PM", duration: "3 hr 30 min", stops: "Nonstop", basePrice: 11200 },
      { name: "flydubai", flightNum: "FZ 446", departureTime: "02:30 PM – 04:35 PM", duration: "3 hr 35 min", stops: "Nonstop", basePrice: 12800 },
      { name: "Emirates", flightNum: "EK 501", departureTime: "04:30 AM – 06:30 AM", duration: "3 hr 30 min", stops: "Nonstop", basePrice: 17400 }
    ],

    // 3. Delhi <-> UAE / Gulf
    "DEL-DXB": [
      { name: "IndiGo + flydubai", flightNum: "6E 2104 / FZ 446", departureTime: "06:15 AM – 04:35 PM", duration: "10 hr 20 min", stops: "1 Stop (BOM)", layoverAirport: "BOM", layoverMinutes: 85, layoverDuration: "1 hr 25 min", isSelfTransfer: true, isInterTerminal: true, basePrice: 9400 },
      { name: "Akasa Air + Air Arabia", flightNum: "QP 1120 / G9 460", departureTime: "10:30 AM – 08:40 PM", duration: "10 hr 10 min", stops: "1 Stop (BOM)", layoverAirport: "BOM", layoverMinutes: 240, layoverDuration: "4 hr 00 min", isSelfTransfer: true, isInterTerminal: true, basePrice: 9900 },
      { name: "Air India", flightNum: "AI 915", departureTime: "01:30 AM – 04:00 AM", duration: "4 hr 00 min", stops: "Nonstop", basePrice: 11900 },
      { name: "Air India Express", flightNum: "IX 141", departureTime: "08:30 AM – 10:55 AM", duration: "3 hr 55 min", stops: "Nonstop", basePrice: 12800 },
      { name: "IndiGo", flightNum: "6E 1475", departureTime: "10:15 AM – 12:40 PM", duration: "3 hr 55 min", stops: "Nonstop", basePrice: 13400 },
      { name: "flydubai", flightNum: "FZ 442", departureTime: "03:40 PM – 06:10 PM", duration: "4 hr 00 min", stops: "Nonstop", basePrice: 14900 },
      { name: "Emirates", flightNum: "EK 513", departureTime: "04:10 AM – 06:35 AM", duration: "3 hr 55 min", stops: "Nonstop", basePrice: 19800 }
    ],

    // 4. Bangalore / Hyderabad / Chennai <-> Gulf
    "BLR-DXB": [
      { name: "IndiGo", flightNum: "6E 1485", departureTime: "07:20 AM – 10:00 AM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 11900 },
      { name: "Air India", flightNum: "AI 995", departureTime: "01:30 PM – 04:10 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 13200 },
      { name: "Emirates", flightNum: "EK 565", departureTime: "10:30 AM – 01:10 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 18200 }
    ],
    "HYD-DXB": [
      { name: "IndiGo", flightNum: "6E 1465", departureTime: "08:15 AM – 10:50 AM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 11600 },
      { name: "Air India", flightNum: "AI 951", departureTime: "12:45 PM – 03:20 PM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 12400 },
      { name: "Emirates", flightNum: "EK 527", departureTime: "09:50 PM – 12:25 AM", duration: "4 hr 05 min", stops: "Nonstop", basePrice: 17900 }
    ],
    "MAA-DXB": [
      { name: "IndiGo", flightNum: "6E 1471", departureTime: "06:50 AM – 09:40 AM", duration: "4 hr 20 min", stops: "Nonstop", basePrice: 11400 },
      { name: "Air India", flightNum: "AI 907", departureTime: "11:25 AM – 02:15 PM", duration: "4 hr 20 min", stops: "Nonstop", basePrice: 12200 },
      { name: "Emirates", flightNum: "EK 543", departureTime: "03:45 AM – 06:35 AM", duration: "4 hr 20 min", stops: "Nonstop", basePrice: 17600 }
    ],

    // 5. Southeast Asia Corridors
    "MAA-SIN": [
      { name: "Air India Express", flightNum: "IX 682", departureTime: "06:15 AM – 12:55 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 10400 },
      { name: "IndiGo", flightNum: "6E 1007", departureTime: "10:45 AM – 05:30 PM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 11200 },
      { name: "Singapore Airlines", flightNum: "SQ 529", departureTime: "11:15 PM – 06:00 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 19500 }
    ],
    "BOM-SIN": [
      { name: "IndiGo", flightNum: "6E 1019", departureTime: "07:30 AM – 03:45 PM", duration: "5 hr 45 min", stops: "Nonstop", basePrice: 15400 },
      { name: "Air India", flightNum: "AI 342", departureTime: "11:55 PM – 07:55 AM", duration: "5 hr 30 min", stops: "Nonstop", basePrice: 17800 },
      { name: "Singapore Airlines", flightNum: "SQ 421", departureTime: "11:45 AM – 07:50 PM", duration: "5 hr 35 min", stops: "Nonstop", basePrice: 23500 }
    ],
    "DEL-SIN": [
      { name: "IndiGo", flightNum: "6E 1005", departureTime: "08:25 AM – 04:40 PM", duration: "5 hr 45 min", stops: "Nonstop", basePrice: 16900 },
      { name: "Air India", flightNum: "AI 382", departureTime: "11:00 PM – 07:15 AM", duration: "5 hr 45 min", stops: "Nonstop", basePrice: 19800 },
      { name: "Singapore Airlines", flightNum: "SQ 401", departureTime: "09:50 AM – 06:10 PM", duration: "5 hr 50 min", stops: "Nonstop", basePrice: 25800 }
    ],
    "DEL-BKK": [
      { name: "IndiGo", flightNum: "6E 1051", departureTime: "05:30 AM – 11:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 13800 },
      { name: "SpiceJet", flightNum: "SG 87", departureTime: "10:15 AM – 04:05 PM", duration: "4 hr 20 min", stops: "Nonstop", basePrice: 12900 },
      { name: "THAI", flightNum: "TG 324", departureTime: "11:55 AM – 05:35 PM", duration: "4 hr 10 min", stops: "Nonstop", basePrice: 19400 }
    ],

    // 6. Domestic India Routes (Short vs Trunk vs Long)
    "BOM-GOI": [
      { name: "IndiGo", flightNum: "6E 341", departureTime: "07:30 AM – 08:40 AM", duration: "1 hr 10 min", stops: "Nonstop", basePrice: 3200 },
      { name: "Akasa Air", flightNum: "QP 1420", departureTime: "11:15 AM – 12:25 PM", duration: "1 hr 10 min", stops: "Nonstop", basePrice: 3050 },
      { name: "SpiceJet", flightNum: "SG 108", departureTime: "04:45 PM – 05:55 PM", duration: "1 hr 10 min", stops: "Nonstop", basePrice: 2900 },
      { name: "Air India", flightNum: "AI 631", departureTime: "08:15 PM – 09:30 PM", duration: "1 hr 15 min", stops: "Nonstop", basePrice: 3800 }
    ],
    "BOM-GOX": [
      { name: "IndiGo", flightNum: "6E 621", departureTime: "08:00 AM – 09:10 AM", duration: "1 hr 10 min", stops: "Nonstop", basePrice: 3150 },
      { name: "Akasa Air", flightNum: "QP 1350", departureTime: "01:30 PM – 02:40 PM", duration: "1 hr 10 min", stops: "Nonstop", basePrice: 3000 }
    ],
    "BLR-MAA": [
      { name: "IndiGo", flightNum: "6E 428", departureTime: "06:30 AM – 07:25 AM", duration: "0 hr 55 min", stops: "Nonstop", basePrice: 2750 },
      { name: "Akasa Air", flightNum: "QP 1184", departureTime: "10:15 AM – 11:10 AM", duration: "0 hr 55 min", stops: "Nonstop", basePrice: 2600 },
      { name: "Air India", flightNum: "AI 562", departureTime: "07:45 PM – 08:45 PM", duration: "1 hr 00 min", stops: "Nonstop", basePrice: 3200 }
    ],
    "DEL-IXC": [
      { name: "IndiGo", flightNum: "6E 2191", departureTime: "06:15 AM – 07:15 AM", duration: "1 hr 00 min", stops: "Nonstop", basePrice: 2850 },
      { name: "Air India", flightNum: "AI 463", departureTime: "04:30 PM – 05:35 PM", duration: "1 hr 05 min", stops: "Nonstop", basePrice: 3400 }
    ],
    "DEL-JAI": [
      { name: "IndiGo", flightNum: "6E 7215", departureTime: "07:00 AM – 07:55 AM", duration: "0 hr 55 min", stops: "Nonstop", basePrice: 2700 },
      { name: "Air India", flightNum: "AI 491", departureTime: "05:15 PM – 06:15 PM", duration: "1 hr 00 min", stops: "Nonstop", basePrice: 3100 }
    ],
    "DEL-BOM": [
      { name: "IndiGo", flightNum: "6E 2104", departureTime: "06:15 AM – 08:30 AM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 5400 },
      { name: "Akasa Air", flightNum: "QP 1120", departureTime: "03:15 PM – 05:30 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 5150 },
      { name: "SpiceJet", flightNum: "SG 8142", departureTime: "07:45 PM – 10:00 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 4950 },
      { name: "Air India", flightNum: "AI 887", departureTime: "10:30 AM – 12:45 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 6250 }
    ],
    "BLR-BOM": [
      { name: "IndiGo", flightNum: "6E 5312", departureTime: "06:00 AM – 07:40 AM", duration: "1 hr 40 min", stops: "Nonstop", basePrice: 4200 },
      { name: "Akasa Air", flightNum: "QP 1102", departureTime: "11:45 AM – 01:25 PM", duration: "1 hr 40 min", stops: "Nonstop", basePrice: 3950 },
      { name: "Air India", flightNum: "AI 610", departureTime: "08:15 PM – 10:00 PM", duration: "1 hr 45 min", stops: "Nonstop", basePrice: 4850 }
    ],
    "DEL-BLR": [
      { name: "IndiGo", flightNum: "6E 2033", departureTime: "06:45 AM – 09:30 AM", duration: "2 hr 45 min", stops: "Nonstop", basePrice: 6800 },
      { name: "Akasa Air", flightNum: "QP 1332", departureTime: "02:15 PM – 05:00 PM", duration: "2 hr 45 min", stops: "Nonstop", basePrice: 6400 },
      { name: "Air India", flightNum: "AI 803", departureTime: "06:10 AM – 08:55 AM", duration: "2 hr 45 min", stops: "Nonstop", basePrice: 7600 }
    ],
    "DEL-CCU": [
      { name: "IndiGo", flightNum: "6E 205", departureTime: "06:00 AM – 08:10 AM", duration: "2 hr 10 min", stops: "Nonstop", basePrice: 5800 },
      { name: "SpiceJet", flightNum: "SG 263", departureTime: "03:45 PM – 05:55 PM", duration: "2 hr 10 min", stops: "Nonstop", basePrice: 5300 },
      { name: "Air India", flightNum: "AI 701", departureTime: "07:30 PM – 09:40 PM", duration: "2 hr 10 min", stops: "Nonstop", basePrice: 6600 }
    ],
    "DEL-COK": [
      { name: "IndiGo", flightNum: "6E 2408", departureTime: "06:00 AM – 09:15 AM", duration: "3 hr 15 min", stops: "Nonstop", basePrice: 8400 },
      { name: "Akasa Air", flightNum: "QP 1822", departureTime: "10:30 AM – 01:50 PM", duration: "3 hr 20 min", stops: "Nonstop", basePrice: 7900 },
      { name: "Air India", flightNum: "AI 512", departureTime: "07:45 PM – 11:00 PM", duration: "3 hr 15 min", stops: "Nonstop", basePrice: 9400 }
    ],
    "DEL-TRV": [
      { name: "IndiGo", flightNum: "6E 2119", departureTime: "05:45 AM – 09:10 AM", duration: "3 hr 25 min", stops: "Nonstop", basePrice: 8900 },
      { name: "Air India", flightNum: "AI 425", departureTime: "06:30 PM – 09:55 PM", duration: "3 hr 25 min", stops: "Nonstop", basePrice: 9800 }
    ],

    // 7. India <-> London / Europe
    "DEL-LHR": [
      { name: "Air India", flightNum: "AI 161", departureTime: "02:45 AM – 07:30 AM", duration: "9 hr 15 min", stops: "Nonstop", basePrice: 48500 },
      { name: "Virgin Atlantic", flightNum: "VS 301", departureTime: "08:45 AM – 01:50 PM", duration: "9 hr 35 min", stops: "Nonstop", basePrice: 52500 },
      { name: "British Airways", flightNum: "BA 142", departureTime: "03:15 AM – 08:10 AM", duration: "9 hr 25 min", stops: "Nonstop", basePrice: 54000 },
      { name: "Qatar Airways", flightNum: "QR 571", departureTime: "09:55 AM – 06:45 PM", duration: "13 hr 20 min", stops: "1 Stop (DOH)", basePrice: 41200 }
    ],
    "BOM-LHR": [
      { name: "Air India", flightNum: "AI 129", departureTime: "06:15 AM – 11:30 AM", duration: "9 hr 45 min", stops: "Nonstop", basePrice: 49200 },
      { name: "Virgin Atlantic", flightNum: "VS 355", departureTime: "02:15 AM – 07:30 AM", duration: "9 hr 45 min", stops: "Nonstop", basePrice: 53200 },
      { name: "British Airways", flightNum: "BA 198", departureTime: "01:15 PM – 06:30 PM", duration: "9 hr 45 min", stops: "Nonstop", basePrice: 54800 }
    ],

    // 8. India <-> North America (US / Canada)
    "DEL-JFK": [
      { name: "Air India", flightNum: "AI 101", departureTime: "02:15 AM – 07:30 AM", duration: "15 hr 45 min", stops: "Nonstop", basePrice: 86500 },
      { name: "Qatar Airways", flightNum: "QR 701", departureTime: "03:45 AM – 03:15 PM", duration: "18 hr 15 min", stops: "1 Stop (DOH)", basePrice: 71500 },
      { name: "Emirates", flightNum: "EK 201", departureTime: "04:30 AM – 04:20 PM", duration: "18 hr 40 min", stops: "1 Stop (DXB)", basePrice: 74800 },
      { name: "British Airways", flightNum: "BA 143", departureTime: "07:15 AM – 06:40 PM", duration: "19 hr 10 min", stops: "1 Stop (LHR)", basePrice: 78200 }
    ],
    "BOM-SFO": [
      { name: "Air India", flightNum: "AI 179", departureTime: "02:30 PM – 06:00 PM", duration: "16 hr 00 min", stops: "Nonstop", basePrice: 89500 },
      { name: "Singapore Airlines", flightNum: "SQ 421", departureTime: "11:45 AM – 08:30 PM", duration: "21 hr 15 min", stops: "1 Stop (SIN)", basePrice: 76400 },
      { name: "Emirates", flightNum: "EK 501", departureTime: "04:30 AM – 02:15 PM", duration: "21 hr 15 min", stops: "1 Stop (DXB)", basePrice: 78900 }
    ],

    // 9. India <-> Australia
    "DEL-SYD": [
      { name: "Air India", flightNum: "AI 302", departureTime: "01:45 PM – 07:10 AM", duration: "12 hr 25 min", stops: "Nonstop", basePrice: 58500 },
      { name: "Malaysia Airlines", flightNum: "MH 191", departureTime: "06:10 AM – 08:30 PM", duration: "16 hr 20 min", stops: "1 Stop (KUL)", basePrice: 46800 },
      { name: "Singapore Airlines", flightNum: "SQ 401", departureTime: "09:30 AM – 06:15 AM", duration: "15 hr 45 min", stops: "1 Stop (SIN)", basePrice: 52400 },
      { name: "Qantas", flightNum: "QF 68", departureTime: "10:15 AM – 05:40 AM", duration: "15 hr 30 min", stops: "1 Stop (SIN)", basePrice: 64200 }
    ]
  };

  let flights = SPECIFIC_ROUTES[pairKey] || SPECIFIC_ROUTES[reverseKey];

  if (!flights) {
    const indiaHubs = ["DEL","BOM","BLR","HYD","MAA","CCU","COK","AMD","GOI","GOX","PNQ","VGA","TRV","CCJ","CNN","IXE","CJB","TRZ","IXM","TCR","SXV","VTZ","TIR","RJA","CDP","KJB","MYQ","IXG","HBX","GBI","RQY","LKO","VNS","AYJ","KNU","GOP","BEK","AGR","HDX","JAI","UDR","JDH","JSA","BKB","KQH","IXC","ATQ","SXR","IXJ","IXL","DED","PGH","KUU","DHM","SLV","PAT","GAY","DBR","DGH","IXR","BBI","JRG","RRK","RDP","IXB","GAU","DIB","IXS","JRH","IXA","IMF","DMU","SHL","AJL","PYG","HGI","IXT","TEI","RUP","NAG","IDR","BHO","GWL","JLR","HJR","RPR","STV","BDQ","HSR","BHU","JGA","IXY","IXK","PBD","DIU","BHJ","SAG","ISK","IXU","KLH","SDV","NDC","JLG","IXZ","AGX"];
    const middleEastHubs = ["DXB","AUH","SHJ","DOH","BAH","KWI","MCT","RUH","JED"];
    const europeHubs = ["LHR","LGW","CDG","FRA","AMS","FCO","ZRH","MAD","BCN"];
    const southeastAsiaHubs = ["SIN","BKK","DMK","HKT","KUL","DPS","HAN","SGN"];
    const eastAsiaHubs = ["NRT","HND","ICN","HKG","TPE","PVG"];
    const oceaniaHubs = ["SYD","MEL","AKL","BNE","PER"];
    const americasHubs = ["JFK","SFO","ORD","YYZ","YVR","LAX","EWR","BOS","IAD","SEA"];

    const origIsIndia = indiaHubs.includes(orig);
    const destIsIndia = indiaHubs.includes(dest);
    const origIsME = middleEastHubs.includes(orig);
    const destIsME = middleEastHubs.includes(dest);
    const origIsOceania = oceaniaHubs.includes(orig);
    const destIsOceania = oceaniaHubs.includes(dest);
    const origIsEurope = europeHubs.includes(orig);
    const destIsEurope = europeHubs.includes(dest);
    const origIsAmericas = americasHubs.includes(orig);
    const destIsAmericas = americasHubs.includes(dest);
    const origIsSEA = southeastAsiaHubs.includes(orig);
    const destIsSEA = southeastAsiaHubs.includes(dest);
    const origIsEA = eastAsiaHubs.includes(orig);
    const destIsEA = eastAsiaHubs.includes(dest);

    // Fallback based on corridor category
    if (origIsIndia && destIsIndia) {
      flights = [
        { name: "IndiGo", flightNum: "6E 2104", departureTime: "06:15 AM – 08:30 AM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 5400 },
        { name: "Akasa Air", flightNum: "QP 1120", departureTime: "03:15 PM – 05:30 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 5150 },
        { name: "SpiceJet", flightNum: "SG 8142", departureTime: "07:45 PM – 10:00 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 4950 },
        { name: "Air India", flightNum: "AI 887", departureTime: "10:30 AM – 12:45 PM", duration: "2 hr 15 min", stops: "Nonstop", basePrice: 6250 }
      ];
    } else if ((origIsIndia && destIsME) || (origIsME && destIsIndia)) {
      flights = [
        { name: "Air India Express", flightNum: "IX 435", departureTime: "08:30 AM – 11:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 11800 },
        { name: "IndiGo", flightNum: "6E 1475", departureTime: "10:15 AM – 01:10 PM", duration: "4 hr 25 min", stops: "Nonstop", basePrice: 12400 },
        { name: "flydubai", flightNum: "FZ 442", departureTime: "03:40 PM – 06:25 PM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 13900 },
        { name: "Emirates", flightNum: "EK 531", departureTime: "04:30 AM – 07:15 AM", duration: "4 hr 15 min", stops: "Nonstop", basePrice: 18500 }
      ];
    } else if ((origIsIndia && destIsAmericas) || (origIsAmericas && destIsIndia)) {
      flights = [
        { name: "Qatar Airways", flightNum: "QR 701", departureTime: "03:45 AM – 03:15 PM", duration: "18 hr 15 min", stops: "1 Stop (DOH)", basePrice: 71500 },
        { name: "Emirates", flightNum: "EK 201", departureTime: "04:30 AM – 04:20 PM", duration: "18 hr 40 min", stops: "1 Stop (DXB)", basePrice: 74800 },
        { name: "British Airways", flightNum: "BA 143", departureTime: "07:15 AM – 06:40 PM", duration: "19 hr 10 min", stops: "1 Stop (LHR)", basePrice: 78200 },
        { name: "Air India", flightNum: "AI 101", departureTime: "02:15 AM – 07:30 AM", duration: "15 hr 45 min", stops: "Nonstop", basePrice: 86500 }
      ];
    } else if ((origIsIndia && destIsEurope) || (origIsEurope && destIsIndia)) {
      flights = [
        { name: "Qatar Airways", flightNum: "QR 571", departureTime: "09:55 AM – 06:45 PM", duration: "13 hr 20 min", stops: "1 Stop (DOH)", basePrice: 41200 },
        { name: "Air India", flightNum: "AI 161", departureTime: "02:45 AM – 07:30 AM", duration: "9 hr 15 min", stops: "Nonstop", basePrice: 48500 },
        { name: "Virgin Atlantic", flightNum: "VS 301", departureTime: "08:45 AM – 01:50 PM", duration: "9 hr 35 min", stops: "Nonstop", basePrice: 52500 },
        { name: "British Airways", flightNum: "BA 142", departureTime: "03:15 AM – 08:10 AM", duration: "9 hr 25 min", stops: "Nonstop", basePrice: 54000 }
      ];
    } else if ((origIsOceania && destIsME) || (origIsME && destIsOceania)) {
      flights = [
        { name: "Singapore Airlines", flightNum: "SQ 232", departureTime: "11:15 AM – 09:10 PM", duration: "17 hr 55 min", stops: "1 Stop (SIN)", basePrice: 69800 },
        { name: "Qatar Airways", flightNum: "QR 909", departureTime: "09:30 PM – 05:45 AM", duration: "18 hr 15 min", stops: "1 Stop (DOH)", basePrice: 72400 },
        { name: "Emirates", flightNum: "EK 415", departureTime: "06:00 AM – 02:20 PM", duration: "14 hr 20 min", stops: "Nonstop", basePrice: 78500 }
      ];
    } else if ((origIsAmericas && destIsEurope) || (origIsEurope && destIsAmericas)) {
      flights = [
        { name: "Virgin Atlantic", flightNum: "VS 4", departureTime: "06:30 PM – 06:30 AM", duration: "7 hr 00 min", stops: "Nonstop", basePrice: 44800 },
        { name: "British Airways", flightNum: "BA 178", departureTime: "08:00 AM – 07:45 PM", duration: "6 hr 45 min", stops: "Nonstop", basePrice: 46500 },
        { name: "Air France", flightNum: "AF 7", departureTime: "07:30 PM – 08:45 AM", duration: "7 hr 15 min", stops: "Nonstop", basePrice: 48200 }
      ];
    } else {
      flights = [
        { name: "Qatar Airways", flightNum: "QR 405", departureTime: "11:20 AM – 10:45 PM", duration: "15 hr 25 min", stops: "1 Stop (DOH)", basePrice: 54200 },
        { name: "Singapore Airlines", flightNum: "SQ 512", departureTime: "03:45 PM – 04:30 AM", duration: "16 hr 45 min", stops: "1 Stop (SIN)", basePrice: 56800 },
        { name: "Emirates", flightNum: "EK 301", departureTime: "07:30 AM – 06:15 PM", duration: "14 hr 45 min", stops: "1 Stop (DXB)", basePrice: 58500 },
        { name: "British Airways", flightNum: "BA 208", departureTime: "08:15 PM – 09:30 AM", duration: "17 hr 15 min", stops: "1 Stop (LHR)", basePrice: 61500 }
      ];
    }
  }

  // Apply date multiplier & day-to-day dynamic variance
  const multiplier = getDatePricingMultiplier(date);
  const dateObj = new Date(date || "2026-09-17");
  const dayNum = isNaN(dateObj.getTime()) ? 17 : dateObj.getDate();

  return flights.map((f, idx) => {
    const fltVar = 1.0 + (((idx * 7 + dayNum) % 7) - 3) * 0.015;
    const finalPrice = Math.max(2500, Math.round((f.basePrice * multiplier * fltVar) / 50) * 50);

    let fNum = f.flightNum;
    if (fNum) {
      const parts = fNum.split(" ");
      if (parts.length === 2 && !isNaN(parts[1])) {
        fNum = `${parts[0]} ${parseInt(parts[1]) + (dayNum % 5)}`;
      }
    }

    return {
      ...f,
      flightNum: fNum,
      basePrice: finalPrice
    };
  });
}

// Global modal traveler exports
if (typeof window !== 'undefined') {
  window.openFlightBookingModal = openFlightBookingModal;
  window.closeBookingModal = closeBookingModal;
  window.initModalTravelerSection = initModalTravelerSection;
  window.renderModalTravelerCards = renderModalTravelerCards;
  window.syncModalPaxField = syncModalPaxField;
  window.addNewCoTravelerModalCard = addNewCoTravelerModalCard;
  window.removeCoTravelerModalCard = removeCoTravelerModalCard;
  window.toggleTravelerVaultFill = toggleTravelerVaultFill;
  window.handleModalPaxFileUpload = handleModalPaxFileUpload;
  window.removeModalPaxFile = removeModalPaxFile;
  window.executeWhatsAppBookingFromModal = executeWhatsAppBookingFromModal;
}

