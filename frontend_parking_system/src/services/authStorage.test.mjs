import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};};
function setup(){const localStorage=storage(),sessionStorage=storage(),exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./authStorage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,localStorage,sessionStorage,Date,JSON});return {s:exports,localStorage,sessionStorage};}
test('remembered session survives a new tab and logout removes it',()=>{const {s,sessionStorage,localStorage}=setup();s.beginSession(true);s.authStorage.setItem('parking.accessToken','access');s.authStorage.setItem('parking.refreshToken','refresh');sessionStorage.clear();s.restoreSession();assert.equal(sessionStorage.getItem('parking.accessToken'),'access');s.clearSession();assert.equal(localStorage.getItem('parking.remembered'),null);});
test('unchecked login removes previous remembered session',()=>{const {s,localStorage,sessionStorage}=setup();s.beginSession(true);s.authStorage.setItem('parking.accessToken','old');s.beginSession(false);s.authStorage.setItem('parking.accessToken','new');sessionStorage.clear();s.restoreSession();assert.equal(sessionStorage.getItem('parking.accessToken'),null);assert.equal(localStorage.getItem('parking.remembered'),null);});
test('expired remembered session is discarded',()=>{const {s,localStorage,sessionStorage}=setup();localStorage.setItem('parking.remembered',JSON.stringify({expiresAt:1,values:{'parking.accessToken':'expired'}}));s.restoreSession();assert.equal(sessionStorage.getItem('parking.accessToken'),null);assert.equal(localStorage.getItem('parking.remembered'),null);});
