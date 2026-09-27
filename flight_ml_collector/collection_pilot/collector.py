"""Bounded search-only collector. No order/payment endpoints. Python standard library.
This is a raw-data feasibility collector, NOT a baggage eligibility engine.
"""
import argparse,datetime as dt,hashlib,json,os,sqlite3,urllib.request,urllib.error,urllib.parse,uuid
from pathlib import Path
from decimal import Decimal,InvalidOperation
ROOT=Path(__file__).resolve().parent

def now():return dt.datetime.now(dt.timezone.utc).isoformat()
def clean(value):
 # Search-only payloads need no authentication/client keys or passenger PII stored.
 if isinstance(value,dict):return {k:clean(v) for k,v in value.items() if k not in {'client_key','access_token','authorization','given_name','family_name','email','phone_number','identity_documents'}}
 if isinstance(value,list):return [clean(v) for v in value]
 return value

def initialize(config,path,start):
 if path.exists():raise ValueError('Manifest already exists; preserve fixed departure dates.')
 jobs=[]
 for origin,destination in config['routes']:
  for lead in config['initial_lead_days']:
   day=(start+dt.timedelta(days=lead)).isoformat()
   jobs.append({'key':f'{origin}-{destination}|{day}','origin':origin,'destination':destination,'departure_date':day})
 manifest={'created_at':now(),'cohort_start':start.isoformat(),'jobs':jobs,'config_sha256':hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()}
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(manifest,indent=2));return manifest

def normalize(offer,observed_at,detail):
 segments=[]
 for sl in offer.get('slices',[]):
  for s in sl.get('segments',[]):
   segments.append({k:s.get(k) for k in ['id','origin','destination','departing_at','arriving_at','marketing_carrier','operating_carrier','marketing_carrier_flight_number','operating_carrier_flight_number','passengers','stops']})
 return {'offer_id':offer.get('id'),'observed_at':observed_at,'live_mode':offer.get('live_mode'),'expires_at':offer.get('expires_at'),
 'quoted_total_amount':offer.get('total_amount'),'currency':offer.get('total_currency'),'tax_amount':offer.get('tax_amount'),
 'segments':segments,'conditions':offer.get('conditions'),'available_services':offer.get('available_services') if detail else None,
 'detail_fetched':detail,'baggage_requirement_status':'UNKNOWN','complete_required_bundle_total':None,'eligible_for_customer_booking':False,
 'reason':'Raw allowances/services captured; per-passenger/per-segment weight, dimensions, fees and ticket conditions still require validation.'}

def connect(path):
 path.parent.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(path)
 db.executescript('''CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, started_at TEXT, finished_at TEXT, mode TEXT, config_json TEXT);
 CREATE TABLE IF NOT EXISTS searches(id TEXT PRIMARY KEY, run_id TEXT, query_key TEXT, started_at TEXT, completed_at TEXT, status TEXT, http_status INTEGER, raw_json TEXT);
 CREATE TABLE IF NOT EXISTS observations(search_id TEXT, offer_id TEXT, observed_at TEXT, stage TEXT, normalized_json TEXT, raw_json TEXT, PRIMARY KEY(search_id,offer_id,stage));
 CREATE TABLE IF NOT EXISTS detail_events(search_id TEXT, offer_id TEXT, observed_at TEXT, status TEXT, http_status INTEGER);
 ''');return db

class API:
 def __init__(self,token,limit):self.token=token;self.limit=limit;self.calls=0
 def call(self,method,path,payload=None):
  if self.calls>=self.limit:raise RuntimeError('HTTP call budget exhausted')
  self.calls+=1
  request=urllib.request.Request('https://api.duffel.com'+path,data=json.dumps(payload).encode() if payload is not None else None,method=method,headers={'Authorization':'Bearer '+self.token,'Duffel-Version':'v2','Accept':'application/json','Content-Type':'application/json'})
  with urllib.request.urlopen(request,timeout=45) as response:return json.load(response)

def store_offer(db,sid,offer,stage):
 stamp=now();safe=clean(offer)
 db.execute('INSERT OR REPLACE INTO observations VALUES(?,?,?,?,?,?)',(sid,offer['id'],stamp,stage,json.dumps(normalize(safe,stamp,stage=='detail')),json.dumps(safe)));db.commit()

