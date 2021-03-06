(function() {
  var doc = document;
  var disableBuilds = true;

  var ctr = 0;
  var spaces = /\s+/, a1 = [''];

  var toArray = function(list) {
    return Array.prototype.slice.call(list || [], 0);
  };

  var byId = function(id) {
    if (typeof id == 'string') { return doc.getElementById(id); }
    return id;
  };

  var query = function(query, root) {
    if (!query) { return []; }
    if (typeof query != 'string') { return toArray(query); }
    if (typeof root == 'string') {
      root = byId(root);
      if(!root){ return []; }
    }

    root = root || document;
    var rootIsDoc = (root.nodeType == 9);
    var doc = rootIsDoc ? root : (root.ownerDocument || document);

    // rewrite the query to be ID rooted
    if (!rootIsDoc || ('>~+'.indexOf(query.charAt(0)) >= 0)) {
      root.id = root.id || ('qUnique' + (ctr++));
      query = '#' + root.id + ' ' + query;
    }
    // don't choke on something like ".yada.yada >"
    if ('>~+'.indexOf(query.slice(-1)) >= 0) { query += ' *'; }

    return toArray(doc.querySelectorAll(query));
  };

  var strToArray = function(s) {
    if (typeof s == 'string' || s instanceof String) {
      if (s.indexOf(' ') < 0) {
        a1[0] = s;
        return a1;
      } else {
        return s.split(spaces);
      }
    }
    return s;
  };

  var addClass = function(node, classStr) {
    classStr = strToArray(classStr);
    var cls = ' ' + node.className + ' ';
    for (var i = 0, len = classStr.length, c; i < len; ++i) {
      c = classStr[i];
      if (c && cls.indexOf(' ' + c + ' ') < 0) {
        cls += c + ' ';
      }
    }
    node.className = cls.trim();
  };

  var removeClass = function(node, classStr) {
    var cls;
    if (classStr !== undefined) {
      classStr = strToArray(classStr);
      cls = ' ' + node.className + ' ';
      for (var i = 0, len = classStr.length; i < len; ++i) {
        cls = cls.replace(' ' + classStr[i] + ' ', ' ');
      }
      cls = cls.trim();
    } else {
      cls = '';
    }
    if (node.className != cls) {
      node.className = cls;
    }
  };

  var toggleClass = function(node, classStr) {
    var cls = ' ' + node.className + ' ';
    if (cls.indexOf(' ' + classStr.trim() + ' ') >= 0) {
      removeClass(node, classStr);
    } else {
      addClass(node, classStr);
    }
  };

  var ua = navigator.userAgent;
  var isFF = parseFloat(ua.split('Firefox/')[1]) || undefined;
  var isWK = parseFloat(ua.split('WebKit/')[1]) || undefined;
  var isOpera = parseFloat(ua.split('Opera/')[1]) || undefined;

  var canTransition = (function() {
    var ver = parseFloat(ua.split('Version/')[1]) || undefined;
    // test to determine if this browser can handle CSS transitions.
    var cachedCanTransition =
      (isWK || (isFF && isFF > 3.6 ) || (isOpera && ver >= 10.5));
    return function() { return cachedCanTransition; }
  })();

  //
  // Slide class
  //
  var Slide = function(node, idx) {
    this._node = node;
    if (idx >= 0) {
      this._count = idx + 1;
    }
    if (this._node) {
      addClass(this._node, 'slide distant-slide');
    }
    this._makeCounter();
    this._makeBuildList();
  };

  Slide.prototype = {
    _node: null,
    _count: 0,
    _buildList: [],
    _visited: false,
    _currentState: '',
    _states: [ 'distant-slide', 'far-past',
               'past', 'current', 'future',
               'far-future', 'distant-slide' ],
    setState: function(state) {
      if (typeof state != 'string') {
        state = this._states[state];
      }
      if (state == 'current' && !this._visited) {
        this._visited = true;
        this._makeBuildList();
      }
      removeClass(this._node, this._states);
      addClass(this._node, state);
      this._currentState = state;

      // delay first auto run. Really wish this were in CSS.
      /*
      this._runAutos();
      */
      var _t = this;
      setTimeout(function(){ _t._runAutos(); } , 400);
    },
    _makeCounter: function() {
      if(!this._count || !this._node) { return; }
      var c = doc.createElement('span');
      c.innerHTML = this._count;
      c.className = 'counter';
      this._node.appendChild(c);
    },
    _makeBuildList: function() {
      this._buildList = [];
      if (disableBuilds) { return; }
      if (this._node) {
        this._buildList = query('[data-build] > *', this._node);
      }
      this._buildList.forEach(function(el) {
        addClass(el, 'to-build');
      });
    },
    _runAutos: function() {
      if (this._currentState != 'current') {
        return;
      }
      // find the next auto, slice it out of the list, and run it
      var idx = -1;
      this._buildList.some(function(n, i) {
        if (n.hasAttribute('data-auto')) {
          idx = i;
          return true;
        }
        return false;
      });
      if (idx >= 0) {
        var elem = this._buildList.splice(idx, 1)[0];
        var transitionEnd = isWK ? 'webkitTransitionEnd' : (isFF ? 'mozTransitionEnd' : 'oTransitionEnd');
        var _t = this;
        if (canTransition()) {
          var l = function(evt) {
            elem.parentNode.removeEventListener(transitionEnd, l, false);
            _t._runAutos();
          };
          elem.parentNode.addEventListener(transitionEnd, l, false);
          removeClass(elem, 'to-build');
        } else {
          setTimeout(function() {
            removeClass(elem, 'to-build');
            _t._runAutos();
          }, 400);
        }
      }
    },
    buildNext: function() {
      if (!this._buildList.length) {
        return false;
      }
      removeClass(this._buildList.shift(), 'to-build');
      return true;
    },
  };

  //
  // SlideShow class
  //
  var SlideShow = function(slides) {
    this._slides = (slides || []).map(function(el, idx) {
      return new Slide(el, idx);
    });
    var h = window.location.hash;
    try {
      this.current = parseInt(h.split('#slide')[1], 10);
    } catch (e) { /* squeltch */ }
    this.current = isNaN(this.current) ? 1 : this.current;
    var _t = this;
    doc.addEventListener('keydown',
        function(e) { _t.handleKeys(e); }, false);
    doc.addEventListener('mousewheel',
        function(e) { _t.handleWheel(e); }, false);
    doc.addEventListener('DOMMouseScroll',
        function(e) { _t.handleWheel(e); }, false);
    doc.addEventListener('touchstart',
        function(e) { _t.handleTouchStart(e); }, false);
    doc.addEventListener('touchend',
        function(e) { _t.handleTouchEnd(e); }, false);
    window.addEventListener('popstate',
        function(e) { if (e.state) { _t.go(e.state); } }, false);
    this._update();
  };

  SlideShow.prototype = {
    _slides: [],
    _update: function(dontPush) {
      document.querySelector('#presentation-counter').innerText = this.current;
      if (history.pushState) {
        if (!dontPush) {
          history.replaceState(this.current, 'Slide ' + this.current, '#slide' + this.current);
        }
      } else {
        window.location.hash = 'slide' + this.current;
      }
      for (var x = this.current-1; x < this.current + 7; x++) {
        if (this._slides[x-4]) {
          this._slides[x-4].setState(Math.max(0, x-this.current));
        }
      }
    },

    current: 0,
    next: function() {
      if (!this._slides[this.current-1].buildNext()) {
        this.current = Math.min(this.current + 1, this._slides.length);
        this._update();
      }
    },
    prev: function() {
      this.current = Math.max(this.current-1, 1);
      this._update();
    },
    go: function(num) {
      this.current = num;
      this._update(true);
    },

    _notesOn: false,
    showNotes: function() {
      var isOn = this._notesOn = !this._notesOn;
      query('.notes').forEach(function(el) {
        el.style.display = (notesOn) ? 'block' : 'none';
      });
    },
    switch3D: function() {
      toggleClass(document.body, 'three-d');
    },
    handleWheel: function(e) {
      var delta = 0;
      if (e.wheelDelta) {
        delta = e.wheelDelta/120;
        if (isOpera) {
          delta = -delta;
        }
      } else if (e.detail) {
        delta = -e.detail/3;
      }

      if (delta > 0 ) {
        this.prev();
        return;
      }
      if (delta < 0 ) {
        this.next();
        return;
      }
    },
    handleKeys: function(e) {

      if (/^(input|textarea)$/i.test(e.target.nodeName)) return;

      switch (e.keyCode) {
        case 37: // left arrow
          this.prev(); break;
        case 39: // right arrow
        case 32: // space
          this.next(); break;
        case 50: // 2
          this.showNotes(); break;
        case 51: // 3
          this.switch3D(); break;
      }
    },
    _touchStartX: 0,
    handleTouchStart: function(e) {
      this._touchStartX = e.touches[0].pageX;
    },
    handleTouchEnd: function(e) {
      var delta = this._touchStartX - e.changedTouches[0].pageX;
      var SWIPE_SIZE = 150;
      if (delta > SWIPE_SIZE) {
        this.next();
      } else if (delta< -SWIPE_SIZE) {
        this.prev();
      }
    },
  };

  // Initialize
  var slideshow = new SlideShow(query('.slide'));
})();


