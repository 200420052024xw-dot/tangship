const BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
export class ApiError extends Error{constructor(message:string,readonly status:number){super(message)}}
async function unwrap<T>(res:Response,path:string){let body:any={};try{body=await res.json()}catch{}if(!res.ok){if(res.status===401&&!['/auth/login','/auth/me'].includes(path))window.dispatchEvent(new Event('admin-session-expired'));throw new ApiError(body.message||body.msg||'请求失败',res.status)}return body.data as T;}
type CacheEntry = { value: unknown; updatedAt: number }
const responseCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<unknown>>()
const cacheTtl = (path:string) => /^\/(operations|runtime)/.test(path) ? 5*60_000 : 30_000
const requestData = async <T>(path:string,options:RequestInit):Promise<T> => unwrap<T>(await fetch(`${BASE}/api/admin${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}}),path)
export function clearApiCache(){responseCache.clear();pendingRequests.clear()}
export function invalidateApiCache(prefix=''){for(const key of responseCache.keys())if(!prefix||key.startsWith(prefix))responseCache.delete(key)}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
  const method=String(options.method||'GET').toUpperCase()
  if(method!=='GET'){
    const value=await requestData<T>(path,options)
    clearApiCache()
    return value
  }
  const cached=responseCache.get(path)
  if(cached&&Date.now()-cached.updatedAt<=cacheTtl(path))return cached.value as T
  const pending=pendingRequests.get(path)
  if(pending)return pending as Promise<T>
  const request=requestData<T>(path,options).then(value=>{responseCache.set(path,{value,updatedAt:Date.now()});return value}).finally(()=>pendingRequests.delete(path))
  pendingRequests.set(path,request)
  return cached ? cached.value as T : request
}
export async function freshApi<T=any>(path:string,options:RequestInit={}):Promise<T>{invalidateApiCache(path);return api<T>(path,options)}
export async function uploadAsset(file:File){const form=new FormData();form.append('file',file);return unwrap<{url:string;objectKey:string}>(await fetch(`${BASE}/api/admin/operations/upload`,{method:'POST',credentials:'include',body:form}),'/operations/upload')}
export const publicApi=async<T>(path:string)=>unwrap<T>(await fetch(`${BASE}/api${path}`),path);
export const money=(cents:number|null|undefined)=>cents==null?'—':`¥${(cents/100).toFixed(2)}`;
export const dateTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';
