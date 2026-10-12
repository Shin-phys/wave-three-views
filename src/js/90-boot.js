/* =========================================================
   起動
   ========================================================= */
(function(A){
'use strict';
function boot(){
  A.view.init();
  A.yt.init();
  A.capture.init();
  A.samples.init();
  A.tools.init();
  A.guide.init();
  A.sheet.init();
  A.flip.init();
  A.ui.init();
  A.ui.tab('open');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(W);