/*

Syntax Highlighter: Dual licensed under the MIT and GPL licenses.

Syntax Highlighter shBrushJScript: Dual licensed under the MIT and GPL licenses.

Dual licensed under the MIT and GPL licenses.
*/
(function(){function j(f,e){if(!XRegExp.isRegExp(f))throw TypeError("type RegExp expected");var a=f._xregexp;f=XRegExp(f.source,m(f)+(e||""));if(a)f._xregexp={source:a.source,captureNames:a.captureNames?a.captureNames.slice(0):null};return f}function m(f){return(f.global?"g":"")+(f.ignoreCase?"i":"")+(f.multiline?"m":"")+(f.extended?"x":"")+(f.sticky?"y":"")}function p(f,e,a,b){var c=y.length,d,h,g;w=true;try{for(;c--;){g=y[c];if(a&g.scope&&(!g.trigger||g.trigger.call(b))){g.pattern.lastIndex=e;if((h=
g.pattern.exec(f))&&h.index===e){d={output:g.handler.call(b,h,a),match:h};break}}}}catch(i){throw i;}finally{w=false}return d}function n(f,e,a){if(Array.prototype.indexOf)return f.indexOf(e,a);for(a=a||0;a<f.length;a++)if(f[a]===e)return a;return-1}XRegExp=function(f,e){var a=[],b=XRegExp.OUTSIDE_CLASS,c=0,d,h;if(XRegExp.isRegExp(f)){if(e!==undefined)throw TypeError("can't supply flags when constructing one RegExp from another");return j(f)}if(w)throw Error("can't call the XRegExp constructor within token definition functions");
e=e||"";for(d={hasNamedCapture:false,captureNames:[],hasFlag:function(g){return e.indexOf(g)>-1},setFlag:function(g){e+=g}};c<f.length;)if(h=p(f,c,b,d)){a.push(h.output);c+=h.match[0].length||1}else if(h=s.exec.call(B[b],f.slice(c))){a.push(h[0]);c+=h[0].length}else{h=f.charAt(c);if(h==="[")b=XRegExp.INSIDE_CLASS;else if(h==="]")b=XRegExp.OUTSIDE_CLASS;a.push(h);c++}a=RegExp(a.join(""),s.replace.call(e,t,""));a._xregexp={source:f,captureNames:d.hasNamedCapture?d.captureNames:null};return a};XRegExp.version=
"1.5.0";XRegExp.INSIDE_CLASS=1;XRegExp.OUTSIDE_CLASS=2;var r=/\$(?:(\d\d?|[$&`'])|{([$\w]+)})/g,t=/[^gimy]+|([\s\S])(?=[\s\S]*\1)/g,u=/^(?:[?*+]|{\d+(?:,\d*)?})\??/,w=false,y=[],s={exec:RegExp.prototype.exec,test:RegExp.prototype.test,match:String.prototype.match,replace:String.prototype.replace,split:String.prototype.split},z=s.exec.call(/()??/,"")[1]===undefined,C=function(){var f=/^/g;s.test.call(f,"");return!f.lastIndex}(),A=function(){var f=/x/g;s.replace.call("x",f,"");return!f.lastIndex}(),
D=RegExp.prototype.sticky!==undefined,B={};B[XRegExp.INSIDE_CLASS]=/^(?:\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S]))/;B[XRegExp.OUTSIDE_CLASS]=/^(?:\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S])|\(\?[:=!]|[?*+]\?|{\d+(?:,\d*)?}\??)/;XRegExp.addToken=function(f,e,a,b){y.push({pattern:j(f,"g"+(D?"y":"")),handler:e,scope:a||XRegExp.OUTSIDE_CLASS,trigger:b||null})};XRegExp.cache=function(f,e){var a=f+"/"+(e||"");return XRegExp.cache[a]||
(XRegExp.cache[a]=XRegExp(f,e))};XRegExp.copyAsGlobal=function(f){return j(f,"g")};XRegExp.escape=function(f){return f.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&")};XRegExp.execAt=function(f,e,a,b){e=j(e,"g"+(b&&D?"y":""));e.lastIndex=a=a||0;f=e.exec(f);return b?f&&f.index===a?f:null:f};XRegExp.freezeTokens=function(){XRegExp.addToken=function(){throw Error("can't run addToken after freezeTokens");}};XRegExp.isRegExp=function(f){return Object.prototype.toString.call(f)==="[object RegExp]"};XRegExp.iterate=
function(f,e,a,b){for(var c=j(e,"g"),d=-1,h;h=c.exec(f);){a.call(b,h,++d,f,c);c.lastIndex===h.index&&c.lastIndex++}if(e.global)e.lastIndex=0};XRegExp.matchChain=function(f,e){return function a(b,c){var d=e[c].regex?e[c]:{regex:e[c]},h=j(d.regex,"g"),g=[],i;for(i=0;i<b.length;i++)XRegExp.iterate(b[i],h,function(l){g.push(d.backref?l[d.backref]||"":l[0])});return c===e.length-1||!g.length?g:a(g,c+1)}([f],0)};RegExp.prototype.apply=function(f,e){return this.exec(e[0])};RegExp.prototype.call=function(f,
e){return this.exec(e)};RegExp.prototype.exec=function(f){var e=s.exec.apply(this,arguments),a;if(e){if(!z&&e.length>1&&n(e,"")>-1){a=RegExp(this.source,s.replace.call(m(this),"g",""));s.replace.call(f.slice(e.index),a,function(){for(var c=1;c<arguments.length-2;c++)if(arguments[c]===undefined)e[c]=undefined})}if(this._xregexp&&this._xregexp.captureNames)for(var b=1;b<e.length;b++)if(a=this._xregexp.captureNames[b-1])e[a]=e[b];!C&&this.global&&!e[0].length&&this.lastIndex>e.index&&this.lastIndex--}return e};
if(!C)RegExp.prototype.test=function(f){(f=s.exec.call(this,f))&&this.global&&!f[0].length&&this.lastIndex>f.index&&this.lastIndex--;return!!f};String.prototype.match=function(f){XRegExp.isRegExp(f)||(f=RegExp(f));if(f.global){var e=s.match.apply(this,arguments);f.lastIndex=0;return e}return f.exec(this)};String.prototype.replace=function(f,e){var a=XRegExp.isRegExp(f),b,c;if(a&&typeof e.valueOf()==="string"&&e.indexOf("${")===-1&&A)return s.replace.apply(this,arguments);if(a){if(f._xregexp)b=f._xregexp.captureNames}else f+=
"";if(typeof e==="function")c=s.replace.call(this,f,function(){if(b){arguments[0]=new String(arguments[0]);for(var d=0;d<b.length;d++)if(b[d])arguments[0][b[d]]=arguments[d+1]}if(a&&f.global)f.lastIndex=arguments[arguments.length-2]+arguments[0].length;return e.apply(null,arguments)});else c=s.replace.call(this+"",f,function(){var d=arguments;return s.replace.call(e,r,function(h,g,i){if(g)switch(g){case "$":return"$";case "&":return d[0];case "`":return d[d.length-1].slice(0,d[d.length-2]);case "'":return d[d.length-
1].slice(d[d.length-2]+d[0].length);default:i="";g=+g;if(!g)return h;for(;g>d.length-3;){i=String.prototype.slice.call(g,-1)+i;g=Math.floor(g/10)}return(g?d[g]||"":"$")+i}else{g=+i;if(g<=d.length-3)return d[g];g=b?n(b,i):-1;return g>-1?d[g+1]:h}})});if(a&&f.global)f.lastIndex=0;return c};String.prototype.split=function(f,e){if(!XRegExp.isRegExp(f))return s.split.apply(this,arguments);var a=this+"",b=[],c=0,d,h;if(e===undefined||+e<0)e=Infinity;else{e=Math.floor(+e);if(!e)return[]}for(f=XRegExp.copyAsGlobal(f);d=
f.exec(a);){if(f.lastIndex>c){b.push(a.slice(c,d.index));d.length>1&&d.index<a.length&&Array.prototype.push.apply(b,d.slice(1));h=d[0].length;c=f.lastIndex;if(b.length>=e)break}f.lastIndex===d.index&&f.lastIndex++}if(c===a.length){if(!s.test.call(f,"")||h)b.push("")}else b.push(a.slice(c));return b.length>e?b.slice(0,e):b};XRegExp.addToken(/\(\?#[^)]*\)/,function(f){return s.test.call(u,f.input.slice(f.index+f[0].length))?"":"(?:)"});XRegExp.addToken(/\((?!\?)/,function(){this.captureNames.push(null);
return"("});XRegExp.addToken(/\(\?<([$\w]+)>/,function(f){this.captureNames.push(f[1]);this.hasNamedCapture=true;return"("});XRegExp.addToken(/\\k<([\w$]+)>/,function(f){var e=n(this.captureNames,f[1]);return e>-1?"\\"+(e+1)+(isNaN(f.input.charAt(f.index+f[0].length))?"":"(?:)"):f[0]});XRegExp.addToken(/\[\^?]/,function(f){return f[0]==="[]"?"\\b\\B":"[\\s\\S]"});XRegExp.addToken(/^\(\?([imsx]+)\)/,function(f){this.setFlag(f[1]);return""});XRegExp.addToken(/(?:\s+|#.*)+/,function(f){return s.test.call(u,
f.input.slice(f.index+f[0].length))?"":"(?:)"},XRegExp.OUTSIDE_CLASS,function(){return this.hasFlag("x")});XRegExp.addToken(/\./,function(){return"[\\s\\S]"},XRegExp.OUTSIDE_CLASS,function(){return this.hasFlag("s")})})();
var SyntaxHighlighter=function(){function j(a,b){a.className.indexOf(b)!=-1||(a.className+=" "+b)}function m(a){return a.indexOf("highlighter_")==0?a:"highlighter_"+a}function p(a){return e.vars.highlighters[m(a)]}function n(a,b,c){if(a==null)return null;var d=c!=true?a.childNodes:[a.parentNode],h={"#":"id",".":"className"}[b.substr(0,1)]||"nodeName",g,i;g=h!="nodeName"?b.substr(1):b.toUpperCase();if((a[h]||"").indexOf(g)!=-1)return a;for(a=0;d&&a<d.length&&i==null;a++)i=n(d[a],b,c);return i}function r(a,
b){var c={},d;for(d in a)c[d]=a[d];for(d in b)c[d]=b[d];return c}function t(a,b,c,d){function h(g){g=g||window.event;if(!g.target){g.target=g.srcElement;g.preventDefault=function(){this.returnValue=false}}c.call(d||window,g)}a.attachEvent?a.attachEvent("on"+b,h):a.addEventListener(b,h,false)}function u(a,b){var c=e.vars.discoveredBrushes,d=null;if(c==null){c={};for(var h in e.brushes){var g=e.brushes[h];d=g.aliases;if(d!=null){g.brushName=h.toLowerCase();for(g=0;g<d.length;g++)c[d[g]]=h}}e.vars.discoveredBrushes=
c}d=e.brushes[c[a]];d==null&&b!=false&&window.alert(e.config.strings.alert+(e.config.strings.noBrush+a));return d}function w(a,b){for(var c=a.split("\n"),d=0;d<c.length;d++)c[d]=b(c[d],d);return c.join("\n")}function y(a,b){if(a==null||a.length==0||a=="\n")return a;a=a.replace(/</g,"&lt;");a=a.replace(/ {2,}/g,function(c){for(var d="",h=0;h<c.length-1;h++)d+=e.config.space;return d+" "});if(b!=null)a=w(a,function(c){if(c.length==0)return"";var d="";c=c.replace(/^(&nbsp;| )+/,function(h){d=h;return""});
if(c.length==0)return d;return d+'<code class="'+b+'">'+c+"</code>"});return a}function s(a,b){a.split("\n");for(var c="",d=0;d<50;d++)c+="                    ";return a=w(a,function(h){if(h.indexOf("\t")==-1)return h;for(var g=0;(g=h.indexOf("\t"))!=-1;)h=h.substr(0,g)+c.substr(0,b-g%b)+h.substr(g+1,h.length);return h})}function z(a){return a.replace(/^\s+|\s+$/g,"")}function C(a,b){if(a.index<b.index)return-1;else if(a.index>b.index)return 1;else if(a.length<b.length)return-1;else if(a.length>b.length)return 1;
return 0}function A(a,b){function c(l){return l[0]}for(var d=null,h=[],g=b.func?b.func:c;(d=b.regex.exec(a))!=null;){var i=g(d,b);if(typeof i=="string")i=[new e.Match(i,d.index,b.css)];h=h.concat(i)}return h}function D(a){var b=/(.*)((&gt;|&lt;).*)/;return a.replace(e.regexLib.url,function(c){var d="",h=null;if(h=b.exec(c)){c=h[1];d=h[2]}return'<a href="'+c+'">'+c+"</a>"+d})}function B(){for(var a=document.getElementsByTagName("script"),b=[],c=0;c<a.length;c++)a[c].type=="syntaxhighlighter"&&b.push(a[c]);
return b}function f(a){a=a.target;var b=n(a,".syntaxhighlighter",true);a=n(a,".container",true);var c=document.createElement("textarea");if(!(!a||!b||n(a,"textarea"))){p(b.id);j(b,"source");for(var d=a.childNodes,h=[],g=0;g<d.length;g++)h.push(d[g].innerText||d[g].textContent);h=h.join("\r");c.appendChild(document.createTextNode(h));a.appendChild(c);c.focus();c.select();t(c,"blur",function(){c.parentNode.removeChild(c);b.className=b.className.replace("source","")})}}if(typeof require!="undefined"&&
typeof XRegExp=="undefined")XRegExp=require("XRegExp").XRegExp;var e={defaults:{"class-name":"","first-line":1,"pad-line-numbers":false,highlight:null,title:null,"smart-tabs":true,"tab-size":4,gutter:true,toolbar:true,"quick-code":true,collapse:false,"auto-links":true,light:false,"html-script":false},config:{space:"&nbsp;",useScriptTags:true,bloggerMode:false,stripBrs:false,tagName:"pre",strings:{expandSource:"expand source",help:"?",alert:"SyntaxHighlighter\n\n",noBrush:"Can't find brush for: ",
brushNotHtmlScript:"Brush wasn't configured for html-script option: ",aboutDialog:'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" /><title>About SyntaxHighlighter</title></head><body style="font-family:Geneva,Arial,Helvetica,sans-serif;background-color:#fff;color:#000;font-size:1em;text-align:center;"><div style="text-align:center;margin-top:1.5em;"><div style="font-size:xx-large;">SyntaxHighlighter</div><div style="font-size:.75em;margin-bottom:3em;"><div>version 3.0.83 (July 02 2010)</div><div><a href="http://alexgorbatchev.com/SyntaxHighlighter" target="_blank" style="color:#005896">http://alexgorbatchev.com/SyntaxHighlighter</a></div><div>JavaScript code syntax highlighter.</div><div>Copyright 2004-2010 Alex Gorbatchev.</div></div><div>If you like this script, please <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=2930402" style="color:#005896">donate</a> to <br/>keep development active!</div></div></body></html>'}},
vars:{discoveredBrushes:null,highlighters:{}},brushes:{},regexLib:{multiLineCComments:/\/\*[\s\S]*?\*\//gm,singleLineCComments:/\/\/.*$/gm,singleLinePerlComments:/#.*$/gm,doubleQuotedString:/"([^\\"\n]|\\.)*"/g,singleQuotedString:/'([^\\'\n]|\\.)*'/g,multiLineDoubleQuotedString:new XRegExp('"([^\\\\"]|\\\\.)*"',"gs"),multiLineSingleQuotedString:new XRegExp("'([^\\\\']|\\\\.)*'","gs"),xmlComments:/(&lt;|<)!--[\s\S]*?--(&gt;|>)/gm,url:/\w+:\/\/[\w-.\/?%&=:@;]*/g,phpScriptTags:{left:/(&lt;|<)\?=?/g,
right:/\?(&gt;|>)/g},aspScriptTags:{left:/(&lt;|<)%=?/g,right:/%(&gt;|>)/g},scriptScriptTags:{left:/(&lt;|<)\s*script.*?(&gt;|>)/gi,right:/(&lt;|<)\/\s*script\s*(&gt;|>)/gi}},toolbar:{getHtml:function(a){function b(i,l){return e.toolbar.getButtonHtml(i,l,e.config.strings[l])}for(var c='<div class="toolbar">',d=e.toolbar.items,h=d.list,g=0;g<h.length;g++)c+=(d[h[g]].getHtml||b)(a,h[g]);c+="</div>";return c},getButtonHtml:function(a,b,c){return'<span><a href="#" class="toolbar_item command_'+b+" "+
b+'">'+c+"</a></span>"},handler:function(a){var b=a.target,c=b.className||"";b=p(n(b,".syntaxhighlighter",true).id);var d=function(h){return(h=(new RegExp(h+"_(\\w+)")).exec(c))?h[1]:null}("command");b&&d&&e.toolbar.items[d].execute(b);a.preventDefault()},items:{list:["expandSource","help"],expandSource:{getHtml:function(a){if(a.getParam("collapse")!=true)return"";var b=a.getParam("title");return e.toolbar.getButtonHtml(a,"expandSource",b?b:e.config.strings.expandSource)},execute:function(a){a=document.getElementById(m(a.id));
a.className=a.className.replace("collapsed","")}},help:{execute:function(){var a="scrollbars=0";a+=", left="+(screen.width-500)/2+", top="+(screen.height-250)/2+", width=500, height=250";a=a.replace(/^,/,"");a=window.open("","_blank",a);a.focus();var b=a.document;b.write(e.config.strings.aboutDialog);b.close();a.focus()}}}},findElements:function(a,b){var c;if(b)c=[b];else{c=document.getElementsByTagName(e.config.tagName);for(var d=[],h=0;h<c.length;h++)d.push(c[h]);c=d}c=c;d=[];if(e.config.useScriptTags)c=
c.concat(B());if(c.length===0)return d;for(h=0;h<c.length;h++){for(var g=c[h],i=c[h].className,l=void 0,k={},o=new XRegExp("^\\[(?<values>(.*?))\\]$"),q=new XRegExp("(?<name>[\\w-]+)\\s*:\\s*(?<value>[\\w-%#]+|\\[.*?\\]|\".*?\"|'.*?')\\s*;?","g");(l=q.exec(i))!=null;){var v=l.value.replace(/^['"]|['"]$/g,"");if(v!=null&&o.test(v)){v=o.exec(v);v=v.values.length>0?v.values.split(/\s*,\s*/):[]}k[l.name]=v}g={target:g,params:r(a,k)};g.params.brush!=null&&d.push(g)}return d},highlight:function(a,b){var c=
this.findElements(a,b),d=null,h=e.config;if(c.length!==0)for(var g=0;g<c.length;g++){b=c[g];var i=b.target,l=b.params,k=l.brush,o;if(k!=null){if(l["html-script"]=="true"||e.defaults["html-script"]==true){d=new e.HtmlScript(k);k="htmlscript"}else if(d=u(k))d=new d;else continue;o=i.innerHTML;if(h.useScriptTags){o=o;var q=z(o),v=false;if(q.indexOf("<![CDATA[")==0){q=q.substring(9);v=true}var E=q.length;if(q.indexOf("]]\>")==E-3){q=q.substring(0,E-3);v=true}o=v?q:o}if((i.title||"")!="")l.title=i.title;
l.brush=k;d.init(l);b=d.getDiv(o);if((i.id||"")!="")b.id=i.id;i.parentNode.replaceChild(b,i)}}},all:function(a){t(window,"load",function(){e.highlight(a)})}};e.all=e.all;e.highlight=e.highlight;e.Match=function(a,b,c){this.value=a;this.index=b;this.length=a.length;this.css=c;this.brushName=null};e.Match.prototype.toString=function(){return this.value};e.HtmlScript=function(a){function b(k,o){for(var q=0;q<k.length;q++)k[q].index+=o}var c=u(a),d,h=new e.brushes.Xml,g=this,i="getDiv getHtml init".split(" ");
if(c!=null){d=new c;for(var l=0;l<i.length;l++)(function(){var k=i[l];g[k]=function(){return h[k].apply(h,arguments)}})();d.htmlScript==null?window.alert(e.config.strings.alert+(e.config.strings.brushNotHtmlScript+a)):h.regexList.push({regex:d.htmlScript.code,func:function(k){for(var o=k.code,q=[],v=d.regexList,E=k.index+k.left.length,F=d.htmlScript,x,G=0;G<v.length;G++){x=A(o,v[G]);b(x,E);q=q.concat(x)}if(F.left!=null&&k.left!=null){x=A(k.left,F.left);b(x,k.index);q=q.concat(x)}if(F.right!=null&&
k.right!=null){x=A(k.right,F.right);b(x,k.index+k[0].lastIndexOf(k.right));q=q.concat(x)}for(k=0;k<q.length;k++)q[k].brushName=c.brushName;return q}})}};e.Highlighter=function(){};e.Highlighter.prototype={getParam:function(a,b){var c=this.params[a];c=c==null?b:c;var d={"true":true,"false":false}[c];return d==null?c:d},create:function(a){return document.createElement(a)},findMatches:function(a,b){var c=[];if(a!=null)for(var d=0;d<a.length;d++)if(typeof a[d]=="object")c=c.concat(A(b,a[d]));return this.removeNestedMatches(c.sort(C))},
removeNestedMatches:function(a){for(var b=0;b<a.length;b++)if(a[b]!==null)for(var c=a[b],d=c.index+c.length,h=b+1;h<a.length&&a[b]!==null;h++){var g=a[h];if(g!==null)if(g.index>d)break;else if(g.index==c.index&&g.length>c.length)a[b]=null;else if(g.index>=c.index&&g.index<d)a[h]=null}return a},figureOutLineNumbers:function(a){var b=[],c=parseInt(this.getParam("first-line"));w(a,function(d,h){b.push(h+c)});return b},isLineHighlighted:function(a){var b=this.getParam("highlight",[]);if(typeof b!="object"&&
b.push==null)b=[b];a:{a=a.toString();var c=void 0;for(c=c=Math.max(c||0,0);c<b.length;c++)if(b[c]==a){b=c;break a}b=-1}return b!=-1},getLineHtml:function(a,b,c){a=["line","number"+b,"index"+a,"alt"+(b%2==0?1:2).toString()];this.isLineHighlighted(b)&&a.push("highlighted");b==0&&a.push("break");return'<div class="'+a.join(" ")+'">'+c+"</div>"},getLineNumbersHtml:function(a,b){var c="",d=a.split("\n").length,h=parseInt(this.getParam("first-line")),g=this.getParam("pad-line-numbers");if(g==true)g=(h+
d-1).toString().length;else if(isNaN(g)==true)g=0;for(var i=0;i<d;i++){var l=b?b[i]:h+i,k;if(l==0)k=e.config.space;else{k=g;for(var o=l.toString();o.length<k;)o="0"+o;k=o}c+=this.getLineHtml(i,l,k)}return c},getCodeLinesHtml:function(a,b){a=z(a);var c=a.split("\n");this.getParam("pad-line-numbers");var d=parseInt(this.getParam("first-line"));a="";for(var h=this.getParam("brush"),g=0;g<c.length;g++){var i=c[g],l=/^(&nbsp;|\s)+/.exec(i),k=null,o=b?b[g]:d+g;if(l!=null){k=l[0].toString();i=i.substr(k.length);
k=k.replace(" ",e.config.space)}i=z(i);if(i.length==0)i=e.config.space;a+=this.getLineHtml(g,o,(k!=null?'<code class="'+h+' spaces">'+k+"</code>":"")+i)}return a},getTitleHtml:function(a){return a?"<caption>"+a+"</caption>":""},getMatchesHtml:function(a,b){function c(o){return(o=o?o.brushName||g:g)?o+" ":""}for(var d=0,h="",g=this.getParam("brush",""),i=0;i<b.length;i++){var l=b[i],k;if(!(l===null||l.length===0)){k=c(l);h+=y(a.substr(d,l.index-d),k+"plain")+y(l.value,k+l.css);d=l.index+l.length+(l.offset||
0)}}h+=y(a.substr(d),c()+"plain");return h},getHtml:function(a){var b="",c=["syntaxhighlighter"],d;if(this.getParam("light")==true)this.params.toolbar=this.params.gutter=false;className="syntaxhighlighter";this.getParam("collapse")==true&&c.push("collapsed");if((gutter=this.getParam("gutter"))==false)c.push("nogutter");c.push(this.getParam("class-name"));c.push(this.getParam("brush"));a=a.replace(/^[ ]*[\n]+|[\n]*[ ]*$/g,"").replace(/\r/g," ");b=this.getParam("tab-size");if(this.getParam("smart-tabs")==
true)a=s(a,b);else{for(var h="",g=0;g<b;g++)h+=" ";a=a.replace(/\t/g,h)}a:{b=a=a;h=/<br\s*\/?>|&lt;br\s*\/?&gt;/gi;if(e.config.bloggerMode==true)b=b.replace(h,"\n");if(e.config.stripBrs==true)b=b.replace(h,"");b=b.split("\n");h=/^\s*/;g=1E3;for(var i=0;i<b.length&&g>0;i++){var l=b[i];if(z(l).length!=0){l=h.exec(l);if(l==null){a=a;break a}g=Math.min(l[0].length,g)}}if(g>0)for(i=0;i<b.length;i++)b[i]=b[i].substr(g);a=b.join("\n")}if(gutter)d=this.figureOutLineNumbers(a);b=this.findMatches(this.regexList,
a);b=this.getMatchesHtml(a,b);b=this.getCodeLinesHtml(b,d);if(this.getParam("auto-links"))b=D(b);typeof navigator!="undefined"&&navigator.userAgent&&navigator.userAgent.match(/MSIE/)&&c.push("ie");return b='<div id="'+m(this.id)+'" class="'+c.join(" ")+'">'+(this.getParam("toolbar")?e.toolbar.getHtml(this):"")+'<table border="0" cellpadding="0" cellspacing="0">'+this.getTitleHtml(this.getParam("title"))+"<tbody><tr>"+(gutter?'<td class="gutter">'+this.getLineNumbersHtml(a)+"</td>":"")+'<td class="code"><div class="container">'+
b+"</div></td></tr></tbody></table></div>"},getDiv:function(a){if(a===null)a="";this.code=a;var b=this.create("div");b.innerHTML=this.getHtml(a);this.getParam("toolbar")&&t(n(b,".toolbar"),"click",e.toolbar.handler);this.getParam("quick-code")&&t(n(b,".code"),"dblclick",f);return b},init:function(a){this.id=""+Math.round(Math.random()*1E6).toString();e.vars.highlighters[m(this.id)]=this;this.params=r(e.defaults,a||{});if(this.getParam("light")==true)this.params.toolbar=this.params.gutter=false},getKeywords:function(a){a=
a.replace(/^\s+|\s+$/g,"").replace(/\s+/g,"|");return"\\b(?:"+a+")\\b"},forHtmlScript:function(a){this.htmlScript={left:{regex:a.left,css:"script"},right:{regex:a.right,css:"script"},code:new XRegExp("(?<left>"+a.left.source+")(?<code>.*?)(?<right>"+a.right.source+")","sgi")}}};return e}();typeof exports!="undefined"&&(exports.SyntaxHighlighter=SyntaxHighlighter);
(function(){function j(){var m=SyntaxHighlighter.regexLib;this.regexList=[{regex:m.multiLineDoubleQuotedString,css:"string"},{regex:m.multiLineSingleQuotedString,css:"string"},{regex:m.singleLineCComments,css:"comments"},{regex:m.multiLineCComments,css:"comments"},{regex:/\s*#.*/gm,css:"preprocessor"},{regex:new RegExp(this.getKeywords("break case catch continue default delete do else false  for function if in instanceof new null return super switch this throw true try typeof var while with"),"gm"),
css:"keyword"}];this.forHtmlScript(m.scriptScriptTags)}typeof require!="undefined"&&(SyntaxHighlighter=require("shCore").SyntaxHighlighter);j.prototype=new SyntaxHighlighter.Highlighter;j.aliases=["js","jscript","javascript"];SyntaxHighlighter.brushes.JScript=j;typeof exports!="undefined"&&(exports.Brush=j)})();
(function(){function j(){this.regexList=[{regex:new XRegExp("(\\&lt;|<)\\!\\[[\\w\\s]*?\\[(.|\\s)*?\\]\\](\\&gt;|>)","gm"),css:"color2"},{regex:SyntaxHighlighter.regexLib.xmlComments,css:"comments"},{regex:new XRegExp("(&lt;|<)[\\s\\/\\?]*(\\w+)(?<attributes>.*?)[\\s\\/\\?]*(&gt;|>)","sg"),func:function(m){var p=SyntaxHighlighter.Match,n=m[0],r=(new XRegExp("(&lt;|<)[\\s\\/\\?]*(?<name>[:\\w-\\.]+)","xg")).exec(n),t=[];if(m.attributes!=null)for(var u,w=new XRegExp("(?<name> [\\w:\\-\\.]+)\\s*=\\s*(?<value> \".*?\"|'.*?'|\\w+)",
"xg");(u=w.exec(n))!=null;){t.push(new p(u.name,m.index+u.index,"color1"));t.push(new p(u.value,m.index+u.index+u[0].indexOf(u.value),"string"))}r!=null&&t.push(new p(r.name,m.index+r[0].indexOf(r.name),"keyword"));return t}}]}typeof require!="undefined"&&(SyntaxHighlighter=require("shCore").SyntaxHighlighter);j.prototype=new SyntaxHighlighter.Highlighter;j.aliases=["xml","xhtml","xslt","html"];SyntaxHighlighter.brushes.Xml=j;typeof exports!="undefined"&&(exports.Brush=j)})();
(function(){
var corecss = document.createElement('link');
var themecss = document.createElement('link');
})();
SyntaxHighlighter.config.clipboardSwf = 'img/clipboard.swf';
SyntaxHighlighter.config.strings.expandSource = 'show source';
SyntaxHighlighter.config.strings.viewSource = 'view source';
SyntaxHighlighter.config.strings.copyToClipboard = 'copy to clipboard';
SyntaxHighlighter.config.strings.copyToClipboardConfirmation = 'The code is in your clipboard now';
SyntaxHighlighter.config.strings.print = 'print';
SyntaxHighlighter.config.strings.help = '?';
SyntaxHighlighter.config.strings.alert = 'SyntaxHighlighter\n\n';
SyntaxHighlighter.config.strings.noBrush = 'Can\'t find brush for: ';
SyntaxHighlighter.config.strings.brushNotHtmlScript = 'Brush wasn\'t configured for html-script option: ';
SyntaxHighlighter.defaults['tab-size'] = 2;
SyntaxHighlighter.all();


  /**
  * hoverIntent r5 // 2007.03.27 // jQuery 1.1.2+
  * <http://cherne.net/brian/resources/jquery.hoverIntent.html>
  *
  * @param  f  onMouseOver function || An object with configuration options
  * @param  g  onMouseOut function  || Nothing (use configuration options object)
  * @author    Brian Cherne <brian@cherne.net>
  */
  (function($){$.fn.hoverIntent=function(f,g){var cfg={sensitivity:7,interval:100,timeout:0};cfg=$.extend(cfg,g?{over:f,out:g}:f);var cX,cY,pX,pY;var track=function(ev){cX=ev.pageX;cY=ev.pageY;};var compare=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);if((Math.abs(pX-cX)+Math.abs(pY-cY))<cfg.sensitivity){$(ob).unbind("mousemove",track);ob.hoverIntent_s=1;return cfg.over.apply(ob,[ev]);}else{pX=cX;pY=cY;ob.hoverIntent_t=setTimeout(function(){compare(ev,ob);},cfg.interval);}};var delay=function(ev,ob){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);ob.hoverIntent_s=0;return cfg.out.apply(ob,[ev]);};var handleHover=function(e){var p=(e.type=="mouseover"?e.fromElement:e.toElement)||e.relatedTarget;while(p&&p!=this){try{p=p.parentNode;}catch(e){p=this;}}if(p==this){return false;}var ev=jQuery.extend({},e);var ob=this;if(ob.hoverIntent_t){ob.hoverIntent_t=clearTimeout(ob.hoverIntent_t);}if(e.type=="mouseover"){pX=ev.pageX;pY=ev.pageY;$(ob).bind("mousemove",track);if(ob.hoverIntent_s!=1){ob.hoverIntent_t=setTimeout(function(){compare(ev,ob);},cfg.interval);}}else{$(ob).unbind("mousemove",track);if(ob.hoverIntent_s==1){ob.hoverIntent_t=setTimeout(function(){delay(ev,ob);},cfg.timeout);}}};return this.mouseover(handleHover).mouseout(handleHover);};})(jQuery);

  jQuery.cookie=function(b,j,m){if(typeof j!="undefined"){m=m||{};if(j===null){j="";m.expires=-1}var e="";if(m.expires&&(typeof m.expires=="number"||m.expires.toUTCString)){var f;if(typeof m.expires=="number"){f=new Date();f.setTime(f.getTime()+(m.expires*24*60*60*1000))}else{f=m.expires}e="; expires="+f.toUTCString()}var l=m.path?"; path="+(m.path):"";var g=m.domain?"; domain="+(m.domain):"";var a=m.secure?"; secure":"";document.cookie=[b,"=",encodeURIComponent(j),e,l,g,a].join("")}else{var d=null;if(document.cookie&&document.cookie!=""){var k=document.cookie.split(";");for(var h=0;h<k.length;h++){var c=jQuery.trim(k[h]);if(c.substring(0,b.length+1)==(b+"=")){d=decodeURIComponent(c.substring(b.length+1));break}}}return d}};

