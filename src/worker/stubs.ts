export const ledger = (env: Env) => env.LEDGER.getByName("main");
export const signal = (env: Env, room: string) => env.SIGNAL_ROOM.getByName(room);
