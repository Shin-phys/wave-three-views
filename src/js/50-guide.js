/* =========================================================
   「y-t図をつくる」ガイド（02-yt-animation.md）
   画面の順番：1か所を選ぶ（段階1）→ 点を打って予想する（段階4）
              → 記録する（段階2・3を1本のアニメーションに）→ y-t図からy-x図へ（段階5）
   文言は操作の指示だけにし、結論は言わない（WAVE-N-05）。
   ========================================================= */
(function(A){
'use strict';
var G = A.guide = {active:false, step:1, dots:{}, pred:[], predMode:false, recorded:false, anim:null, pen:null, trace:[]};
A.dim = 0;
var PEN='#6fe3c1';

function body(html){ A.$('#guideBody').innerHTML=html; }
function hasSrc(){ return !!A.src; }
function dotCount(){ return Object.keys(G.dots).length; }

/* 暗くする量をなめらかに変える */
var dimTarget=0, dimRaf=null;
function setDim(on){
  dimTarget=on?1:0;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ A.dim=dimTarget; A.view.renderOv(); return; }
  if(dimRaf) return;
  (function step(){
    var d=dimTarget-A.dim;
    if(Math.abs(d)<0.02){ A.dim=dimTarget; dimRaf=null; A.view.renderOv(); return; }
    A.dim+=d*0.12; A.view.renderOv(); dimRaf=requestAnimationFrame(step);
  })();
}

/* ---------- 打点と予想の道具（段階4） ---------- */
var predDrawing=false;
var guideTool = {
  kind:'guide',
  vidDown:function(p){
    if(G.step!==2 || !A.lines.length) return false;
    // 近くの目印（玉・赤い線）に吸い付ける
    G.dots[A.cur]=A.yt.snapY(A.cur, A.lines[0].x, p.y, 36/A.view.s);
    var adv=parseInt((A.$('#gAdv')||{}).value||'1',10);
    updateCounts();
    if(A.cur>=A.N()-1){
      A.toStart();
      A.toast('最後のコマまで打ちました。最初のコマにもどります');
    } else {
      A.goto(Math.min(A.N()-1, A.cur+adv));
      A.yt.follow();
    }
    A.yt.renderOv();
  },
  ytDown:function(p){
    if(G.step!==2 || !G.predMode) return false;
    predDrawing=true;
    addPred(p);
  },
  ytMove:function(p){ if(!predDrawing) return false; addPred(p); },
  ytUp:function(){ predDrawing=false; },
  drawVid:function(ctx,V){
    if(!A.lines.length) return;
    var L=A.lines[0];
    if(G.step===2 && G.dots[A.cur]!=null){
      ctx.strokeStyle=PEN; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(V.sx2c(L.x),V.sy2c(G.dots[A.cur]),6,0,Math.PI*2); ctx.stroke();
    }
  }
};
function addPred(p){
  var f=A.yt.c2f(p.cx)-0.5, y=A.yt.c2y(p.cy);
  // 時間が後戻りする点は捨てる（左から右へなぞる）
  var last=G.pred[G.pred.length-1];
  if(last && f<last.f-0.2) return;
  G.pred.push({f:f,y:y});
}

/* ---------- 重ね描き ---------- */
function drawVidOv(ctx,V){
  if(!G.active || !G.pen || !A.lines.length) return;
  var L=A.lines[0], x=V.sx2c(L.x), y=G.pen.y==null?null:V.sy2c(G.pen.y);
  if(y==null) return;
  ctx.strokeStyle=PEN; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(V.cssW,y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle=PEN; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
}
function drawYtOv(ctx,Y){
  if(!G.active) return;
  // 予想
  if(G.pred.length>1){
    ctx.strokeStyle=PEN; ctx.globalAlpha=0.9; ctx.lineWidth=2.5; ctx.setLineDash([7,5]);
    ctx.beginPath();
    G.pred.forEach(function(q,i){ var x=Y.f2c(q.f+0.5), y=Y.y2c(q.y); if(i)ctx.lineTo(x,y); else ctx.moveTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
  }
  // 打った点
  ctx.fillStyle=PEN; ctx.strokeStyle='#06121f'; ctx.lineWidth=1.5;
  Object.keys(G.dots).forEach(function(k){
    var x=Y.f2c(+k+0.5), y=Y.y2c(G.dots[k]);
    ctx.beginPath(); ctx.arc(x,y,4.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  });
  // ペンの跡とガイド線（段階2）
  if(G.trace.length && A.src.kind==='flip'){
    // ぱらぱら漫画は点で記録する
    ctx.fillStyle=PEN; ctx.strokeStyle='#1b2a44'; ctx.lineWidth=1.2;
    G.trace.forEach(function(q){ if(q.y==null) return; ctx.beginPath(); ctx.arc(Y.f2c(q.f+0.5),Y.y2c(q.y),5,0,Math.PI*2); ctx.fill(); ctx.stroke(); });
  } else if(G.trace.length>1){
    ctx.strokeStyle=A.src.light?'#1b2a44':'#ffffff'; ctx.lineWidth=2; ctx.globalAlpha=0.85; ctx.beginPath();
    var started=false;
    G.trace.forEach(function(q){
      if(q.y==null){ started=false; return; }
      var x=Y.f2c(q.f+0.5), y=Y.y2c(q.y);
      if(started) ctx.lineTo(x,y); else { ctx.moveTo(x,y); started=true; }
    });
    ctx.stroke(); ctx.globalAlpha=1;
  }
  if(G.pen && G.pen.y!=null){
    var px=Y.f2c(G.pen.f+0.5), py=Y.y2c(G.pen.y), x0=A.$('#ytWrap').scrollLeft;
    ctx.strokeStyle=PEN; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(x0,py); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=PEN; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px-9,py-5); ctx.lineTo(px-9,py+5); ctx.fill();
  }
}

/* ---------- 段階2・3：記録のアニメーション ---------- */
function speedOf(){
  var v=(A.$('#gSpeed')||{}).value||'normal', flip=A.src.unit==='T';
  var map=flip?{slow:1,normal:2,fast:4}:{slow:8,normal:16,fast:32};
  return {fps:map[v], k:{slow:1.6,normal:1,fast:0.5}[v]};
}
function stripCanvas(f, x, bw){
  var s=A.src, w=Math.max(2,Math.round(bw)), x0=A.clamp(Math.round(x-w/2),0,s.W-w);
  var c=A.canvas(w,s.H), cx=c.getContext('2d');
  cx.putImageData(s.frames[f], -x0, 0, x0, 0, w, s.H);
  return c;
}
function fly(f, group, ms, tok){
  return new Promise(function(res){
    if(tok.cancel){ res(); return; }
    var s=A.src, L=A.lines[0], V=A.view;
    A.yt.follow(f+group/2);
    var vr=A.$('#cvVid').getBoundingClientRect(), yr=A.$('#cvYt').getBoundingClientRect();
    var bw=Math.max(4,A.band+2), c=stripCanvas(f,L.x,bw);
    var w0=bw*V.s, h=V.dispH;
    var sx=vr.left+V.sx2c(L.x)-w0/2, sy=vr.top;
    var w1=Math.max(2,group*A.ppf*V.s), ex=yr.left+A.yt.f2c(f), ey=yr.top;
    c.style.cssText='position:fixed;left:'+sx+'px;top:'+sy+'px;width:'+w0+'px;height:'+h+'px;z-index:30;pointer-events:none;box-shadow:0 0 0 1px '+PEN+';transform-origin:0 0';
    document.body.appendChild(c);
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var anim=c.animate([
      {transform:'translate(0,0) scaleX(1)'},
      {transform:'translate(0,-14px) scaleX(1)',offset:0.25},
      {transform:'translate('+(ex-sx)+'px,'+(ey-sy)+'px) scaleX('+(w1/w0)+')'}
    ],{duration:reduce?1:ms,easing:'ease-in-out',fill:'forwards'});
    anim.onfinish=function(){ c.remove(); res(); };
    anim.oncancel=function(){ c.remove(); res(); };
  });
}
async function record(){
  if(!A.lines.length) return;
  cancelAnim();
  A.stop();
  var tok=G.anim={cancel:false};
  var N=A.N(), L=A.lines[0], sp=speedOf();
  setNav();
  // 段階2：ペンで跡を残す
  G.trace=[]; A.ytReveal={upto:0,group:1}; A.yt.renderBase();
  for(var f=0;f<N;f++){
    if(tok.cancel) return;
    var y=A.yt.pointY(f,L.x);
    G.pen={f:f,y:y}; G.trace.push({f:f,y:y});
    A.goto(f); A.yt.follow(f); A.view.renderOv(); A.yt.renderOv();
    await A.sleep(1000/sp.fps);
  }
  G.pen=null; A.view.renderOv();
  await A.sleep(400*sp.k);
  // 段階3：線の場所の帯を切り取って並べる（最初は太く、だんだん細く速く）
  var flip=A.src.unit==='T', group=flip?1:5, nSlow=flip?N:Math.min(8,Math.ceil(N/group));
  for(var g=0;g<nSlow;g++){
    if(tok.cancel) return;
    var ff=g*group; if(ff>=N) break;
    A.goto(ff);
    var ms=(g<3?900:(g<6?500:300))*sp.k*(flip?1.4:1);
    await fly(ff, Math.min(group,N-ff), ms, tok);
    if(tok.cancel) return;
    A.ytReveal={upto:Math.min(N,(g+1)*group), group:group}; A.yt.renderBase();
  }
  var done=Math.min(N,nSlow*group), stepK=Math.max(1,Math.round(N/60));
  for(var k=done;k<=N;k+=stepK){
    if(tok.cancel) return;
    A.ytReveal={upto:k, group:1}; A.goto(Math.min(N-1,k)); A.yt.follow(k); A.yt.renderBase();
    await A.sleep(28*sp.k);
  }
  finishRecord();
}
function finishRecord(){
  G.anim=null; G.pen=null; G.trace=[];
  A.ytReveal=null; A.yt.renderBase();
  G.recorded=true;
  A.toStart();          // 1つの作業が終わったら最初のコマにもどる
  setNav();
}
function cancelAnim(){
  if(G.anim){ G.anim.cancel=true; G.anim=null; }
  A.$$('canvas[style*="position:fixed"]').forEach(function(c){ c.remove(); });
  G.pen=null;
}

/* ---------- 各段階の画面 ---------- */
function updateCounts(){
  var n=dotCount(), el=A.$('#gDotN'); if(el) el.textContent=n;
  var b=A.$('#gPred'); if(b) b.disabled=n<3;
}
function setNav(){
  var next=A.$('#gNext'), back=A.$('#gBack');
  back.disabled = G.step<=1 || !!G.anim;
  var ok=true;
  if(!hasSrc()) ok=false;
  else if(G.step===1) ok=A.lines.length>0;
  else if(G.step===3) ok=G.recorded && !G.anim;
  next.disabled=!ok;
  next.textContent = G.step===4 ? '自由に調べる' : '次へ';
  A.$$('#guideSteps li').forEach(function(li){
    var n=+li.dataset.step; li.classList.toggle('on',n===G.step); li.classList.toggle('done',n<G.step);
  });
}

function render(){
  A.tool = G.active ? guideTool : A.tool;
  A.ytLocked = G.active && G.step<4;
  if(!hasSrc()){
    body('<p>まず「開く」で、動画かサンプルを開いてください。</p>'); setNav(); return;
  }
  if(G.step===1){
    body('<p>左の<b>y-x図</b>をタップして、調べたい場所に縦の線を置きましょう。線はドラッグで動かせます。</p>'+
      '<button class="btn" id="gDim"></button>');
    var b=A.$('#gDim');
    var lab=function(){ b.textContent = dimTarget? '全体を見る' : 'その場所だけを残す'; b.disabled=!A.lines.length; };
    lab(); b.addEventListener('click',function(){ setDim(!dimTarget); lab(); });
    A.ytReveal = G.recorded?null:{upto:0};
  } else if(G.step===2){
    var flip=A.src.unit==='T';
    var obj=flip?'赤い線':'媒質の点';
    body('<p>◀ ▶ でコマを送りながら、線の上で'+obj+'がある高さを、左の<b>y-x図</b>でタップしましょう。右の<b>y-t図</b>に点が打たれます。最後のコマまで打つと、最初のコマにもどります。</p>'+
      '<div class="row small"><label><input type="checkbox" id="gSnap"'+(A.snap?' checked':'')+'> 打った点を近くの'+(flip?'赤い線':'玉')+'に吸い付ける</label></div>'+
      '<div class="row small"><label>タップするたびに <select id="gAdv">'+
      [1,2,3,5,10].map(function(n){return '<option value="'+n+'"'+((flip?n===1:n===3)?' selected':'')+'>'+n+'</option>';}).join('')+
      '</select> コマ進める</label></div>'+
      '<p class="small">打った点：<b id="gDotN">0</b> 個</p>'+
      '<div class="row"><button class="btn" id="gPred">続きを予想して描く</button><button class="btn sm" id="gClr">点と予想を消す</button></div>'+
      '<p class="mut small" id="gPredHint"></p>');
    A.$('#gPred').addEventListener('click',function(){
      G.predMode=!G.predMode; this.classList.toggle('on',G.predMode);
      A.$('#gPredHint').textContent = G.predMode ? '右のy-t図の上を、左から右へなぞって描きます。' : '';
    });
    A.$('#gSnap').addEventListener('change',function(){ A.snap=this.checked; A.$('#chkSnap').checked=A.snap; });
    A.$('#gClr').addEventListener('click',function(){ G.dots={}; G.pred=[]; updateCounts(); A.yt.renderOv(); A.view.renderOv(); });
    updateCounts();
    if(!G.recorded) A.ytReveal={upto:0};
  } else if(G.step===3){
    body('<p>「記録をはじめる」を押すと、線の場所の動きが右の<b>y-t図</b>に記録されていきます。終わると最初のコマにもどります。</p>'+
      '<div class="row small"><label>速さ <select id="gSpeed"><option value="slow">ゆっくり</option><option value="normal" selected>ふつう</option><option value="fast">はやい</option></select></label></div>'+
      '<div class="row"><button class="btn primary" id="gRec">記録をはじめる</button><button class="btn sm" id="gSkip">最後までとばす</button></div>');
    A.$('#gRec').addEventListener('click',function(){ G.predMode=false; record(); });
    A.$('#gSkip').addEventListener('click',function(){ cancelAnim(); G.trace=[]; finishRecord(); });
    if(!G.recorded) A.ytReveal={upto:0};
  } else {
    body('<p>右の<b>y-t図</b>をタップすると、左の<b>y-x図</b>がその時刻のコマに切り替わります。y-t図の山や谷をタップして、y-x図ではどんな場面か確かめましょう。</p>'+
      '<p class="mut small">左のy-x図をタップすると、線がその場所に移り、y-t図もその場所の記録に変わります。</p>'+
      '<button class="btn" id="gLine2">もう1か所に線を置いて比べる</button>'+
      '<p class="mut small" id="gLine2Hint">2本目の線は色を変えて、同じy-t図に重ねます。</p>');
    A.$('#gLine2').addEventListener('click',function(){
      A.maxLines=2; this.disabled=true;
      setDim(false);
      A.$('#gLine2Hint').textContent='左のy-x図の別の場所をタップしてください。';
    });
    A.ytReveal=null;
  }
  A.yt.renderBase(); A.view.renderOv();
  setNav();
}

G.go = function(step){
  cancelAnim();
  G.step=A.clamp(step,1,4);
  if(G.step!==2) G.predMode=false;
  if(A.src) A.toStart();
  render();
};

G.enter = function(){
  G.active=true;
  A.maxLines=1;
  if(A.lines.length>1){ A.lines=A.lines.slice(0,1); A.emit('lines'); }
  render();
};
G.leave = function(){
  if(!G.active) return;
  cancelAnim();
  G.active=false; G.predMode=false;
  if(A.tool===guideTool) A.tool=null;
  A.maxLines=2; A.ytLocked=false; A.ytReveal=null;
  setDim(false);
  A.yt.renderBase();
};
G.reset = function(){
  cancelAnim();
  G.step=1; G.dots={}; G.pred=[]; G.trace=[]; G.recorded=false; G.predMode=false;
  dimTarget=0; A.dim=0;
};

G.init = function(){
  A.vidOverlays.push(drawVidOv);
  A.ytOverlays.push(drawYtOv);
  A.$('#gNext').addEventListener('click',function(){
    if(G.step===4){ A.ui.tab('tools'); return; }
    G.go(G.step+1);
  });
  A.$('#gBack').addEventListener('click',function(){ G.go(G.step-1); });
  A.on('lines',function(){
    if(!G.active) return;
    setNav();
    var b=A.$('#gDim'); if(b) b.disabled=!A.lines.length;
    // 線を動かしたら、記録はやり直し
    if(A.lines.length && G.recorded && G.step<4){ G.recorded=false; G.trace=[]; A.ytReveal={upto:0}; A.yt.renderBase(); setNav(); }
  });
  A.on('source',function(){ G.reset(); if(G.active) render(); });
  A.on('tab',function(t){ if(t==='guide') G.enter(); else G.leave(); });
};

})(W);
