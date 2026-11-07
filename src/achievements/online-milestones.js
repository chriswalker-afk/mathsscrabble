/** Pass D: compact, server-generated milestones for Signal Clash.
 * Called ONLY by the validated room rule transitions in online-rules.js.
 * A client never supplies the award event, its points, or opponent details.
 * Views expose only the authenticated seat's public progress evidence.
 */
import {isBlank,tilePool} from '../engine.js';
import {localStandings} from '../multiplayer.js';
export const MAX_ONLINE_MILESTONES=48;
const validSeat=(room,seat)=>Number.isInteger(seat)&&seat>=0&&seat<room.people.length;
export function onlineRoomScope(room){
 if(!room||typeof room.code!=='string'||!Number.isSafeInteger(room.createdAt))
  throw Error('Missing authoritative room identity.');
 return 'room-'+room.code.toLowerCase()+'-'+room.createdAt.toString(36);
}
function evidence(room,seat,type,data,variant='first'){
 const roomId=onlineRoomScope(room),scopeId=roomId;
 return {id:'online-'+roomId+'-'+seat+'-'+type+'-'+variant,
  mode:'online',type,scopeId,roomId,authority:'server-confirmed',data};
}
export function recordOnlineMilestone(room,seat,type,data,variant='first'){
 if(!validSeat(room,seat)||!['room-joined','lobby-multi','match-started',
   'move-scored','match-finished'].includes(type))return room;
 const log=Array.isArray(room.achievementMilestones)?room.achievementMilestones:[];
 const marker=seat+':'+type+':'+variant;
 if(log.some(x=>x.marker===marker))return room;
 const event=evidence(room,seat,type,data,variant);
 // Capped to 48 milestone receipts, not to raw turns; normally at most 6/seat.
 return {...room,achievementMilestones:[...log,{marker,seat,event}].slice(-MAX_ONLINE_MILESTONES)};
}
export function registerOnlineLobby(room){
 return recordOnlineMilestone(room,0,'room-joined',{playerCount:1});
}
export function registerOnlineJoin(room,seat){
 let next=recordOnlineMilestone(room,seat,'room-joined',{playerCount:room.people.length});
 if(room.people.length>=2)for(let i=0;i<room.people.length;i++)
  next=recordOnlineMilestone(next,i,'lobby-multi',{playerCount:room.people.length});
 return next;
}
export function registerOnlineStart(room){
 let next=room;
 for(let seat=0;seat<room.people.length;seat++)
  next=recordOnlineMilestone(next,seat,'match-started',{
   playerCount:room.people.length,isHost:seat===0
  });
 return next;
}
export function registerOnlineScored(room,seat,{board,pending,move,points}){
 if(!validSeat(room,seat)||!Array.isArray(board)||!move||!points)return room;
 const placed=Object.values(pending).filter(t=>t&&t.value!=='=');
 const data={
  points:points.total,
  wildcards:placed.filter(isBlank).length,
  crossing:move.indices.filter(index=>Boolean(board[index])).length,
  numberTiles:placed.filter(t=>tilePool(t)==='numbers').length,
  premium:points.tileScores.some(t=>!t.existing&&['2T','3T','2E','3E'].includes(t.premium)),
  tileSet:room.tileSet||'natural'
 };
 let next=recordOnlineMilestone(room,seat,'move-scored',data);
 // A second receipt is retained only if the first scoring move was unconnected.
 // Both receipts are server-derived, not client-visible "awards".
 if(data.crossing>=1)next=recordOnlineMilestone(next,seat,'move-scored',data,'connected');
 return next;
}
export function registerOnlineFinish(room){
 if(room.phase!=='finished'||room.match?.phase!=='finished')return room;
 const results=room.match.finalScores||localStandings(room.match);
 const everyoneScored=room.match.players.every(p=>p.scoredMoves>0);
 let next=room;
 for(let seat=0;seat<room.people.length;seat++){
  const entry=results.find(x=>x.index===seat);
  if(!entry)continue;
  next=recordOnlineMilestone(next,seat,'match-finished',{
   playerCount:room.people.length,scoredMoves:room.match.players[seat].scoredMoves,
   winner:Boolean(entry.winner),everyoneScored,participated:true,isHost:seat===0
  });
 }
 return next;
}
export function onlineSeatEvidence(room,seat){
 if(!validSeat(room,seat))return [];
 const records=Array.isArray(room.achievementMilestones)?room.achievementMilestones:[];
 return records.filter(x=>x.seat===seat).map(x=>x.event);
}
