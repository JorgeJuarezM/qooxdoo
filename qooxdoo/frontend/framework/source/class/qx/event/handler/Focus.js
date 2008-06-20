/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2007-2008 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Sebastian Werner (wpbasti)
     * Fabian Jakobs (fjakobs)

************************************************************************ */

/* ************************************************************************

#use(qx.event.dispatch.DomBubbling)

************************************************************************ */

/**
 * This handler is used to normalize all focus/activation requirements
 * and normalize all cross browser quirks in this area.
 *
 * Notes:
 *
 * * Webkit and Opera (before 9.5) do not support tabIndex for all elements
 * (See also: http://bugs.webkit.org/show_bug.cgi?id=7138)
 *
 * * TabIndex is normally 0, which means all naturally focusable elements are focusable.
 * * TabIndex > 0 means that the element is focusable and tabable
 * * TabIndex < 0 means that the element, even if naturally possible, is not focusable.
 */
qx.Class.define("qx.event.handler.Focus",
{
  extend : qx.core.Object,
  implement : qx.event.IEventHandler,




  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  /**
   * Create a new instance
   *
   * @type constructor
   * @param manager {qx.event.Manager} Event manager for the window to use
   */
  construct : function(manager)
  {
    this.base(arguments);

    // Define shorthands
    this._manager = manager;
    this._window = manager.getWindow();
    this._document = this._window.document;
    this._root = this._document.documentElement;
    this._body = this._document.body;

    this._initObserver();
  },





  /*
  *****************************************************************************
     PROPERTIES
  *****************************************************************************
  */

  properties :
  {
    /** The active DOM element */
    active :
    {
      apply : "_applyActive",
      nullable : true
    },


    /** The focussed DOM element */
    focus :
    {
      apply : "_applyFocus",
      nullable : true
    }
  },





  /*
  *****************************************************************************
     STATICS
  *****************************************************************************
  */

  statics :
  {
    /** {Integer} Priority of this handler */
    PRIORITY : qx.event.Registration.PRIORITY_NORMAL,

    /** {Map} Supported event types */
    SUPPORTED_TYPES :
    {
      focus : 1,
      blur : 1,
      focusin : 1,
      focusout : 1,
      activate : 1,
      deactivate : 1
    },

    /** {Integer} Whether the method "canHandleEvent" must be called */
    IGNORE_CAN_HANDLE : true
  },





  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    /*
    ---------------------------------------------------------------------------
      EVENT HANDLER INTERFACE
    ---------------------------------------------------------------------------
    */

    // interface implementation
    canHandleEvent : function(target, type) {},


    // interface implementation
    registerEvent : function(target, type, capture) {
      // Nothing needs to be done here
    },


    // interface implementation
    unregisterEvent : function(target, type, capture) {
      // Nothing needs to be done here
    },






    /*
    ---------------------------------------------------------------------------
      FOCUS/BLUR USER INTERFACE
    ---------------------------------------------------------------------------
    */

    /**
     * Focusses the given DOM element
     *
     * @type member
     * @param element {Element} DOM element to focus
     * @return {void}
     */
    focus : function(element)
    {
      try {
        element.focus();
      } catch(ex) {};

      this.setFocus(element);
      this.setActive(element);
    },


    /**
     * Activates the given DOM element
     *
     * @type member
     * @param element {Element} DOM element to activate
     * @return {void}
     */
    activate : function(element) {
      this.setActive(element);
    },


    /**
     * Blurs the given DOM element
     *
     * @type member
     * @param element {Element} DOM element to focus
     * @return {void}
     */
    blur : function(element) 
    {
      try{
        element.blur();
      } catch(ex) {}
        
      if (this.getActive() === element) {
        this.resetActive(); 
      }
      
      if (this.getFocus() === element) {
        this.resetFocus(); 
      }
    },


    /**
     * Deactivates the given DOM element
     *
     * @type member
     * @param element {Element} DOM element to activate
     * @return {void}
     */
    deactivate : function(element)
    {
      if (this.getActive() === element) {
        this.resetActive();
      }
    },





    /*
    ---------------------------------------------------------------------------
      HELPER
    ---------------------------------------------------------------------------
    */


    /**
     * Shorthand to fire events from within this class.
     *
     * @type member
     * @param target {Element} DOM element which is the target
     * @param related {Element} DOM element which is the related target
     * @param type {String} Name of the event to fire
     * @param bubbles {Boolean} Whether the event should bubble
     * @return {void}
     */
    __fireEvent : function(target, related, type, bubbles)
    {
      var Registration = qx.event.Registration;

      var evt = Registration.createEvent(type, qx.event.type.Focus, [target, related, bubbles]);
      Registration.dispatchEvent(target, evt);
    },






    /*
    ---------------------------------------------------------------------------
      WINDOW FOCUS/BLUR SUPPORT
    ---------------------------------------------------------------------------
    */

    /** {Boolean} Whether the window is focused currently */
    _windowFocused : true,


    /**
     * Helper for native event listeners to react on window blur
     *
     * @type member
     * @return {void}
     */
    __doWindowBlur : function()
    {
      // Omit doubled blur events
      // which is a common behavior at least for gecko based clients
      if (this._windowFocused)
      {
        // this.debug("NativeWindowBlur");
        this._windowFocused = false;
        this.__fireEvent(this._window, null, "blur", false);
      }
    },


    /**
     * Helper for native event listeners to react on window focus
     *
     * @type member
     * @return {void}
     */
    __doWindowFocus : function()
    {
      // Omit doubled focus events
      // which is a common behavior at least for gecko based clients
      if (!this._windowFocused)
      {
        // this.debug("NativeWindowFocus");
        this._windowFocused = true;
        this.__fireEvent(this._window, null, "focus", false);
      }
    },






    /*
    ---------------------------------------------------------------------------
      NATIVE OBSERVER
    ---------------------------------------------------------------------------
    */

    /**
     * Initializes event listeners.
     *
     * @type member
     * @signature function()
     * @return {void}
     */
    _initObserver : qx.core.Variant.select("qx.client",
    {
      "gecko" : function()
      {
        // Bind methods
        this.__onNativeMouseDownWrapper = qx.lang.Function.listener(this.__onNativeMouseDown, this);
        this.__onNativeMouseUpWrapper = qx.lang.Function.listener(this.__onNativeMouseUp, this);

        this.__onNativeFocusWrapper = qx.lang.Function.listener(this.__onNativeFocus, this);
        this.__onNativeBlurWrapper = qx.lang.Function.listener(this.__onNativeBlur, this);


        // Register events
        this._document.addEventListener("mousedown", this.__onNativeMouseDownWrapper, true);
        this._document.addEventListener("mouseup", this.__onNativeMouseUpWrapper, true);

        // Capturing is needed for gecko to correctly
        // handle focus of input and textarea fields
        this._window.addEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.addEventListener("blur", this.__onNativeBlurWrapper, true);
      },

      "mshtml" : function()
      {
        // Bind methods
        this.__onNativeMouseDownWrapper = qx.lang.Function.listener(this.__onNativeMouseDown, this);
        this.__onNativeMouseUpWrapper = qx.lang.Function.listener(this.__onNativeMouseUp, this);

        this.__onNativeFocusInWrapper = qx.lang.Function.listener(this.__onNativeFocusIn, this);
        this.__onNativeFocusOutWrapper = qx.lang.Function.listener(this.__onNativeFocusOut, this);

        this.__onNativeSelectStartWrapper = qx.lang.Function.listener(this.__onNativeSelectStart, this);


        // Register events
        this._document.attachEvent("onmousedown", this.__onNativeMouseDownWrapper);
        this._document.attachEvent("onmouseup", this.__onNativeMouseUpWrapper);

        // MSHTML supports their own focusin and focusout events
        // To detect which elements get focus the target is useful
        // The window blur can detected using focusout and look
        // for the toTarget property which is empty in this case.
        this._document.attachEvent("onfocusin", this.__onNativeFocusInWrapper);
        this._document.attachEvent("onfocusout", this.__onNativeFocusOutWrapper);

        // Add selectstart to prevent selection
        this._document.attachEvent("onselectstart", this.__onNativeSelectStartWrapper);
      },

      "webkit" : function()
      {
        // Bind methods
        this.__onNativeMouseDownWrapper = qx.lang.Function.listener(this.__onNativeMouseDown, this);
        this.__onNativeMouseUpWrapper = qx.lang.Function.listener(this.__onNativeMouseUp, this);

        this.__onNativeFocusInWrapper = qx.lang.Function.listener(this.__onNativeFocusIn, this);
        this.__onNativeFocusOutWrapper = qx.lang.Function.listener(this.__onNativeFocusOut, this);

        this.__onNativeFocusWrapper = qx.lang.Function.listener(this.__onNativeFocus, this);
        this.__onNativeBlurWrapper = qx.lang.Function.listener(this.__onNativeBlur, this);

        this.__onNativeSelectStartWrapper = qx.lang.Function.listener(this.__onNativeSelectStart, this);


        // Register events
        this._document.addEventListener("mousedown", this.__onNativeMouseDownWrapper, true);
        this._document.addEventListener("mouseup", this.__onNativeMouseUpWrapper, true);
        this._document.addEventListener("selectstart", this.__onNativeSelectStartWrapper, false);

        this._window.addEventListener("DOMFocusIn", this.__onNativeFocusInWrapper, true);
        this._window.addEventListener("DOMFocusOut", this.__onNativeFocusOutWrapper, true);

        this._window.addEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.addEventListener("blur", this.__onNativeBlurWrapper, true);
      },

      "opera" : function()
      {
        // Bind methods
        this.__onNativeMouseDownWrapper = qx.lang.Function.listener(this.__onNativeMouseDown, this);
        this.__onNativeMouseUpWrapper = qx.lang.Function.listener(this.__onNativeMouseUp, this);

        this.__onNativeFocusInWrapper = qx.lang.Function.listener(this.__onNativeFocusIn, this);
        this.__onNativeFocusOutWrapper = qx.lang.Function.listener(this.__onNativeFocusOut, this);

        this.__onNativeFocusWrapper = qx.lang.Function.listener(this.__onNativeFocus, this);
        this.__onNativeBlurWrapper = qx.lang.Function.listener(this.__onNativeBlur, this);


        // Register events
        this._document.addEventListener("mousedown", this.__onNativeMouseDownWrapper, true);
        this._document.addEventListener("mouseup", this.__onNativeMouseUpWrapper, true);

        this._window.addEventListener("DOMFocusIn", this.__onNativeFocusInWrapper, true);
        this._window.addEventListener("DOMFocusOut", this.__onNativeFocusOutWrapper, true);

        this._window.addEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.addEventListener("blur", this.__onNativeBlurWrapper, true);
      }
    }),


    /**
     * Disconnects event listeners.
     *
     * @type member
     * @signature function()
     * @return {void}
     */
    _stopObserver : qx.core.Variant.select("qx.client",
    {
      "gecko" : function()
      {
        this._document.removeEventListener("mousedown", this.__onNativeMouseDownWrapper, true);
        this._document.removeEventListener("mouseup", this.__onNativeMouseUpWrapper, true);

        this._window.removeEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.removeEventListener("blur", this.__onNativeBlurWrapper, true);
      },

      "mshtml" : function()
      {
        this._document.detachEvent("onmousedown", this.__onNativeMouseDownWrapper);
        this._document.detachEvent("onmouseup", this.__onNativeMouseUpWrapper);

        this._document.detachEvent("onfocusin", this.__onNativeFocusInWrapper);
        this._document.detachEvent("onfocusout", this.__onNativeFocusOutWrapper);

        this._document.detachEvent("onselectstart", this.__onNativeSelectStartWrapper);
      },

      "webkit" : function()
      {
        this._document.removeEventListener("mousedown", this.__onNativeMouseDownWrapper, true);
        this._document.removeEventListener("selectstart", this.__onNativeSelectStartWrapper, false);

        this._window.removeEventListener("DOMFocusIn", this.__onNativeFocusInWrapper, true);
        this._window.removeEventListener("DOMFocusOut", this.__onNativeFocusOutWrapper, true);

        this._window.removeEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.removeEventListener("blur", this.__onNativeBlurWrapper, true);
      },

      "opera" : function()
      {
        this._document.removeEventListener("mousedown", this.__onNativeMouseDownWrapper, true);

        this._window.removeEventListener("DOMFocusIn", this.__onNativeFocusInWrapper, true);
        this._window.removeEventListener("DOMFocusOut", this.__onNativeFocusOutWrapper, true);

        this._window.removeEventListener("focus", this.__onNativeFocusWrapper, true);
        this._window.removeEventListener("blur", this.__onNativeBlurWrapper, true);
      }
    }),






    /*
    ---------------------------------------------------------------------------
      NATIVE LISTENERS
    ---------------------------------------------------------------------------
    */

    /**
     * Native event listener for <code>DOMFocusIn</code> or <code>focusin</code>
     * depending on the client's engine.
     *
     * @type member
     * @signature function(e)
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeFocusIn : qx.core.Variant.select("qx.client",
    {
      "mshtml" : function(e)
      {
        // Force window focus to be the first
        this.__doWindowFocus();

        // Update internal data
        var target = e.srcElement;

        // IE focusin is also fired on elements which are not focusable at all
        // We need to look up for the next focusable element.
        var focusTarget = this.__findFocusElement(target);
        if (focusTarget) {
          this.setFocus(focusTarget);
        }
      },

      "opera" : function(e)
      {
        var target = e.target;
        if (target == this._document || target == this._window) 
        {
          this.__doWindowFocus();
          
          if (this.__previousFocus) 
          {
            this.setFocus(this.__previousFocus);
            delete this.__previousFocus;
          }          
          
          if (this.__previousActive) 
          {
            this.setActive(this.__previousActive);
            delete this.__previousActive;
          }
        } 
        else 
        {
          this.setFocus(target); 
          this.setActive(target);
        }        
      },

      "webkit" : function(e)
      {
        // unused
      },
      
      "default" : null
    }),


    /**
     * Native event listener for <code>DOMFocusOut</code> or <code>focusout</code>
     * depending on the client's engine.
     *
     * @type member
     * @signature function(e)
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeFocusOut : qx.core.Variant.select("qx.client",
    {
      "mshtml" : function(e)
      {
        // unused
      },

      "webkit" : function(e) 
      {
        var target = e.target;

        if (target === this.getFocus()) {
          this.resetFocus();
        }
        
        if (target === this.getActive()) {
          this.resetActive();        
        }
      },
      
      "opera" : function(e)
      {
        var target = e.target;
        if (target == this._document)
        {
          this.__doWindowBlur();
          
          // Store old focus/active elements
          // Opera do not fire focus events for them
          // when refocussing the window (in my opinion an error)
          this.__previousFocus = this.getFocus();
          this.__previousActive = this.getActive();
          
          this.resetFocus();
          this.resetActive(); 
        }
        else
        {
          if (target === this.getFocus()) {
            this.resetFocus();
          }
          
          if (target === this.getActive()) {
            this.resetActive();        
          }        
        }
      },
      
      "default" : null
    }),


    /**
     * Native event listener for <code>blur</code>.
     *
     * @type member
     * @signature function(e)
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeBlur : qx.core.Variant.select("qx.client",
    {
      "gecko" : function(e)
      {
        if (e.target === this._window || e.target === this._document) 
        {
          this.__doWindowBlur(); 
          
          this.resetActive();
          this.resetFocus();
        }        
      },
      
      "webkit" : function(e)
      {
        if (e.target === this._window || e.target === this._document) 
        {
          this.__doWindowBlur(); 
          
          // Store old focus/active elements
          // Opera do not fire focus events for them
          // when refocussing the window (in my opinion an error)
          this.__previousFocus = this.getFocus();
          this.__previousActive = this.getActive();
                    
          this.resetActive();
          this.resetFocus();
        }          
      },
      
      "opera" : function(e)
      {
        
      },   

      "default" : null
    }),


    /**
     * Native event listener for <code>focus</code>.
     *
     * @type member
     * @signature function(e)
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeFocus : qx.core.Variant.select("qx.client",
    {
      "gecko" : function(e)
      {
        var target = e.target;
        
        if (target === this._window || target === this._document) 
        {
          this.__doWindowFocus();
          
          // Always speak of the body, not the window or document
          target = this._body;
        }
        
        this.setFocus(target);
        this.setActive(target);
      },

      "webkit" : function(e)
      {
        var target = e.target;        
        if (target === this._window || target === this._document) 
        {
          this.__doWindowFocus();
          
          if (this.__previousFocus) 
          {
            this.setFocus(this.__previousFocus);
            delete this.__previousFocus;
          }          
          
          if (this.__previousActive) 
          {
            this.setActive(this.__previousActive);
            delete this.__previousActive;
          }
        }
        else
        {
          this.setFocus(target);
          this.setActive(target);
        }
      },
      
      "opera" : function(e)
      {
        
      },

      "default" : null
    }),


    /**
     * Native event listener for <code>mousedown</code>.
     *
     * @type member
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeMouseDown : qx.core.Variant.select("qx.client",
    {
      "gecko" : function(e)
      {
        var target = e.target;
        var focusTarget = this.__findFocusElement(target);
        if (!focusTarget) {
          qx.bom.Event.preventDefault(e);
        }
      },

      "mshtml" : function(e)
      {
        var target = e.srcElement;
        
        // Stop events when no focus element available (or blocked)
        var focusTarget = this.__findFocusElement(target);
        if (focusTarget)
        {
          // Add unselectable to keep selection
          if (!this.__isSelectable(target)) 
          {
            // The element is not selectable. Block selection.
            target.unselectable = "on";
            
            // Unselectable may keep the current selection which
            // is not what we like when changing the focus element.
            // So we clear it
            document.selection.empty();            
            
            // The unselectable attribute stops focussing as well.
            // Do this manually.
            target.focus();
          }
        }
        else
        {
          // Stop event for blocking support
          qx.bom.Event.preventDefault(e);
          
          // Add unselectable to keep selection
          if (!this.__isSelectable(target)) {
            target.unselectable = "on";
          }             
        }
      },

      "webkit|opera" : function(e)
      {
        var target = e.target;
        var focusTarget = this.__findFocusElement(target);
        
        if (focusTarget) {
          this.setFocus(focusTarget);
        }
      },

      "default" : null
    }),


    /**
     * Native event listener for <code>mouseup</code>.
     *
     * @type member
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeMouseUp : qx.core.Variant.select("qx.client",
    {
      "mshtml" : function(e) 
      {
        var target = e.srcElement;
        if (target.unselectable) {
          target.unselectable = "off";
        }
        
        this.setActive(target);
      },

      "gecko|webkit|opera" : function(e) {
        this.setActive(e.target);
      },

      "default" : null
    }),
    
    
    /**
     * Native event listener for <code>selectstart</code>.
     *
     * @type member
     * @param e {Event} Native event
     * @return {void}
     */
    __onNativeSelectStart : qx.core.Variant.select("qx.client",
    {
      "mshtml|webkit" : function(e)
      {
        if (!this.__isSelectable(e.srcElement)) {
          qx.bom.Event.preventDefault(e); 
        }
      },
      
      "default" : null
    }),





    /*
    ---------------------------------------------------------------------------
      HELPER METHODS
    ---------------------------------------------------------------------------
    */
    
    /** 
     * {Map} See: http://msdn.microsoft.com/en-us/library/ms534654(VS.85).aspx 
     */
    __defaultFocusable : qx.core.Variant.select("qx.client",
    {
      "mshtml|gecko" :
      {
        a : 1,
        body : 1,
        button : 1,
        frame : 1,
        iframe : 1,
        img : 1,
        input : 1,
        object : 1,
        select : 1,
        textarea : 1
      },
      
      "opera|webkit" :
      {
        button : 1,
        input : 1,
        select : 1,
        textarea : 1
      }
    }),
    
    
    /**
     * Whether the given element is focusable. This is perfectly modeled to the 
     * browsers behavior and this way may differ in the various clients.
     *
     * @type member
     * @param el {Element} DOM Element to query
     * @return {Boolean} Whether the element is focusable
     */
    __isFocusable : function(el)
    {
      var index = qx.bom.element.Attribute.get(el, "tabIndex");
      return index >= 1 || (index >= 0 && this.__defaultFocusable[el.tagName.toLowerCase()]);
    },   
    

    /**
     * Returns the next focusable parent element of a activated DOM element.
     *
     * @type member
     * @param node {Node} Node to start lookup with
     * @return {void}
     */
    __findFocusElement : function(el)
    {
      var Attribute = qx.bom.element.Attribute;
      
      while (el && el.nodeType === 1)
      {
        if (Attribute.get(el, "qxKeepFocus") == "on") {
          return null;
        }
        
        if (this.__isFocusable(el)) {
          return el; 
        }

        el = el.parentNode;
      }

      // This should be identical to the one which is selected when
      // clicking into an empty page area. In mshtml this must be
      // the body of the document.
      return this._body;
    },


    /**
     * Whether the given el (or its content) should be selectable
     * by the user.
     *
     * @type member
     * @param node {Element} Node to start lookup with
     * @return {Boolean} Whether the content is selectable.
     */
    __isSelectable : function(node)
    {
      var Attribute = qx.bom.element.Attribute;

      while(node && node.nodeType === 1)
      {
        attr = Attribute.get(node, "qxSelectable");
        if (attr != null) {
          return attr === "on";
        }

        node = node.parentNode;
      }

      return true;
    },






    /*
    ---------------------------------------------------------------------------
      PROPERTY APPLY ROUTINES
    ---------------------------------------------------------------------------
    */

    // apply routine
    _applyActive : function(value, old)
    {
      var id = "null";
      if (value) {
        id = (value.tagName||value) + "[" + (value.$$hash || "none") + "]";
      }
      
      this.debug("Property Active: " + id);

      // Fire events
      if (old) {
        this.__fireEvent(old, value, "deactivate", true);
      }

      if (value) {
        this.__fireEvent(value, old, "activate", true);
      }
    },


    // apply routine
    _applyFocus : function(value, old)
    {
      var id = "null";
      if (value) {
        id = (value.tagName||value) + "[" + (value.$$hash || "none") + "]";
      }
      
      this.debug("Property Focus: " + id);

      // Fire bubbling events
      if (old) {
        this.__fireEvent(old, value, "focusout", true);
      }

      if (value) {
        this.__fireEvent(value, old, "focusin", true);
      }

      // Fire after events
      if (old) {
        this.__fireEvent(old, value, "blur", false);
      }

      if (value) {
        this.__fireEvent(value, old, "focus", false);
      }
    }
  },





  /*
  *****************************************************************************
     DESTRUCTOR
  *****************************************************************************
  */

  destruct : function()
  {
    this._stopObserver();
    this._disposeFields("_manager", "_window", "_document", "_root", "_body",
      "__mouseActive");
  },





  /*
  *****************************************************************************
     DEFER
  *****************************************************************************
  */

  defer : function(statics) {
    qx.event.Registration.addHandler(statics);
  }
});
