import {createHash,randomUUID} from 'node:crypto';
export const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const id=()=>randomUUID();
export function validateDefinition(d){
 if(!d||!Array.isArray(d.roles)||!['scribe','facilitator','white_cell'].every(x=>d.roles.includes(x))) throw Object.assign(new Error('Missing reference roles'),{code:'INVALID_DEFINITION'});
 if(!d.artifactType || !d.workflow || d.workflow.join('>')!=='scribe>facilitator>white_cell')throw Object.assign(new Error('Expected Scribe → Facilitator → White Cell'),{code:'INVALID_DEFINITION'});
 return d;
}
export function transition(status, role,operation){
 const map={draft:{scribe:['artifact.submit','submitted']},submitted:{facilitator:['artifact.forward','in_review'],scribe:['artifact.edit','draft']},in_review:{white_cell:['artifact.accept','accepted'],facilitator:['artifact.return','returned']},returned:{scribe:['artifact.resubmit','submitted']}};
 const candidate=map[status]?.[role];if(!candidate||candidate[0]!==operation)throw Object.assign(new Error('Workflow transition denied'),{code:'WORKFLOW_DENIED'});
 return candidate[1];
}
export function validateCommand(c){for(const x of ['commandId','deviceId','operationType','aggregateId','governingReleaseId'])if(!c?.[x])throw Object.assign(new Error('Missing '+x),{code:'INVALID_COMMAND'});if(!Number.isInteger(c.expectedAggregateVersion)||c.expectedAggregateVersion<0)throw Object.assign(new Error('Bad expected version'),{code:'INVALID_COMMAND'});return c;}
