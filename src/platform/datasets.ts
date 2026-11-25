import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { models } from '../domain/schemas';
import { PlatformStore } from './store';
import { requireRole, HttpError, type Principal } from './auth';

export const datasetSchema=z.object({caseId:z.string().min(2),requirements:z.array(z.object({id:z.string().min(1),statement:z.string().min(10)})).min(1),ambiguities:z.array(z.string()),conflicts:z.array(z.string()),acceptableLifecycles:z.array(z.enum(models)).min(1),manualDurationMs:z.number().positive().optional(),notes:z.string().min(20)});
type Vote={actor:string;role:'architect'|'product_owner';decision:'approve'|'reject';note:string;at:string};
export type ReferenceDataset={id:string;projectId:string;inputHash:string;owner:string;createdBeforeInference:boolean;createdAt:string;reference:z.infer<typeof datasetSchema>;votes:Vote[]};
export const datasetFrozen=(dataset:ReferenceDataset)=>{
  const architect=dataset.votes.findLast(v=>v.role==='architect'),owner=dataset.votes.findLast(v=>v.role==='product_owner');
  return Boolean(architect?.decision==='approve'&&owner?.decision==='approve'&&architect.actor!==owner.actor);
};
export const referenceFrozenBefore=(dataset:ReferenceDataset,inferenceStartedAt:string)=>{
  const architect=dataset.votes.findLast(v=>v.role==='architect'),owner=dataset.votes.findLast(v=>v.role==='product_owner');
  return dataset.createdBeforeInference&&datasetFrozen(dataset)&&Boolean(architect&&owner&&architect.at<inferenceStartedAt&&owner.at<inferenceStartedAt);
};
export const createDataset=(store:PlatformStore,principal:Principal,projectId:string,inputHash:string,createdBeforeInference:boolean,input:unknown,expires?:number)=>{
  requireRole(principal,['analyst','architect','product_owner']);const reference=datasetSchema.parse(input);
  if(new Set(reference.requirements.map(req=>req.id)).size!==reference.requirements.length)throw new HttpError(422,'Reference IDs must be unique.');
  const record:ReferenceDataset={id:randomUUID(),projectId,inputHash,owner:principal.id,createdBeforeInference,createdAt:new Date().toISOString(),reference,votes:[]};
  store.transaction(()=>{store.put(principal.tenantId,'datasets',record.id,record,expires);store.audit(principal.tenantId,principal.id,'reference.created',projectId,{datasetId:record.id,inputHash,createdBeforeInference});});return record;
};
export const voteDataset=(store:PlatformStore,principal:Principal,projectId:string,id:string,decision:'approve'|'reject',note:string,expires?:number)=>{
  requireRole(principal,['architect','product_owner']);z.enum(['approve','reject']).parse(decision);z.string().min(20).max(6000).parse(note);
  const record=store.get<ReferenceDataset>(principal.tenantId,'datasets',id);if(!record||record.projectId!==projectId)throw new HttpError(404,'Reference dataset not found.');
  if(record.owner===principal.id)throw new HttpError(403,'Reference author cannot adjudicate their own dataset.');
  const role=principal.roles.includes('architect')?'architect':'product_owner';record.votes.push({actor:principal.id,role,decision,note,at:new Date().toISOString()});
  store.transaction(()=>{store.put(principal.tenantId,'datasets',id,record,expires);store.audit(principal.tenantId,principal.id,'reference.reviewed',projectId,{datasetId:id,role,decision,frozen:datasetFrozen(record)});});return record;
};
