
(function(mousetouch){
   var mt={}; // private variables of mousetouch
   mt.current=-1;
   mt.justpressed=false;
   mt.justpnr=false; // just pressed and released
   mt.dbl=false; // in double click gesture;
   mt.outside=false; // outside of current element;
   mt.elements=[];
   mt.touches=[{},{},{},{},{},{}]; // last coordinates of touches
   mt.mouse={x:0,y:0}; // last coordinate of mouse
   
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
         console.log("down1");
         mt.current=elnr;
         mt.outside=false;
         mt.dbl=mt.justpnr; // this is the second click of a double click if true
         mt.justpressed=false;
         mt.justpnr=false; 
         if (mt.dbl){
            console.log("down2");
            callhandler(e,'down');
         } else {
            console.log("down3");
            if (mt.elements[elnr].gestures.doubleclick){ // does this element want double clicks?
               mt.justpressed=true;
               setTimeout(function(){
                  console.log("down_to_1");
                  if (mt.justpressed){
                     callhandler(e,'down'); // this is a delayed single click
                  }
                  mt.justpressed=false;
               },mt.dbl_t1);
            } else {
               console.log("down4");
               callhandler(e,'down');
            }
         }
         console.log("down5");

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
   }
   
   // mouseup / touchend event; registered on global document to catch events outside of element
   var up=function(e){
      if (mt.current<0) return; // not a gesture of any registered element
      if (mt.justpressed){ // going to be a double click gesture (mouseup shortly after mousedown)
         mt.justpnr=true;
         mt.justpressed=false;
         var elnr=mt.current;
         setTimeout(function(){
            if (mt.justpnr){
               callhandler(e,'down'); // this is a delayed single click
               callhandler(e,'up'); // instantaneously end gesture (single click)
            }
            mt.justpnr=false;
         },mt.dbl_t2);
      } else {
         callhandler(e,'up');
      }
      mt.current=-1; // end gesture officially
      return false;
   }
   
   // mousemove / touchmove event; registered on global document to catch events outside of element
   var move=function(e){
      console.log("move1");
      if (mt.current<0) return; // not a gesture of any registered element
      if (mt.justpressed || mt.justpnr){ // this interrupts double click detection 
         mt.justpnr=false;
         mt.justpressed=false;
         console.log("move2");
         callhandler(e,'down'); // start of gesture
      }
      console.log("move3");
      callhandler(e,'move');
      return false;
   }
   
   
   
   // call the handler for the element; provide additional gesture information
   var callhandler=function(e,what){ 
      console.log("hdl1");
      var gesture={doubleclick:mt.dbl,outside:mt.outside,first:(what=='down'),last:(what=='up')};
      console.log("hdl2");
      if (e.originalEvent.touches){ // touch event
         console.log("hdl3");
         if (e.originalEvent.touches.length){
            console.log("hdl4");
            gesture.x=e.originalEvent.touches[0].pageX;
            gesture.y=e.originalEvent.touches[0].pageY;
            console.log("hdl5");
            mt.touches[0].x=gesture.x;
            mt.touches[0].y=gesture.y;
         } else {
            console.log("hdl6");
            gesture.x=mt.touches[0].x;
            gesture.y=mt.touches[0].y;
         }
      } else { // mouse event
         console.log("hdl7");
         gesture.x=e.pageX;
         gesture.y=e.pageY;
      }
      console.log("hdl8");
      console.log("mt.current=" + mt.current);
      mt.elements[mt.current].handler.call(mt.elements[mt.current].element,e,gesture);
      console.log("hdl9");
      
   }

   // register document event handlers after DOM ready
   $(function(){
      $(document).mouseup(up);
      $(document).bind('touchend',up);
      $(document).mousemove(move);
      $(document).bind('touchmove',move);
   });
})(window.mousetouch={});