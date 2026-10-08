import {describe,it,expect} from 'vitest';
import {PIPELINES,TOOLS,SCHEMAS} from './upstream';
import {createProject,startStage,saveArtifact,submitStage,approveStage,requestRevision,exportProject,importProject,replayAt} from './project-ops';
import type {NewProjectInput} from './types';
const input:NewProjectInput={title:'Test production',prompt:'A documentary',pipeline:'animated-explainer',style:'clean-professional',checkpointPolicy:'manual_all',output:{aspect:'16:9',resolution:'1080p',fps:30},durationSec:60,budgetUsd:0,referenceVideoUrl:''};
describe('OpenMontage production contracts',()=>{
 it('imports the real catalogue including character animation',()=>{expect(PIPELINES.length).toBe(13);expect(PIPELINES.some(p=>p.name==='character-animation')).toBe(true);expect(TOOLS.length).toBeGreaterThan(100);expect(SCHEMAS.length).toBeGreaterThan(20);});
 it('creates a first ready stage and locks downstream stages',()=>{const p=createProject(input);expect(p.stages[0].status).toBe('ready');expect(p.stages.slice(1).every(s=>s.status==='locked')).toBe(true);});
 it('does not start a locked stage',()=>{const p=createProject(input);expect(()=>startStage(p,p.stages[1].name)).toThrow();});
 it('rejects empty or invalid stage artifact',()=>{let p=createProject(input);p=startStage(p,p.stages[0].name);expect(()=>submitStage(p,p.stages[0].name)).toThrow();});
 it('requires explicit approval before unlocking the next stage',()=>{let p=createProject(input);const name=p.stages[0].name;p=startStage(p,name);p=saveArtifact(p,name,'{"brief":"reviewed"}');p=submitStage(p,name);expect(p.stages[0].status).toBe('awaiting_approval');expect(p.stages[1].status).toBe('locked');p=approveStage(p,name);expect(p.stages[0].status).toBe('approved');expect(p.stages[1].status).toBe('ready');});
 it('requires revision notes and keeps an audit trail',()=>{let p=createProject(input);const name=p.stages[0].name;p=submitStage(saveArtifact(startStage(p,name),name,'{}'),name);expect(()=>requestRevision(p,name,'')).toThrow();p=requestRevision(p,name,'Rewrite opening');expect(p.stages[0].revisions).toBe(1);expect(p.decisionLog.at(-1)?.kind).toBe('revision');});
 it('roundtrips JSON while avoiding imported ID collisions',()=>{const p=createProject(input);const q=importProject(exportProject(p),[p.id]);expect(q.id).not.toBe(p.id);expect(q.pipeline).toBe(p.pipeline);expect(q.workerSynced).toBe(false);});
 it('replays prior states without altering current data',()=>{let p=createProject(input);p=startStage(p,p.stages[0].name);expect(replayAt(p,0)[p.stages[0].name]).toBe('ready');expect(p.stages[0].status).toBe('in_progress');});
});
