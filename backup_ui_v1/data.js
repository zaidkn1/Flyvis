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

// ===== CACHED DATA =====
// We keep a local cache so filtering is instant
window.cachedVisas = [];
window.cachedFlights = [];

// ===== DEFAULT IMAGES (FALLBACK) =====
function getCountryImage(countryCode) {
  const images = {
    AE: 'https://images.unsplash.com/photo-1512453979436-5a50ce8c8d05?auto=format&fit=crop&q=80&w=800',
    US: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=800',
    GB: 'https://images.unsplash.com/photo-1513635269975-5969336cd100?auto=format&fit=crop&q=80&w=800',
    TH: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=800',
    SG: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&q=80&w=800',
    FR: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800',
    IT: 'https://images.unsplash.com/photo-1499678329028-1014352c1599?auto=format&fit=crop&q=80&w=800',
    ES: 'https://images.unsplash.com/photo-1539037116277-4db20202d03d?auto=format&fit=crop&q=80&w=800',
    TR: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&q=80&w=800',
    EG: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&q=80&w=800',
    ZA: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&q=80&w=800',
    AU: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?auto=format&fit=crop&q=80&w=800',
    JP: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800',
    CN: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&q=80&w=800',
    IN: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&q=80&w=800',
    BR: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&q=80&w=800',
    MX: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&q=80&w=800',
    CA: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&q=80&w=800',
    RU: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&q=80&w=800',
    SA: 'https://images.unsplash.com/photo-1583422409516-15eba534927b?auto=format&fit=crop&q=80&w=800'
  };
  return images[countryCode] || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800';
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

      window.cachedVisas = visas;
      // Dispatch event to re-render UI automatically
      window.dispatchEvent(new Event('visasUpdated'));
      resolve(visas);
    }, error => {
      console.error("Error loading visas:", error);
      window.cachedVisas = [];
      resolve([]);
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
