// Lift legacy 13×13 boards into the centre of the 19×19 reactor.
import {SIZE,CENTER} from './engine.js';
export const LEGACY_BOARD_SIZE=13;
export function migrateBoardState(state){
 if(!state||!Array.isArray(state.board)||state.board.length===SIZE*SIZE)return state;
 if(state.board.length!==LEGACY_BOARD_SIZE*LEGACY_BOARD_SIZE)return state;
 const offset=CENTER-Math.floor(LEGACY_BOARD_SIZE/2);
 const convert=index=>{
   const n=Number(index);
   if(!Number.isInteger(n)||n<0||n>=LEGACY_BOARD_SIZE**2)throw Error('Invalid legacy grid index');
   return (Math.floor(n/LEGACY_BOARD_SIZE)+offset)*SIZE+n%LEGACY_BOARD_SIZE+offset;
 };
 const board=Array(SIZE*SIZE).fill(null);
 state.board.forEach((tile,i)=>board[convert(i)]=tile);
 const pending={};
 for(const [i,tile] of Object.entries(state.pending||{}))pending[convert(i)]=tile;
 return {...state,board,pending,placementOrder:Array.isArray(state.placementOrder)?
   state.placementOrder.map(convert):state.placementOrder};
}
export function migrateOnlineRoom(room){
 if(!room?.match)return room;
 const match=migrateBoardState(room.match);
 return match===room.match?room:{...room,match};
}
