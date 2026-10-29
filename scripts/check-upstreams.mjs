#!/usr/bin/env node
// Explicit developer CLI: public checks only, no SMTP/push/model calls, no host inspection.
import {fileURLToPath}from'node:url'
import{UpdateMonitor,updateSchema}from'../lib/updates.js'
import{updateCatalog}from'../lib/update-catalog.js'
const config=Object.fromEntries(Object.entries(updateSchema).map(([key,value])=>[key,value.meta.default??'']));
Object.assign(config,{updatesEnabled:true,updatesAutoAnalyze:false,updatesMailEnabled:false,updatesPushService:'off'});
const monitor=new UpdateMonitor({catalog:updateCatalog,directory:fileURLToPath(new URL('../.cache/upstream-cli/',import.meta.url)),settings:()=>config});
await monitor.check();const state=monitor.snapshot();
for(const r of state.results)console.log(r.status.padEnd(9),r.name,r.current,'→',r.latest??'未确定');
console.log('完整说明见docs/UPDATES.md；本次报告位于.cache/upstream-cli/upstream-updates.json。');
if(state.lastError){console.error(state.lastError);process.exitCode=2}
