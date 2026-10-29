import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const url = (process.env.OPENCODE_URL || 'http://127.0.0.1:4096').replace(/\/$/, '');
const store = resolve(process.env.ORCHESTRATOR_STORE || new URL('../.state/tasks.json', import.meta.url).pathname);
const timeout = Number(process.env.OPENCODE_TIMEOUT_MS || 12000);
const sleep = ms => new Promise(r => setTimeout(r,ms));
const now = () => new Date().toISOString();
const sessionPath = id => '/api/session/' + encodeURIComponent(id);
const taskId = () => 'TASK-' + randomUUID().slice(0,8);

async function request(method,path,body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url+path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(process.env.OPENCODE_SERVER_PASSWORD ? {authorization:'Basic '+Buffer.from('opencode:'+process.env.OPENCODE_SERVER_PASSWORD).toString('base64')} : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let value;
    try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
    if (!response.ok) throw Error('OpenCode V2 '+method+' '+path+': HTTP '+response.status+' '+JSON.stringify(value).slice(0,300));
    return value?.data ?? value;
  } finally { clearTimeout(timer); }
}
async function withStore(fn) {
  await mkdir(dirname(store), {recursive:true});
  const lock = store+'.lock';
  let handle;
  for(let i=0;i<100;i++){
    try { handle=await open(lock,'wx');break; }
    catch(e){ if(e.code!=='EEXIST')throw e;await sleep(40); }
  }
  if(!handle)throw Error('Store locked; inspect stale .lock before removing it');
  try {
    let tasks=[];
    try {tasks=JSON.parse(await readFile(store,'utf8'));} catch(e){if(e.code!=='ENOENT')throw e;}
    const result=await fn(tasks);
    const tmp=store+'.'+process.pid+'.'+randomUUID()+'.tmp';
    await writeFile(tmp,JSON.stringify(tasks,null,2)+'\n',{mode:0o600});
    await rename(tmp,store);
    return result;
  } finally {await handle.close();await unlink(lock).catch(()=>{});}
}
async function readTasks() {try{return JSON.parse(await readFile(store,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
function find(tasks,id){const task=tasks.find(t=>t.id===id);if(!task)throw Error('Unknown task: '+id);return task;}
async function update(id,patch) {await withStore(tasks=>Object.assign(find(tasks,id),patch,{updatedAt:now()}));}
async function prompt(sessionID,text,delivery) {
  return request('POST',sessionPath(sessionID)+'/prompt',{text,delivery,resume:true});
}
export async function createTask({title,prompt:text,directory,agent}={}) {
  if(!title?.trim() || !text?.trim())throw Error('title and prompt are required');
  const dir=resolve(directory||process.env.ORCHESTRATOR_WORKER_DIR||process.cwd());
  const id=taskId();
  // V2 sessions are created at a location; no legacy /session fallback.
  const session=await request('POST','/api/session',{title:'['+id+'] '+title,directory:dir});
  if(!session?.id)throw Error('V2 create did not return session id');
  const task={id,title,prompt:text,directory:dir,agent:agent||null,sessionId:session.id,status:'dispatching',createdAt:now(),updatedAt:now(),updates:[],error:null};
  await withStore(tasks=>{tasks.push(task);});
  try {
    if(agent)await request('POST',sessionPath(session.id)+'/agent',{agent});
    await prompt(session.id,text,'steer');
    await update(id,{status:'running'});
    return {id,sessionId:session.id,directory:dir,status:'running',delivery:'steer'};
  } catch(e) {
    await update(id,{status:'dispatch_uncertain',error:String(e)});
    throw Error('Task '+id+' session '+session.id+' dispatch uncertain; inspect before retrying: '+e.message);
  }
}
export async function sendTask({id,instruction,delivery='steer'}={}) {
  if(!instruction?.trim())throw Error('instruction required');
  if(!['steer','queue'].includes(delivery))throw Error('delivery must be steer or queue');
  const task=find(await readTasks(),id);
  if(['cancelled','dispatch_failed'].includes(task.status))throw Error('Task is '+task.status);
  const entry={id:randomUUID(),text:instruction,delivery,status:'submitting',createdAt:now()};
  await withStore(tasks=>{find(tasks,id).updates.push(entry);});
  try {
    const admitted=await prompt(task.sessionId,instruction,delivery);
    await withStore(tasks=>{const t=find(tasks,id); const u=t.updates.find(x=>x.id===entry.id); u.status='admitted';u.messageId=admitted?.id??null;t.updatedAt=now();});
    return {id,updateId:entry.id,status:'admitted',delivery,sessionId:task.sessionId,note:'Admitted by OpenCode V2; worker applies at next processing boundary.'};
  } catch(e) {
    await withStore(tasks=>{const t=find(tasks,id);t.updates.find(x=>x.id===entry.id).status='uncertain';t.error=String(e);t.updatedAt=now();});
    throw Error('Steering admission uncertain; inspect session before retrying: '+e.message);
  }
}
export async function listTasks({refresh=false}={}) {
  const tasks=await readTasks();
  if(!refresh)return tasks;
  let active=null,error=null;
  try {active=await request('GET','/api/session/active');}
  catch(e){error=String(e);}
  return tasks.map(t=>({...t,liveActive:active===null?null:Boolean(active?.[t.sessionId]),liveError:error,statusNote:'Active is not equivalent to task completion.'}));
}
export async function cancelTask({id}={}) {
  const task=find(await readTasks(),id);
  const response=await request('POST',sessionPath(task.sessionId)+'/interrupt',undefined);
  await update(id,{status:'cancelled'});
  return {id,status:'cancelled',interrupted:response?.interrupted??null,note:'Interrupt requested; confirm no external side effects remain.'};
}
