(function(root){
 'use strict';
 function isTestUrl(value){try{const u=new URL(value);return u.origin==='https://humanbenchmark.com'&&/^\/tests\/reactiontime\/?$/.test(u.pathname)}catch{return false}}
 function parseScore(value){const m=String(value??'').match(/^\s*(\d+(?:\.\d+)?)\s*(?:ms|毫秒)\s*$/i);if(!m)return null;const score=Number(m[1]);return Number.isFinite(score)&&score>=1&&score<=10000?score:null}
 function readFinalScore(document,href){
  if(!isTestUrl(href))return null;
  const roots=document.querySelectorAll('[data-test].view-score');if(roots.length!==1)return null;
  const headings=roots[0].querySelectorAll('h1');if(headings.length!==1)return null;
  return parseScore(headings[0].textContent);
 }
 root.ReactionHBDetector=Object.freeze({isTestUrl,parseScore,readFinalScore});
})(globalThis);