def collect(config,manifest,dbpath,mode):
 token=os.environ.get('DUFFEL_ACCESS_TOKEN')
 if not token:raise ValueError('Set DUFFEL_ACCESS_TOKEN locally; do not paste credentials into chat.')
 if mode=='live' and not (config['rights_confirmed_for_historical_storage_and_ml'] and config['provider_search_charges_and_budget_confirmed']):raise ValueError('Confirm provider retention/training rights and search cost budget in config before live collection.')
 if manifest['config_sha256']!=hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest():raise ValueError('Config changed since manifest creation. Create a new cohort manifest; do not alter an existing cohort.')
 api=API(token,config['max_http_calls_per_run']);db=connect(dbpath);run=str(uuid.uuid4())
 db.execute('INSERT INTO runs VALUES(?,?,?,?,?)',(run,now(),None,mode,json.dumps(config)));db.commit()
 count=0
 try:
  for job in manifest['jobs']:
   if dt.date.fromisoformat(job['departure_date'])<=dt.datetime.now(dt.timezone.utc).date():continue
   if count>=config['max_searches_per_run']:break
   count+=1;sid=str(uuid.uuid4())
   db.execute('INSERT INTO searches VALUES(?,?,?,?,?,?,?,?)',(sid,run,job['key'],now(),None,'started',None,None));db.commit()
   try:
    response=api.call('POST',f"/air/offer_requests?return_offers=true&supplier_timeout={config['supplier_timeout_ms']}",{'data':{'slices':[{k:job[k] for k in ['origin','destination','departure_date']}],'passengers':config['passengers'],'cabin_class':config['cabin_class'],'max_connections':config['max_connections']}})
    data=response['data']
    if data.get('live_mode') is not (mode=='live'):raise ValueError('Provider live/test mode differs from requested mode')
    offers=data.get('offers')
    if not isinstance(offers,list):raise ValueError('Offer list missing from response')
    db.execute('UPDATE searches SET completed_at=?,status=?,http_status=?,raw_json=? WHERE id=?',(now(),'offers_returned' if offers else 'no_offers_returned',200,json.dumps(clean(response)),sid));db.commit()
    for offer in offers:store_offer(db,sid,offer,'search')
    # Stable bounded sample; explicitly not exhaustive baggage-price coverage.
    def rank(o):
     try:amount=Decimal(o.get('total_amount','Infinity'))
     except (InvalidOperation,TypeError):amount=Decimal('Infinity')
     return (o.get('total_currency') or '',amount,o['id'])
    for offer in sorted(offers,key=rank)[:config['max_offer_details_per_search']]:
     try:
      detail=api.call('GET','/air/offers/'+urllib.parse.quote(offer['id'],safe='')+'?return_available_services=true')['data']
      if detail.get('live_mode') is not (mode=='live'):raise ValueError('Offer mode mismatch')
      store_offer(db,sid,detail,'detail');status='success';code=200
     except urllib.error.HTTPError as e:status='http_error';code=e.code
     except (OSError,ValueError,KeyError,RuntimeError):status='detail_failed';code=None
     db.execute('INSERT INTO detail_events VALUES(?,?,?,?,?)',(sid,offer['id'],now(),status,code));db.commit()
   except urllib.error.HTTPError as e:
    db.execute('UPDATE searches SET completed_at=?,status=?,http_status=? WHERE id=?',(now(),'http_error',e.code,sid));db.commit()
    if e.code in [401,403,429]:break
   except (OSError,ValueError,KeyError,RuntimeError):
    db.execute('UPDATE searches SET completed_at=?,status=? WHERE id=?',(now(),'request_or_validation_failed',sid));db.commit()
 finally:
  db.execute('UPDATE runs SET finished_at=? WHERE id=?',(now(),run));db.commit();db.close()
 return {'run_id':run,'search_attempts':count,'http_calls':api.calls,'database':str(dbpath),'mode':mode}

def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['init','plan','collect']);p.add_argument('--config',type=Path,default=ROOT/'config.json');p.add_argument('--manifest',type=Path,default=ROOT/'manifest.json');p.add_argument('--db',type=Path);p.add_argument('--mode',choices=['test','live'],default='test');p.add_argument('--start',type=dt.date.fromisoformat)
 a=p.parse_args();c=json.loads(a.config.read_text())
 if a.command=='init':m=initialize(c,a.manifest,a.start or dt.datetime.now(dt.timezone.utc).date());print(json.dumps(m,indent=2))
 elif a.command=='plan':print(json.dumps({'jobs_per_initial_cohort':len(c['routes'])*len(c['initial_lead_days']),'searches_per_suggested_day':2*len(c['routes'])*len(c['initial_lead_days']),'maximum_calls_per_suggested_day':2*c['max_http_calls_per_run'],'scheduler_installed':False,'live_collection_started':False},indent=2))
 else:print(json.dumps(collect(c,json.loads(a.manifest.read_text()),a.db or ROOT/('quotes_'+a.mode+'.sqlite'),a.mode),indent=2))
if __name__=='__main__':main()
