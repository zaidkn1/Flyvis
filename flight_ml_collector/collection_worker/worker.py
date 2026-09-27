"""24-hour bounded worker; fixed cohorts, persistent deadline and cloud sync.
Requires a source account, dedicated Supabase project, and an always-on host.
"""
import argparse,datetime as dt,fcntl,hashlib,json,math,os,subprocess,sys,time,uuid
from pathlib import Path
from cloud import Supabase,sync
ROOT=Path(__file__).resolve().parent
PILOT=ROOT.parent/'collection_pilot'
sys.path.insert(0,str(PILOT))
from collector import initialize
UTC=dt.timezone.utc

def write(path,data):
 temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2));temp.replace(path)

def plan(c):
 searches=len(c['routes'])*len(c['initial_lead_days'])
 return {'hours':24,'interval_hours':3,'scheduled_batches':8,'searches_per_batch':min(searches,c['max_searches_per_run']),'max_http_calls_per_batch':c['max_http_calls_per_run'],'max_http_calls_total':8*c['max_http_calls_per_run'],'database':'Supabase (not provisioned)','source':'Duffel adapter (account required)','live_started':False}

def due_slot(state,stamp):
 if stamp>=state['deadline_epoch']:return None
 slot=int((stamp-state['start_epoch'])//10800)
 if slot<0 or slot>=8 or str(slot) in state['batches']:return None
 return slot

def preflight(c,mode):
 if not os.environ.get('DUFFEL_ACCESS_TOKEN'):raise ValueError('Missing DUFFEL_ACCESS_TOKEN')
 if mode=='live' and not(c.get('rights_confirmed_for_historical_storage_and_ml') and c.get('provider_search_charges_and_budget_confirmed')):raise ValueError('Source retention/training rights and request-cost budget must be confirmed before live use')
 remote=Supabase();remote.check();return remote

def run(config,folder,mode):
 folder.mkdir(parents=True,exist_ok=True)
 with (folder/'worker.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  c=json.loads(config.read_text());remote=preflight(c,mode)
  statefile=folder/'state.json';db=folder/'quotes.sqlite';manifest=folder/'manifest.json';snapshot=folder/'config.json'
  digest=hashlib.sha256(json.dumps(c,sort_keys=True).encode()).hexdigest()
  if statefile.exists():
   state=json.loads(statefile.read_text())
   if state['config_sha256']!=digest or state['mode']!=mode:raise ValueError('Cannot change configuration or mode inside an existing campaign')
   if state['status'] in {'complete','complete_local_pending_cloud','stopped_by_user'}:print('Campaign finished or stopped; no new source requests. Use sync for pending uploads.');return
  else:
   if manifest.exists() or db.exists():raise ValueError('Use an empty state directory for a new campaign')
   start=time.time();snapshot.write_text(json.dumps(c,indent=2));initialize(c,manifest,dt.datetime.now(UTC).date())
   state={'campaign_id':str(uuid.uuid4()),'start_epoch':start,'deadline_epoch':start+86400,'start_utc':dt.datetime.fromtimestamp(start,UTC).isoformat(),'deadline_utc':dt.datetime.fromtimestamp(start+86400,UTC).isoformat(),'config_sha256':digest,'mode':mode,'status':'running','batches':{},'reserved_http_calls':0,'uploaded_changes':0,'last_sync_status':'not_run'};write(statefile,state)
  def upload():
   try:state['uploaded_changes']+=sync(db,state['campaign_id'],mode,remote);state['last_sync_status']='success'
   except Exception as e:state['last_sync_status']='failed:'+type(e).__name__
   write(statefile,state)
  while time.time()<state['deadline_epoch']:
   if (folder/'STOP').exists():state['status']='stopped_by_user';write(statefile,state);upload();print('Stopped');return
   slot=due_slot(state,time.time())
   if slot is not None:
    # Reserve the full batch budget before dispatch: a crash never replays this slot.
    if state['reserved_http_calls']+c['max_http_calls_per_run']>8*c['max_http_calls_per_run']:raise ValueError('Campaign call budget exceeded')
    state['reserved_http_calls']+=c['max_http_calls_per_run'];state['batches'][str(slot)]={'status':'started','at':dt.datetime.now(UTC).isoformat()};write(statefile,state)
    command=[sys.executable,str(PILOT/'collector.py'),'collect','--config',str(snapshot),'--manifest',str(manifest),'--db',str(db),'--mode',mode]
    # Killing at deadline also terminates an in-flight provider request. No catch-up batches.
    remaining=max(0,state['deadline_epoch']-time.time())
    try:
     child=subprocess.run(command,capture_output=True,text=True,timeout=remaining)
     if child.returncode==0:
      summary=json.loads(child.stdout);state['batches'][str(slot)]={'status':'finished','result':summary}
     else:state['batches'][str(slot)]={'status':'failed','exit_code':child.returncode}
    except subprocess.TimeoutExpired:state['batches'][str(slot)]={'status':'deadline_terminated'}
    write(statefile,state);upload();print(json.dumps({'batch':slot,'status':state['batches'][str(slot)]['status'],'cloud':state['last_sync_status']}),flush=True)
   else:time.sleep(min(30,max(0,state['deadline_epoch']-time.time())))
  # Database flush may finish after deadline; no source calls occur here.
  upload();state['status']='complete' if state['last_sync_status']=='success' else 'complete_local_pending_cloud';write(statefile,state)
  print(json.dumps({'status':state['status'],'state':str(statefile)}))

def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['plan','run','status','sync']);p.add_argument('--config',type=Path,default=PILOT/'config.json');p.add_argument('--state-dir',type=Path,default=ROOT/'state');p.add_argument('--mode',choices=['test','live'],default='test');a=p.parse_args()
 if a.command=='plan':print(json.dumps(plan(json.loads(a.config.read_text())),indent=2))
 elif a.command=='status':print((a.state_dir/'state.json').read_text() if (a.state_dir/'state.json').exists() else 'NOT STARTED')
 elif a.command=='sync':
  s=json.loads((a.state_dir/'state.json').read_text());print('Uploaded changes:',sync(a.state_dir/'quotes.sqlite',s['campaign_id'],s['mode'],Supabase()))
 else:run(a.config.resolve(),a.state_dir.resolve(),a.mode)
if __name__=='__main__':
 try:main()
 except (ValueError,OSError) as e:
  # Do not print URLs, HTTP bodies, credentials, or exception tracebacks.
  print('Could not start/continue:',type(e).__name__,'— check configuration, credentials and connectivity.',file=sys.stderr);sys.exit(1)
