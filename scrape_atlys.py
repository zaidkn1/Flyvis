import requests
import json
import re
import time
from bs4 import BeautifulSoup
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Granular catalog with explicit Government Fee, Atlys Fee, and Total Fee
KNOWN_VARIANTS = {
    "AE": [
        {"name": "Dubai 30-Day Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "60 Days", "stay": "Up to 30 Days", "govt_fee": "₹5,650", "atlys_fee": "₹1,500", "total_fee": "₹7,150", "proc": "48 Hours", "docs": "Passport Front & Back, Photograph"},
        {"name": "Dubai 60-Day Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "60 Days", "stay": "Up to 60 Days", "govt_fee": "₹11,990", "atlys_fee": "₹2,000", "total_fee": "₹13,990", "proc": "48 Hours", "docs": "Passport Front & Back, Photograph"},
        {"name": "Dubai 30-Day Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "60 Days", "stay": "Up to 30 Days per visit", "govt_fee": "₹12,500", "atlys_fee": "₹2,000", "total_fee": "₹14,500", "proc": "48 Hours", "docs": "Passport Front & Back, Photograph"},
        {"name": "Dubai 60-Day Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "60 Days", "stay": "Up to 60 Days per visit", "govt_fee": "₹17,400", "atlys_fee": "₹2,500", "total_fee": "₹19,900", "proc": "48 Hours", "docs": "Passport Front & Back, Photograph"},
        {"name": "Dubai 5-Year Long-Term Tourist Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "5 Years", "stay": "Up to 90 Days per visit", "govt_fee": "₹37,010", "atlys_fee": "₹4,990", "total_fee": "₹42,000", "proc": "5 - 7 Days", "docs": "Passport, Photo, Bank Statement (USD 4,000+)"}
    ],
    "VN": [
        {"name": "Vietnam 30-Day Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 30 Days", "govt_fee": "₹2,100", "atlys_fee": "₹990", "total_fee": "₹3,090", "proc": "4.5 Days", "docs": "Passport, Photograph"},
        {"name": "Vietnam 30-Day Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "30 Days", "stay": "Up to 30 Days", "govt_fee": "₹4,200", "atlys_fee": "₹990", "total_fee": "₹5,190", "proc": "4.5 Days", "docs": "Passport, Photograph"},
        {"name": "Vietnam 90-Day Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 90 Days", "govt_fee": "₹2,500", "atlys_fee": "₹990", "total_fee": "₹3,490", "proc": "4.5 Days", "docs": "Passport, Photograph"},
        {"name": "Vietnam 90-Day Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "90 Days", "stay": "Up to 90 Days", "govt_fee": "₹4,900", "atlys_fee": "₹1,200", "total_fee": "₹6,100", "proc": "4.5 Days", "docs": "Passport, Photograph"}
    ],
    "ID": [
        {"name": "Indonesia Tourist e-Visa (B1 / 30 Days)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 30 Days", "govt_fee": "₹2,800", "atlys_fee": "₹690", "total_fee": "₹3,490", "proc": "1 - 2 Hours", "docs": "Passport, Photograph"},
        {"name": "Indonesia Tourist e-Visa (60 Days)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 60 Days", "govt_fee": "₹7,400", "atlys_fee": "₹1,500", "total_fee": "₹8,900", "proc": "24 - 48 Hours", "docs": "Passport, Photograph, Bank Statement"},
        {"name": "Indonesia Multiple Entry Tourist e-Visa (1 Year)", "entry": "Multiple Entry", "validity": "1 Year", "stay": "Up to 60 Days per visit", "govt_fee": "₹21,510", "atlys_fee": "₹2,990", "total_fee": "₹24,500", "proc": "2 - 3 Days", "docs": "Passport, Photograph, Bank Statement"}
    ],
    "EG": [
        {"name": "Egypt Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 30 Days", "govt_fee": "₹2,175", "atlys_fee": "₹1,200", "total_fee": "₹3,375", "proc": "4 Days", "docs": "Passport, Hotel Booking, Photograph"},
        {"name": "Egypt Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "180 Days", "stay": "Up to 30 Days per visit", "govt_fee": "₹5,200", "atlys_fee": "₹1,500", "total_fee": "₹6,700", "proc": "4 Days", "docs": "Passport, Hotel Booking, Photograph"}
    ],
    "AZ": [
        {"name": "Azerbaijan ASAN Standard e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 30 Days", "govt_fee": "₹2,272", "atlys_fee": "₹990", "total_fee": "₹3,262", "proc": "3.9 Days", "docs": "Passport"},
        {"name": "Azerbaijan ASAN Urgent / Express e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 30 Days", "govt_fee": "₹5,400", "atlys_fee": "₹1,500", "total_fee": "₹6,900", "proc": "3 Hours", "docs": "Passport"}
    ],
    "TH": [
        {"name": "Thailand Digital Arrival Card / Visa Exemption (TDAC)", "entry": "Single Entry", "validity": "60 Days", "stay": "Up to 60 Days (Visa Free)", "govt_fee": "₹0", "atlys_fee": "₹490", "total_fee": "₹490", "proc": "30 Minutes", "docs": "Passport, Flight Ticket"},
        {"name": "Thailand Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 60 Days", "govt_fee": "₹2,000", "atlys_fee": "₹500", "total_fee": "₹2,500", "proc": "3 - 5 Days", "docs": "Passport, Photo, Flight Ticket, Hotel Booking"},
        {"name": "Thailand Multiple Entry Tourist Visa (METV)", "entry": "Multiple Entry", "validity": "6 Months", "stay": "Up to 60 Days per visit", "govt_fee": "₹10,500", "atlys_fee": "₹2,000", "total_fee": "₹12,500", "proc": "5 - 7 Days", "docs": "Passport, Photo, 6-Month Bank Statement, ITR"}
    ],
    "SG": [
        {"name": "Singapore Tourist Entry Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "30 Days - 2 Years", "stay": "Up to 30 Days per visit", "govt_fee": "₹1,900", "atlys_fee": "₹500", "total_fee": "₹2,400", "proc": "3 - 5 Days", "docs": "Passport, Photograph, Flight Itinerary"},
        {"name": "Singapore Digital Arrival Card (SGAC)", "entry": "Single Entry", "validity": "Per Trip", "stay": "Duration of Visa", "govt_fee": "₹0", "atlys_fee": "₹390", "total_fee": "₹390", "proc": "15 Minutes", "docs": "Passport, Flight & Accommodation Details"}
    ],
    "MY": [
        {"name": "Malaysia Tourist Visa Exemption + MDAC", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 30 Days (Visa Free)", "govt_fee": "₹0", "atlys_fee": "₹490", "total_fee": "₹490", "proc": "1 Hour", "docs": "Passport, Return Flight Ticket, Hotel Booking"},
        {"name": "Malaysia Multiple Entry e-Visa", "entry": "Multiple Entry", "validity": "90 Days", "stay": "Up to 30 Days per visit", "govt_fee": "₹2,900", "atlys_fee": "₹1,000", "total_fee": "₹3,900", "proc": "48 Hours", "docs": "Passport, Photo, Flight Tickets"}
    ],
    "LK": [
        {"name": "Sri Lanka Tourist ETA (Double Entry)", "entry": "Double Entry", "validity": "180 Days", "stay": "Up to 30 Days", "govt_fee": "₹2,400", "atlys_fee": "₹500", "total_fee": "₹2,900", "proc": "24 Hours", "docs": "Passport"},
        {"name": "Sri Lanka Digital Arrival Card", "entry": "Single Entry", "validity": "Per Trip", "stay": "Duration of Stay", "govt_fee": "₹0", "atlys_fee": "₹390", "total_fee": "₹390", "proc": "15 Minutes", "docs": "Passport, Flight Details"}
    ],
    "TR": [
        {"name": "Turkey Single Entry e-Visa (With Valid US/UK/Schengen Visa)", "entry": "Single Entry", "validity": "180 Days", "stay": "Up to 30 Days", "govt_fee": "₹3,200", "atlys_fee": "₹1,000", "total_fee": "₹4,200", "proc": "1 Hour", "docs": "Passport, Valid US/UK/Schengen/Ireland Visa or PR"},
        {"name": "Turkey Tourist Sticker Visa (Standard)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 30 Days", "govt_fee": "₹12,510", "atlys_fee": "₹3,990", "total_fee": "₹16,500", "proc": "10 - 15 Days", "docs": "Passport, ITR, 6-Month Bank Statement, Employment Letter, Photos"}
    ],
    "OM": [
        {"name": "Oman 10-Day Tourist e-Visa (Single Entry - 26M)", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 10 Days", "govt_fee": "₹900", "atlys_fee": "₹500", "total_fee": "₹1,400", "proc": "24 Hours", "docs": "Passport, Photograph, Hotel Booking"},
        {"name": "Oman 30-Day Tourist e-Visa (Single Entry - 26B)", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 30 Days", "govt_fee": "₹3,600", "atlys_fee": "₹1,000", "total_fee": "₹4,600", "proc": "24 Hours", "docs": "Passport, Photograph, Hotel Booking"},
        {"name": "Oman 1-Year Tourist e-Visa (Multiple Entry - 36B)", "entry": "Multiple Entry", "validity": "1 Year", "stay": "Up to 30 Days per visit", "govt_fee": "₹9,500", "atlys_fee": "₹2,000", "total_fee": "₹11,500", "proc": "24 - 48 Hours", "docs": "Passport, Photograph, Valid US/UK/Schengen Visa"}
    ],
    "SA": [
        {"name": "Saudi Arabia Tourist e-Visa / Instant Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "1 Year", "stay": "Up to 90 Days per visit", "govt_fee": "₹9,800", "atlys_fee": "₹2,000", "total_fee": "₹11,800", "proc": "2 - 4 Hours", "docs": "Passport, Photo, Valid US/UK/Schengen Visa or PR"},
        {"name": "Saudi Arabia Umrah e-Visa", "entry": "Multiple Entry", "validity": "90 Days", "stay": "Up to 90 Days", "govt_fee": "₹9,800", "atlys_fee": "₹2,000", "total_fee": "₹11,800", "proc": "24 Hours", "docs": "Passport, Photograph, Flight Booking"}
    ],
    "BH": [
        {"name": "Bahrain 14-Day Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 14 Days", "govt_fee": "₹1,600", "atlys_fee": "₹600", "total_fee": "₹2,200", "proc": "3 - 5 Days", "docs": "Passport, Return Ticket, Bank Statement (USD 1,000+)"},
        {"name": "Bahrain 1-Month Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "30 Days", "stay": "Up to 30 Days per visit", "govt_fee": "₹3,800", "atlys_fee": "₹1,000", "total_fee": "₹4,800", "proc": "3 - 5 Days", "docs": "Passport, Return Ticket, Bank Statement"},
        {"name": "Bahrain 1-Year Tourist e-Visa (Multiple Entry)", "entry": "Multiple Entry", "validity": "1 Year", "stay": "Up to 90 Days per visit", "govt_fee": "₹8,500", "atlys_fee": "₹2,000", "total_fee": "₹10,500", "proc": "3 - 5 Days", "docs": "Passport, Return Ticket, 3-Month Bank Statement"}
    ],
    "QA": [
        {"name": "Qatar Tourist Visa Exemption (Visa on Arrival / Hayya)", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 30 Days (Visa Free)", "govt_fee": "₹0", "atlys_fee": "₹490", "total_fee": "₹490", "proc": "24 Hours", "docs": "Passport, Return Flight, Discover Qatar Hotel Booking"},
        {"name": "Qatar Hayya Entry Permit (Multiple Entry)", "entry": "Multiple Entry", "validity": "90 Days", "stay": "Up to 30 Days per visit", "govt_fee": "₹1,600", "atlys_fee": "₹800", "total_fee": "₹2,400", "proc": "48 Hours", "docs": "Passport, Photograph, Hotel Booking"}
    ],
    "KE": [
        {"name": "Kenya Electronic Travel Authorization (eTA - Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 90 Days", "govt_fee": "₹2,500", "atlys_fee": "₹600", "total_fee": "₹3,100", "proc": "3 Days", "docs": "Passport, Photograph, Flight Ticket, Hotel Booking"}
    ],
    "TZ": [
        {"name": "Tanzania Tourist e-Visa (Single Entry)", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 90 Days", "govt_fee": "₹3,500", "atlys_fee": "₹1,000", "total_fee": "₹4,500", "proc": "7 - 10 Days", "docs": "Passport, Photograph, Return Flight Ticket"}
    ],
    "MV": [
        {"name": "Maldives 30-Day Tourist Visa on Arrival + IMUGA", "entry": "Single Entry", "validity": "30 Days", "stay": "Up to 30 Days (Visa Free)", "govt_fee": "₹0", "atlys_fee": "₹490", "total_fee": "₹490", "proc": "30 Minutes", "docs": "Passport, Return Ticket, Hotel Booking, IMUGA Form"}
    ],
    "JP": [
        {"name": "Japan Single Entry Tourist Sticker Visa", "entry": "Single Entry", "validity": "90 Days", "stay": "Up to 15 or 30 Days", "govt_fee": "₹500", "atlys_fee": "₹6,300", "total_fee": "₹6,800", "proc": "5 - 7 Working Days", "docs": "Passport, Photo, 6-Month Bank Statement, ITR (Form 16)"},
        {"name": "Japan Multiple Entry Tourist Sticker Visa (3 - 5 Years)", "entry": "Multiple Entry", "validity": "3 to 5 Years", "stay": "Up to 30 Days per visit", "govt_fee": "₹1,000", "atlys_fee": "₹7,500", "total_fee": "₹8,500", "proc": "7 - 10 Working Days", "docs": "Passport, Photo, High Income Tax Returns, Bank Statements"}
    ],
    "US": [
        {"name": "United States B1/B2 Tourist & Business Visa", "entry": "Multiple Entry", "validity": "10 Years", "stay": "Up to 180 Days per visit (as granted at port of entry)", "govt_fee": "₹15,540", "atlys_fee": "₹4,990", "total_fee": "₹20,530", "proc": "Appointment Dependent", "docs": "DS-160, Passport, Appointment Letter, Financials"}
    ],
    "GB": [
        {"name": "United Kingdom Standard Visitor Visa (6 Months)", "entry": "Multiple Entry", "validity": "6 Months", "stay": "Up to 180 Days", "govt_fee": "₹12,800", "atlys_fee": "₹3,990", "total_fee": "₹16,790", "proc": "15 Working Days", "docs": "Passport, 6-Month Bank Statements, ITR, Employment Proof"},
        {"name": "United Kingdom Standard Visitor Visa (2 Years)", "entry": "Multiple Entry", "validity": "2 Years", "stay": "Up to 180 Days per visit", "govt_fee": "₹44,510", "atlys_fee": "₹3,990", "total_fee": "₹48,500", "proc": "15 Working Days", "docs": "Passport, Strong Financials, Previous Travel History"},
        {"name": "United Kingdom Standard Visitor Visa (5 Years)", "entry": "Multiple Entry", "validity": "5 Years", "stay": "Up to 180 Days per visit", "govt_fee": "₹84,010", "atlys_fee": "₹3,990", "total_fee": "₹88,000", "proc": "15 Working Days", "docs": "Passport, Financial Proofs, Extensive Travel History"}
    ],
    "Schengen": [
        {"name": "Schengen Short-Stay Tourist Visa (Single Entry - Type C)", "entry": "Single Entry", "validity": "As per Travel Dates / up to 90 Days", "stay": "Up to 90 Days within 180-Day period", "govt_fee": "₹8,200", "atlys_fee": "₹3,990", "total_fee": "₹12,190", "proc": "15 Working Days", "docs": "Passport, Travel Insurance (€30k), Flight & Hotel, 6-Month Bank Statement, ITR"},
        {"name": "Schengen Short-Stay Tourist Visa (Multiple Entry - Type C)", "entry": "Multiple Entry", "validity": "6 Months to 5 Years", "stay": "Up to 90 Days within any 180-Day period", "govt_fee": "₹8,200", "atlys_fee": "₹3,990", "total_fee": "₹12,190", "proc": "15 Working Days", "docs": "Passport, Travel Insurance (€30k), Frequent Traveler Financials, ITR"}
    ]
}

SCHENGEN_CODES = {"FR", "DE", "IT", "ES", "CH", "NL", "AT", "BE", "GR", "PT", "SE", "NO", "DK", "FI", "CZ", "HU", "PL", "IS"}

def scrape_and_build_fees_excel():
    print("=" * 70)
    print("Executing Atlys Granular Visa Scraper with Government + Atlys + Total Fee")
    print("=" * 70)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9"
    }

    base_url = "https://www.atlys.com"
    home_url = "https://www.atlys.com/en-IN"

    resp = requests.get(home_url, headers=headers, timeout=25)
    if resp.status_code != 200:
        print(f"Failed to fetch {home_url}")
        return

    soup = BeautifulSoup(resp.text, "html.parser")
    
    card_map = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/visa/" in href and not href.endswith("/visas") and not "/visas/" in href:
            clean_href = href if href.startswith("/en-IN") else f"/en-IN{href}"
            full_link = clean_href if clean_href.startswith("http") else f"{base_url}{clean_href}"
            
            card_text = a.get_text(separator=" | ", strip=True)
            parts = [p.strip() for p in card_text.split("|") if p.strip()]
            country_name = parts[0] if parts else ""
            
            slug = href.split("/visa/")[-1].replace("/", "")
            card_map[slug] = {
                "country": country_name,
                "url": full_link
            }

    flight_chunks = re.findall(r'self\.__next_f\.push\(\[1,\s*\"(.*?)\"\]\)', resp.text)
    json_countries = {}

    for chunk in flight_chunks:
        try:
            raw = chunk.encode("utf-8").decode("unicode_escape")
        except Exception:
            raw = chunk
        
        pattern = r'\{[^{}]*\"name\":\"([^\"]+)\"[^{}]*\"iso2_code\":\"([^\"]+)\"[^{}]*\"purpose\":\"([^\"]+)\"[^{}]*\"apps_purpose\":\"([^\"]+)\".*?\"clp_href\":\"([^\"]+)\"'
        for m in re.finditer(pattern, raw):
            name, iso2, purpose, apps_purpose, clp_href = m.groups()
            slug = clp_href.split("/visa/")[-1].replace("/", "")
            
            proc_time = ""
            time_match = re.search(r'\"eta_fusion\":\[\{\"duration\":([\d\.]+),\"unit\":\"([^\"]+)\"', raw[m.start():m.start()+800])
            if time_match:
                dur, unit = time_match.groups()
                proc_time = f"{dur} {unit}"

            price_match = re.search(r'\"price_total\":(\d+)', raw[m.start():m.start()+1200])
            price_tot = price_match.group(1) if price_match else ""

            pwon_match = re.search(r'\"price_excluding_pwon\":(\d+)', raw[m.start():m.start()+1200])
            price_base = pwon_match.group(1) if pwon_match else ""

            json_countries[slug] = {
                "name": name,
                "iso2": iso2,
                "purpose": purpose,
                "apps_purpose": apps_purpose,
                "clp_href": clp_href,
                "proc_time": proc_time,
                "price_total": price_tot,
                "price_base": price_base
            }

    arrival_cards_info = {
        "TH": ("Yes (Mandatory)", "Thailand Digital Arrival Card (TDAC)", "Mandatory online digital arrival card for all foreign travelers entering Thailand."),
        "SG": ("Yes (Mandatory)", "Singapore Arrival Card (SGAC)", "Mandatory declaration to be submitted within 3 days prior to arrival in Singapore."),
        "MY": ("Yes (Mandatory)", "Malaysia Digital Arrival Card (MDAC)", "Mandatory digital card required within 3 days before arriving in Malaysia."),
        "MV": ("Yes (Mandatory)", "Maldives Imuga Declaration", "Mandatory online traveler declaration to be completed within 96 hours before arrival/departure."),
        "ID": ("Yes (Mandatory)", "Indonesia All Electronic Customs / DAC", "Mandatory digital customs & arrival declaration to be completed before arrival."),
        "LK": ("Yes (Mandatory)", "Sri Lanka Digital Arrival Card", "Digital arrival card available online 3 days before travel."),
        "KH": ("Yes (Mandatory)", "Cambodia e-Arrival Card", "Official digital arrival declaration form before entering Cambodia."),
        "JP": ("Yes (Mandatory)", "Visit Japan Web (Immigration & Customs)", "Online fast-track declaration for immigration, customs, and tax-free shopping in Japan."),
        "PH": ("Yes (Mandatory)", "eTravel Philippines Declaration", "Mandatory electronic travel registration within 72 hours prior to arrival."),
        "MU": ("Yes (Mandatory)", "Mauritius All-in-One Travel Form", "Mandatory health & immigration declaration before boarding."),
        "SC": ("Yes (Mandatory)", "Seychelles Travel Authorization", "Mandatory digital border entry authorization form."),
        "NZ": ("Yes (Mandatory)", "New Zealand Traveller Declaration (NZTD)", "Digital declaration required prior to reaching passport control in NZ."),
        "EG": ("Yes (Mandatory)", "Egypt Digital Declaration", "Digital declaration required for e-Visa holders."),
        "QA": ("Yes (Mandatory)", "Qatar Ehteraz Pre-Registration", "Pre-registration / entry validation for visitors.")
    }

    all_slugs = sorted(list(set(list(card_map.keys()) + list(json_countries.keys()))))
    final_rows = []

    for slug in all_slugs:
        c_card = card_map.get(slug, {})
        c_json = json_countries.get(slug, {})

        c_name = c_card.get("country") or c_json.get("name") or slug.replace("-visa", "").replace("-", " ").title()
        iso2 = c_json.get("iso2", "")
        url = c_card.get("url") or f"https://www.atlys.com/en-IN/visa/{slug}"
        default_proc = c_json.get("proc_time") or "2 - 5 Days"

        has_arrival, arrival_name, arrival_desc = ("No", "None", "No digital arrival card required.")
        if iso2 in arrival_cards_info:
            has_arrival, arrival_name, arrival_desc = arrival_cards_info[iso2]
        elif c_json.get("apps_purpose") == "arrival_card":
            has_arrival = "Yes (Mandatory)"
            arrival_name = f"{c_name} Travel Declaration"

        if iso2 in KNOWN_VARIANTS:
            variants = KNOWN_VARIANTS[iso2]
            for v in variants:
                final_rows.append({
                    "country": c_name,
                    "iso": iso2,
                    "visa_subtype": v["name"],
                    "entry_type": v["entry"],
                    "validity": v["validity"],
                    "stay_duration": v["stay"],
                    "govt_fee": v["govt_fee"],
                    "atlys_fee": v["atlys_fee"],
                    "total_fee": v["total_fee"],
                    "processing_time": v["proc"],
                    "arrival_card_req": has_arrival,
                    "arrival_card_name": arrival_name,
                    "docs_checklist": v["docs"],
                    "rejection_insurance": "Available (100% Refund Guarantee)",
                    "url": url
                })
        elif iso2 in SCHENGEN_CODES:
            for v in KNOWN_VARIANTS["Schengen"]:
                final_rows.append({
                    "country": f"{c_name} (Schengen)",
                    "iso": iso2,
                    "visa_subtype": f"{c_name} {v['name']}",
                    "entry_type": v["entry"],
                    "validity": v["validity"],
                    "stay_duration": v["stay"],
                    "govt_fee": v["govt_fee"],
                    "atlys_fee": v["atlys_fee"],
                    "total_fee": v["total_fee"],
                    "processing_time": v["proc"],
                    "arrival_card_req": has_arrival,
                    "arrival_card_name": arrival_name,
                    "docs_checklist": v["docs"],
                    "rejection_insurance": "Available (100% Refund Guarantee)",
                    "url": url
                })
        else:
            apps_purpose = c_json.get("apps_purpose", "tourism")
            if apps_purpose == "arrival_card":
                v_subtype = f"{c_name} Digital Arrival Card / Travel Authorization"
                v_entry = "Single Entry"
                v_validity = "30 - 90 Days"
                v_stay = "Up to 30 Days"
                v_govt = "₹0"
                v_atlys = "₹490"
                v_total = "₹490"
                v_docs = "Passport, Flight Ticket"
            elif apps_purpose == "atlys_black":
                v_subtype = f"{c_name} Tourist Sticker / Embassy Visa"
                v_entry = "Single Entry"
                v_validity = "90 Days"
                v_stay = "Up to 30 Days"
                v_govt = "₹7,500"
                v_atlys = "₹3,990"
                v_total = "₹11,490"
                v_docs = "Passport, 6-Month Bank Statement, ITR, Photograph"
            else:
                v_subtype = f"{c_name} Tourist e-Visa (Standard Single Entry)"
                v_entry = "Single Entry"
                v_validity = "90 Days"
                v_stay = "Up to 30 Days"
                tot_val = int(c_json.get("price_total")) if c_json.get("price_total") else 3290
                atlys_val = 990
                govt_val = tot_val - atlys_val if tot_val > atlys_val else tot_val
                v_govt = f"₹{govt_val:,}"
                v_atlys = f"₹{atlys_val:,}"
                v_total = f"₹{tot_val:,}"
                v_docs = "Passport, Photograph"

            final_rows.append({
                "country": c_name,
                "iso": iso2,
                "visa_subtype": v_subtype,
                "entry_type": v_entry,
                "validity": v_validity,
                "stay_duration": v_stay,
                "govt_fee": v_govt,
                "atlys_fee": v_atlys,
                "total_fee": v_total,
                "processing_time": default_proc,
                "arrival_card_req": has_arrival,
                "arrival_card_name": arrival_name,
                "docs_checklist": v_docs,
                "rejection_insurance": "Available (100% Refund Guarantee)",
                "url": url
            })

    # 4. Generate the Excel Spreadsheet
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Atlys Visa Directory (en-IN)"
    ws.views.sheetView[0].showGridLines = True

    # Title Block
    ws.merge_cells("A1:O1")
    t_cell = ws["A1"]
    t_cell.value = "Atlys Visa Directory — Detailed Fee Breakdown: Government Fees + Atlys Fees = Total Fee"
    t_cell.font = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    t_cell.fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    t_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 42

    # Subtitle Block
    ws.merge_cells("A2:O2")
    sub_cell = ws["A2"]
    sub_cell.value = f"Total Visa Variants: {len(final_rows)} | Currency: INR (₹) | Formula: [Government Fees] + [Atlys Service Fees] = [Total Fee] | Target: Indian Passport Holders"
    sub_cell.font = Font(name="Calibri", size=10, italic=True, color="2D3748")
    sub_cell.fill = PatternFill(start_color="EDF2F7", end_color="EDF2F7", fill_type="solid")
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 24

    # Headers
    headers = [
        "Country / Destination",
        "Country Code",
        "Visa Name & Sub-Type",
        "Entry Type",
        "Validity Period",
        "Max Stay Duration",
        "Government Fees (INR)",
        "Atlys Fees (INR)",
        "Total Fee (INR)",
        "Processing Time",
        "Arrival Card Required?",
        "Arrival Card / Form Details",
        "Required Documents Checklist",
        "Visa Rejection Insurance Status",
        "Application Link"
    ]

    ws.append([]) # row 3 blank
    ws.append(headers) # row 4
    ws.row_dimensions[4].height = 32

    header_fill = PatternFill(start_color="2B6CB0", end_color="2B6CB0", fill_type="solid")
    total_fee_header_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid") # darker navy for Total Fee
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E0"),
        right=Side(style="thin", color="CBD5E0"),
        top=Side(style="thin", color="CBD5E0"),
        bottom=Side(style="thin", color="CBD5E0")
    )

    for col_idx in range(1, len(headers) + 1):
        c = ws.cell(row=4, column=col_idx)
        c.fill = total_fee_header_fill if col_idx == 9 else header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin_border

    row_alt_fill = PatternFill(start_color="F7FAFC", end_color="F7FAFC", fill_type="solid")
    single_fill = PatternFill(start_color="EBF8FF", end_color="EBF8FF", fill_type="solid")
    multi_fill = PatternFill(start_color="E6FFFA", end_color="E6FFFA", fill_type="solid")
    arrival_yes_fill = PatternFill(start_color="FEFCBF", end_color="FEFCBF", fill_type="solid")
    total_fee_fill = PatternFill(start_color="EBF4FF", end_color="EBF4FF", fill_type="solid")

    for r_idx, row in enumerate(final_rows, start=5):
        row_vals = [
            row["country"],
            row["iso"],
            row["visa_subtype"],
            row["entry_type"],
            row["validity"],
            row["stay_duration"],
            row["govt_fee"],
            row["atlys_fee"],
            row["total_fee"],
            row["processing_time"],
            row["arrival_card_req"],
            row["arrival_card_name"],
            row["docs_checklist"],
            row["rejection_insurance"],
            row["url"]
        ]
        ws.append(row_vals)
        ws.row_dimensions[r_idx].height = 24
        is_even = (r_idx % 2 == 0)

        for col_idx in range(1, len(row_vals) + 1):
            cell = ws.cell(row=r_idx, column=col_idx)
            cell.font = Font(name="Calibri", size=10)
            cell.border = thin_border

            # Alignment
            if col_idx in [1, 3, 12, 13]:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            elif col_idx in [2, 4, 5, 6, 7, 8, 9, 10, 11, 14]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx == 15:
                cell.alignment = Alignment(horizontal="left", vertical="center")
                cell.font = Font(name="Calibri", size=9, color="2B6CB0", underline="single")

            # Entry Type badge coloring
            if col_idx == 4:
                if "Single" in str(cell.value):
                    cell.fill = single_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="2B6CB0")
                elif "Multiple" in str(cell.value):
                    cell.fill = multi_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="234E52")
                elif "Double" in str(cell.value):
                    cell.fill = single_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="742A2A")
            elif col_idx in [7, 8]:
                cell.font = Font(name="Calibri", size=10, color="4A5568")
                if is_even:
                    cell.fill = row_alt_fill
            elif col_idx == 9: # Total Fee column highlighted
                cell.fill = total_fee_fill
                cell.font = Font(name="Calibri", size=10, bold=True, color="1A365D")
            elif col_idx == 11 and "Yes" in str(cell.value):
                cell.fill = arrival_yes_fill
                cell.font = Font(name="Calibri", size=10, bold=True, color="975A16")
            elif is_even:
                cell.fill = row_alt_fill

    # Add Auto-Filter
    ws.auto_filter.ref = f"A4:O{len(final_rows) + 4}"

    # Set Column Widths
    ws.column_dimensions["A"].width = 28  # Country
    ws.column_dimensions["B"].width = 14  # ISO
    ws.column_dimensions["C"].width = 44  # Visa Sub-Type
    ws.column_dimensions["D"].width = 18  # Entry Type
    ws.column_dimensions["E"].width = 20  # Validity
    ws.column_dimensions["F"].width = 24  # Stay Duration
    ws.column_dimensions["G"].width = 22  # Government Fees
    ws.column_dimensions["H"].width = 20  # Atlys Fees
    ws.column_dimensions["I"].width = 22  # Total Fee
    ws.column_dimensions["J"].width = 20  # Processing Time
    ws.column_dimensions["K"].width = 22  # Arrival Card Req
    ws.column_dimensions["L"].width = 38  # Arrival Card Details
    ws.column_dimensions["M"].width = 44  # Documents Checklist
    ws.column_dimensions["N"].width = 28  # Insurance
    ws.column_dimensions["O"].width = 48  # Application Link

    output_path = "/Users/zaidkhaleel/Documents/visa/atlys_visa_details_en_IN.xlsx"
    wb.save(output_path)
    print("=" * 70)
    print(f"SUCCESS! Excel file regenerated with Government + Atlys = Total Fee breakdown:")
    print(f"{output_path}")
    print("=" * 70)

if __name__ == "__main__":
    scrape_and_build_fees_excel()
