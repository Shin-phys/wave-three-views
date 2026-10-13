/* =========================================================
   コア — 全体で使う道具と状態
   W.src  : いま開いているコマの集まり（動画・サンプル・ぱらぱら漫画で共通の形）
   W.cur  : いま表示しているコマ番号
   W.lines: 位置線（元画像の画素で x を持つ）
   ========================================================= */
var W = (function(){
'use strict';
var A = {};

A.$  = function(s,r){return (r||document).querySelector(s);};
A.$$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
A.clamp = function(v,a,b){return Math.max(a,Math.min(b,v));};
A.show = function(sel,on){var e=(typeof sel==='string')?A.$(sel):sel; if(e)e.classList.toggle('hidden',!on);};
A.dpr = function(){return Math.min(2,window.devicePixelRatio||1);};
A.sleep = function(ms){return new Promise(function(r){setTimeout(r,ms);});};
A.raf = function(){return new Promise(function(r){requestAnimationFrame(r);});};

var toastT=null;
A.toast = function(msg,ms){
  var el=A.$('#toast');
  if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.appendChild(el);}
  el.textContent=msg; el.style.display='block';
  clearTimeout(toastT); toastT=setTimeout(function(){el.style.display='none';},ms||3000);
};
A.saveCanvas = function(cv,name){
  cv.toBlob(function(b){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href);},3000);
  },'image/png');
};
A.canvas = function(w,h){var c=document.createElement('canvas'); c.width=w; c.height=h; return c;};

/* ---------- ちいさなイベント ---------- */
var subs={};
A.on = function(k,fn){(subs[k]=subs[k]||[]).push(fn);};
A.emit = function(k,a){(subs[k]||[]).forEach(function(f){f(a);});};

/* ---------- 状態 ---------- */
A.src = null;
A.cur = 0;
A.lines = [];          // [{x:元画像の画素}]
A.band = 3;            // 位置線の幅（元画像の画素）
A.ppf = 2;             // y-t図で1コマに割り当てる幅（元画像の画素）
A.maxLines = 2;
A.LINE_COLORS = ['#5aa9ff','#ffc24a'];
A.LINE_RGB = [[90,169,255],[255,194,74]];
A.LINE_DARK = ['#1d6fd6','#c07f00'];   // 白い背景の上で使う濃い色
A.snap = true;         // 線と点を目印に吸い付ける

/* src の形
   { kind:'video'|'sample'|'flip', name, W, H,
     frames:[ImageData], times:[秒]（動画の再生時刻）|null,
     fps, slow（撮影倍率：実時間 = 再生時間 × slow）,
     pxPerM|null, light（背景が明るいか）, unit:'s'|'T', perPeriod（ぱらぱら漫画の1周期のコマ数） } */
A.setSource = function(s){
  A.stop && A.stop();
  A.src = s;
  A.cur = 0;
  A.lines = [];
  if(s.kind==='flip'){ A.band=5; A.ppf=Math.max(24,Math.round(s.W/10)); }
  else { A.band=3; A.ppf=2; }
  A.emit('source', s);
  A.emit('frame');
};
/* フレームだけ差し替える（傾き補正・ぱらぱら漫画の表示切替など） */
A.replaceFrames = function(frames, extra){
  var s=A.src; if(!s) return;
  s.frames=frames;
  if(extra) for(var k in extra) s[k]=extra[k];
  A.cur=A.clamp(A.cur,0,frames.length-1);
  A.emit('frames');
  A.emit('frame');
};

A.N = function(){return A.src?A.src.frames.length:0;};

/* コマ i の実時間（秒）。撮影倍率を掛ける。 */
A.timeOf = function(i){
  var s=A.src; if(!s) return 0;
  if(s.unit==='T') return i/s.perPeriod;          // 周期 T を単位にした値
  var t = s.times ? (s.times[i]-s.times[0]) : i/s.fps;
  return t*(s.slow||1);
};
A.fmtTime = function(i){
  var s=A.src; if(!s) return '—';
  if(s.unit==='T'){
    var n=i, d=s.perPeriod;
    return 't = '+(n===0?'0':(n+'T/'+d))+'　（'+(i+1)+' / '+A.N()+' コマ）';
  }
  return 't = '+A.timeOf(i).toFixed(3)+' s　（'+(i+1)+' / '+A.N()+' コマ）';
};
/* 実時間で1コマあたり何秒か（y-t図の横軸の換算に使う） */
A.dtReal = function(){
  var s=A.src; if(!s) return 1/30;
  if(s.unit==='T') return 1/s.perPeriod;
  return (s.slow||1)/s.fps;
};

A.goto = function(i){
  if(!A.src) return;
  i=A.clamp(Math.round(i),0,A.N()-1);
  if(i===A.cur) return;
  A.cur=i; A.emit('frame');
};

/* 列の平均：フレーム f の x を中心に幅 band の列を平均し、RGB を H 個返す */
A.column = function(f, x, band, out, off){
  var s=A.src, im=s.frames[f], w=s.W, h=s.H, d=im.data;
  var b=Math.max(1,Math.round(band));
  var x0=Math.round(x-(b-1)/2); x0=A.clamp(x0,0,w-1);
  var x1=A.clamp(x0+b-1,0,w-1), n=x1-x0+1;
  for(var y=0;y<h;y++){
    var r=0,g=0,bl=0, p=(y*w+x0)*4;
    for(var k=0;k<n;k++,p+=4){r+=d[p];g+=d[p+1];bl+=d[p+2];}
    var o=off+y*3; out[o]=r/n; out[o+1]=g/n; out[o+2]=bl/n;
  }
};

/* 背景が明るいかどうか（最初のコマの平均の明るさで判定） */
A.isLight = function(im){
  var d=im.data, sum=0, n=0;
  for(var i=0;i<d.length;i+=4*37){sum+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;}
  return (sum/n)>128;
};

return A;
})();
