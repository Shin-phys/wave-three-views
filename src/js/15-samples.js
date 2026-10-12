/* =========================================================
   サンプル（WAVE-F-03, F-04, §1.1）
   動画ファイルにせず、パラメータからコマを生成する。
   見た目は実写の撮り方に近づける（暗い背景に、糸でつながった明るい玉の列）。
   表示名では結論を言わない（WAVE-N-05）。
   ========================================================= */
(function(A){
'use strict';
var S = A.samples = {};
var WID=320, HEI=180, FPS=30, PXM=400;   // 横 320 画素 = 0.8 m

function smooth(e){ e=A.clamp(e,0,1); return e*e*(3-2*e); }

/* y(x,t) を描いたコマを並べる。y は上向き正（画素） */
function render(fn, dur){
  var n=Math.round(dur*FPS), cv=A.canvas(WID,HEI), ctx=cv.getContext('2d',{willReadFrequently:true});
  var frames=[], y0=HEI/2;
  for(var i=0;i<n;i++){
    var t=i/FPS;
    ctx.fillStyle='#07090d'; ctx.fillRect(0,0,WID,HEI);
    // 床の目印（動かない基準）
    ctx.fillStyle='#161b24'; ctx.fillRect(0,HEI-14,WID,14);
    ctx.strokeStyle='rgba(150,160,178,.55)'; ctx.lineWidth=1.2; ctx.beginPath();
    for(var x=0;x<=WID;x+=2){ var y=y0-fn(x,t); if(x===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.stroke();
    ctx.fillStyle='#f3f6fb';
    for(var bx=5;bx<WID;bx+=10){ ctx.beginPath(); ctx.arc(bx,y0-fn(bx,t),2.6,0,Math.PI*2); ctx.fill(); }
    frames.push(ctx.getImageData(0,0,WID,HEI));
  }
  return frames;
}

var DEFS = [
  { id:'travel', name:'サンプル1：つながった玉を伝わる波', v:null,
    make:function(){
      var lam=160, T=2, Am=26;
      this.v=lam/T/PXM;
      return render(function(x,t){ return Am*Math.sin(2*Math.PI*(x/lam - t/T)); }, 6);
    }},
  { id:'pulse', name:'サンプル2：1つだけ伝わる山（前と後ろで形がちがう）', v:null,
    make:function(){
      var vp=70, Am=40, rise=14, tail=90;
      this.v=vp/PXM;
      return render(function(x,t){
        var u=(vp*t-10)-x;                 // 先頭からの距離（先頭の後ろが正）
        if(u<0) return 0;
        if(u<rise) return Am*Math.sin(Math.PI/2*u/rise);
        if(u<rise+tail) return Am*(1-smooth((u-rise)/tail));
        return 0;
      }, 6.5);
    }},
  { id:'counter', name:'サンプル3：向かい合う2つの波', v:null,
    make:function(){
      var lam=128, T=2, Am=20, vp=lam/T;
      this.v=vp/PXM;
      return render(function(x,t){
        var f1=vp*t, f2=WID-vp*t, y=0;
        if(x<f1) y+=Am*Math.sin(2*Math.PI*(x/lam - t/T))*smooth((f1-x)/12);
        if(x>f2) y+=Am*Math.sin(2*Math.PI*(x/lam + t/T))*smooth((x-f2)/12);
        return y;
      }, 9);
    }}
];

S.open = function(id){
  var d=DEFS.filter(function(x){return x.id===id;})[0]; if(!d) return;
  A.toast('サンプルを作っています…',1200);
  setTimeout(function(){
    var frames=d.make();
    A.setSource({kind:'sample', name:d.name, W:WID, H:HEI, frames:frames, times:null, fps:FPS, fpsAuto:false,
      slow:1, pxPerM:PXM, light:false, unit:'s', v:d.v});
  },30);
};

/* 実写のお手本：samples/real-wave.mp4 を置いたときだけ開ける（WAVE-F-04） */
S.openReal = function(){
  fetch('samples/real-wave.mp4').then(function(r){
    if(!r.ok) throw new Error();
    return r.blob();
  }).then(function(b){
    A.capture.openFile(b,'実写のお手本');
    A.toast('区間を確かめて「この区間を取り込む」を押してください');
  }).catch(function(){
    A.toast('実写のお手本はまだ用意されていません');
  });
};

S.init = function(){
  var box=A.$('#sampleList');
  DEFS.forEach(function(d){
    var b=document.createElement('button'); b.className='btn sm'; b.textContent=d.name;
    b.addEventListener('click',function(){S.open(d.id);});
    box.appendChild(b);
  });
  var f=document.createElement('button'); f.className='btn sm'; f.textContent='サンプル4：ぱらぱら漫画の見本（8コマ）';
  f.addEventListener('click',function(){ A.flip.openSample(); });
  box.appendChild(f);
  var r=document.createElement('button'); r.className='btn sm'; r.textContent='サンプル5：実写のお手本';
  r.addEventListener('click',S.openReal);
  box.appendChild(r);
};

})(W);
