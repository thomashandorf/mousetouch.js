
(function(mousetouch){
   var mt={}; // private variables of mousetouch
   mt.current=-1;
   mt.justpressed=false;
   mt.justpnr=false; // just pressed and released
   mt.dbl=false; // in double click gesture;
   mt.outside=false; // outside of current element;
   mt.elements=[];
   mt.touches={}; // last coordinates of touches
   mt.touchesidx=[];
   mt.mouse={x:0,y:0}; // last coordinate of mouse
   mt.gesturelast=undefined;
   // double click timings
   mt.dbl_t1=300; // timing for release
   mt.dbl_t2=500; // timing for next down
   
   // function for registering mousetouch events for an element, gestures is hash e.g. {doubleclick=>1,...}
   mousetouch.register=function(element,handler,gestures){
      var elnr=mt.elements.length;
      mt.elements[elnr]={};
      mt.elements[elnr].handler=handler;
      mt.elements[elnr].element=element;
      mt.elements[elnr].gestures=(gestures ? gestures : {});
      
      var down=function(e){
         //console.log("down1");
         if (e.pageX!=undefined){ 
            mt.mouse.x=e.pageX; // save current mouse coordinate
            mt.mouse.y=e.pageY;
         }
         mt.current=elnr;
         mt.outside=false;
         mt.dbl=mt.justpnr; // this is the second click of a double click if true
         mt.justpressed=false;
         mt.justpnr=false; 
         if (mt.dbl){
            //console.log("down2");
            gesturehandler(e,'down');
         } else {
            //console.log("down3");
            if (mt.elements[elnr].gestures.doubleclick){ // does this element want double clicks?
               mt.justpressed=true;
               var which=mt.current;
               setTimeout(function(){
                  //console.log("down_to_1");
                  if (which==mt.current && mt.justpressed){
                     //console.log("down_to_2");
                     gesturehandler(e,'down'); // this is a delayed single click
                     mt.justpressed=false;
                  }
               },mt.dbl_t1);
            } else {
               //console.log("down4");
               gesturehandler(e,'down');
            }
         }
         //console.log("down5");
         
         return false;
      }
      $(element).mousedown(down); // register down function to mousedown
      $(element).bind('touchstart',down); // and touchstart
      
      // events that simply register whether mouse / touch is outside element
      $(element).mouseleave(function(e){
         if (elnr!=mt.current) return;
                            mt.outside=true;
         return false;
      });
      $(element).mouseenter(function(e){
         if (elnr!=mt.current) return;
                            mt.outside=false;
         return false;
      });
      $(element).bind("contextmenu",function(e){ // FIXME make this optional
            return false; // disable context menu;
      });
      $(element).bind("mousewheel",function(e){
         mt.current=elnr;
         mt.outside=false;
         mt.dbl=false; // this is the second click of a double click if true
         mt.justpressed=false;
         mt.justpnr=false; 
         gesturehandler(e,'wheel');
         mt.current=-1; // end gesture officially
         return false;
      }); 
   }
   
   // mouseup / touchend event; registered on global document to catch events outside of element
   var up=function(e){
      //console.log("up1");
      if (mt.current<0) return; // not a gesture of any registered element
      if (mt.justpressed){ // going to be a double click gesture (mouseup shortly after mousedown)
         //console.log("up2");
         mt.justpnr=true;
         mt.justpressed=false;
         var elnr=mt.current;
         setTimeout(function(){
            //console.log("up_to_1");
            if (mt.justpnr){
               if (mt.current>0 && mt.current != elnr) return; // we are in a different gesture already
               mt.current=elnr;
      //console.log("up_to_2");
               gesturehandler(e,'down'); // this is a delayed single click
               gesturehandler(e,'up'); // instantaneously end gesture (single click)
               mt.justpnr=false;
               mt.current=-1;
            }
         },mt.dbl_t2);
      } else {
         //console.log("up3");
         gesturehandler(e,'up');
      }
      //console.log("up4");
      mt.current=-1; // end gesture officially
      return false;
   }
   
   // mousemove / touchmove event; registered on global document to catch events outside of element
   var move=function(e){
      //console.log("move1");
      if (e.pageX!=undefined){ 
         mt.mouse.x=e.pageX; // save current mouse coordinate
         mt.mouse.y=e.pageY;
      }
      if (mt.current<0) return; // not a gesture of any registered element
      if (mt.justpressed || mt.justpnr){ // this interrupts double click detection 
         mt.justpnr=false;
         mt.justpressed=false;
         //console.log("move2");
         gesturehandler(e,'down'); // start of gesture
      }
      //console.log("move3");
      gesturehandler(e,'move');
      return false;
   }
   
   
   
   // call the handler for the element; provide additional gesture information
   var gesturehandler=function(e,what){ 
      //console.log("hdl1");
      if (mt.gesturelast && (what=='up' || what=='down' || what=='wheel')){ // break last gesture
         console.log("break gesture "+ what);
         var gesture=mt.gesturelast;
         gesture.first=false;
         gesture.last=true;
         mt.elements[mt.current].handler.call(mt.elements[mt.current].element,e,gesture);
         mt.gesturelast=undefined;
      }
      var gesture={doubleclick:mt.dbl,outside:mt.outside};
      //console.log("hdl2");
      if (e.originalEvent.changedTouches) { // touch event
		 //console.log(e);
         doTouches(e.originalEvent,what,gesture);
       //console.log(JSON.stringify(gesture));
         //console.log("hdl3");
      } else { // mouse event
         //console.log("hdl7");
         if (what=='up') return;
         doMouse(e,what,gesture);
      }
      //console.log("hdl8");
      //console.log("mt.current=" + mt.current);
      mt.elements[mt.current].handler.call(mt.elements[mt.current].element,e,gesture);
      mt.gesturelast=gesture;
      //console.log("hdl9");
      
   }
   
   // Mouse specific event handling
   var doMouse=function(e,what,gesture){
      gesture.x=e.pageX;
      gesture.y=e.pageY;
      if (gesture.x === undefined){ // happens e.g. for mousewheel
         gesture.x=mt.mouse.x;
         gesture.y=mt.mouse.y;
      }
      var el=mt.elements[mt.current].element;
      var cx=$(el).offset().left+$(el).width()/2;
      var cy=$(el).offset().top+$(el).height()/2;
      if (what=='down') {
         gesture.first=true;
         mt.start={x:gesture.x,y:gesture.y};
         mt.startrot=Math.atan2(gesture.y-cy,gesture.x-cx);
      }
      if (what=='wheel'){
         var delta;
         if (event.wheelDelta) { /* IE/Opera. */
            delta = event.wheelDelta/120;
         } else if (event.detail) { /** Mozilla case. */
            /** In Mozilla, sign of delta is different than in IE.
             * Also, delta is multiple of 3.
             */
            delta = -event.detail/3;
         }
         gesture.scale=Math.pow(1.2,delta);
         gesture.start={x:gesture.x,y:gesture.y};
         gesture.shift={x:0,y:0};
         gesture.rotation=0;
      } else if (e.button==2){ // rotate gesture on mouse
         var rot=Math.atan2(gesture.y-cy,gesture.x-cx);
         var drot=rot-mt.startrot;
         if (drot>Math.PI) drot-=2*Math.PI;
         if (drot<-Math.PI) drot+=2*Math.PI;
         gesture.rotation=180*drot/Math.PI;
         gesture.start={x:cx,y:cy};
         gesture.shift={x:0,y:0};
         gesture.scale=1;
      } else {
         gesture.scale=1;
         gesture.start={x:mt.start.x,y:mt.start.y};
         gesture.rotation=0;
         gesture.shift={x:gesture.x-mt.start.x,y:gesture.y-mt.start.y};
      }
   }
   // touch specific event handling
   var doTouches=function(oe,what,gesture){
      var i;
      //console.log(JSON.stringify(mt.touches));
      mt.touches={};
      mt.touchesidx=[];
      var x=0;
      var y=0;
      for (i=0;i<oe.touches.length;i++){
         var t=oe.touches[i];
         mt.touches[t.identifier]={pageX:t.pageX,pageY:t.pageY,identifier:t.identifier};
         mt.touchesidx.push(t.identifier);
         x+=t.pageX;
         y+=t.pageY;
      }
      mt.touchesidx.sort();
      x/=mt.touchesidx.length;
      y/=mt.touchesidx.length;
      // FIXME: what if len==0;
      gesture.x=x;
      gesture.y=y;
      console.log(JSON.stringify(mt.touches));
      if (mt.touchesidx.length==0) return; // no gesture continues
      if (what=='down' || what=='up'){ // gesture starts
         gesture.first=true;
         mt.start={x:gesture.x,y:gesture.y};
         if (mt.touchesidx.length==2){
            var d={x:mt.touches[mt.touchesidx[1]].pageX-mt.touches[mt.touchesidx[0]].pageX,y:mt.touches[mt.touchesidx[1]].pageY-mt.touches[mt.touchesidx[0]].pageY};
            mt.startrot=Math.atan2(d.y,d.x);
            mt.startd=Math.sqrt(d.x*d.x+d.y*d.y);
         }
      } else {
         gesture.shift={x:gesture.x-mt.start.x,y:gesture.y-mt.start.y};
         if (mt.touchesidx.length==2){ // rotation & scale for two finger gestures
            var d={x:mt.touches[mt.touchesidx[1]].pageX-mt.touches[mt.touchesidx[0]].pageX,y:mt.touches[mt.touchesidx[1]].pageY-mt.touches[mt.touchesidx[0]].pageY};
            var rot=Math.atan2(d.y,d.x);
            var drot=rot-mt.startrot;
            if (drot>Math.PI) drot-=2*Math.PI;
            if (drot<-Math.PI) drot+=2*Math.PI;
            gesture.rotation=180*drot/Math.PI;
            var ld=Math.sqrt(d.x*d.x+d.y*d.y);
            gesture.scale=ld/mt.startd;
         }
      }
      return;
   }
   // register document event handlers after DOM ready
   $(function(){
      $(document).mouseup(up);
      $(document).bind('touchend',up);
      $(document).mousemove(move);
      $(document).bind('touchmove',move);
      $(document).bind('touchcancel',up);
   });
})(window.mousetouch={});