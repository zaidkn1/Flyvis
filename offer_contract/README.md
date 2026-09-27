# Flyvis offer contract (partner-neutral, pre-integration)

This defines the **minimum** evidence required before a fare can be shown as
eligible for Flyvis's price-monitoring and booking promise. A search result is
only an observation. It is not an eligible or bookable offer until a partner
adapter supplies the fields below. Missing or uncertain fields fail closed.

This is a reference contract and validator, **not** a provider integration,
payment authorization, seat hold, or ticketing service. No order may be marked
ticketed merely because `evaluate_reprice` returns eligible.

## Normalized request

- `origin`, `destination`: exact airport IATA codes (no city substitution).
- `departure_date`: local date at the departure airport, `YYYY-MM-DD`.
- `departure_windows`: allowed local time ranges as `HH:MM-HH:MM`; empty means
  any time. For a window crossing midnight, the end is on the next local day.
- `max_stops`: maximum connections on the journey.
- `allowed_airlines`: accepted **marketing** carrier IATA codes; empty means
  any carrier. Agree separately whether operating carriers are also restricted.
- `required_flight_number` (optional): if set, only that exact nonstop flight
  may qualify. Leave unset when the customer permits alternatives.
- `cabin`: exact cabin requested for every segment.
- `passenger_ids`: stable IDs for every traveler in this quote. No names or
  identity documents belong in price observations.
- `checked_bags_per_passenger`: required number of checked bags.
- `min_kg_per_checked_bag`: minimum allowed weight **per bag**, not pooled.
- `max_total_amount`, `currency`: customer's authorized all-in spending cap.

The validator defaults to rejecting test-mode offers. Its `allow_test_mode`
switch exists only for isolated mock tests; test-mode output is never booking
evidence. Any other promised requirement (seat, meal, flexibility, protected connection,
refundability) must be added as an explicit hard constraint before production.
The current validator intentionally does not infer those from an airline name.

## Normalized offer

- `provider`, `live_mode`, `offer_id`, `observed_at`, `expires_at`, and
  `available=true` as confirmed by the partner for all requested passengers.
- `passenger_ids`, `currency`, and `price`: decimal strings for `base_amount`,
  `taxes_fees_amount`, `baggage_amount`, `other_required_services_amount`, and
  `total_amount`. They must add up exactly. The adapter must include all
  mandatory fees and selected baggage in that total, and set
  `all_mandatory_charges_included=true` only when the provider confirms this.
  A cross-currency price
  cannot pass without an explicit customer-approved conversion/settlement flow.
- `segments`: ordered, continuous flights with `origin`, `destination`,
  timezone-aware `departing_at` and `arriving_at`, `marketing_airline`,
  `flight_number`, `cabin`, and `baggage_by_passenger`.
- `single_ticket=true`: provider confirmation that all segments can be issued
  as one protected ticket. The reference gate rejects separate-ticket
  itineraries until a distinct policy for self-transfers exists.
- `baggage_by_passenger`: each passenger ID maps to an array of checked bag
  entitlements for **that segment**. Each entry has `max_weight_kg` and
  `confirmed_in_total=true`. Paid bags only count after the partner confirms
  them in the repriced total. Unknown allowance or fees make the offer
  ineligible.

An adapter must preserve the provider's raw response, offer IDs, source
timestamp, and any caveats for audit; it must not manufacture missing values.
Offer IDs may expire, so history stores observations while booking obtains a
fresh provider response.

## Booking gate

1. Validate the observed offer against **all** hard constraints. A raw scrape,
   generated fallback, test-mode quote, or incomplete baggage price fails.
2. Immediately before order creation, request a fresh provider reprice for the
   selected offer and all passengers and services. Validate it again. Reject if
   expired, older than the configured freshness limit, over budget, in a
   different currency, or if the exact itinerary changed. A same-route fare on
   a different flight is not a valid reprice.
3. Create the provider order with an idempotency key. If the partner reports a
   price/availability change, restart the gate. Do not silently accept a
   higher price or weaker baggage terms.
4. Tell the customer a ticket is issued only after the provider confirms an
   order reference **and ticket number(s)** for all passengers. Store the final
   price, baggage entitlements, source responses, timestamps, and refund basis.
   A PNR alone may represent a reservation, not an issued ticket.

The next partner assessment should ask whether its live API supports offer
search, detailed fare/baggage retrieval, repricing, order creation, ticket
status, and idempotency; what routes/carriers it covers; offer lifetime;
price/booking failure rates; ancillary booking support; and data retention
rights/costs for ML training. The contract here is provider-neutral and makes
no claim that a particular API supports all of these.

Run the reference checks with `python3 -m unittest discover -s offer_contract/tests -v`
from the `visa` project root.

## Offline mock partner

`mock_partner.py` supplies the adapter shape we expect to replace when a real
partner is chosen: `search_offers(request, now=...)` returns normalized offers,
and `reprice_offer(offer_id, now=...)` returns the fresh selected offer. The
mock covers DEL–DXB economy fixtures only. It has stable, changed-price,
sold-out, expired, missing-baggage, insufficient-seat, no-offer and
all-unavailable scenarios. The selection demo filters hard requirements,
reprices every surviving offer, then chooses the lowest **fresh all-in** total.

For example, in `alternative_cheaper_after_reprice`, the search initially
shows the AI flight at ₹38,000 and the EK alternative at ₹41,000. Repricing
changes them to ₹46,000 and ₹39,000, so the mock selects the EK flight. A
₹32,000 bare fare is excluded because it has no confirmed 25 kg checked bag.
If `required_flight_number` or `allowed_airlines` forbids the alternative,
the selection returns no candidate rather than relaxing the customer's rule.

All mock offers use `live_mode=false`. Production validation rejects them by
default; only the isolated simulation runner passes `allow_test_mode=true`.
Every result is marked `simulation_only=true` and
`eligible_for_real_booking=false`. `create_order` always raises, and the mock
cannot charge, reserve or issue a ticket. It is deliberately separate from the
current customer UI and production booking collections.

Run the examples without credentials or network access:

```sh
python3 -m offer_contract.mock_partner
python3 -m unittest discover -s offer_contract/tests -v
```
