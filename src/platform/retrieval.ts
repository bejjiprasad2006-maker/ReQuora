import { createHash } from 'node:crypto';
import { searchEvidence, type Evidence } from '../domain/retrieval';
import { PlatformStore } from './store';
import type { ProjectProfile } from '../domain/profile';

export const cosine=(a:number[],b:number[])=>{
  if(a.length!==b.length||!a.length)throw new Error('Embedding dimensions do not match.');
  const dot=a.reduce((sum,value,i)=>sum+value*b[i]!,0),na=Math.hypot(...a),nb=Math.hypot(...b);return na&&nb?dot/(na*nb):0;
};
export const hybridRetrieve=async(root:string,query:string,additional:Evidence[],store:PlatformStore,tenantId:string,settings?:{model:string;baseURL:string;apiKey:string},projectId='shared',expiresAt=Date.now()+30*86400_000,domain:ProjectProfile['domain']='ecommerce')=>{
  const lexical=await searchEvidence(root,query,domain),byId=new Map([...lexical,...additional].map(item=>[item.id,item])),documents=[...byId.values()];
  if(!settings?.model)return {mode:'bm25+approved-project-sources',model:null,evidence:documents};
  const embed=async(input:string)=>{
    const key=projectId+':'+createHash('sha256').update(`${settings.baseURL}|${settings.model}|${input}`).digest('hex');
    const cached=store.get<number[]>(tenantId,'embeddings',key);if(cached)return cached;
    const response=await fetch(`${settings.baseURL.replace(/\/$/,'')}/embeddings`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${settings.apiKey}`},body:JSON.stringify({model:settings.model,input:input.slice(0,16000)}),signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Embedding server returned HTTP ${response.status}.`);
    const body=await response.json() as {data?:{embedding?:number[]}[]};const vector=body.data?.[0]?.embedding;
    if(!vector?.length||vector.length>8192||vector.some(value=>!Number.isFinite(value)))throw new Error('Embedding response is invalid.');
    store.put(tenantId,'embeddings',key,vector,Math.min(expiresAt,Date.now()+30*86400_000));return vector;
  };
  const queryVector=await embed(query);const scored=[];
  // Sequential requests avoid exhausting local embedding-model memory.
  for(const doc of documents)scored.push({...doc,score:cosine(queryVector,await embed(doc.content))});
  scored.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return {mode:'hybrid-bm25-cosine',model:settings.model,evidence:scored.slice(0,12)};
};
