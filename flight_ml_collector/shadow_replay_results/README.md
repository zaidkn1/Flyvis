# Flyvis historical shadow replay — research only

This is a **historical replay**, not a live shadow pilot. It applies the frozen
Wong classifier and its validation-selected probability threshold (0.40) to
previously saved development-period scores. It makes no provider calls, takes
no customer money, and books no tickets. The score file and training details
are in `/Users/zaidkhaleel/Documents/Codex/2026-09-23/i-am/outputs/wong_drop_model/` on this
machine; the replay runner accepts alternate paths through CLI arguments.

## What was replayed

For each entry window (exactly 7, 14, 21, or 28 days before departure), select
one starting decision per route/date/airline/time profile. At that point compare
three fixed actions: book immediately, always wait one day, and wait one day
only when the saved model probability reaches 0.40. If waiting, compare today's
recorded qualifying fare with the next calendar day's recorded qualifying fare.
The replay then stops. It does **not** repeatedly optimize until departure.

A missing next-day quote is recorded as unresolved, split into a source gap or
source-present/no-matching-quote. It is not called sold out or assigned a real
replacement fare. Hypothetical $0, $50, $100 and $250 per-unresolved-case
sensitivities appear in `report.json`. A $100 sensitivity is an assumption, not
an estimated loss distribution. `ledger.csv.gz` has one row per
cohort/profile/policy, including the action, observation status, observed fare
change and unresolved reason.

## Result at the seven-day entry point

| Policy | Starts | Waits | Unresolved waits | Known signed fare change | Mean per start with assumed $100 per unresolved wait |
|---|---:|---:|---:|---:|---:|
| Book now | 926 | 0 | 0 | $0 | $0.00 |
| Always wait one day | 926 | 926 | 46 | -$5,380.51 | -$10.78 |
| Frozen model rule | 926 | 63 | 4 | +$412.02 | **+$0.01** |

Among the 59 resolved model waits, the next recorded fare was lower in 20
cases, unchanged in 29, and higher in 10. The positive changes total $1,047.03
and the fare increases total $635.01. Under Flyvis's stated promise to refund
**all** savings, that $1,047.03 is a customer refund proxy, not platform
revenue. The observed top-ups alone imply **-$635.01** in platform cash before
fees, the unresolved cases, and any other costs. The +$412.02 net fare change
is not a profit figure. If four unresolved waits really cost $100 each, the
rule's net fare proxy falls to +$12.02 across 926 starts.

At 14 days, the frozen rule waited 31 of 903 times, had one unresolved case,
and a known +$401.03 signed fare change. At 21 days it waited 13 of 873 times
with +$270.99 known change; at 28 days it waited 15 of 849 times with +$221.99.
These are **separate, overlapping cohorts**, not 3,551 independent customers.
The route-level breakdown is in `report.json`; the seven-day rule never waits
on ATL–BOS, which is a useful sign of narrow coverage rather than a global
claim.

## Limits and next gate

These are old US domestic research quotes. They lack verified baggage, complete
bookable totals, supplier availability and ticket confirmation. Even a matching
next-day quote may be a different ticket within the research profile. The
late-2022 development period was examined before this replay; the replay is
diagnostic, **not** an untouched holdout or evidence of real-world savings.
The 926 seven-day starts occupy only 102 route/departure-date groups, so row
counts overstate independence. Actual platform economics also depend on fees,
payment costs, recovery behavior and how often baggage-compliant offers exist.

The next genuine shadow pilot requires a permitted live provider feed. Log the
customer's strict request, the chosen eligible offer, action, quote timestamp,
complete baggage-inclusive total, reprice result and whether a ticket could
have been issued. Run it without collecting customer funds or creating orders,
then compare to the predeclared book-now rule. Until then all ledger events have
`actual_booking_possible=false`.

Reproduce from `/Users/zaidkhaleel/Documents/visa`:

```sh
python3 flight_ml_collector/shadow_replay.py
python3 -m unittest discover -s flight_ml_collector/tests -v
```
