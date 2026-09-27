/**
 * Flyvis — Amadeus Seat Map Proxy
 * Firebase Cloud Function: seatmap
 *
 * SIMULATION MODE (default): Generates Amadeus-format seat data seeded by flightId.
 *   Same flightId always returns the same consistent seat layout.
 *
 * LIVE MODE: Set Firebase env var  AMADEUS_LIVE=true  and provide secrets:
 *   firebase functions:secrets:set AMADEUS_CLIENT_ID
 *   firebase functions:secrets:set AMADEUS_CLIENT_SECRET
 *   Then redeploy: firebase deploy --only functions
 *
 * Endpoint: POST /api/seatmap
 * Body: { flightId, airline, flightNum, route }
 * Returns: { decks: [ { deckType, seats: [ { number, availability, characteristics, price } ] } ] }
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch");

const AMADEUS_CLIENT_ID = defineSecret("AMADEUS_CLIENT_ID");
const AMADEUS_CLIENT_SECRET = defineSecret("AMADEUS_CLIENT_SECRET");

// Seat price map by characteristic
const SEAT_PRICES = {
  EXIT_ROW: 850,
  EXTRA_LEGROOM: 850,
  BULKHEAD: 600,
  W: 350,   // Window
  A: 350,   // Aisle
  M: 0,     // Middle
  DEFAULT: 350
};

/**
 * Deterministic pseudo-random number seeded by a string.
 * Same seed → same sequence. Used so the same flight always shows the same seats.
 */
function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function() {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return (h >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Generates a realistic Amadeus-format seat map for a given flight.
 * Aircraft configs:
 *   - Narrow-body (A320 / 737): 3-3 layout, 30 rows
 *   - Wide-body (777 / A380 economy): 3-4-3 or 3-3-3 layout, 40 rows
 */
function generateSimulatedSeatMap(flightId, airline, flightNum) {
  const rand = seededRand(flightId || flightNum || airline || "default");

  // Determine aircraft config from airline / flight characteristics
  const isWidebody = ["Emirates", "Qatar Airways", "Etihad", "Etihad Airways",
                      "Singapore Airlines", "British Airways", "Lufthansa",
                      "Air India", "Turkish Airlines"].includes(airline);

  const columns = isWidebody ? ["A","B","C","D","E","F","G","H","J"] : ["A","B","C","D","E","F"];
  const aisleAfter = isWidebody ? [2, 5] : [2]; // after C and F for wide, after C for narrow
  const totalRows = isWidebody ? 42 : 32;
  const startRow = 1;
  const exitRows = isWidebody ? [11, 30] : [12, 13];
  const bulkheadRows = [1, 2];

  const seats = [];

  for (let row = startRow; row <= totalRows; row++) {
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const seatNum = `${row}${col}`;
      const isExitRow = exitRows.includes(row);
      const isBulkhead = bulkheadRows.includes(row);

      // Determine position characteristic
      let posChar = "M"; // middle by default
      if (ci === 0 || ci === columns.length - 1) posChar = "W"; // window
      else if (aisleAfter.some(a => ci === a || ci === a + 1)) posChar = "A"; // aisle

      // Build characteristics list (mirrors Amadeus characteristicList)
      const characteristics = [posChar];
      if (isExitRow) characteristics.push("EXIT_ROW", "EXTRA_LEGROOM");
      if (isBulkhead) characteristics.push("BULKHEAD");
      if (row <= 5) characteristics.push("FRONT_ZONE");
      if (row > totalRows - 8) characteristics.push("REAR_ZONE");

      // Availability — seed-deterministic so same flight = same map
      const occupancyRoll = rand();
      let availability = "AVAILABLE";
      if (occupancyRoll < 0.38) availability = "OCCUPIED";
      else if (occupancyRoll < 0.42) availability = "BLOCKED";

      // Price
      let price = SEAT_PRICES.DEFAULT;
      if (isExitRow || characteristics.includes("EXTRA_LEGROOM")) price = SEAT_PRICES.EXIT_ROW;
      else if (isBulkhead) price = SEAT_PRICES.BULKHEAD;
      else if (posChar === "W" || posChar === "A") price = SEAT_PRICES.W;
      else price = 0; // Middle seats free to pick

      seats.push({
        number: seatNum,
        row,
        column: col,
        availability,          // AVAILABLE | OCCUPIED | BLOCKED
        characteristicList: characteristics,
        travelerPricing: [{ price: { total: String(price), currency: "INR" } }],
        position: posChar,
        isExitRow,
        isBulkhead
      });
    }
  }

  return {
    type: "seatmap",
    id: flightId || flightNum,
    aircraft: { code: isWidebody ? "77W" : "320" },
    class: "ECONOMY",
    columns,
    aisleAfter,
    totalRows,
    decks: [
      {
        deckType: "MAIN",
        deckConfiguration: {
          width: columns.length,
          length: totalRows,
          startSeatRow: startRow,
          endSeatRow: totalRows,
          exitRowsX: exitRows,
          startWingsX: isWidebody ? 15 : 10,
          endWingsX: isWidebody ? 32 : 22
        },
        facilities: exitRows.map(r => ({
          code: "EX", column: "", rowEnd: r, rowStart: r,
          position: "FRONT", description: "EXIT"
        })),
        seats
      }
    ]
  };
}

/**
 * Fetches a real Amadeus OAuth2 token.
 */
async function getAmadeusToken(clientId, clientSecret) {
  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Amadeus OAuth failed: " + JSON.stringify(data));
  return data.access_token;
}

/**
 * Fetches live seat map from Amadeus API.
 */
async function fetchLiveSeatMap(token, flightOfferId) {
  const url = `https://test.api.amadeus.com/v1/shopping/seatmaps?flightOrderId=${encodeURIComponent(flightOfferId)}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  return data;
}

// ─── Cloud Function ───────────────────────────────────────────────────────────
exports.seatmap = onRequest(
  {
    cors: true,
    secrets: [AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET]
  },
  async (req, res) => {
    // CORS preflight
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { flightId, airline, flightNum, route } = req.body || {};
    const isLiveMode = process.env.AMADEUS_LIVE === "true";

    try {
      let seatMapData;

      if (isLiveMode) {
        // ── LIVE MODE: real Amadeus data ──────────────────────────────────
        const clientId = AMADEUS_CLIENT_ID.value();
        const clientSecret = AMADEUS_CLIENT_SECRET.value();
        if (!clientId || !clientSecret) {
          throw new Error("AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET secrets not set.");
        }
        const token = await getAmadeusToken(clientId, clientSecret);
        seatMapData = await fetchLiveSeatMap(token, flightId);
      } else {
        // ── SIMULATION MODE: Amadeus-format generated data ────────────────
        seatMapData = generateSimulatedSeatMap(flightId, airline, flightNum);
      }

      res.status(200).json({ success: true, mode: isLiveMode ? "live" : "simulation", data: seatMapData });
    } catch (err) {
      console.error("Seat map error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
