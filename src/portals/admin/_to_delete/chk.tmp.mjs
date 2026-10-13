import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.cwd() + '/');
let ok = 0, bad = 0;
let parse;
try { ({ parseSync: parse } = require('rolldown/experimental')); } catch (e) { console.log('no experimental parseSync', e.message.slice(0,80)); }
if (!parse) { try { ({ parseSync: parse } = require('rolldown/parseAst')); } catch (e) { console.log('no parseAst', e.message.slice(0,80)); } }
console.log('parser', typeof parse);
