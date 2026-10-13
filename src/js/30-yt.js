/* =========================================================
   y-t図（WAVE-F-20〜F-27, F-37, F-50）
   位置線の場所の縦の画素列を、時間順に左から並べて画像にする。
   縦の目盛りは動画と同じ。横は1コマあたり A.ppf 画素（元画像の画素）。
   A.ytReveal を使うと、途中までだけ描く（ガイドのアニメーション用）。
     null            … 全部
     {upto:k, group:g} … k コマ目の手前まで。g コマごとに同じ列を使う（太い帯）
   ========================================================= */
(function(A){
'use strict';
var Y = A.yt = {};
var cv, cvO, ctx, ctxO, wrap;
var cols=[];            // 線ごとの列データ Uint8ClampedArray(N*H*3)
var colsKey='';
A.ytReveal = null;
A.ytOverlays = [];      // function(ctx, Y)

Y.outW = function(){ return Math.max(1, Math.round(A.N()*A.ppf)); };
Y.cssScale = function(){ return A.view.s; };
/* y-t図の座標（CSS画素）とコマ番号の換算 */
Y.f2c = function(f){ return f*A.ppf*A.view.s; };           // コマ f の左端
Y.c2f = function(cx){ return cx/(A.ppf*A.view.s); };
Y.y2c = function(y){ return y*A.view.s; };
Y.c2y = function(cy){ return cy/A.view.s; };

function key(){
  return [A.src?A.src.frames:'', A.N(), A.band, A.lines.map(function(L){return Math.round(L.x*10);}).join(',')].join('|')+'|'+(A.src&&A.src._ver||0);
}
var framesRef=null;
function buildCols(){
  var s=A.src, N=A.N(), H=s.H;
  cols = A.lines.map(function(L){
    var a=new Uint8ClampedArray(N*H*3);
    for(var f=0;f<N;f++) A.column(f, L.x, A.band, a, f*H*3);
    if(!s.light) autoGain(a);
    return a;
  });
}

/* 暗い背景の動画では、線が媒質の玉のふちをかすめると y-t図が暗くなる。
   いちばん明るいあたり（上位0.5%）が白に近づくように明るさを持ち上げる（最大4倍）。 */
function autoGain(a){
  var hist=new Uint32Array(256), n=a.length/3, i;
  for(i=0;i<a.length;i+=3) hist[Math.max(a[i],a[i+1],a[i+2])]++;
  var acc=0, top=255; while(top>0 && acc<n*0.005){ acc+=hist[top]; top--; }
  var g=Math.min(4, 235/Math.max(1,top));
  if(g<=1.05) return;
  for(i=0;i<a.length;i++) a[i]=a[i]*g;
}

/* 1本ならそのままの色、2本なら色をつけて重ねる（WAVE-F-13） */
Y.renderBase = function(){
  var s=A.src; if(!s) return;
  if(framesRef!==s.frames){ framesRef=s.frames; colsKey=''; }
  var k=key(); if(k!==colsKey){ buildCols(); colsKey=k; }
  var N=A.N(), H=s.H, w=Y.outW();
  var css=Math.round(w*A.view.s);
  cv.width=w; cv.height=H;
  cv.style.width=css+'px'; cv.style.height=A.view.dispH+'px';
  var d=A.dpr(), ow=Math.min(16000, Math.round(css*d));
  cvO.width=ow; cvO.height=Math.round(A.view.dispH*d);
  cvO.style.width=css+'px'; cvO.style.height=A.view.dispH+'px';
  var wrapW=A.$('#ytPane').clientWidth;
  wrap.style.height=A.view.dispH+'px';

  if(s.kind==='flip'){ renderDots(w,H,N); return; }
  var img=ctx.createImageData(w,H), D=img.data;
  var light=s.light, bg=light?255:10;
  for(var i=0;i<D.length;i+=4){ D[i]=bg; D[i+1]=bg; D[i+2]=light?255:14; D[i+3]=255; }
  var rv=A.ytReveal, upto=rv?A.clamp(rv.upto,0,N):N, group=rv&&rv.group||1;
  if(cols.length){
    var two=cols.length>1;
    for(var x=0;x<w;x++){
      var f=Math.min(N-1, Math.floor(x/A.ppf));
      if(f>=upto) break;
      var sf=Math.floor(f/group)*group;
      for(var y=0;y<H;y++){
        var p=(y*w+x)*4, o=sf*H*3+y*3;
        if(!two){ D[p]=cols[0][o]; D[p+1]=cols[0][o+1]; D[p+2]=cols[0][o+2]; continue; }
        var r=0,g=0,b=0;
        for(var li=0;li<2;li++){
          var c=cols[li], L=0.299*c[o]+0.587*c[o+1]+0.114*c[o+2], t=A.LINE_RGB[li];
          if(light){ var dk=1-L/255; r+=dk*(255-t[0]); g+=dk*(255-t[1]); b+=dk*(255-t[2]); }
          else { r+=L*t[0]/255; g+=L*t[1]/255; b+=L*t[2]/255; }
        }
        if(light){ D[p]=255-r; D[p+1]=255-g; D[p+2]=255-b; }
        else { D[p]=r; D[p+1]=g; D[p+2]=b; }
      }
    }
  }
  ctx.putImageData(img,0,0);
  A.$('#ytInfo').textContent = A.lines.length ? '' : '左の図をタップして線を置くと、ここに記録されます';
  Y.renderOv();
};

/* ぱらぱら漫画：コマごとに、線の場所の赤い線の高さを点で打つ（WAVE-F-25） */
function renderDots(w,H,N){
  var s=A.src, sc=A.view.s;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,H);
  if(s.rowPx){
    for(var r=-s.rows; r<=s.rows; r++){
      var y=s.axisPx-r*s.rowPx;
      ctx.fillStyle = r===0 ? '#7cc4e6' : (r%5===0 ? '#cfe9f6' : '#e8f4fb');
      ctx.fillRect(0, y-(r===0?1:0.5)/sc, w, (r===0?2:1)/sc);
    }
  }
  ctx.fillStyle='#eef1f5';
  for(var f=1;f<N;f++) ctx.fillRect(f*A.ppf-0.5/sc,0,1/sc,H);
  var rv=A.ytReveal, upto=rv?A.clamp(rv.upto,0,N):N, rad=5.5/sc;
  A.lines.forEach(function(L,li){
    ctx.fillStyle=A.LINE_DARK[li]; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5/sc;
    for(var f=0;f<upto;f++){
      var y=Y.pointY(f,L.x); if(y==null) continue;
      ctx.beginPath(); ctx.arc((f+0.5)*A.ppf, y, rad, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
  });
  A.$('#ytInfo').textContent = A.lines.length ? '' : '左の図をタップして線を置くと、ここに記録されます';
  Y.renderOv();
}

/* ---------- 吸着（スマホで線や点を置きやすくする） ---------- */
/* 動画：どの列に「動くもの」が多いか（コマ間の明るさの変化の合計）を1回だけ数えておく */
function energy(){
  var s=A.src; if(s._energyFor===s.frames) return s._energy;
  var W=s.W, H=s.H, N=s.frames.length, step=Math.max(1,Math.floor(N/40)), idx=[], i, x, y, f;
  for(f=0;f<N;f+=step) idx.push(f);
  var mean=new Float32Array(W*H);
  idx.forEach(function(f){ var d=s.frames[f].data; for(i=0;i<W*H;i++) mean[i]+=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; });
  for(i=0;i<W*H;i++) mean[i]/=idx.length;
  var e=new Float32Array(W);
  idx.forEach(function(f){ var d=s.frames[f].data;
    for(y=0;y<H;y++) for(x=0;x<W;x++){ i=y*W+x; e[x]+=Math.abs(0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]-mean[i]); } });
  var sm=new Float32Array(W);
  for(x=0;x<W;x++) sm[x]=(e[Math.max(0,x-1)]+2*e[x]+e[Math.min(W-1,x+1)])/4;
  s._energy=sm; s._energyFor=s.frames;
  return sm;
}
/* 位置線の x を吸着させる：ぱらぱら漫画は方眼の縦線、動画は近くの「よく動く列」 */
Y.snapX = function(x){
  var s=A.src; if(!s||!A.snap) return x;
  var tol=16/A.view.s;
  if(s.colPx){
    var c=A.clamp(Math.round(x/s.colPx)*s.colPx, 0, s.W-1);
    return Math.abs(c-x)<=tol ? c : x;
  }
  var e=energy(), rr=Math.max(2,Math.round(Math.min(tol,8))), x0=Math.round(x), best=x0, bv=-1, sum=0, n=0;
  for(var k=Math.max(0,x0-rr); k<=Math.min(s.W-1,x0+rr); k++){ sum+=e[k]; n++; if(e[k]>bv){ bv=e[k]; best=k; } }
  return (n && bv>1.25*sum/n) ? best : x;
};
/* 列の中の「目印」の高さの候補：動画は背景と違う明るさの山、ぱらぱら漫画は赤い線 */
Y.peaks = function(f, x){
  var s=A.src, H=s.H, a=new Uint8ClampedArray(H*3), out=[], j;
  A.column(f, x, Math.max(3,A.band), a, 0);
  if(s.kind==='flip'){
    var sy=0, sw=0;
    for(j=0;j<=H;j++){
      var rd = j<H ? a[j*3]-(a[j*3+1]+a[j*3+2])/2 : 0;
      if(rd>60){ sy+=j*rd; sw+=rd; }
      else if(sw>0){ out.push(sy/sw); sy=0; sw=0; }
    }
    return out;
  }
  var lum=[], srt, med, sal=[];
  for(j=0;j<H;j++) lum.push(0.299*a[j*3]+0.587*a[j*3+1]+0.114*a[j*3+2]);
  srt=lum.slice().sort(function(p,q){return p-q;}); med=srt[H>>1];
  for(j=0;j<H;j++) sal.push(Math.abs((lum[Math.max(0,j-1)]+2*lum[j]+lum[Math.min(H-1,j+1)])/4-med));
  for(j=1;j<H-1;j++){
    if(sal[j]<=28 || sal[j]<sal[j-1] || sal[j]<sal[j+1]) continue;
    var cy=0, cw=0;
    for(var q=Math.max(0,j-3); q<=Math.min(H-1,j+3); q++){ var wv=Math.max(0,sal[q]-sal[j]*0.3); cy+=q*wv; cw+=wv; }
    var py=cw>0?cy/cw:j;
    if(!out.length || py-out[out.length-1]>4) out.push(py);
  }
  return out;
};
/* 打った点の y を、近くの目印に吸い付ける（tol は元画像の画素） */
Y.snapY = function(f, x, y, tol){
  if(!A.snap || !A.src) return y;
  var best=y, bd=tol;
  Y.peaks(f,x).forEach(function(p){ var d=Math.abs(p-y); if(d<bd){ bd=d; best=p; } });
  return best;
};

/* 時間の目盛りとカーソル */
Y.renderOv = function(){
  var s=A.src; if(!s) return;
  var d=A.dpr(), css=Math.round(Y.outW()*A.view.s), H=A.view.dispH;
  var sc=cvO.width/Math.max(1,css);
  ctxO.setTransform(sc,0,0,d,0,0);
  ctxO.clearRect(0,0,css,H);
  // 目盛り
  ctxO.strokeStyle=s.light?'rgba(40,50,70,.55)':'rgba(200,210,225,.5)';
  ctxO.fillStyle=s.light?'rgba(40,50,70,.85)':'rgba(220,228,240,.85)';
  ctxO.font='11px system-ui'; ctxO.textBaseline='bottom'; ctxO.lineWidth=1;
  if(s.unit==='T'){
    for(var f=0;f<=A.N();f++){
      var x=Y.f2c(f); ctxO.beginPath(); ctxO.moveTo(x,H); ctxO.lineTo(x,H-6); ctxO.stroke();
    }
    ctxO.textAlign='center';
    for(var g=0;g<A.N();g++){
      var lab = g===0?'0':(g+'T/'+s.perPeriod);
      ctxO.fillText(lab, Y.f2c(g+0.5), H-8);
    }
  } else {
    var dt=A.dtReal(), total=A.N()*dt;
    var step = total>12?2:(total>4?1:(total>1.5?0.5:0.1));
    ctxO.textAlign='left';
    for(var t=0;t<=total+1e-9;t+=step){
      var xx=Y.f2c(t/dt); ctxO.beginPath(); ctxO.moveTo(xx,H); ctxO.lineTo(xx,H-7); ctxO.stroke();
      ctxO.fillText((Math.round(t*10)/10)+' s', xx+3, H-2);
    }
  }
  A.ytOverlays.forEach(function(fn){ ctxO.save(); fn(ctxO,Y); ctxO.restore(); });
  if(A.tool && A.tool.drawYt){ ctxO.save(); A.tool.drawYt(ctxO,Y); ctxO.restore(); }
  // カーソル（WAVE-F-21）
  var cx=Y.f2c(A.cur+0.5);
  ctxO.strokeStyle=s.light?'rgba(20,30,50,.75)':'rgba(255,255,255,.7)'; ctxO.lineWidth=1.2;
  ctxO.setLineDash([4,3]); ctxO.beginPath(); ctxO.moveTo(cx,0); ctxO.lineTo(cx,H); ctxO.stroke(); ctxO.setLineDash([]);
  ctxO.fillStyle=ctxO.strokeStyle; ctxO.beginPath(); ctxO.moveTo(cx-5,0); ctxO.lineTo(cx+5,0); ctxO.lineTo(cx,7); ctxO.fill();
};

/* カーソルが見えるようにスクロールする */
Y.follow = function(f){
  var x=Y.f2c((f==null?A.cur:f)+0.5), w=wrap.clientWidth;
  if(x<wrap.scrollLeft+20 || x>wrap.scrollLeft+w-20) wrap.scrollLeft=Math.max(0,x-w*0.6);
};

/* 点の高さの推定：列の中で背景といちばん違う画素（赤い線があれば赤を優先） */
Y.pointY = function(f, x){
  var s=A.src, H=s.H, a=new Uint8ClampedArray(H*3);
  A.column(f, x, Math.max(3,A.band), a, 0);
  var red=[], lum=[], sr=0;
  for(var y=0;y<H;y++){
    var r=a[y*3],g=a[y*3+1],b=a[y*3+2];
    lum.push(0.299*r+0.587*g+0.114*b);
    var rd=r-(g+b)/2; red.push(rd); if(rd>60) sr++;
  }
  if(s.kind==='flip'){
    if(!sr) return null;
    var sy=0,sw=0; for(var i=0;i<H;i++){ if(red[i]>60){ sy+=i*red[i]; sw+=red[i]; } }
    return sy/sw;
  }
  var srt=lum.slice().sort(function(p,q){return p-q;}), med=srt[H>>1];
  var best=-1, bv=0;
  for(var j=1;j<H-1;j++){
    var v=Math.abs((lum[j-1]+2*lum[j]+lum[j+1])/4-med);
    if(v>bv){bv=v;best=j;}
  }
  if(bv<=28) return null;
  // まわり ±3 画素の重心で、画素より細かく求める（跡がぎざぎざにならないように）
  var sy=0, sw=0;
  for(var q=Math.max(0,best-3); q<=Math.min(H-1,best+3); q++){ var wv=Math.max(0,Math.abs(lum[q]-med)-bv*0.3); sy+=q*wv; sw+=wv; }
  return sw>0 ? sy/sw : best;
};

/* 画像で保存（WAVE-F-50） */
Y.save = function(){
  var s=A.src; if(!s||!A.lines.length){ A.toast('先に線を置いてください'); return; }
  var k=Math.max(1,Math.round(480/s.H)), w=Y.outW()*k, h=s.H*k, pad=26;
  var out=A.canvas(w, h+pad), c=out.getContext('2d');
  c.fillStyle=s.light?'#fff':'#0a0c10'; c.fillRect(0,0,w,h+pad);
  c.imageSmoothingEnabled=(s.kind!=='flip'); c.drawImage(cv,0,0,w,h);
  c.fillStyle=s.light?'#222':'#ddd'; c.strokeStyle=c.fillStyle; c.font='14px system-ui';
  if(s.unit==='T'){
    c.textAlign='center';
    for(var g=0;g<A.N();g++) c.fillText(g===0?'0':(g+'T/'+s.perPeriod),(g+0.5)*A.ppf*k,h+18);
  } else {
    var dt=A.dtReal(), total=A.N()*dt, step=total>12?2:(total>4?1:0.5);
    c.textAlign='left';
    for(var t=0;t<=total+1e-9;t+=step){ var x=t/dt*A.ppf*k; c.fillRect(x,h,1,6); c.fillText((Math.round(t*10)/10)+' s',x+3,h+20); }
  }
  A.saveCanvas(out,'y-t図.png');
};

/* ---------- 操作：タップで動画をその時刻へ（WAVE-F-22） ---------- */
var scrub=false;
function pos(e){ var r=cvO.getBoundingClientRect(); return {cx:e.clientX-r.left, cy:e.clientY-r.top}; }
function down(e){
  if(!A.src) return;
  var p=pos(e);
  if(A.tool && A.tool.ytDown){ A.tool.ytDown(p,e); cv.setPointerCapture(e.pointerId); Y.renderOv(); return; }
  if(A.ytLocked) return;
  scrub=true; cv.setPointerCapture(e.pointerId);
  A.stop(); A.goto(Math.floor(Y.c2f(p.cx)));
}
function move(e){
  var p=pos(e);
  if(A.tool && A.tool.ytMove){ A.tool.ytMove(p,e); Y.renderOv(); return; }
  if(scrub) A.goto(Math.floor(Y.c2f(p.cx)));
}
function up(e){
  if(A.tool && A.tool.ytUp){ A.tool.ytUp(pos(e),e); Y.renderOv(); }
  scrub=false;
}

Y.init = function(){
  cv=A.$('#cvYt'); cvO=A.$('#cvYtOv'); wrap=A.$('#ytWrap');
  ctx=cv.getContext('2d'); ctxO=cvO.getContext('2d');
  // 上の重ね用キャンバスは pointer-events:none。操作は下のキャンバスで受ける
  cv.addEventListener('pointerdown',down);
  cv.addEventListener('pointermove',move);
  cv.addEventListener('pointerup',up);
  cv.addEventListener('pointercancel',up);
  A.on('source',function(){ wrap.scrollLeft=0; });
  A.on('layout',Y.renderBase);
  A.on('lines',Y.renderBase);
  A.on('frame',function(){ Y.renderOv(); if(A.isPlaying()) Y.follow(); });
};

})(W);
