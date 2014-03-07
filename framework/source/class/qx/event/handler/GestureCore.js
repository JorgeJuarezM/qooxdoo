/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2014 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Christopher Zuendorf (czuendorf)
     * Daniel Wagner (danielwagner)

************************************************************************ */

/**
 * Listens for (native or synthetic) pointer events and fires events
 * for gestures like "tap" or "swipe"
 *
 * @ignore(qx.event.type.Tap.*)
 * @ignore(qx.event.type.Swipe.*)
 */
qx.Bootstrap.define("qx.event.handler.GestureCore", {
  extend : Object,

  statics : {

    TYPES : ["tap", "swipe", "longtap", "dbltap", "track", "trackstart", "trackend"],

    GESTURE_EVENTS : ["gesturestart", "gestureend", "gesturechange"],

    TAP_MAX_DISTANCE : qx.core.Environment.get("os.name") != "android" ? 10 : 40,

    /** @type {Map} The direction of a swipe relative to the axis */
    SWIPE_DIRECTION :
    {
      x : ["left", "right"],
      y : ["up", "down"]
    },

    /** @type {Integer} The minimum distance of a swipe. Only if the x or y distance
     *      of the performed swipe is greater as or equal the value of this
     *      constant, a swipe event is fired.
     */
    SWIPE_MIN_DISTANCE : qx.core.Environment.get("os.name") != "android" ? 11 : 41,

    /** @type {Integer} The minimum velocity of a swipe. Only if the velocity of the
     *      performed swipe is greater as or equal the value of this constant, a
     *      swipe event is fired.
     */
    SWIPE_MIN_VELOCITY : 0,

    /**
     * @type {Integer} The time delta in milliseconds to fire a long tap event.
     */
    LONGTAP_TIME : 500,

    /**
     * @type {Integer} Maximum time between two tap events that will still trigger a
     * dbltap event.
     */
    DOUBLETAP_TIME : 500
  },

  /**
   * @param target {Element} DOM Element that should fire gesture events
   * @param emitter {qx.event.Emitter?} Event emitter (used if dispatchEvent
   * is not supported, e.g. in IE8)
   */
  construct : function(target, emitter) {
    this.__defaultTarget = target;
    this.__emitter = emitter;
    this.__gesture = {};
    this._initObserver();
  },

  members : {
    __defaultTarget : null,
    __emitter : null,
    __gesture : null,
    __eventName : null,

    /**
     * Register pointer event listeners
     */
    _initObserver : function() {
      // force qx.bom.Event.supportsEvent to return true for this type so we
      // can use the native addEventListener (synthetic gesture events use the
      // native dispatchEvent).
      qx.event.handler.GestureCore.TYPES.forEach(function(type) {
        if (!this.__defaultTarget["on" + type]) {
          this.__defaultTarget["on" + type] = true;
        }
      }.bind(this));

      qx.event.handler.GestureCore.GESTURE_EVENTS.forEach(function(gestureType) {
        qxWeb(this.__defaultTarget).on(gestureType, this.checkAndFireGesture, this);
      }.bind(this));

      if (qx.core.Environment.get("engine.name") == "mshtml" &&
        qx.core.Environment.get("browser.documentmode") < 9)
      {
        qxWeb(this.__defaultTarget).on("dblclick", this._onDblClick, this);
      }
    },


    /**
     * Remove native pointer event listeners.
     */
    _stopObserver : function() {
      qx.event.handler.GestureCore.GESTURE_EVENTS.forEach(function(pointerType) {
        qxWeb(this.__defaultTarget).off(pointerType, this.checkAndFireGesture, this);
      }.bind(this));

      if (qx.core.Environment.get("engine.name") == "mshtml" &&
        qx.core.Environment.get("browser.documentmode") < 9)
      {
        qxWeb(this.__defaultTarget).off("dblclick", this._onDblClick, this);
      }
    },


    /**
     * Checks if a gesture was made and fires the gesture event.
     *
     * @param domEvent {Event} DOM event
     * @param type {String ? null} type of the event
     * @param target {Element ? null} event target
     */
    checkAndFireGesture : function(domEvent, type, target) {
      var gesture = this.__gesture[domEvent.pointerId];
      //if(gesture && gesture.gestureProcessed) {
      //  return;
      //}

      if (!type) {
        type = domEvent.type;
      }

      if (!target) {
        target = qx.bom.Event.getTarget(domEvent);
      }

      if (type == "gesturestart") {
        this.gestureStart(domEvent, target);
      } else if (type == "gesturechange") {
        this.gestureChange(domEvent, target);
      } else if (type == "gestureend") {
        this.gestureEnd(domEvent, target);
      }
    },

    /**
     * Helper method for gesture start.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    gestureStart : function(domEvent, target) {
      this.__gesture[domEvent.pointerId] = {
        "gestureProcessed" : true,
        "startX" : domEvent.clientX,
        "startY" : domEvent.clientY,
        "startTime" : new Date().getTime(),
        "target" : target,
        "isTap" : true,
        "lastTapTime" : null,
        "longTapTimer" : window.setTimeout(
          this.__fireLongTap.bind(this, domEvent, target),
          qx.event.handler.GestureCore.LONGTAP_TIME
        )
      };

      this.__fireTrack("trackstart", domEvent, target);
    },

    /**
     * Helper method for gesture change.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    gestureChange : function(domEvent, target) {
      var gesture = this.__gesture[domEvent.pointerId];
      if(gesture) {
        this.__fireTrack("track", domEvent, target);
        
        // abort long tap timer if the distance is too big
        if (gesture.isTap) {
          gesture.isTap = this._isBelowTapMaxDistance(domEvent);
          if (!gesture.isTap) {
            this.__stopLongTapTimer(gesture);
          }
        }
      }
    },


    /**
     * Helper method for gesture end.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     * @ignore(qx.event)
     * @ignore(qx.event.type)
     */
    gestureEnd : function(domEvent, target) {
      // If no start position is available for this pointerup event, cancel gesture recognition.
      if (Object.keys(this.__gesture).length === 0) {
        return;
      }

      var gesture = this.__gesture[domEvent.pointerId];

      // delete the long tap
      this.__stopLongTapTimer(gesture);

      var eventType;


      if (target !== gesture.target) {
        delete this.__gesture[domEvent.pointerId];
        return;
      }

      if (gesture.isTap) {
        if (qx.event && qx.event.type && qx.event.type.Tap) {
          eventType = qx.event.type.Tap;
        }
        this._fireEvent(domEvent, "tap", domEvent.target || target, eventType);

        if (gesture.lastTapTime) {
          var diff = Date.now() - gesture.lastTapTime;
          if (diff <= qx.event.handler.GestureCore.DOUBLETAP_TIME) {
            this._fireEvent(domEvent, "dbltap", domEvent.target || target, eventType);
          }
        }
        gesture.lastTapTime = Date.now();

      }
      else {
        gesture.lastTapTime = null;
        var swipe = this.__getSwipeGesture(domEvent, target);
        if (swipe) {
          if (qx.event && qx.event.type && qx.event.type.Swipe) {
            eventType = qx.event.type.Swipe;
          }
          domEvent.swipe = swipe;
          this._fireEvent(domEvent, "swipe", domEvent.target || target, eventType);
        }
      }

      this.__fireTrack("trackend", domEvent, target);

      delete this.__gesture[domEvent.pointerId];
    },


    /**
     * Checks if the distance between the x/y coordinates of DOM event
     * exceeds TAP_MAX_DISTANCE and returns the result.
     *
     * @param domEvent {Event} The DOM event from the browser.
     * @return {Boolean} true if distance is below TAP_MAX_DISTANCE.
     */
    _isBelowTapMaxDistance: function(domEvent) {
      var delta = this._getDeltaCoordinates(domEvent);
      if (!delta) {
        return null;
      }
      var clazz = qx.event.handler.GestureCore;

      return (Math.abs(delta.x) <= clazz.TAP_MAX_DISTANCE &&
              Math.abs(delta.y) <= clazz.TAP_MAX_DISTANCE);
    },


    /**
    * Calculates the delta coordinates in relation to the position on <code>pointerstart</code> event.
    * @param domEvent {Event} The DOM event from the browser.
    * @return {Map} containing the deltaX as x, ans deltaY as y.
    */
    _getDeltaCoordinates : function(domEvent) {
      var gesture = this.__gesture[domEvent.pointerId];
      if (!gesture) {
        return null;
      }

      var deltaX = domEvent.clientX - gesture.startX;
      var deltaY = domEvent.clientY - gesture.startY;

      var axis = "x";
      if (Math.abs(deltaX / deltaY) < 1) {
        axis = "y";
      }

      return {
        "x": deltaX,
        "y": deltaY,
        "axis": axis
      };
    },


    /**
     * Fire a gesture event with the given parameters
     *
     * @param domEvent {Event} DOM event
     * @param type {String} type of the event
     * @param target {Element ? null} event target
     */
    _fireEvent : function(domEvent, type, target) {
      var evt;
      if (qx.core.Environment.get("event.dispatchevent")) {
        evt = new qx.event.type.native.Custom(type, domEvent);
        this.__defaultTarget.dispatchEvent(evt);
      } else if (this.__emitter) {
        evt = new qx.event.type.native.Custom(type, domEvent, {
          target : this.__defaultTarget,
          currentTarget : this.__defaultTarget,
          srcElement : this.__defaultTarget
        });

        this.__emitter.emit(type, domEvent);
      }
    },


    /**
     * Fire "tap" and "dbltap" events after a native "dblclick"
     * event to fix IE 8's broken mouse event sequence.
     *
     * @param domEvent {Event} dblclick event
     */
    _onDblClick : function(domEvent) {
      var eventType;
      if (qx.event && qx.event.type && qx.event.type.Tap) {
        eventType = qx.event.type.Tap;
      }
      var target = qx.bom.Event.getTarget(domEvent);
      this._fireEvent(domEvent, "tap", target, eventType);
      this._fireEvent(domEvent, "dbltap", target, eventType);
    },


    /**
     * Returns the swipe gesture when the user performed a swipe.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     * @return {Map} returns the swipe data when the user performed a swipe, null if the gesture was no swipe.
     */
    __getSwipeGesture : function(domEvent, target) {
      var gesture = this.__gesture[domEvent.pointerId];

      var clazz = qx.event.handler.GestureCore;
      var deltaCoordinates = this._getDeltaCoordinates(domEvent);
      var duration = new Date().getTime() - gesture.startTime;
      var axis = (Math.abs(deltaCoordinates.x) >= Math.abs(deltaCoordinates.y)) ? "x" : "y";
      var distance = deltaCoordinates[axis];
      var direction = clazz.SWIPE_DIRECTION[axis][distance < 0 ? 0 : 1];
      var velocity = (duration !== 0) ? distance/duration : 0;

      var swipe = null;
      if (Math.abs(velocity) >= clazz.SWIPE_MIN_VELOCITY
          && Math.abs(distance) >= clazz.SWIPE_MIN_DISTANCE)
      {
        swipe = {
            startTime : gesture.startTime,
            duration : duration,
            axis : axis,
            direction : direction,
            distance : distance,
            velocity : velocity
        };
      }
      return swipe;
    },


    /**
     * Fires a track event.
     *
     * @param type {String} the track type
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __fireTrack : function(type, domEvent, target) {
      domEvent.delta = this._getDeltaCoordinates(domEvent);
      this._fireEvent(domEvent, type, domEvent.target || target, qx.event.type.Track);
    },


    /**
     * Fires the long tap event.
     *
     * @param domEvent {Event} DOM event
     * @param target {Element} event target
     */
    __fireLongTap : function(domEvent, target) {
      this._fireEvent(domEvent, "longtap", domEvent.target || target, qx.event.type.Tap);

      var gesture = this.__gesture[domEvent.pointerId];
      gesture.longTapTimer = null;
      gesture.isTap = false;
    },


    /**
     * Stops the time for the long tap event.
     */
    __stopLongTapTimer : function(gesture) {
      if (gesture.longTapTimer) {
        window.clearTimeout(gesture.longTapTimer);
        gesture.longTapTimer = null;
      }
    },

    /**
     * Checks if the distance between the x/y coordinates of touchstart/mousedown and touchmove/mousemove event
     * exceeds TAP_MAX_DISTANCE and returns the result.
     *
     * @param event {Event} The event from the browser.
     * @return {Boolean} true if distance is below TAP_MAX_DISTANCE.
     */
    isBelowTapMaxDistance: function(event) {
      var deltaCoordinates = this._calcDelta(event);
      var clazz = qx.event.handler.GestureCore;

      return (Math.abs(deltaCoordinates.x) <= clazz.TAP_MAX_DISTANCE &&
              Math.abs(deltaCoordinates.y) <= clazz.TAP_MAX_DISTANCE);
    },


    /**
     * Dispose the current instance
     */
    dispose : function() {
      for(var gesture in this.__gesture) {
        this.__stopLongTapTimer(gesture);
      }

      this._stopObserver();
      this.__defaultTarget = this.__emitter = null;
    }
  }
});