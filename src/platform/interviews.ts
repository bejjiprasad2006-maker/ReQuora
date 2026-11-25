import { createHash, randomUUID } from 'node:crypto';
import type { Interview } from '../domain/schemas';
import { redactSensitiveData } from '../domain/privacy';
import { projectProfile, type ProjectProfile } from '../domain/profile';

export type Question = {id:string;role:string;topic:string;question:string;reason:string;blocking:boolean;requirementIds:string[];status:'open'|'answered';answer?:string;answeredBy?:string;answeredAt?:string;followUp?:string};
export const interviewTemplates = [
  {role:'product_owner',topic:'scope',question:'What business outcome, users and features define the release scope, and what is explicitly excluded?',reason:'Establish an agreed business boundary.',blocking:true},
  {role:'legal',topic:'jurisdiction',question:'Which countries or regions will the merchant serve, and which legal entity operates the store?',reason:'Determine legal scope without assuming the merchant is a regulated lender.',blocking:true},
  {role:'product_owner',topic:'returns',question:'What cancellation, return and refund policy has the merchant approved, including exceptions and responsible owners?',reason:'Prevent contradictory customer commitments.',blocking:true},
  {role:'architect',topic:'payments',question:'Will payments use redirect, embedded or direct card handling, and what provider contract, authentication and retry behaviour apply?',reason:'Define payment scope and integrity risks.',blocking:true},
  {role:'security',topic:'access',question:'Which roles can read customer data, change orders, approve returns and execute refunds, and how are those permissions verified?',reason:'Separate duties and prevent unauthorised operations.',blocking:true},
  {role:'operations',topic:'performance',question:'What measurable latency, concurrent workload and availability targets are required, and how will they be tested?',reason:'Replace vague performance expectations with observable criteria.',blocking:true},
  {role:'operations',topic:'recovery',question:'What recovery time, recovery point and restore-test objectives does the operations owner accept?',reason:'Specify failure consequences and operational evidence.',blocking:true},
  {role:'legal',topic:'retention',question:'What customer/order data is retained, for what purpose and duration, and how are deletion requests and legal holds handled?',reason:'Set a reviewed retention policy rather than inventing one.',blocking:true},
  {role:'project_manager',topic:'delivery',question:'What budget, delivery deadline, stakeholder availability and change frequency constrain this project?',reason:'Ground lifecycle ratings in actual delivery constraints.',blocking:true},
  {role:'architect',topic:'integrations',question:'Which legacy systems and APIs must integrate, what specifications exist, and which behaviours need a prototype?',reason:'Identify uncertainty, interface contracts and feasibility risk.',blocking:false},
] as const;
export const questionId = (topic:string,question:string) => 'Q-'+createHash('sha256').update(`${topic}:${question.toLowerCase().trim()}`).digest('hex').slice(0,12);
export const initialQuestions = (profile:Partial<ProjectProfile>={}):Question[] => {
  const finance=projectProfile(profile).domain==='finance';
  const templates=finance?[
    ...interviewTemplates.filter(item=>!['jurisdiction','returns','payments','access'].includes(item.topic)),
    {role:'legal',topic:'jurisdiction',question:'Which legal entity operates the financial service, what licence or regulated activity applies, and which jurisdictions and current source packs govern it?',reason:'Confirm the entity-specific regulatory perimeter and exclusions.',blocking:true},
    {role:'product_owner',topic:'financial-rules',question:'Which financial transactions or decisions are in scope, and who approves amount limits, precision/rounding, disclosures, exceptions and complaints?',reason:'Ground financial business rules in approved policy.',blocking:true},
    {role:'security',topic:'access',question:'Which customer, operator, maker, checker, auditor and third-party roles may access records or authorise transactions, and which duties must be separated?',reason:'Protect financial records and prevent self-approved transactions.',blocking:true},
    {role:'architect',topic:'integrity',question:'How are ledger or case changes reconciled, replayed safely, reversed and linked to immutable evidence when an integration fails?',reason:'Define integrity, recovery and exception verification.',blocking:true},
    {role:'legal',topic:'financial-compliance',question:'Which KYC/AML, reporting, fairness, consent and customer-protection obligations apply to this service, with exact source provisions and accountable reviewers?',reason:'Avoid unsupported legal mappings and automated high-impact decisions.',blocking:true},
    {role:'security',topic:'threats',question:'What assets and trust boundaries need threat modelling, which attack scenarios matter, and what evidence is needed to accept residual risk?',reason:'Require explicit threat mitigation and independent risk decisions.',blocking:true},
  ]:interviewTemplates;
  return templates.map(item=>({...item,requirementIds:[],status:'open',id:questionId(item.topic,item.question)}));
};
export const mergeQuestions = (existing:Question[],interview:Interview):Question[] => {
  const result=structuredClone(existing);
  for(const item of interview.questions){
    const id=questionId(item.topic,item.question);
    if(result.some(q=>q.id===id || item.topic!=='analysis'&&q.status==='answered'&&q.topic===item.topic))continue;
    result.push({...item,id,status:'open'});
  }
  return result;
};
export const answerQuestion = (question:Question,answer:string,userId:string) => {
  const safe=redactSensitiveData(answer.trim()).text;
  if(safe.length<10 || safe.length>6000)throw new Error('Answer must contain 10–6,000 characters.');
  const vague=/^(?:not sure|unknown|tbd|asap|fast|secure|normal|standard|yes|no)[.!\s]*$/i.test(safe);
  const needsNumber=['performance','recovery'].includes(question.topic) && !/\d/.test(safe) && !/\b(out of scope|not applicable|excluded)\b.{10,}/i.test(safe);
  const followUp=vague?'Please supply a concrete decision, accountable owner, or explicit unresolved issue.':needsNumber?'Please state measurable numeric targets, units and workload, or explicitly exclude this objective with a reason.':undefined;
  question.answer=safe;question.answeredBy=userId;question.answeredAt=new Date().toISOString();
  question.status=followUp?'open':'answered';question.followUp=followUp;
  return question;
};
export const injectionFlags = (text:string) => [
  /ignore\s+(all\s+)?(previous|prior|system)\s+instructions/i,
  /(?:reveal|print|exfiltrate|send).{0,30}(?:system prompt|api.?key|password|secret)/i,
  /<\/?(?:system|developer|assistant)>|\[INST\]/i,
  /(?:powershell|cmd\.exe|curl\s+https?:|eval\s*\()/i,
].flatMap((pattern,index)=>pattern.test(text)?[`INJECTION_PATTERN_${index+1}`]:[]);
export const sourceId = () => randomUUID();
