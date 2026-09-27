"""Deterministic, offline partner simulation for the Flyvis offer gate.

All offers have live_mode=False. This module never charges, reserves, orders,
issues tickets, contacts a provider, or writes to production booking storage.
"""

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from .validator import evaluate_offer, evaluate_reprice


SCENARIOS = {
    'stable', 'alternative_cheaper_after_reprice', 'cheapest_sold_out',
    'cheapest_expired', 'cheapest_baggage_missing', 'insufficient_seats',
    'all_unavailable', 'no_offers',
}


def _utc(now):
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('now must be timezone-aware')
    return now.astimezone(timezone.utc)


def _stamp(value):
    return value.isoformat().replace('+00:00', 'Z')


def _price(total, bags):
    amount = Decimal(str(total))
    bag_amount = Decimal(str(bags))
    tax = Decimal('4000.00')
    return {
        'base_amount': f'{amount - tax - bag_amount:.2f}',
        'taxes_fees_amount': f'{tax:.2f}',
        'baggage_amount': f'{bag_amount:.2f}',
        'other_required_services_amount': '0.00',
        'total_amount': f'{amount:.2f}',
    }


def _offer(request, now, code, airline, flight_number, departure, arrival, total, bag_kg, bag_amount):
    passengers = list(request['passenger_ids'])
    flight_day = date.fromisoformat(request['departure_date']).isoformat()
    baggage = {
        pid: ([{'max_weight_kg': bag_kg, 'confirmed_in_total': True}] if bag_kg else [])
        for pid in passengers
    }
    return {
        'environment': 'mock',
        'provider': 'flyvis_mock',
        'live_mode': False,
        'offer_id': code,
        'observed_at': _stamp(now - timedelta(seconds=10)),
        'expires_at': _stamp(now + timedelta(minutes=10)),
        'available': True,
        'single_ticket': True,
        'all_mandatory_charges_included': True,
        'passenger_ids': passengers,
        'currency': 'INR',
        'price': _price(total, bag_amount),
        'segments': [{
            'origin': request['origin'],
            'destination': request['destination'],
            'departing_at': f'{flight_day}T{departure}:00+05:30',
            'arriving_at': f'{flight_day}T{arrival}:00+04:00',
            'marketing_airline': airline,
            'flight_number': flight_number,
            'cabin': 'economy',
            'baggage_by_passenger': baggage,
        }],
    }


class MockPartnerAdapter:
    """One search and fresh-reprice fixture set for DEL–DXB economy only."""

    environment = 'mock'

    def __init__(self, scenario='stable'):
        if scenario not in SCENARIOS:
            raise ValueError('unknown mock scenario')
        self.scenario = scenario
        self._offers = {}

    def search_offers(self, request, *, now):
        now = _utc(now)
        if request.get('origin') != 'DEL' or request.get('destination') != 'DXB' or request.get('cabin') != 'economy':
            return []
        if self.scenario == 'no_offers':
            return []
        # Bare fare is intentionally the cheapest search result but lacks the
        # required 25 kg bag in the example request.
        offers = [
            _offer(request, now, 'mock-bare', 'AI', 'AI-701', '18:00', '20:00', 32000, 0, 0),
            _offer(request, now, 'mock-first', 'AI', 'AI-915', '18:30', '20:30', 38000, 25, 3000),
            _offer(request, now, 'mock-alternative', 'EK', 'EK-513', '19:15', '21:15', 41000, 25, 3000),
        ]
        if self.scenario == 'cheapest_expired':
            offers[1]['expires_at'] = _stamp(now - timedelta(seconds=1))
        self._offers = {offer['offer_id']: deepcopy(offer) for offer in offers}
        return deepcopy(offers)

    def reprice_offer(self, offer_id, *, now):
        now = _utc(now)
        if offer_id not in self._offers:
            raise ValueError('offer_not_found')
        offer = deepcopy(self._offers[offer_id])
        offer['offer_id'] = f'repriced-{offer_id}'
        offer['reprice_of_offer_id'] = offer_id
        offer['observed_at'] = _stamp(now)
        offer['expires_at'] = _stamp(now + timedelta(minutes=5))
        if offer_id == 'mock-first':
            if self.scenario == 'alternative_cheaper_after_reprice':
                offer['price'] = _price(46000, 3000)
            elif self.scenario in {'cheapest_sold_out', 'all_unavailable', 'insufficient_seats'}:
                offer['available'] = False
                if self.scenario == 'insufficient_seats':
                    offer['available_seats'] = 1
            elif self.scenario == 'cheapest_baggage_missing':
                for pid in offer['passenger_ids']:
                    offer['segments'][0]['baggage_by_passenger'][pid] = []
        elif offer_id == 'mock-alternative':
            if self.scenario == 'alternative_cheaper_after_reprice':
                offer['price'] = _price(39000, 3000)
            elif self.scenario == 'all_unavailable':
                offer['available'] = False
        return offer

    def create_order(self, *_args, **_kwargs):
        raise RuntimeError('Mock partner cannot reserve, charge, issue, or create orders')


def choose_simulated_offer(adapter, request, *, now):
    """Select cheapest eligible *repriced* mock offer; never return booking authority."""
    if not isinstance(adapter, MockPartnerAdapter) or adapter.environment != 'mock':
        raise TypeError('simulation runner accepts only MockPartnerAdapter')
    now = _utc(now)
    search = adapter.search_offers(request, now=now)
    rejected = []
    repriced_candidates = []
    for observed in search:
        eligible, reasons = evaluate_offer(request, observed, now=now, allow_test_mode=True)
        if not eligible:
            rejected.append({'offer_id': observed['offer_id'], 'stage': 'search', 'reasons': reasons})
            continue
        try:
            refreshed = adapter.reprice_offer(observed['offer_id'], now=now)
        except (ValueError, TimeoutError) as exc:
            rejected.append({'offer_id': observed['offer_id'], 'stage': 'reprice', 'reasons': [str(exc)]})
            continue
        eligible, reasons = evaluate_reprice(request, observed, refreshed, now=now, allow_test_mode=True)
        if eligible:
            repriced_candidates.append(refreshed)
        else:
            rejected.append({'offer_id': observed['offer_id'], 'stage': 'reprice', 'reasons': reasons})
    best = min(repriced_candidates, key=lambda o: (Decimal(o['price']['total_amount']), o['offer_id']), default=None)
    return {
        'environment': 'mock',
        'simulation_only': True,
        'eligible_for_real_booking': False,
        'searched': len(search),
        'repriced_eligible': len(repriced_candidates),
        'selected_offer': deepcopy(best),
        'rejected': rejected,
    }


def example_request():
    return {
        'origin': 'DEL', 'destination': 'DXB', 'departure_date': '2026-10-13',
        'departure_windows': ['16:00-20:00'], 'max_stops': 0,
        'allowed_airlines': [], 'cabin': 'economy', 'passenger_ids': ['p1', 'p2'],
        'checked_bags_per_passenger': 1, 'min_kg_per_checked_bag': 25,
        'currency': 'INR', 'max_total_amount': '50000.00',
    }


if __name__ == '__main__':
    import json
    fixed_now = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
    for name in sorted(SCENARIOS):
        result = choose_simulated_offer(MockPartnerAdapter(name), example_request(), now=fixed_now)
        selected = result['selected_offer']
        print(json.dumps({
            'scenario': name,
            'selected_offer_id': selected['reprice_of_offer_id'] if selected else None,
            'total_inr': selected['price']['total_amount'] if selected else None,
            'rejections': result['rejected'],
            'simulation_only': True,
        }))
