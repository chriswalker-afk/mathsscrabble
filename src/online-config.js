// The static site calls a separately deployed room service, never a secret.
// Change this hostname only when intentionally configuring your Worker route.
const local=['127.0.0.1','localhost'].includes(location.hostname);
export const ONLINE_API=local?'http://127.0.0.1:8787':'https://rooms.mrwalkermaths.com';
export const ONLINE_SESSION_KEY='equa-nova.online-room.v1';