/*!
 * jQuery UI 1.8.6
 *
 * Copyright 2010, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI
 */
(function(a,c){a.ui=a.ui||{};if(a.ui.version){return}a.extend(a.ui,{version:"1.8.6",keyCode:{ALT:18,BACKSPACE:8,CAPS_LOCK:20,COMMA:188,COMMAND:91,COMMAND_LEFT:91,COMMAND_RIGHT:93,CONTROL:17,DELETE:46,DOWN:40,END:35,ENTER:13,ESCAPE:27,HOME:36,INSERT:45,LEFT:37,MENU:93,NUMPAD_ADD:107,NUMPAD_DECIMAL:110,NUMPAD_DIVIDE:111,NUMPAD_ENTER:108,NUMPAD_MULTIPLY:106,NUMPAD_SUBTRACT:109,PAGE_DOWN:34,PAGE_UP:33,PERIOD:190,RIGHT:39,SHIFT:16,SPACE:32,TAB:9,UP:38,WINDOWS:91}});a.fn.extend({_focus:a.fn.focus,focus:function(d,e){return typeof d==="number"?this.each(function(){var f=this;setTimeout(function(){a(f).focus();if(e){e.call(f)}},d)}):this._focus.apply(this,arguments)},scrollParent:function(){var d;if((a.browser.msie&&(/(static|relative)/).test(this.css("position")))||(/absolute/).test(this.css("position"))){d=this.parents().filter(function(){return(/(relative|absolute|fixed)/).test(a.curCSS(this,"position",1))&&(/(auto|scroll)/).test(a.curCSS(this,"overflow",1)+a.curCSS(this,"overflow-y",1)+a.curCSS(this,"overflow-x",1))}).eq(0)}else{d=this.parents().filter(function(){return(/(auto|scroll)/).test(a.curCSS(this,"overflow",1)+a.curCSS(this,"overflow-y",1)+a.curCSS(this,"overflow-x",1))}).eq(0)}return(/fixed/).test(this.css("position"))||!d.length?a(document):d},zIndex:function(g){if(g!==c){return this.css("zIndex",g)}if(this.length){var e=a(this[0]),d,f;while(e.length&&e[0]!==document){d=e.css("position");if(d==="absolute"||d==="relative"||d==="fixed"){f=parseInt(e.css("zIndex"),10);if(!isNaN(f)&&f!==0){return f}}e=e.parent()}}return 0},disableSelection:function(){return this.bind((a.support.selectstart?"selectstart":"mousedown")+".ui-disableSelection",function(d){d.preventDefault()})},enableSelection:function(){return this.unbind(".ui-disableSelection")}});a.each(["Width","Height"],function(f,d){var e=d==="Width"?["Left","Right"]:["Top","Bottom"],g=d.toLowerCase(),j={innerWidth:a.fn.innerWidth,innerHeight:a.fn.innerHeight,outerWidth:a.fn.outerWidth,outerHeight:a.fn.outerHeight};function h(l,k,i,m){a.each(e,function(){k-=parseFloat(a.curCSS(l,"padding"+this,true))||0;if(i){k-=parseFloat(a.curCSS(l,"border"+this+"Width",true))||0}if(m){k-=parseFloat(a.curCSS(l,"margin"+this,true))||0}});return k}a.fn["inner"+d]=function(i){if(i===c){return j["inner"+d].call(this)}return this.each(function(){a(this).css(g,h(this,i)+"px")})};a.fn["outer"+d]=function(i,k){if(typeof i!=="number"){return j["outer"+d].call(this,i)}return this.each(function(){a(this).css(g,h(this,i,true,k)+"px")})}});function b(d){return !a(d).parents().andSelf().filter(function(){return a.curCSS(this,"visibility")==="hidden"||a.expr.filters.hidden(this)}).length}a.extend(a.expr[":"],{data:function(f,e,d){return !!a.data(f,d[3])},focusable:function(f){var i=f.nodeName.toLowerCase(),d=a.attr(f,"tabindex");if("area"===i){var h=f.parentNode,g=h.name,e;if(!f.href||!g||h.nodeName.toLowerCase()!=="map"){return false}e=a("img[usemap=#"+g+"]")[0];return !!e&&b(e)}return(/input|select|textarea|button|object/.test(i)?!f.disabled:"a"==i?f.href||!isNaN(d):!isNaN(d))&&b(f)},tabbable:function(e){var d=a.attr(e,"tabindex");return(isNaN(d)||d>=0)&&a(e).is(":focusable")}});a(function(){var d=document.body,e=d.appendChild(e=document.createElement("div"));a.extend(e.style,{minHeight:"100px",height:"auto",padding:0,borderWidth:0});a.support.minHeight=e.offsetHeight===100;a.support.selectstart="onselectstart" in e;d.removeChild(e).style.display="none"});a.extend(a.ui,{plugin:{add:function(e,f,h){var g=a.ui[e].prototype;for(var d in h){g.plugins[d]=g.plugins[d]||[];g.plugins[d].push([f,h[d]])}},call:function(d,f,e){var h=d.plugins[f];if(!h||!d.element[0].parentNode){return}for(var g=0;g<h.length;g++){if(d.options[h[g][0]]){h[g][1].apply(d.element,e)}}}},contains:function(e,d){return document.compareDocumentPosition?e.compareDocumentPosition(d)&16:e!==d&&e.contains(d)},hasScroll:function(g,e){if(a(g).css("overflow")==="hidden"){return false}var d=(e&&e==="left")?"scrollLeft":"scrollTop",f=false;if(g[d]>0){return true}g[d]=1;f=(g[d]>0);g[d]=0;return f},isOverAxis:function(e,d,f){return(e>d)&&(e<(d+f))},isOver:function(i,e,h,g,d,f){return a.ui.isOverAxis(i,h,d)&&a.ui.isOverAxis(e,g,f)}})})(jQuery);
/*!
 * jQuery UI Widget 1.8.6
 *
 * Copyright 2010, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Widget
 */
