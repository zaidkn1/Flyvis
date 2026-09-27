// ===== FLYVIS LIVE FLIGHT SCRAPER & REAL-TIME API CLIENT =====

/**
 * Configuration for Live Flight Data Sources
 * Can be configured via Admin Dashboard or localStorage
 */
function getLiveFlightApiConfig() {
  try {
    const raw = localStorage.getItem('flyvis_flight_api_config');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    provider: 'local_scraper', // 'local_scraper', 'amadeus', 'rapidapi_skyscanner', 'timetable_fallback'
    scraperEndpoint: 'http://localhost:5050/api/scrape-flights',
    apiKey: '',
    apiSecret: '',
    liveStreamingEnabled: true
  };
}

function saveLiveFlightApiConfig(cfg) {
  try {
    localStorage.setItem('flyvis_flight_api_config', JSON.stringify(cfg));
  } catch (e) {}
}

/**
 * Master function to fetch live flight schedules & fares.
 * Tries Live API / Local Scraper first, and gracefully falls back to the published schedule matrix.
 */
async function fetchLiveFlights(params) {
  const { originCode, destCode, departureDate, cabinClass = "economy", userCardIds = [] } = params;
  const config = getLiveFlightApiConfig();

  let liveFlightsResult = null;
  let isLiveDataSource = false;
  let sourceLabel = "Scheduled Timetables";

  // 1. Try Local Scraper or Live API if enabled
  if (config.liveStreamingEnabled) {
    try {
      if (config.provider === 'local_scraper' && config.scraperEndpoint) {
        const url = `${config.scraperEndpoint}?from=${originCode}&to=${destCode}&date=${departureDate}&cabin=${cabinClass}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.flights && data.flights.length > 0) {
            liveFlightsResult = data;
            isLiveDataSource = true;
            sourceLabel = "Live Scraper Stream";
          }
        }
      } else if (config.provider === 'amadeus' && config.apiKey) {
        // Amadeus Live Search integration hook
        sourceLabel = "Amadeus GDS Live";
      }
    } catch (err) {
      console.warn("Live flight stream not reachable or timed out. Falling back to published airline network timetable.", err);
    }
  }

  // 2. Fallback to Published Airline Network Matrix
  if (!liveFlightsResult || !liveFlightsResult.flights || !liveFlightsResult.flights.length) {
    liveFlightsResult = window.searchLiveFlightsNetwork(params);
    isLiveDataSource = false;
    sourceLabel = "Published IATA Airline Timetable";
  }

  return {
    ...liveFlightsResult,
    isLiveDataSource,
    sourceLabel
  };
}

if (typeof window !== 'undefined') {
  window.getLiveFlightApiConfig = getLiveFlightApiConfig;
  window.saveLiveFlightApiConfig = saveLiveFlightApiConfig;
  window.fetchLiveFlights = fetchLiveFlights;
}
