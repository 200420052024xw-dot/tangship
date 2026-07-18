const BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
export class ApiError extends Error{constructor(message:string,readonly status:number){super(message)}}
async function unwrap<T>(res:Response,path:string){let body:any={};try{body=await res.json()}catch{}if(!res.ok){if(res.status===401&&!['/auth/login','/auth/me'].includes(path))window.dispatchEvent(new Event('admin-session-expired'));throw new ApiError(body.message||body.msg||'请求失败',res.status)}return body.data as T;}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{return unwrap<T>(await fetch(`${BASE}/api/admin${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}}),path)}
export async function uploadAsset(file:File){const form=new FormData();form.append('file',file);return unwrap<{url:string;objectKey:string}>(await fetch(`${BASE}/api/admin/operations/upload`,{method:'POST',credentials:'include',body:form}),'/operations/upload')}
export const publicApi=async<T>(path:string)=>unwrap<T>(await fetch(`${BASE}/api${path}`),path);
export const money=(cents:number|null|undefined)=>cents==null?'—':`¥${(cents/100).toFixed(2)}`;
export const dateTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';