(function(b,d){if(b.cleanData){var c=b.cleanData;b.cleanData=function(e){for(var f=0,g;(g=e[f])!=null;f++){b(g).triggerHandler("remove")}c(e)}}else{var a=b.fn.remove;b.fn.remove=function(e,f){return this.each(function(){if(!f){if(!e||b.filter(e,[this]).length){b("*",this).add([this]).each(function(){b(this).triggerHandler("remove")})}}return a.call(b(this),e,f)})}}b.widget=function(f,h,e){var g=f.split(".")[0],j;f=f.split(".")[1];j=g+"-"+f;if(!e){e=h;h=b.Widget}b.expr[":"][j]=function(k){return !!b.data(k,f)};b[g]=b[g]||{};b[g][f]=function(k,l){if(arguments.length){this._createWidget(k,l)}};var i=new h();i.options=b.extend(true,{},i.options);b[g][f].prototype=b.extend(true,i,{namespace:g,widgetName:f,widgetEventPrefix:b[g][f].prototype.widgetEventPrefix||f,widgetBaseClass:j},e);b.widget.bridge(f,b[g][f])};b.widget.bridge=function(f,e){b.fn[f]=function(i){var g=typeof i==="string",h=Array.prototype.slice.call(arguments,1),j=this;i=!g&&h.length?b.extend.apply(null,[true,i].concat(h)):i;if(g&&i.charAt(0)==="_"){return j}if(g){this.each(function(){var k=b.data(this,f),l=k&&b.isFunction(k[i])?k[i].apply(k,h):k;if(l!==k&&l!==d){j=l;return false}})}else{this.each(function(){var k=b.data(this,f);if(k){k.option(i||{})._init()}else{b.data(this,f,new e(i,this))}})}return j}};b.Widget=function(e,f){if(arguments.length){this._createWidget(e,f)}};b.Widget.prototype={widgetName:"widget",widgetEventPrefix:"",options:{disabled:false},_createWidget:function(f,g){b.data(g,this.widgetName,this);this.element=b(g);this.options=b.extend(true,{},this.options,this._getCreateOptions(),f);var e=this;this.element.bind("remove."+this.widgetName,function(){e.destroy()});this._create();this._trigger("create");this._init()},_getCreateOptions:function(){return b.metadata&&b.metadata.get(this.element[0])[this.widgetName]},_create:function(){},_init:function(){},destroy:function(){this.element.unbind("."+this.widgetName).removeData(this.widgetName);this.widget().unbind("."+this.widgetName).removeAttr("aria-disabled").removeClass(this.widgetBaseClass+"-disabled ui-state-disabled")},widget:function(){return this.element},option:function(f,g){var e=f;if(arguments.length===0){return b.extend({},this.options)}if(typeof f==="string"){if(g===d){return this.options[f]}e={};e[f]=g}this._setOptions(e);return this},_setOptions:function(f){var e=this;b.each(f,function(g,h){e._setOption(g,h)});return this},_setOption:function(e,f){this.options[e]=f;if(e==="disabled"){this.widget()[f?"addClass":"removeClass"](this.widgetBaseClass+"-disabled ui-state-disabled").attr("aria-disabled",f)}return this},enable:function(){return this._setOption("disabled",false)},disable:function(){return this._setOption("disabled",true)},_trigger:function(f,g,h){var k=this.options[f];g=b.Event(g);g.type=(f===this.widgetEventPrefix?f:this.widgetEventPrefix+f).toLowerCase();h=h||{};if(g.originalEvent){for(var e=b.event.props.length,j;e;){j=b.event.props[--e];g[j]=g.originalEvent[j]}}this.element.trigger(g,h);return !(b.isFunction(k)&&k.call(this.element[0],g,h)===false||g.isDefaultPrevented())}}})(jQuery);(function(e,h){var c,b="ui-button ui-widget ui-state-default ui-corner-all",g="ui-state-hover ui-state-active ",f="ui-button-icons-only ui-button-icon-only ui-button-text-icons ui-button-text-icon-primary ui-button-text-icon-secondary ui-button-text-only",d=function(i){e(":ui-button",i.target.form).each(function(){var j=e(this).data("button");setTimeout(function(){j.refresh()},1)})},a=function(j){var i=j.name,k=j.form,l=e([]);if(i){if(k){l=e(k).find("[name='"+i+"']")}else{l=e("[name='"+i+"']",j.ownerDocument).filter(function(){return !this.form})}}return l};e.widget("ui.button",{options:{disabled:null,text:true,label:null,icons:{primary:null,secondary:null}},_create:function(){this.element.closest("form").unbind("reset.button").bind("reset.button",d);if(typeof this.options.disabled!=="boolean"){this.options.disabled=this.element.attr("disabled")}this._determineButtonType();this.hasTitle=!!this.buttonElement.attr("title");var i=this,k=this.options,l=this.type==="checkbox"||this.type==="radio",m="ui-state-hover"+(!l?" ui-state-active":""),j="ui-state-focus";if(k.label===null){k.label=this.buttonElement.html()}if(this.element.is(":disabled")){k.disabled=true}this.buttonElement.addClass(b).attr("role","button").bind("mouseenter.button",function(){if(k.disabled){return}e(this).addClass("ui-state-hover");if(this===c){e(this).addClass("ui-state-active")}}).bind("mouseleave.button",function(){if(k.disabled){return}e(this).removeClass(m)}).bind("focus.button",function(){e(this).addClass(j)}).bind("blur.button",function(){e(this).removeClass(j)});if(l){this.element.bind("change.button",function(){i.refresh()})}if(this.type==="checkbox"){this.buttonElement.bind("click.button",function(){if(k.disabled){return false}e(this).toggleClass("ui-state-active");i.buttonElement.attr("aria-pressed",i.element[0].checked)})}else{if(this.type==="radio"){this.buttonElement.bind("click.button",function(){if(k.disabled){return false}e(this).addClass("ui-state-active");i.buttonElement.attr("aria-pressed",true);var n=i.element[0];a(n).not(n).map(function(){return e(this).button("widget")[0]}).removeClass("ui-state-active").attr("aria-pressed",false)})}else{this.buttonElement.bind("mousedown.button",function(){if(k.disabled){return false}e(this).addClass("ui-state-active");c=this;e(document).one("mouseup",function(){c=null})}).bind("mouseup.button",function(){if(k.disabled){return false}e(this).removeClass("ui-state-active")}).bind("keydown.button",function(n){if(k.disabled){return false}if(n.keyCode==e.ui.keyCode.SPACE||n.keyCode==e.ui.keyCode.ENTER){e(this).addClass("ui-state-active")}}).bind("keyup.button",function(){e(this).removeClass("ui-state-active")});if(this.buttonElement.is("a")){this.buttonElement.keyup(function(n){if(n.keyCode===e.ui.keyCode.SPACE){e(this).click()}})}}}this._setOption("disabled",k.disabled)},_determineButtonType:function(){if(this.element.is(":checkbox")){this.type="checkbox"}else{if(this.element.is(":radio")){this.type="radio"}else{if(this.element.is("input")){this.type="input"}else{this.type="button"}}}if(this.type==="checkbox"||this.type==="radio"){this.buttonElement=this.element.parents().last().find("label[for="+this.element.attr("id")+"]");this.element.addClass("ui-helper-hidden-accessible");var i=this.element.is(":checked");if(i){this.buttonElement.addClass("ui-state-active")}this.buttonElement.attr("aria-pressed",i)}else{this.buttonElement=this.element}},widget:function(){return this.buttonElement},destroy:function(){this.element.removeClass("ui-helper-hidden-accessible");this.buttonElement.removeClass(b+" "+g+" "+f).removeAttr("role").removeAttr("aria-pressed").html(this.buttonElement.find(".ui-button-text").html());if(!this.hasTitle){this.buttonElement.removeAttr("title")}e.Widget.prototype.destroy.call(this)},_setOption:function(i,j){e.Widget.prototype._setOption.apply(this,arguments);if(i==="disabled"){if(j){this.element.attr("disabled",true)}else{this.element.removeAttr("disabled")}}this._resetButton()},refresh:function(){var i=this.element.is(":disabled");if(i!==this.options.disabled){this._setOption("disabled",i)}if(this.type==="radio"){a(this.element[0]).each(function(){if(e(this).is(":checked")){e(this).button("widget").addClass("ui-state-active").attr("aria-pressed",true)}else{e(this).button("widget").removeClass("ui-state-active").attr("aria-pressed",false)}})}else{if(this.type==="checkbox"){if(this.element.is(":checked")){this.buttonElement.addClass("ui-state-active").attr("aria-pressed",true)}else{this.buttonElement.removeClass("ui-state-active").attr("aria-pressed",false)}}}},_resetButton:function(){if(this.type==="input"){if(this.options.label){this.element.val(this.options.label)}return}var l=this.buttonElement.removeClass(f),k=e("<span></span>").addClass("ui-button-text").html(this.options.label).appendTo(l.empty()).text(),j=this.options.icons,i=j.primary&&j.secondary;if(j.primary||j.secondary){l.addClass("ui-button-text-icon"+(i?"s":(j.primary?"-primary":"-secondary")));if(j.primary){l.prepend("<span class='ui-button-icon-primary ui-icon "+j.primary+"'></span>")}if(j.secondary){l.append("<span class='ui-button-icon-secondary ui-icon "+j.secondary+"'></span>")}if(!this.options.text){l.addClass(i?"ui-button-icons-only":"ui-button-icon-only").removeClass("ui-button-text-icons ui-button-text-icon-primary ui-button-text-icon-secondary");if(!this.hasTitle){l.attr("title",k)}}}else{l.addClass("ui-button-text-only")}}});e.widget("ui.buttonset",{_create:function(){this.element.addClass("ui-buttonset")},_init:function(){this.refresh()},_setOption:function(i,j){if(i==="disabled"){this.buttons.button("option",i,j)}e.Widget.prototype._setOption.apply(this,arguments)},refresh:function(){this.buttons=this.element.find(":button, :submit, :reset, :checkbox, :radio, a, :data(button)").filter(":ui-button").button("refresh").end().not(":ui-button").button().end().map(function(){return e(this).button("widget")[0]}).removeClass("ui-corner-all ui-corner-left ui-corner-right").filter(":visible").filter(":first").addClass("ui-corner-left").end().filter(":last").addClass("ui-corner-right").end().end().end()},destroy:function(){this.element.removeClass("ui-buttonset");this.buttons.map(function(){return e(this).button("widget")[0]}).removeClass("ui-corner-left ui-corner-right").end().button("destroy");e.Widget.prototype.destroy.call(this)}})}(jQuery));(function(f,g){f.ui=f.ui||{};var d=/left|center|right/,e=/top|center|bottom/,a="center",b=f.fn.position,c=f.fn.offset;f.fn.position=function(i){if(!i||!i.of){return b.apply(this,arguments)}i=f.extend({},i);var m=f(i.of),l=m[0],o=(i.collision||"flip").split(" "),n=i.offset?i.offset.split(" "):[0,0],k,h,j;if(l.nodeType===9){k=m.width();h=m.height();j={top:0,left:0}}else{if(l.setTimeout){k=m.width();h=m.height();j={top:m.scrollTop(),left:m.scrollLeft()}}else{if(l.preventDefault){i.at="left top";k=h=0;j={top:i.of.pageY,left:i.of.pageX}}else{k=m.outerWidth();h=m.outerHeight();j=m.offset()}}}f.each(["my","at"],function(){var p=(i[this]||"").split(" ");if(p.length===1){p=d.test(p[0])?p.concat([a]):e.test(p[0])?[a].concat(p):[a,a]}p[0]=d.test(p[0])?p[0]:a;p[1]=e.test(p[1])?p[1]:a;i[this]=p});if(o.length===1){o[1]=o[0]}n[0]=parseInt(n[0],10)||0;if(n.length===1){n[1]=n[0]}n[1]=parseInt(n[1],10)||0;if(i.at[0]==="right"){j.left+=k}else{if(i.at[0]===a){j.left+=k/2}}if(i.at[1]==="bottom"){j.top+=h}else{if(i.at[1]===a){j.top+=h/2}}j.left+=n[0];j.top+=n[1];return this.each(function(){var s=f(this),u=s.outerWidth(),r=s.outerHeight(),t=parseInt(f.curCSS(this,"marginLeft",true))||0,q=parseInt(f.curCSS(this,"marginTop",true))||0,w=u+t+parseInt(f.curCSS(this,"marginRight",true))||0,x=r+q+parseInt(f.curCSS(this,"marginBottom",true))||0,v=f.extend({},j),p;if(i.my[0]==="right"){v.left-=u}else{if(i.my[0]===a){v.left-=u/2}}if(i.my[1]==="bottom"){v.top-=r}else{if(i.my[1]===a){v.top-=r/2}}v.left=parseInt(v.left);v.top=parseInt(v.top);p={left:v.left-t,top:v.top-q};f.each(["left","top"],function(z,y){if(f.ui.position[o[z]]){f.ui.position[o[z]][y](v,{targetWidth:k,targetHeight:h,elemWidth:u,elemHeight:r,collisionPosition:p,collisionWidth:w,collisionHeight:x,offset:n,my:i.my,at:i.at})}});if(f.fn.bgiframe){s.bgiframe()}s.offset(f.extend(v,{using:i.using}))})};f.ui.position={fit:{left:function(h,i){var k=f(window),j=i.collisionPosition.left+i.collisionWidth-k.width()-k.scrollLeft();h.left=j>0?h.left-j:Math.max(h.left-i.collisionPosition.left,h.left)},top:function(h,i){var k=f(window),j=i.collisionPosition.top+i.collisionHeight-k.height()-k.scrollTop();h.top=j>0?h.top-j:Math.max(h.top-i.collisionPosition.top,h.top)}},flip:{left:function(i,k){if(k.at[0]===a){return}var m=f(window),l=k.collisionPosition.left+k.collisionWidth-m.width()-m.scrollLeft(),h=k.my[0]==="left"?-k.elemWidth:k.my[0]==="right"?k.elemWidth:0,j=k.at[0]==="left"?k.targetWidth:-k.targetWidth,n=-2*k.offset[0];i.left+=k.collisionPosition.left<0?h+j+n:l>0?h+j+n:0},top:function(i,k){if(k.at[1]===a){return}var m=f(window),l=k.collisionPosition.top+k.collisionHeight-m.height()-m.scrollTop(),h=k.my[1]==="top"?-k.elemHeight:k.my[1]==="bottom"?k.elemHeight:0,j=k.at[1]==="top"?k.targetHeight:-k.targetHeight,n=-2*k.offset[1];i.top+=k.collisionPosition.top<0?h+j+n:l>0?h+j+n:0}}};if(!f.offset.setOffset){f.offset.setOffset=function(l,i){if(/static/.test(f.curCSS(l,"position"))){l.style.position="relative"}var k=f(l),n=k.offset(),h=parseInt(f.curCSS(l,"top",true),10)||0,m=parseInt(f.curCSS(l,"left",true),10)||0,j={top:(i.top-n.top)+h,left:(i.left-n.left)+m};if("using" in i){i.using.call(l,j)}else{k.css(j)}};f.fn.offset=function(h){var i=this[0];if(!i||!i.ownerDocument){return null}if(h){return this.each(function(){f.offset.setOffset(this,h)})}return c.call(this)}}}(jQuery));(function(d,e){var b="ui-dialog ui-widget ui-widget-content ui-corner-all ",a={buttons:true,height:true,maxHeight:true,maxWidth:true,minHeight:true,minWidth:true,width:true},c={maxHeight:true,maxWidth:true,minHeight:true,minWidth:true};d.widget("ui.dialog",{options:{autoOpen:true,buttons:{},closeOnEscape:true,closeText:"close",dialogClass:"",draggable:true,hide:null,height:"auto",maxHeight:false,maxWidth:false,minHeight:150,minWidth:150,modal:false,position:{my:"center",at:"center",of:window,collision:"fit",using:function(g){var f=d(this).css(g).offset().top;if(f<0){d(this).css("top",g.top-f)}}},resizable:true,show:null,stack:true,title:"",width:300,zIndex:1000},_create:function(){this.originalTitle=this.element.attr("title");if(typeof this.originalTitle!=="string"){this.originalTitle=""}this.options.title=this.options.title||this.originalTitle;var n=this,o=n.options,l=o.title||"&#160;",g=d.ui.dialog.getTitleId(n.element),m=(n.uiDialog=d("<div></div>")).appendTo(document.body).hide().addClass(b+o.dialogClass).css({zIndex:o.zIndex}).attr("tabIndex",-1).css("outline",0).keydown(function(p){if(o.closeOnEscape&&p.keyCode&&p.keyCode===d.ui.keyCode.ESCAPE){n.close(p);p.preventDefault()}}).attr({role:"dialog","aria-labelledby":g}).mousedown(function(p){n.moveToTop(false,p)}),i=n.element.show().removeAttr("title").addClass("ui-dialog-content ui-widget-content").appendTo(m),h=(n.uiDialogTitlebar=d("<div></div>")).addClass("ui-dialog-titlebar ui-widget-header ui-corner-all ui-helper-clearfix").prependTo(m),k=d('<a href="#"></a>').addClass("ui-dialog-titlebar-close ui-corner-all").attr("role","button").hover(function(){k.addClass("ui-state-hover")},function(){k.removeClass("ui-state-hover")}).focus(function(){k.addClass("ui-state-focus")}).blur(function(){k.removeClass("ui-state-focus")}).click(function(p){n.close(p);return false}).appendTo(h),j=(n.uiDialogTitlebarCloseText=d("<span></span>")).addClass("ui-icon ui-icon-closethick").text(o.closeText).appendTo(k),f=d("<span></span>").addClass("ui-dialog-title").attr("id",g).html(l).prependTo(h);if(d.isFunction(o.beforeclose)&&!d.isFunction(o.beforeClose)){o.beforeClose=o.beforeclose}h.find("*").add(h).disableSelection();if(o.draggable&&d.fn.draggable){n._makeDraggable()}if(o.resizable&&d.fn.resizable){n._makeResizable()}n._createButtons(o.buttons);n._isOpen=false;if(d.fn.bgiframe){m.bgiframe()}},_init:function(){if(this.options.autoOpen){this.open()}},destroy:function(){var f=this;if(f.overlay){f.overlay.destroy()}f.uiDialog.hide();f.element.unbind(".dialog").removeData("dialog").removeClass("ui-dialog-content ui-widget-content").hide().appendTo("body");f.uiDialog.remove();if(f.originalTitle){f.element.attr("title",f.originalTitle)}return f},widget:function(){return this.uiDialog},close:function(h){var f=this,g;if(false===f._trigger("beforeClose",h)){return}if(f.overlay){f.overlay.destroy()}f.uiDialog.unbind("keypress.ui-dialog");f._isOpen=false;if(f.options.hide){f.uiDialog.hide(f.options.hide,function(){f._trigger("close",h)})}else{f.uiDialog.hide();f._trigger("close",h)}d.ui.dialog.overlay.resize();if(f.options.modal){g=0;d(".ui-dialog").each(function(){if(this!==f.uiDialog[0]){g=Math.max(g,d(this).css("z-index"))}});d.ui.dialog.maxZ=g}return f},isOpen:function(){return this._isOpen},moveToTop:function(j,i){var f=this,h=f.options,g;if((h.modal&&!j)||(!h.stack&&!h.modal)){return f._trigger("focus",i)}if(h.zIndex>d.ui.dialog.maxZ){d.ui.dialog.maxZ=h.zIndex}if(f.overlay){d.ui.dialog.maxZ+=1;f.overlay.$el.css("z-index",d.ui.dialog.overlay.maxZ=d.ui.dialog.maxZ)}g={scrollTop:f.element.attr("scrollTop"),scrollLeft:f.element.attr("scrollLeft")};d.ui.dialog.maxZ+=1;f.uiDialog.css("z-index",d.ui.dialog.maxZ);f.element.attr(g);f._trigger("focus",i);return f},open:function(){if(this._isOpen){return}var g=this,h=g.options,f=g.uiDialog;g.overlay=h.modal?new d.ui.dialog.overlay(g):null;g._size();g._position(h.position);f.show(h.show);g.moveToTop(true);if(h.modal){f.bind("keypress.ui-dialog",function(k){if(k.keyCode!==d.ui.keyCode.TAB){return}var j=d(":tabbable",this),l=j.filter(":first"),i=j.filter(":last");if(k.target===i[0]&&!k.shiftKey){l.focus(1);return false}else{if(k.target===l[0]&&k.shiftKey){i.focus(1);return false}}})}d(g.element.find(":tabbable").get().concat(f.find(".ui-dialog-buttonpane :tabbable").get().concat(f.get()))).eq(0).focus();g._isOpen=true;g._trigger("open");return g},_createButtons:function(i){var h=this,f=false,g=d("<div></div>").addClass("ui-dialog-buttonpane ui-widget-content ui-helper-clearfix"),j=d("<div></div>").addClass("ui-dialog-buttonset").appendTo(g);h.uiDialog.find(".ui-dialog-buttonpane").remove();if(typeof i==="object"&&i!==null){d.each(i,function(){return !(f=true)})}if(f){d.each(i,function(k,m){m=d.isFunction(m)?{click:m,text:k}:m;var l=d('<button type="button"></button>').attr(m,true).unbind("click").click(function(){m.click.apply(h.element[0],arguments)}).appendTo(j);if(d.fn.button){l.button()}});g.appendTo(h.uiDialog)}},_makeDraggable:function(){var f=this,i=f.options,j=d(document),h;function g(k){return{position:k.position,offset:k.offset}}f.uiDialog.draggable({cancel:".ui-dialog-content, .ui-dialog-titlebar-close",handle:".ui-dialog-titlebar",containment:"document",start:function(k,l){h=i.height==="auto"?"auto":d(this).height();d(this).height(d(this).height()).addClass("ui-dialog-dragging");f._trigger("dragStart",k,g(l))},drag:function(k,l){f._trigger("drag",k,g(l))},stop:function(k,l){i.position=[l.position.left-j.scrollLeft(),l.position.top-j.scrollTop()];d(this).removeClass("ui-dialog-dragging").height(h);f._trigger("dragStop",k,g(l));d.ui.dialog.overlay.resize()}})},_makeResizable:function(k){k=(k===e?this.options.resizable:k);var g=this,j=g.options,f=g.uiDialog.css("position"),i=(typeof k==="string"?k:"n,e,s,w,se,sw,ne,nw");function h(l){return{originalPosition:l.originalPosition,originalSize:l.originalSize,position:l.position,size:l.size}}g.uiDialog.resizable({cancel:".ui-dialog-content",containment:"document",alsoResize:g.element,maxWidth:j.maxWidth,maxHeight:j.maxHeight,minWidth:j.minWidth,minHeight:g._minHeight(),handles:i,start:function(l,m){d(this).addClass("ui-dialog-resizing");g._trigger("resizeStart",l,h(m))},resize:function(l,m){g._trigger("resize",l,h(m))},stop:function(l,m){d(this).removeClass("ui-dialog-resizing");j.height=d(this).height();j.width=d(this).width();g._trigger("resizeStop",l,h(m));d.ui.dialog.overlay.resize()}}).css("position",f).find(".ui-resizable-se").addClass("ui-icon ui-icon-grip-diagonal-se")},_minHeight:function(){var f=this.options;if(f.height==="auto"){return f.minHeight}else{return Math.min(f.minHeight,f.height)}},_position:function(g){var h=[],i=[0,0],f;if(g){if(typeof g==="string"||(typeof g==="object"&&"0" in g)){h=g.split?g.split(" "):[g[0],g[1]];if(h.length===1){h[1]=h[0]}d.each(["left","top"],function(k,j){if(+h[k]===h[k]){i[k]=h[k];h[k]=j}});g={my:h.join(" "),at:h.join(" "),offset:i.join(" ")}}g=d.extend({},d.ui.dialog.prototype.options.position,g)}else{g=d.ui.dialog.prototype.options.position}f=this.uiDialog.is(":visible");if(!f){this.uiDialog.show()}this.uiDialog.css({top:0,left:0}).position(g);if(!f){this.uiDialog.hide()}},_setOptions:function(i){var g=this,f={},h=false;d.each(i,function(j,k){g._setOption(j,k);if(j in a){h=true}if(j in c){f[j]=k}});if(h){this._size()}if(this.uiDialog.is(":data(resizable)")){this.uiDialog.resizable("option",f)}},_setOption:function(i,j){var g=this,f=g.uiDialog;switch(i){case"beforeclose":i="beforeClose";break;case"buttons":g._createButtons(j);break;case"closeText":g.uiDialogTitlebarCloseText.text(""+j);break;case"dialogClass":f.removeClass(g.options.dialogClass).addClass(b+j);break;case"disabled":if(j){f.addClass("ui-dialog-disabled")}else{f.removeClass("ui-dialog-disabled")}break;case"draggable":var h=f.is(":data(draggable)");if(h&&!j){f.draggable("destroy")}if(!h&&j){g._makeDraggable()}break;case"position":g._position(j);break;case"resizable":var k=f.is(":data(resizable)");if(k&&!j){f.resizable("destroy")}if(k&&typeof j==="string"){f.resizable("option","handles",j)}if(!k&&j!==false){g._makeResizable(j)}break;case"title":d(".ui-dialog-title",g.uiDialogTitlebar).html(""+(j||"&#160;"));break}d.Widget.prototype._setOption.apply(g,arguments)},_size:function(){var i=this.options,f,h;this.element.show().css({width:"auto",minHeight:0,height:0});if(i.minWidth>i.width){i.width=i.minWidth}f=this.uiDialog.css({height:"auto",width:i.width}).height();h=Math.max(0,i.minHeight-f);if(i.height==="auto"){if(d.support.minHeight){this.element.css({minHeight:h,height:"auto"})}else{this.uiDialog.show();var g=this.element.css("height","auto").height();this.uiDialog.hide();this.element.height(Math.max(g,h))}}else{this.element.height(Math.max(i.height-f,0))}if(this.uiDialog.is(":data(resizable)")){this.uiDialog.resizable("option","minHeight",this._minHeight())}}});d.extend(d.ui.dialog,{version:"1.8.6",uuid:0,maxZ:0,getTitleId:function(f){var g=f.attr("id");if(!g){this.uuid+=1;g=this.uuid}return"ui-dialog-title-"+g},overlay:function(f){this.$el=d.ui.dialog.overlay.create(f)}});d.extend(d.ui.dialog.overlay,{instances:[],oldInstances:[],maxZ:0,events:d.map("focus,mousedown,mouseup,keydown,keypress,click".split(","),function(f){return f+".dialog-overlay"}).join(" "),create:function(g){if(this.instances.length===0){setTimeout(function(){if(d.ui.dialog.overlay.instances.length){d(document).bind(d.ui.dialog.overlay.events,function(h){if(d(h.target).zIndex()<d.ui.dialog.overlay.maxZ){return false}})}},1);d(document).bind("keydown.dialog-overlay",function(h){if(g.options.closeOnEscape&&h.keyCode&&h.keyCode===d.ui.keyCode.ESCAPE){g.close(h);h.preventDefault()}});d(window).bind("resize.dialog-overlay",d.ui.dialog.overlay.resize)}var f=(this.oldInstances.pop()||d("<div></div>").addClass("ui-widget-overlay")).appendTo(document.body).css({width:this.width(),height:this.height()});if(d.fn.bgiframe){f.bgiframe()}this.instances.push(f);return f},destroy:function(f){this.oldInstances.push(this.instances.splice(d.inArray(f,this.instances),1)[0]);if(this.instances.length===0){d([document,window]).unbind(".dialog-overlay")}f.remove();var g=0;d.each(this.instances,function(){g=Math.max(g,this.css("z-index"))});this.maxZ=g},height:function(){var g,f;if(d.browser.msie&&d.browser.version<7){g=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);f=Math.max(document.documentElement.offsetHeight,document.body.offsetHeight);if(g<f){return d(window).height()+"px"}else{return g+"px"}}else{return d(document).height()+"px"}},width:function(){var f,g;if(d.browser.msie&&d.browser.version<7){f=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);g=Math.max(document.documentElement.offsetWidth,document.body.offsetWidth);if(f<g){return d(window).width()+"px"}else{return f+"px"}}else{return d(document).width()+"px"}},resize:function(){var f=d([]);d.each(d.ui.dialog.overlay.instances,function(){f=f.add(this)});f.css({width:0,height:0}).css({width:d.ui.dialog.overlay.width(),height:d.ui.dialog.overlay.height()})}});d.extend(d.ui.dialog.overlay.prototype,{destroy:function(){d.ui.dialog.overlay.destroy(this.$el)}})}(jQuery));

