var __mousetouch_defined = __mousetouch_defined || false;

// public mousetouch object
// variables can be changed to affect mousetouch behaviour

var mousetouch = mousetouch || {};

// anonymous function defining a private scope for internal mousetouch variables and functions
(function(mousetouch) {
  "use strict";
  // only execute once. necessary????
  if (__mousetouch_defined) return;
  __mousetouch_defined = true;

  // access mousetouch configuration properties either trough options hash provided at register or through mousetouch global object
  var config = function(pt, element) {
    if (current !== undefined && elements[current].options[pt] !== undefined) return elements[current].options[pt];
    if (element !== undefined && element.options[pt] !== undefined) return element.options[pt];
    if (mousetouch[pt] !== undefined) return mousetouch[pt];
    return undefined;
  }

  if (config('debug')) console.log('mousetouch init');

  var __mousetouch_defaults = {
    waitdoubleclick: false, // don't send out downs immidiately, wait whether it's going to be a double click
    cancelgestures: true, // if number of buttons/fingers changes, send out an extra cancel event for existing gesture
    preventdefault: false, // always call preventDefault on all observed events
    preventdefault_move: true, // prevent default on move events
    preventdefault_context: true, // prevent context menu
    preventDefault_wheel: true, // prevent default wheel operation (only if wheelscale or wheelymove actuall hit)
    debug: false,
    double_ms: 300, // double click: time in which first up must occure AND time in which 2dn down must occur after 1st up
    long_ms: 500, // time to be considered as long click
    touchquarantine_ms: 1000, // how long to wait after touch event until a mouse event is not ignored anymore
    mouserotateshift: true, // configure which modifiers will trigger mouse rotate / scale gesture ...
    mouserotatealt: false,
    mouserotatectrl: false,
    mouserotatebtn1: false,
    mouserotatebtn2: true,
    mousescaleshift: false,
    mousescalealt: false,
    mousescalectrl: true,
    mousescalebtn1: true,
    mousescalebtn2: false,
    wheelymovectrl: false,
    wheelymovealt: false,
    wheelymoveshift: false,
    wheelymove: true,
    wheelymovedelta: 20,
    wheelxmovectrl: false,
    wheelxmovealt: false,
    wheelxmoveshift: true,
    wheelxmove: false,
    wheelxmovedelta: 20,
    wheelscalectrl: true,
    wheelscalealt: true,
    wheelscaleshift: false,
    wheelscale: false,
    wheelscaledelta: 1.2

  }

  // some private variables
  var gestureID = 1, // counts up for each new down event
    elements = [],
    lastGesture = undefined;
  // variables for temporal gestures
  var temp_ID = 1,
    temp_ctrlID = undefined, // for temporal gestures to detect if multiple clicks come from same finger / button
    temp_justp = false, // just pressed
    temp_justpnr = false, // just pressed and released
    temp_downGesture = undefined,
    temp_upGesture = undefined,
    temp_element = undefined;
  // Note: some temp variables are also gesture state variables as they are reset when the gesture ends

  // variables for mouse events after touch events detection
  var touchID = 1,
    in_touch = false;

  // mousetouch state variables
  var current, mousePos, touch, touches, mouseBtn, ctrlID, temp_long, temp_abort, no_temp, gestures_detected, reset, transf_startd, transf_startrot;
  var reset_state = function() {
    current = undefined; // index of gesture recieving element into elements array
    mousePos = {
      x: 0,
      y: 0
    };
    touch = false;
    touches = [];
    mouseBtn = [false, false, false];
    ctrlID = undefined; // ID of touch or mouse button
    gestures_detected = {};
    reset = false;
    temp_long = false; // not yet pressed long enough for long click
    temp_abort = false; // stop detecting temporal gestures for current gesture
    no_temp = false; // no temporal gestures
    transf_startd = undefined;
    transf_startrot = undefined;
  }
  reset_state();

  // register a gesture handler for a given element
  mousetouch.register = function(element, handler, options) {
    var elnr = elements.length;
    elements[elnr] = {
      handler: handler,
      element: element,
      options: (options ? options : {})
    };
    var down = function(e) { // handler for handling down events on the registered element
      if (config('debug')) console.log("down");
      if (current === undefined) {
        current = elnr; // indicates that a new gesture has started.
        gestureID++;
      }
      if (touch) { // update touch information
        for (var i = 0; i < e.changedTouches.length; i++) {
          for (var n = 0; n < touches.length; n++) {
            if (e.changedTouches[i].identifier == touches[n].identifier) {
              if (config('debug')) console.log('recieved double touchstart for ctrlID ' + ctrlID);
              return; // ignore this event; // might be problematic if there is more than one changedTouches
            }
          }
          touches.push(e.changedTouches[i]);
        }
      } else {
        if (e.button !== undefined) { // update button status
          mouseBtn[e.button] = true;
        }
      }
      // call the second part of the down handler;
      // needed as "up" handler needs to call "down" handler if gesture is not finished and in this case the state updates from above should not be executed
      gesture_down(e);
    }
    var wheel = function(e) {
      if (config('debug')) console.log("wheel");
      if (current === undefined) {
        current = elnr; // indicates that a new gesture has started.
        gestureID++;
      }
      gesture_wheel(e);
    }
    bnd(element, "mousedown", down, false);
    bnd(element, "touchstart", down, false);
    if (config('preventdefault_context', elements[elnr])) {
      bnd(element, "contextmenu", function(e) {
        e.preventDefault()
      }, false);
    }
    bnd(element, "mousewheel", wheel);
    bnd(element, "DOMMouseScroll", wheel);
  }
  // 2nd part gesture handling for down events (needed since temporal gestures may trigger further execution at a later time point)
  var gesture_down = function(e) {
    if (config('debug')) console.log("gesture_down");
    var gesture = {
      last: false,
    };
    // if there is a current gesture and there is a new down event we need to cancel the current gesture and continue
    // with the new one 
    // e.g. transition from single touch to double touch
    if (lastGesture && config('cancelgestures')) { // send a cancel gesture
      gesture_cancel(); // this also does temp_gesture_abort();
      gesture.first = true;
    } else if (lastGesture) {
      temp_gesture_abort();
      gesture.cancel = true; // don't send a extra cancel gesture; just set cancel property in current
    } else {
      gesture.first = true; // no current gesture, so this is a new one
    }
    // initializing properties of gesture
    if (touch) {
      var touchavg = average_touches();
      gesture.x = touchavg.x;
      gesture.y = touchavg.y;
      gesture.start = {
        x: gesture.x,
        y: gesture.y
      };
      gesture_touch_scale_start();
      gesture_touch_rotate_start();
    } else {
      gesture.x = mousePos.x;
      gesture.y = mousePos.y;
      gesture.start = {
        x: mousePos.x,
        y: mousePos.y
      };
    }
    // detect mnulti touch / or several mouse buttons
    var num = 0;
    if (mouseBtn[0]) num++;
    if (mouseBtn[1]) num++;
    if (mouseBtn[2]) num++;
    num += touches.length;
    if (num > 1) gestures_detected.multi = 1;
    // fill in missing properties
    gesture_fill(gesture, e)
    // go
    temp_gesture_down(gesture); // first does temporal gestures detection like double click or long click; may wait before sending gesture
  }
  // handler for up events
  var gesture_up = function(e) {
    if (current === undefined) return; // not in a gesture
    if (config('debug')) console.log("up");
    gesture_fill(lastGesture, e);
    if (touch) { // update touch information
      for (var i = 0; i < e.changedTouches.length; i++) {
        for (var n = 0; n < touches.length; n++) {
          if (e.changedTouches[i].identifier == touches[n].identifier) {
            touches.splice(n, 1); // remove touch point
          }
        }
      }
    } else {
      if (e.button !== undefined) { // update button status
        mouseBtn[e.button] = false;
      }
    }
    if (mouseBtn[0] || mouseBtn[1] || mouseBtn[2] || touches.length) { // WARNING: this only assumes 3 mouse buttons
      // we are not finished yet. there will be a new gesture running afterwards, hence call gesture_down
      gesture_down(e);
    } else {
      // finish gesture
      lastGesture.last = true;
      if (!gestures_detected.move && !gestures_detected.multi && !gestures_detected.wheel) {
        lastGesture.click = true;
        lastGesture.doubleclick = !! gestures_detected.double;
        lastGesture.longclick = !! gestures_detected.long;
      }
      reset = true;
      // send after reseting state to ensure reset even if client handler breaks;
      temp_gesture_up(lastGesture); // this sends the gesture after handling possible temporal gestures; sending may be delayed
    }
  }
  var gesture_move = function(e) {
    if (current == undefined) return; // not in a gesture
    if (config('debug')) console.log("move");
    temp_gesture_abort();
    gestures_detected.move = true;
    var gesture = lastGesture;
    // update position
    if (touch) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        for (var n = 0; n < touches.length; n++) {
          if (e.changedTouches[i].identifier == touches[n].identifier) {
            touches[n] = e.changedTouches[i];
            break;
          }
        }
      }
      var touchavg = average_touches();
      gesture.x = touchavg.x;
      gesture.y = touchavg.y;
    } else {
      gesture.x = mousePos.x;
      gesture.y = mousePos.y;
    }
    gesture.shift = {
      x: gesture.x - gesture.start.x,
      y: gesture.y - gesture.start.y
    }

    // detect transform gestures
    if (touch) {
      gesture_touch_scale(gesture, e);
      gesture_touch_rotate(gesture, e);
    } else {
      gesture_mouse_scale(gesture, e);
      gesture_mouse_rotate(gesture, e);
      // gesture_mouse_scroll(gesture);
    }

    // feed in more gesture data
    gesture_fill(gesture, e);
    // call preventDefault for event if configured for move events
    if (config('preventdefault_move')) {
      e.preventDefault();
    }
    //go

    gesture_send(gesture);
  }
  var gesture_wheel = function(e) {
    no_temp = true; // disable temporal gestures (i.e. no double click for wheels)
    gestures_detected.wheel = true;
    gesture_down(e); // send a down gesture
    var gesture = lastGesture;
    var delta;
    if (e.wheelDelta) { /* IE/Opera. */
      delta = e.wheelDelta / 120;
    } else if (e.detail) { /** Mozilla case. */
      /** In Mozilla, sign of delta is different than in IE.
       * Also, delta is multiple of 3.
       */
      delta = -e.detail / 3;
    }
    // should we send a scaling gesture?
    if (e.ctrlKey && config('wheelscalectrl') ||
      e.altKey && config('wheelscalealt') ||
      e.shiftKey && config('wheelscaleshift') || !e.shiftKey && !e.ctrlKey && !e.altKey && config('wheelscale')) {
      gesture.scale = Math.pow(config('wheelscaledelta'), delta);
      gestures_detected.tranform = true;
      if (config('preventdefault_wheel')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    // should we send a ymove gesture (y-scrolling)
    if (e.ctrlKey && config('wheelymovectrl') ||
      e.altKey && config('wheelymovealt') ||
      e.shiftKey && config('wheelymoveshift') || !e.shiftKey && !e.ctrlKey && !e.altKey && config('wheelymove')) {
      gesture.shift = {
        x: 0,
        y: delta * config('wheelymovedelta')
      };
      gesture.y += gesture.shift.y;
      gestures_detected.move = true;
      if (config('preventdefault_wheel')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    // should we send a xmove gesture (x-scrolling)
    if (e.ctrlKey && config('wheelxmovectrl') ||
      e.altKey && config('wheelxmovealt') ||
      e.shiftKey && config('wheelxmoveshift') || !e.shiftKey && !e.ctrlKey && !e.altKey && config('wheelxmove')) {
      gesture.shift = {
        x: delta * config('wheelxmovedelta'),
        y: 0
      };
      gesture.x += gesture.shift.x;
      gestures_detected.move = true;
      if (config('preventdefault_wheel')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    gesture.wheeldelta = delta; // just save the delta value in gesture.wheeldelta so that clients can use it
    gesture_fill(gesture, e);
    gesture_send(gesture); // send to gestures (one move /scale + one up) as this is consistent with non wheel gestures
    gesture_up(e);
  }
  var gesture_cancel = function() {
    temp_gesture_abort();
    lastGesture.cancel = true;
    lastGesture.last = true;
    gesture_send(lastGesture);
  }
  var gesture_fill = function(gesture, e) {
    // inject further properties calculated from current gesture state
    add_properties(gesture, {
      event: e,
      double: gestures_detected.hasOwnProperty('double'),
      long: gestures_detected.hasOwnProperty('long'),
      multi: gestures_detected.hasOwnProperty('multi'),
      transform: gestures_detected.hasOwnProperty('transform'),
      move: gestures_detected.hasOwnProperty('move'),
      wheel: gestures_detected.hasOwnProperty('wheel'),
      buttons: mouseBtn.slice(),
      touch: touch
    }, true);
    // inject default values if not yet set
    add_properties(gesture, {
      rotation: 0,
      scale: 1,
      click: false,
      cancel: false,
      doubleclick: false,
      longclick: false,
      shift: {
        x: 0,
        y: 0
      },
      wheeldelta: 0,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey
    });
  }
  var gesture_send = function(gesture, element) {
    var el = element || elements[current];
    // save current gesture
    if (!element) gesture_save(gesture); // this may destroy gesture state variables if reset is true
    // call client handler, should be called as the last step to avoid state corruption if client handler fails
    if (config('debug')) console.log("gesture_send");
    el.handler.call(el.element, gesture);
  }
  // save gesture to lastGesture and reset some properties which are valid only one time
  var gesture_save = function(gesture) {
    if (reset) {
      if (config('debug')) console.log("gesture_reset");
      lastGesture = undefined;
      reset_state();
    } else {
      if (config('debug')) console.log("gesture_save");
      lastGesture = dclone(gesture); // deep copy gesture object; client changes won't matter anymore
      lastGesture.cancel = false;
      lastGesture.first = false;
      lastGesture.last = false;
    }
  }
  // detects double and long clicks (down handler)
  var temp_gesture_down = function(gesture) {
    if (temp_abort || no_temp) return gesture_send(gesture);
    if (config('debug')) console.log("temp_down");
    // detect if multiple clicks come from same button/finger
    // if (temp_ctrlID && temp_ctrlID !== ctrlID) { // WARNING: this probably does not work for touches
    //   temp_gesture_abort();
    //   return gesture_send(gesture);
    // }
    // temp_ctrlID = ctrlID;

    if (temp_justpnr) { // this is a double click
      temp_justpnr = false;
      temp_abort = true; // set temp abort, but do not trigger gesture_send for latest down and up events (only applies if waitdoubleclick is true)
      temp_downGesture = undefined;
      temp_upGesture = undefined;
      gestures_detected.double = true;
      gesture.double = true; //inject into current down gesture as well (this already has been filled with gesture_fill)
      return gesture_send(gesture);
    } else {
      if (temp_downGesture) {
        temp_gesture_abort(); // this inactivates any running timers from last temp gesture by doing temp_ID++
        return gesture_send(gesture);
      } else if (!(temp_abort)) { // start new temporal gesture detection
        var curID = temp_ID;
        var curGID = gestureID;
        temp_downGesture = gesture;
        temp_element = elements[current];
        temp_justp = true;
        temp_long = true;
        setTimeout(function() { // start timer for doubleclick detection
          if (curID != temp_ID) return; // not my temp gesture anymore
          if (temp_justp) { // no up fired in waiting period and temporal gestures have not been aborted
            if (config('debug')) console.log("mousetouch justp timeout");
            temp_gesture_abort(true);
          }
          temp_justp = false;
        }, config('double_ms'));
        setTimeout(function() { // start timer for long click detection
          if (curGID != gestureID) return; // not my gesture anymore
          if (temp_long) { // warning, long click detection does not react on temp_abort; temp_long is falsified extra in temp_gesture_abort if not call with parameter true
            if (config('debug')) console.log("mousetouch long click timeout");
            gestures_detected.long = true;
          }
          temp_long = false;
        }, config('long_ms'));
        if (config('waitdoubleclick')) {
          return gesture_save(gesture);
        } else {
          return gesture_send(gesture);
        }
      }
    }
  }
  // detects double and long clicks (up handler)
  var temp_gesture_up = function(gesture) {
    temp_long = false; // if long click waiting period is not finished yet, don't wait for it anymore
    if (temp_abort || no_temp) return gesture_send(gesture);
    if (config('debug')) console.log("temp_up"); // detect if multiple clicks come from same button/finger
    // if (temp_ctrlID && temp_ctrlID !== ctrlID) {
    //   temp_gesture_abort();
    //   return gesture_send(gesture);
    // }
    // temp_ctrlID = ctrlID;

    if (temp_justp) { // release after click -> maybe a double click
      var curID = temp_ID;
      temp_upGesture = gesture;
      temp_justp = false;
      temp_justpnr = true;
      setTimeout(function() {
        if (curID != temp_ID) return; // not my temp gesture anymore
        if (temp_justpnr) { // waiting for next down period expired
          if (config('debug')) console.log("mousetouch justpnr timeout");
          temp_gesture_abort();
        }
        temp_justpnr = false;
      }, config('double_ms'));
      if (config('waitdoubleclick')) {
        return gesture_save(gesture);
      } else {
        return gesture_send(gesture);
      }
    }
    return gesture_send(gesture);
  }
  // abort temporal gesture detection and trigger pending events if 'waitdoubleclick'
  // if dontabortlong is true, this does not stop long click detection (needed for temp_gesture_abort called from double click down timeout handler)
  var temp_gesture_abort = function(dontabortlong) {
    if (!dontabortlong) temp_long = false;
    if (temp_abort) return;
    if (config('debug')) console.log("temp_abort");
    if (current !== undefined) temp_abort = true; // only set temp_abort if currently in gesture
    temp_ID++;
    temp_justp = false;
    temp_justpnr = false;
    if (config('waitdoubleclick', temp_element)) {
      if (temp_downGesture) gesture_send(temp_downGesture, temp_element);
      if (temp_upGesture) gesture_send(temp_upGesture, temp_element);
    }
    temp_downGesture = undefined;
    temp_upGesture = undefined;
  }
  // get the average of all active touch positions.
  var average_touches = function() {
    var x = 0,
      y = 0,
      cc = 0;
    for (var i = 0; i < touches.length; i++) {
      var t = touches[i];
      if (t.pageX) {
        x += t.pageX;
        y += t.pageY;
        cc++;
      }
    }
    x /= cc;
    y /= cc;
    return {
      x: x,
      y: y
    };
  };
  // prepare start value for scale gesture
  var gesture_touch_scale_start = function() {
    if (touches.length == 2) { // preparing 2-finger transform gestures
      var dx = (touches[1].pageX - touches[0].pageX);
      var dy = (touches[1].pageY - touches[0].pageY);
      transf_startd = Math.sqrt(dx * dx + dy * dy); // initial distance of touches
      gestures_detected.transform = true;
    }
  }
  // prepare start value for rotate gesture
  var gesture_touch_rotate_start = function() {
    if (touches.length == 2) { // preparing 2-finger transform gestures
      var dx = (touches[1].pageX - touches[0].pageX);
      var dy = (touches[1].pageY - touches[0].pageY);
      transf_startrot = Math.atan2(dy, dx); // initial rotation
      gestures_detected.transform = true;
    }
  }
  var gesture_touch_scale = function(gesture) {
    if (touches.length == 2) { // preparing 2-finger transform gestures
      var dx = (touches[1].pageX - touches[0].pageX);
      var dy = (touches[1].pageY - touches[0].pageY);
      var now = Math.sqrt(dx * dx + dy * dy); // distance of touches
      gesture.scale = now / transf_startd
      gestures_detected.transform = true;
    }
  }
  var gesture_touch_rotate = function(gesture) {
    if (touches.length == 2) { // preparing 2-finger transform gestures
      var dx = (touches[1].pageX - touches[0].pageX);
      var dy = (touches[1].pageY - touches[0].pageY);
      var now = Math.atan2(dy, dx); // initial rotation
      var drot = now - transf_startrot;
      if (drot > Math.PI) drot -= 2 * Math.PI;
      if (drot < -Math.PI) drot += 2 * Math.PI;
      gesture.rotation = 180 * drot / Math.PI
      gestures_detected.transform = true;
    }
  }
  var gesture_mouse_scale = function(gesture, e) {
    if (e.ctrlKey && config('mousescalectrl') ||
      e.altKey && config('mousescalealt') ||
      e.shiftKey && config('mousescaleshift') ||
      e.button == 1 && config('mousescalebtn1') ||
      e.button == 2 && config('mousescalebtn2')) {
      gestures_detected.transform = true;
      gesture.scale = Math.pow(2, 4 * (gesture.x - gesture.y - gesture.start.x + gesture.start.y) / (elements[current].element.clientWidth + elements[current].element.clientHeight));
      gesture.shift = {
        x: 0,
        y: 0
      };
    }
  }
  var gesture_mouse_rotate = function(gesture, e) {
    if (e.ctrlKey && config('mouserotatectrl') ||
      e.altKey && config('mouserotatealt') ||
      e.shiftKey && config('mouserotateshift') ||
      e.button == 1 && config('mouserotatebtn1') ||
      e.button == 2 && config('mouserotatebtn2')) {
      // if (vec.norm(vec.diff(gesture.start, gesture)) > 15) {
      //   var dx = (gesture.start.x - gesture.x);
      //   var dy = (gesture.start.y - gesture.y);
      //   if (transf_startrot === undefined) {
      //     transf_startrot = Math.atan2(dy, dx); // initial rotation
      //     return;
      //   }
      //   gestures_detected.transform = true;
      //   var now = Math.atan2(dy, dx); // current rotation
      //   var drot = now - transf_startrot;
      //   if (drot > Math.PI) drot -= 2 * Math.PI;
      //   if (drot < -Math.PI) drot += 2 * Math.PI;
      //   gesture.rotation = 180 * drot / Math.PI
      // }
      gestures_detected.transform = true;
      gesture.rotation = (gesture.x - gesture.y - gesture.start.x + gesture.start.y) / (elements[current].element.clientWidth + elements[current].element.clientHeight) * 4 * 360;
      while (gesture.rotation < 0) gesture.rotation += 360;
      while (gesture.rotation > 360) gesture.rotation -= 360;
      gesture.shift = {
        x: 0,
        y: 0
      };
    }
  }
  // Internet Explorer version detection, http://gist.github.com/527683
  var IE_ver = (function() {

    var v = 3,
      div = document.createElement('div'),
      all = div.getElementsByTagName('i');

    while (
      div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
      all[0]);

    return v > 4 ? v : undefined;

  }());

  // generalized event binding & handling without jquery or similar
  var bnd = function(elem, type, eventHandle, capture) {
    var handler = function(e) {
      if (e.mousetouch) { // mousetouch has seen this event
        if (config('debug')) console.log('mousetouch: multiple elements registered in bubble chain. currently only first element will be handled.');
        return;
      }
      e.mousetouch = true;
      // touch detection
      touch = (e.changedTouches ? true : false);
      // start mouse events after touch events detection
      if (touch) {
        touchID++;
        var this_touchID = touchID;
        in_touch = true;
        setTimeout(function() {
          if (this_touchID === touchID) {
            in_touch = false;
          }
        }, config('touchquarantine_ms'))
      }
      //ignore mouse event after touch event
      if (in_touch && e instanceof MouseEvent) {
        if (config('debug')) console.log("mouse event " + e.type + " ignored.");
        return;
      }
      // crossbrowser pageXY from jquery
      // Calculate pageX/Y if missing and clientX/Y available 
      if (!touch && e.pageX === undefined && e.clientX !== undefined) {
        eventDoc = e.target.ownerDocument || document;
        doc = eventDoc.documentElement;
        body = eventDoc.body;
        e.pageX = e.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
        e.pageY = e.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
      }
      // update mouse position
      if (!touch && e.pageX !== undefined) {
        mousePos.x = e.pageX;
        mousePos.y = e.pageY;
      }
      // normalize mouse buttons to 0 === left; 1 === middle; 2 === right
      // http://unixpapa.com/js/mouse.html
      if (!touch && e.button !== undefined) {
        if (IE_ver < 9) {
          switch (e.button) {
            case 1:
              e.button = 0;
              break;
            case 2:
              e.button = 2;
              break
            case 4:
              e.button = 1;
          }
        }
      } else if (!touch && e.which !== undefined) { // quick hack which is not correct in all cases, but for almost all browsers e.button should be set anyway
        e.button = e.which - 1;
      }

      // unified identifier for mouse button and fingers
      if (!touch && e.button !== undefined) {
        ctrlID = "btn" + e.button;
      }
      if (touch) {
        ctrlID = e.changedTouches[0].identifier;
      }

      if (config('debug') && current) console.log("event: " + e.type + ", ctrlID: " + ctrlID);

      if (config('preventdefault') && (current !== undefined || e.type === 'mousedown' || e.type === 'touchstart')) {
        e.preventDefault();
      }
      // now call the actuall handler
      return eventHandle.call(elem, e);
    }
    // bind event
    if (elem.addEventListener) { // all modern browsers
      elem.addEventListener(type, handler, capture);
    } else if (elem.attachEvent) { // IE way of event attachment
      elem.attachEvent("on" + type, handler);
      if (capture) {
        elem.setCapture(true);
      }
    }
  }

  // tests if obj is plain object
  var isPlainObject = function(obj) {
    // Must be an Object.
    // Because of IE, we also have to check the presence of the constructor property.
    // Make sure that DOM nodes and window objects don't pass through, as well
    if (!obj || typeof(obj) !== "object" || obj.nodeType) {
      return false;
    }
    try {
      // Not own constructor property must be Object
      if (obj.constructor && !obj.hasOwnProperty("constructor") && !obj.constructor.prototype.hasOwnProperty("isPrototypeOf")) {
        return false;
      }
    } catch (e) {
      // IE8,9 Will throw exceptions on certain host objects #9897
      return false;
    }
    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var key;
    for (key in obj) {}
    return key === undefined || obj.hasOwnProperty(key);
  }
  // deep clone objects; modified from jquery extend; 
  var dclone = function() {
    var length = arguments.length,
      target = length == 1 ? {} : arguments[0],
      srcobj = length == 1 ? arguments[0] : arguments[1];

    if (!srcobj) return;
    // Extend the base object
    for (name in srcobj) {
      var src, copyIsArray, copy, name, clone;
      src = target[name];
      copy = srcobj[name];
      // Recurse if we're merging plain objects or arrays
      if (copy && (isPlainObject(copy) || (copyIsArray = (typeof(copy) === "array")))) {
        if (copyIsArray) {
          copyIsArray = false;
          clone = src && (typeof(src) === "array") ? src : [];

        } else {

          clone = src && (isPlainObject(src)) ? src : {};
        }

        // Never move original objects, clone them
        target[name] = dclone(clone, copy);

        // Don't bring in undefined values
      } else if (copy !== undefined) {
        target[name] = copy;
      }
    }

    // Return the modified object
    return target;
  };

  // fill in properties from src into target; if force==true replace properties already set in target
  var add_properties = function(target, src, force) {
    for (var p in src) {
      if ((force || !target[p]) && src.hasOwnProperty(p)) {
        target[p] = src[p];
      }
    }
  }

  // ready function; called once document is available
  var ready = function() {
    // registering move and up handlers at document level and in capture phase
    bnd(document, 'mouseup', gesture_up, true);
    bnd(document, 'touchend', gesture_up, true);
    bnd(document, 'mousemove', gesture_move, true);
    bnd(document, 'touchmove', gesture_move, true);
    bnd(document, 'touchcancel', gesture_up, true);
    // fill in default parameters if not already defined
    add_properties(mousetouch, __mousetouch_defaults);
  }
  // bind global listeners
  ready();
  // // bind ready function cross-browser
  // // http://stackoverflow.com/questions/799981/document-ready-equivalent-without-jquery
  // // Mozilla, Opera and webkit nightlies currently support this event
  // if (document.addEventListener) {
  //   // Use the handy event callback
  //   document.addEventListener("DOMContentLoaded", function() {
  //     document.removeEventListener("DOMContentLoaded", arguments.callee, false);
  //     ready();
  //   }, false);

  //   // If IE event model is used
  // } else if (document.attachEvent) {
  //   // ensure firing before onload,
  //   // maybe late but safe also for iframes
  //   document.attachEvent("onreadystatechange", function() {
  //     if (document.readyState === "complete") {
  //       document.detachEvent("onreadystatechange", arguments.callee);
  //       ready();
  //     }
  //   });
  // }

})(mousetouch);