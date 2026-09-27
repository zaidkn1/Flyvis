"""Historical one-decision shadow replay of the frozen Wong research policy.

Research only: source quotes lack baggage, final executable price and ticketing.
No booking, notification, network call or customer-data write occurs here.
"""

import argparse
import csv
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

DEFAULT_INPUT = Path('/Users/zaidkhaleel/Documents/Codex/2026-09-23/i-am/outputs/wong_drop_model/development_test_scores.csv.gz')
DEFAULT_MODEL_RESULTS = DEFAULT_INPUT.parent / 'results.json'
DEFAULT_OUTPUT = Path(__file__).resolve().parent / 'shadow_replay_results'
ENTRY_LEAD_DAYS = (7, 14, 21, 28)
PENALTIES_USD = (0, 50, 100, 250)
POLICIES = ('book_now', 'always_wait_one_day', 'frozen_model')
MATCHED = 'matching_quote_observed'


def money(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise ValueError('invalid fare') from exc
    if not result.is_finite() or result < 0:
        raise ValueError('invalid fare')
    return result


def load_scores(path, threshold):
    with gzip.open(path, 'rt', newline='') as stream:
        rows = list(csv.DictReader(stream))
    required = {'profile_id', 'route', 'searchDate', 'flightDate', 'future_1_date',
                'future_1_status', 'current_fare_usd', 'future_1_fare_usd',
                'fixed_wait_1_saving_usd', 'predicted_drop_probability', 'action'}
    if not rows or not required.issubset(rows[0]):
        raise ValueError('missing required score columns')
    seen = set()
    for row in rows:
        key = (row['profile_id'], row['searchDate'])
        if key in seen:
            raise ValueError('duplicate profile/date decision')
        seen.add(key)
        search = date.fromisoformat(row['searchDate'])
        flight = date.fromisoformat(row['flightDate'])
        future = date.fromisoformat(row['future_1_date'])
        if future != search + timedelta(days=1) or flight <= future:
            raise ValueError('invalid one-day decision horizon')
        probability = float(row['predicted_drop_probability'])
        if not 0 <= probability <= 1:
            raise ValueError('invalid probability')
        expected = 'WAIT_ONE_DAY' if probability >= threshold else 'BOOK_NOW'
        if row['action'] != expected:
            raise ValueError('saved action disagrees with frozen threshold')
        fare = money(row['current_fare_usd'])
        if row['future_1_status'] == MATCHED:
            future_fare = money(row['future_1_fare_usd'])
            saved_delta = Decimal(row['fixed_wait_1_saving_usd'])
            if abs(fare - future_fare - saved_delta) > Decimal('0.001'):
                raise ValueError('saved fare change does not reconcile')
        elif row['future_1_status'] not in {'source_gap', 'source_present_no_match'}:
            raise ValueError('unexpected next-day status')
        elif row['future_1_fare_usd'] or row['fixed_wait_1_saving_usd']:
            raise ValueError('unresolved next day has a price or saving')
        row['entry_lead_days'] = (flight - search).days
    return rows


def entry_cohort(rows, lead_days):
    selected = [r for r in rows if r['entry_lead_days'] == lead_days]
    if len({r['profile_id'] for r in selected}) != len(selected):
        raise ValueError('cohort contains repeated profile')
    return sorted(selected, key=lambda r: (r['route'], r['flightDate'], r['profile_id']))


def decide(row, policy):
    if policy == 'book_now':
        return 'BOOK_NOW'
    if policy == 'always_wait_one_day':
        return 'WAIT_ONE_DAY'
    if policy == 'frozen_model':
        return row['action']
    raise ValueError('unknown policy')


def event(row, policy):
    action = decide(row, policy)
    matched = row['future_1_status'] == MATCHED
    current = money(row['current_fare_usd'])
    next_fare = money(row['future_1_fare_usd']) if matched else None
    delta = current - next_fare if matched else None
    outcome = 'book_now'
    if action == 'WAIT_ONE_DAY':
        if not matched:
            outcome = 'unresolved_' + row['future_1_status']
        elif delta > 0:
            outcome = 'waited_lower_fare_observed'
        elif delta < 0:
            outcome = 'waited_higher_fare_observed'
        else:
            outcome = 'waited_unchanged_fare_observed'
    return {
        'cohort_lead_days': row['entry_lead_days'],
        'policy': policy,
        'profile_id': row['profile_id'],
        'route': row['route'],
        'departure_date': row['flightDate'],
        'decision_date': row['searchDate'],
        'action': action,
        'predicted_drop_probability': row['predicted_drop_probability'],
        'current_fare_usd': str(current),
        'next_day_status': row['future_1_status'],
        'next_day_fare_usd': str(next_fare) if next_fare is not None else '',
        'outcome': outcome,
        'observed_signed_saving_usd': str(delta) if action == 'WAIT_ONE_DAY' and matched else '',
        'customer_refund_proxy_usd': str(max(delta, Decimal(0))) if action == 'WAIT_ONE_DAY' and matched else '',
        'platform_topup_proxy_usd': str(max(-delta, Decimal(0))) if action == 'WAIT_ONE_DAY' and matched else '',
        'missed_next_day_drop_proxy_usd': str(max(delta, Decimal(0))) if action == 'BOOK_NOW' and matched else '',
        'actual_booking_possible': False,
        'reason_not_bookable': 'Historical quotes lack verified baggage, complete executable price and supplier availability.',
    }


def summarize(events):
    n = len(events)
    waits = [e for e in events if e['action'] == 'WAIT_ONE_DAY']
    known = [e for e in waits if e['observed_signed_saving_usd'] != '']
    unresolved = [e for e in waits if e['observed_signed_saving_usd'] == '']
    topups = [money(e['platform_topup_proxy_usd']) for e in known]
    net = sum((Decimal(e['observed_signed_saving_usd']) for e in known), Decimal(0))
    refund = sum((money(e['customer_refund_proxy_usd']) for e in known), Decimal(0))
    topup = sum(topups, Decimal(0))
    book_now = [e for e in events if e['action'] == 'BOOK_NOW']
    missed = [money(e['missed_next_day_drop_proxy_usd']) for e in book_now if e['missed_next_day_drop_proxy_usd'] != '']
    groups = {(e['route'], e['departure_date']) for e in events}
    return {
        'starts': n,
        'unique_profiles': len({e['profile_id'] for e in events}),
        'route_departure_groups': len(groups),
        'book_now': len(book_now),
        'waits': len(waits),
        'resolved_waits': len(known),
        'unresolved_waits': len(unresolved),
        'unresolved_by_reason': dict(Counter(e['next_day_status'] for e in unresolved)),
        'waited_lower_unchanged_higher': {
            label: sum(e['outcome'] == label for e in known)
            for label in ('waited_lower_fare_observed', 'waited_unchanged_fare_observed', 'waited_higher_fare_observed')
        },
        'known_net_fare_saving_usd': float(net),
        'customer_refund_proxy_usd': float(refund),
        'platform_topup_proxy_usd': float(topup),
        'platform_cash_before_fees_if_all_savings_refunded_usd': float(-topup),
        'largest_observed_topup_usd': float(max(topups, default=Decimal(0))),
        'observed_book_now_next_day_drop_count': sum(v > 0 for v in missed),
        'missed_next_day_drop_proxy_usd': float(sum(missed, Decimal(0))),
        'mean_advantage_per_start_by_unresolved_cost_usd': {
            str(penalty): float((net - Decimal(penalty) * len(unresolved)) / n) if n else None
            for penalty in PENALTIES_USD
        },
        'actual_bookable_offers': 0,
    }


def run(input_path=DEFAULT_INPUT, model_results=DEFAULT_MODEL_RESULTS, output_dir=DEFAULT_OUTPUT):
    config = json.loads(Path(model_results).read_text())
    threshold = config['chosen_policy']['probability_threshold']
    if threshold is None:
        raise ValueError('no frozen model threshold available')
    source = Path(input_path)
    rows = load_scores(source, threshold)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    ledger = []
    report = {
        'scope': 'historical one-decision replay, not a live shadow run',
        'policy_threshold': threshold,
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'entry_lead_days': list(ENTRY_LEAD_DAYS),
        'cohorts': {},
        'limitations': [
            'All fares are 2022 Wong research observations, not executable supplier quotes.',
            'Baggage and complete fare rules are unknown; no event is eligible for actual booking.',
            'Unresolved next-day observations are missing data, not proven sold-out inventory.',
            'Each cohort has one entry per profile; cohorts overlap and are not independent.',
            'The late-2022 development period was previously inspected, so this is not a new holdout.',
            'USD savings and top-ups are fare proxies, not platform profit or actual customer refunds.',
        ],
    }
    for lead in ENTRY_LEAD_DAYS:
        cohort = entry_cohort(rows, lead)
        report['cohorts'][str(lead)] = {}
        for policy in POLICIES:
            events = [event(row, policy) for row in cohort]
            ledger.extend(events)
            report['cohorts'][str(lead)][policy] = {
                **summarize(events),
                'by_route': {
                    route: summarize([e for e in events if e['route'] == route])
                    for route in sorted({e['route'] for e in events})
                },
            }
    with gzip.open(out / 'ledger.csv.gz', 'wt', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(ledger[0]))
        writer.writeheader()
        writer.writerows(ledger)
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=DEFAULT_INPUT)
    parser.add_argument('--model-results', type=Path, default=DEFAULT_MODEL_RESULTS)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = run(args.input, args.model_results, args.output)
    print(json.dumps(result['cohorts'], indent=2))
