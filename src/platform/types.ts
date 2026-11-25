import type { Analysis } from '../domain/report';
import type { PolicySource } from '../domain/compliance';
import type { Question } from './interviews';
import type { Role } from './auth';
import type { ProjectProfile } from '../domain/profile';

export type InputSource = {id:string;name:string;kind:'brief'|'transcript'|'email'|'meeting'|'questionnaire'|'api'|'database'|'legacy'|'incident'|'policy';stakeholder:string;content:string;sha256:string;version:number;classification:'internal'|'personal'|'sensitive';flags:string[];reviewedBy?:string;reviewNote?:string;createdAt:string};
export type Resolution = {key:string;versionId:string;decision:'resolved'|'accepted-risk'|'false-positive';note:string;evidence:string;actor:string;role:Role;at:string};
export type Approval = {versionId:string;documentHash:string;target:string;decision:'approve'|'reject';note:string;actor:string;role:Role;at:string};
export type ControlDecision = {versionId:string;controlId:string;decision:'mapped'|'excluded';requirementIds:string[];note:string;actor:string;role:Role;sourceHash:string;at:string};
export type KnowledgeReview = {id:string;source:PolicySource;reviewedBy?:string;reviewedAt?:string;note?:string};
export type ThreatDecision={versionId:string;documentHash:string;threatId:string;decision:'mitigated'|'accepted-risk'|'not-applicable';note:string;evidence:string;actor:string;at:string};
export type AssuranceRecord={versionId:string;documentHash:string;kind:'penetration-test'|'deployment-review';outcome:'passed'|'failed';evidence:string;note:string;actor:string;at:string};
export type Project = Partial<ProjectProfile>&{id:string;tenantId:string;name:string;owner:string;members:string[];revision:number;etag:number;createdAt:string;updatedAt:string;expiresAt:number;legalHold:boolean;status:'draft'|'analysing'|'failed';mode:'live'|'demo';brief:string;jurisdictions:('India'|'EU'|'UK'|'US'|'Unspecified')[];sources:InputSource[];questions:Question[];versions:string[];latestVersionId?:string;resolutions:Resolution[];approvals:Approval[];controlDecisions:ControlDecision[];threatDecisions?:ThreatDecision[];assurances?:AssuranceRecord[];baselines:{id:string;versionId:string;documentHash:string;at:string;approvedBy:string;revision:number}[];lastError?:string};
export type ProjectVersion = {id:string;projectId:string;inputRevision:number;number:number;createdAt:string;createdBy:string;documentHash:string;data:Analysis;modelId:string;knowledgeHash:string;parentVersionId?:string;changeReason?:string};
