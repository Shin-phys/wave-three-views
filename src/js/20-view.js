/* =========================================================
   y-x図（コマ表示）と再生（WAVE-F-10, F-12, F-13, N-02, N-12）
   動画とy-t図は横に並べ、縦の目盛りをそろえる。
   ========================================================= */
(function(A){
'use strict';
var V = A.view = {s:1, crop:{x0:0,w:1}, dispH:0, cssW:0, narrow:false};
var cvV, cvVO, ctxV, ctxVO, scratch;
A.vidOverlays = [];      // 追加の描画（ガイド・ぱらぱら漫画）：function(ctx, V)
A.tool = null;           // 一時的な道具（目盛り・傾き・打点など）。null なら位置線

V.sx2c = function(x){ return (x-V.crop.x0)*V.s; };
V.sy2c = function(y){ return y*V.s; };
V.c2sx = function(cx){ return V.crop.x0 + cx/V.s; };
V.c2sy = function(cy){ return cy/V.s; };

function sizeCanvas(cv, cssW, cssH, pxW, pxH){
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  if(cv.width!==pxW) cv.width=pxW;
  if(cv.height!==pxH) cv.height=pxH;
}

/* ---------- 配置 ---------- */
V.layout = function(){
  var s=A.src; if(!s) return;
  var stage=A.$('#stage');
  var avail=stage.clientWidth-24;
  V.narrow = window.innerWidth<700 && window.innerHeight>window.innerWidth;
  A.show('#rotateNote', V.narrow);
  A.show('#vidInfo', !V.narrow);
  A.$('#vidTitle').textContent = V.narrow ? 'y-x図' : (s.kind==='flip' ? 'y-x図（作図の1コマ）' : 'y-x図（動画の1コマ）');
  // 縦持ちでは位置線のまわりだけを細く切り抜く（WAVE-N-12）
  if(V.narrow && A.lines.length){
    var cw=Math.min(s.W, Math.round(s.H*0.5));
    V.crop={x0:A.clamp(Math.round(A.lines[0].x-cw/2),0,s.W-cw), w:cw};
  } else V.crop={x0:0,w:s.W};
  var frac = V.narrow ? 0.36 : 0.58;
  var maxH = Math.max(150, window.innerHeight - (V.narrow?260:210));
  var vw = Math.max(120, avail*frac-6);
  var sc = vw/V.crop.w;
  if(s.H*sc>maxH) sc=maxH/s.H;
  V.s=sc; V.cssW=Math.round(V.crop.w*sc); V.dispH=Math.round(s.H*sc);
  var d=A.dpr();
  sizeCanvas(cvV, V.cssW, V.dispH, V.crop.w, s.H);
  sizeCanvas(cvVO, V.cssW, V.dispH, Math.round(V.cssW*d), Math.round(V.dispH*d));
  A.$('#vidPane').style.width=V.cssW+'px';
  // ぱらぱら漫画は、y-t図が1周期ぶん横に収まるように1コマの幅を合わせる（手で変えたらそのまま）
  if(s.kind==='flip' && !s.ppfManual){
    A.ppf=Math.max(16, Math.floor((A.$('#ytPane').clientWidth-4)/(V.s*A.N())));
    if(A.tools) A.tools.refresh();
  }
  A.emit('layout');
  V.render();
};

/* ---------- 描画 ---------- */
V.render = function(){
  var s=A.src; if(!s||!s.frames.length) return;
  var im=s.frames[A.cur];
  ctxV.putImageData(im, -V.crop.x0, 0, V.crop.x0, 0, V.crop.w, s.H);
  V.renderOv();
  A.$('#tLabel').textContent=A.fmtTime(A.cur);
  var r=A.$('#rngT'); r.max=A.N()-1; r.value=A.cur;
};

V.renderOv = function(){
  var s=A.src; if(!s) return;
  var d=A.dpr(), ctx=ctxVO;
  ctx.setTransform(d,0,0,d,0,0);
  ctx.clearRect(0,0,V.cssW,V.dispH);
  // 1点だけ残す（ガイドの段階1）：線のまわり以外を暗くする
  if(A.dim>0 && A.lines.length){
    var L=A.lines[0], half=Math.max(A.band/2+2, 4);
    var a=V.sx2c(L.x-half), b=V.sx2c(L.x+half);
    ctx.fillStyle='rgba(0,0,0,'+(0.86*A.dim).toFixed(3)+')';
    ctx.fillRect(0,0,Math.max(0,a),V.dispH);
    ctx.fillRect(b,0,Math.max(0,V.cssW-b),V.dispH);
  }
  A.lines.forEach(function(L,i){
    var x=V.sx2c(L.x), col=A.LINE_COLORS[i], bw=Math.max(1,A.band*V.s);
    ctx.fillStyle=col; ctx.globalAlpha=0.16; ctx.fillRect(x-bw/2,0,bw,V.dispH); ctx.globalAlpha=1;
    ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,V.dispH); ctx.stroke();
    // つまみ
    ctx.fillStyle=col;
    [[x,9],[x,V.dispH-9]].forEach(function(p){ ctx.beginPath(); ctx.arc(p[0],p[1],7,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle='#06121f'; ctx.font='bold 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(i+1), x, 9.5);
  });
  A.vidOverlays.forEach(function(f){ ctx.save(); f(ctx,V); ctx.restore(); });
  if(A.tool && A.tool.drawVid){ ctx.save(); A.tool.drawVid(ctx,V); ctx.restore(); }
};

/* ---------- 位置線の操作 ---------- */
var drag=null;
function nearestLine(cx){
  var best=-1, bd=16;
  A.lines.forEach(function(L,i){ var dd=Math.abs(V.sx2c(L.x)-cx); if(dd<bd){bd=dd;best=i;} });
  return best;
}
function evPos(e){
  var r=cvV.getBoundingClientRect();
  var cx=e.clientX-r.left, cy=e.clientY-r.top;
  return {cx:cx, cy:cy, x:A.clamp(V.c2sx(cx),0,A.src.W-1), y:A.clamp(V.c2sy(cy),0,A.src.H-1)};
}
var lineEmitPending=false;
function emitLines(){
  if(lineEmitPending) return; lineEmitPending=true;
  requestAnimationFrame(function(){ lineEmitPending=false; A.emit('lines'); });
}
A.on('lines', function(){ if(V.narrow) V.layout(); else V.renderOv(); });

function onDown(e){
  if(!A.src) return;
  var p=evPos(e);
  // 道具が受け取らなかった（false を返した）ときは、位置線の操作にする
  if(A.tool && A.tool.vidDown && A.tool.vidDown(p,e)!==false){ V.renderOv(); return; }
  var i=nearestLine(p.cx);
  if(i<0){
    if(A.lines.length>=A.maxLines){
      if(A.maxLines===1){ A.lines[0].x=A.yt.snapX(p.x); i=0; }
      else { A.toast('線は'+A.maxLines+'本までです。ドラッグで動かすか、「調べる」で消してください'); return; }
    } else { A.lines.push({x:A.yt.snapX(p.x)}); i=A.lines.length-1; }
    emitLines();
  }
  drag={i:i};
  cvV.setPointerCapture(e.pointerId);
}
function onMove(e){
  if(!A.src) return;
  var p=evPos(e);
  if(A.tool && A.tool.vidMove){ A.tool.vidMove(p,e); V.renderOv(); return; }
  if(!drag) return;
  A.lines[drag.i].x=A.yt.snapX(p.x); emitLines();
}
function onUp(e){
  if(A.tool && A.tool.vidUp){ A.tool.vidUp(evPos(e),e); V.renderOv(); }
  if(drag){ drag=null; A.emit('lines-done'); }
}

/* ---------- 再生 ---------- */
var playing=false, last=0, acc=0;
V.rateOpts = function(){
  var s=A.src;
  if(s && s.unit==='T') return [['1','1 コマ/秒'],['2','2 コマ/秒'],['4','4 コマ/秒'],['8','8 コマ/秒']];
  return [['1','1倍'],['0.5','1/2'],['0.25','1/4'],['0.125','1/8']];
};
function fillRate(){
  var sel=A.$('#selRate'), opts=V.rateOpts(), s=A.src;
  sel.innerHTML=opts.map(function(o){return '<option value="'+o[0]+'">'+o[1]+'</option>';}).join('');
  sel.value = (s&&s.unit==='T') ? '4' : '0.5';
}
function frameMs(){
  var s=A.src, r=parseFloat(A.$('#selRate').value)||1;
  if(s.unit==='T') return 1000/r;
  return 1000/(s.fps*r);
}
function loop(ts){
  if(!playing) return;
  var dt=ts-last; last=ts; acc+=Math.min(dt,250);
  var fm=frameMs(), moved=false;
  while(acc>=fm){ acc-=fm; A.cur=(A.cur+1)%A.N(); moved=true; }
  if(moved) A.emit('frame');
  requestAnimationFrame(loop);
}
A.play = function(){
  if(!A.src||playing) return;
  playing=true; last=performance.now(); acc=0;
  A.$('#btnPlay').textContent='❚❚'; A.$('#btnPlay').setAttribute('aria-label','停止');
  requestAnimationFrame(loop);
};
A.stop = function(){
  playing=false;
  var b=A.$('#btnPlay'); if(b){ b.textContent='▶'; b.setAttribute('aria-label','再生'); }
};
A.isPlaying = function(){ return playing; };
/* 最初のコマにもどる（y-t図も左端へ） */
A.toStart = function(){
  A.stop(); A.cur=-1; A.goto(0);
  var w=A.$('#ytWrap'); if(w) w.scrollLeft=0;
};

V.init = function(){
  cvV=A.$('#cvVid'); cvVO=A.$('#cvVidOv');
  ctxV=cvV.getContext('2d'); ctxVO=cvVO.getContext('2d');
  scratch=null;
  cvV.addEventListener('pointerdown',onDown);
  cvV.addEventListener('pointermove',onMove);
  cvV.addEventListener('pointerup',onUp);
  cvV.addEventListener('pointercancel',onUp);

  A.$('#btnPlay').addEventListener('click',function(){ playing?A.stop():A.play(); });
  A.$('#btnPrev').addEventListener('click',function(){ A.stop(); A.goto(A.cur-1); });
  A.$('#btnFirst').addEventListener('click',function(){ A.toStart(); });
  A.$('#btnNext').addEventListener('click',function(){ A.stop(); A.goto(A.cur+1); });
  A.$('#rngT').addEventListener('input',function(){ A.stop(); A.goto(parseInt(this.value,10)); });
  document.addEventListener('keydown',function(e){
    if(!A.src) return;
    var tg=e.target.tagName;
    if(tg==='INPUT'&&e.target.type!=='range' || tg==='SELECT' || tg==='TEXTAREA') return;
    if(e.key==='ArrowLeft'){ A.stop(); A.goto(A.cur-1); e.preventDefault(); }
    else if(e.key==='ArrowRight'){ A.stop(); A.goto(A.cur+1); e.preventDefault(); }
    else if(e.key===' '&&tg!=='BUTTON'){ playing?A.stop():A.play(); e.preventDefault(); }
    else if(e.key==='Home'){ A.toStart(); e.preventDefault(); }
  });

  A.on('source',function(s){
    A.show('#empty',false); A.show('#viewRow',true); A.show('#transport',true);
    A.$('#srcName').textContent=s.name;
    A.$('#vidTitle').textContent = s.kind==='flip' ? 'y-x図（作図の1コマ）' : 'y-x図（動画の1コマ）';
    A.$('#vidInfo').textContent = s.kind==='flip' ? '' : (s.W+'×'+s.H+'・'+s.frames.length+'コマ');
    fillRate();
    V.layout();
  });
  A.on('frames',function(){ V.layout(); });
  A.on('frame',V.render);
  var rt=null;
  window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(V.layout,80); });
  A.on('panel',function(){ setTimeout(V.layout,30); });
};

})(W);
