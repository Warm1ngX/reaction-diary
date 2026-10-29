import {createBroker} from './broker.mjs';
const request=fn=>new Promise((resolve,reject)=>{fn(result=>{const error=chrome.runtime.lastError;if(error)reject(Error(error.message));else resolve(result)})});
const broker=createBroker({
 readState:()=>request(cb=>chrome.storage.session.get('reactionHBBridge',cb)).then(x=>x.reactionHBBridge),
 writeState:state=>request(cb=>chrome.storage.session.set({reactionHBBridge:state},cb)),
 createTab:options=>request(cb=>chrome.tabs.create(options,cb)),
 updateTab:(id,options)=>request(cb=>chrome.tabs.update(id,options,cb)),
 getTab:id=>request(cb=>chrome.tabs.get(id,cb)),
 removeTab:id=>request(cb=>chrome.tabs.remove(id,cb)),
 sendToTab:(id,message)=>request(cb=>chrome.tabs.sendMessage(id,message,{frameId:0},cb)),
 now:()=>Date.now(),uuid:()=>crypto.randomUUID(),
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 broker.handle(message,sender).then(sendResponse,()=>sendResponse({ok:false,error:'助手连接未完成，请重新发起测试'}));return true;
});
chrome.tabs.onRemoved.addListener(id=>{broker.closed(id).catch(()=>{})});
