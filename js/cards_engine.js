// ===== FLYVIS CREDIT CARD FLIGHT DEALS OPTIMIZER ENGINE =====

/**
 * Evaluates a flight fare against a user's selected credit cards.
 * Computes:
 * - Direct Promo Code Discounts
 * - Multiplier / Reward Point Net Value
 * - Lowest Net Effective Fare
 * - The Best Winning Card Recommendation
 */
function evaluateFlightCardOffers(flight, selectedCardIds = []) {
  const basePrice = typeof flight.price === 'number' 
    ? flight.price 
    : (parseFloat(String(flight.price || flight.fare || '0').replace(/[^0-9.]/g, '')) || 0);

  const availableCards = window.MASTER_CREDIT_CARDS || [];
  const promos = window.GLOBAL_BANK_FLIGHT_PROMOS || [];

  // Filter cards to user's selection (if none selected, evaluate top 5 popular cards)
  let cardsToEvaluate = [];
  if (selectedCardIds && selectedCardIds.length > 0) {
    cardsToEvaluate = availableCards.filter(c => selectedCardIds.includes(c.id));
  }
  if (!cardsToEvaluate.length) {
    cardsToEvaluate = availableCards.filter(c => c.popular);
  }

  const evaluations = cardsToEvaluate.map(card => {
    let directDiscount = 0;
    let promoCodeApplied = null;
    let promoTitle = '';

    // 1. Check card's own instant discount list
    if (card.instantDiscounts && card.instantDiscounts.length > 0) {
      card.instantDiscounts.forEach(disc => {
        if (basePrice >= (disc.minSpend || 0)) {
          const discountAmt = Math.min(basePrice * disc.discountPct, disc.maxDiscount || Infinity);
          if (discountAmt > directDiscount) {
            directDiscount = discountAmt;
            promoCodeApplied = disc.code;
            promoTitle = `${Math.round(disc.discountPct * 100)}% Instant Off via ${disc.platform}`;
          }
        }
      });
    }

    // 2. Check Global Bank/Airline Promos matching this flight's airline
    const flightAirline = (flight.airline || '').toLowerCase();
    promos.forEach(p => {
      const isCardEligible = p.cardIds.includes(card.id) || p.cardIds.includes('all_' + card.bank.toLowerCase().split(' ')[0]);
      const isAirlineMatch = p.airline === 'All Airlines' || flightAirline.includes(p.airline.toLowerCase());

      if (isCardEligible && isAirlineMatch && basePrice >= p.minSpend) {
        const discountAmt = Math.min(basePrice * p.discountPct, p.maxDiscount);
        if (discountAmt > directDiscount) {
          directDiscount = discountAmt;
          promoCodeApplied = p.code;
          promoTitle = p.title;
        }
      }
    });

    // 3. Calculate Reward Multiplier / Milestone Value
    const remainingFare = basePrice - directDiscount;
    const rewardSavings = Math.round(remainingFare * (card.flightMultiplierValue || 0.03));

    // 4. Net Effective Fare
    const totalSavings = Math.round(directDiscount + rewardSavings);
    const netFare = Math.max(0, Math.round(basePrice - totalSavings));

    return {
      card,
      basePrice,
      directDiscount: Math.round(directDiscount),
      promoCodeApplied,
      promoTitle,
      rewardSavings,
      multiplierText: card.flightMultiplier,
      totalSavings,
      netFare,
      redemptionNote: card.pointRedemptionRate
    };
  });

  // Sort by highest savings (lowest net fare)
  evaluations.sort((a, b) => b.totalSavings - a.totalSavings);

  const bestOffer = evaluations[0] || null;

  return {
    basePrice,
    bestOffer,
    allCardOffers: evaluations,
    hasSavings: bestOffer ? bestOffer.totalSavings > 0 : false
  };
}

// User Selected Cards LocalStorage State
function getStoredUserCardIds() {
  try {
    const raw = localStorage.getItem('flyvis_user_cards');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Default to popular starter selection
  return ['hdfc_infinia', 'axis_atlas', 'sbi_cashback'];
}

function saveStoredUserCardIds(cardIds) {
  try {
    localStorage.setItem('flyvis_user_cards', JSON.stringify(cardIds));
    window.dispatchEvent(new CustomEvent('userCardsUpdated', { detail: cardIds }));
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.evaluateFlightCardOffers = evaluateFlightCardOffers;
  window.getStoredUserCardIds = getStoredUserCardIds;
  window.saveStoredUserCardIds = saveStoredUserCardIds;
}