var PRESO = {
  init:function() {
      
      (function () {
          "use strict";

          /**
          * Manipulation slide #1, demo
          */
          var dacTrigger = true;
          $("#demoAttributeChange").bind("click", function () {
              if (dacTrigger)
              {
                  $("li").css({'color' : 'blue', 'font-weight' : 'bold', 'font-size' : '2em'});
                  $(this).text("Quick! Change it back!");
              }
              else
              {
                  $("li").removeAttr('style');
                  $(this).html('Click here to toggle <code>&lt;li&gt;</code> styles.');
              }
              dacTrigger = !dacTrigger;
          });

          /**
          * Event slide #1, demo
          */
          var show = $("#hiddenList");
          show.hide();
          $("#clickEventDemo").bind("click", function () {
              if (!show.is(":visible"))
              {
                  $(this).hide(200, function () {
                      show.show(200);            
                  });
              }
          });
          
          $("#resetClickEventDemo").bind("click", function () {
              if (show.is(":visible"))
              {
                  show.hide(200, function () {
                      $("#clickEventDemo").show(200);                                
                  });
              }
          });

          /**
          * AJAX slide #1, demo
          */
          $("#progressSpinner").hide();
          $("#ajaxDemoResults").hide();
          $("#ajaxDemo").bind("click", function () {
              $("#progressSpinner").fadeIn(200, function () {
                  $("#ajaxDemoResults").load("http://10.natalilabsproject.appspot.com/currentdate/", function () {
                      $("#ajaxDemoResults").fadeIn(200, function () {
                          $("#progressSpinner").fadeOut(200);                                                            
                      });
                  });
              });
          });
      }());
  }
};

$(document).ready(function() {
    PRESO.init();
});
