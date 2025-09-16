/* Wrapper for textarea-caret-position library to provide the expected API */

// Include the original library
var CaretCoordinates = (function() {
  // Insert the entire textarea-caret-position library code here
  
  // The properties that we copy into a mirrored div.
  var properties = [
    'direction',  // RTL support
    'boxSizing',
    'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
    'height',
    'overflowX',
    'overflowY',  // copy the scrollbar for IE
  
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
  
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  
    // https://developer.mozilla.org/en-US/docs/Web/CSS/font
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
  
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',  // might not make a difference, but better be safe
  
    'letterSpacing',
    'wordSpacing'
  ];
  
  function CaretCoordinates(element) {
    var self = this;
  
    this.element = element;
  
    // mirrored div
    this.div = document.createElement('div');
    element.parentNode.insertBefore(this.div, element);
  
    var style = this.div.style;
    this.computed = window.getComputedStyle? getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9
  
    // default textarea styles
    style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT')
      style.wordWrap = 'break-word';  // only for textarea-s
  
    // position off-screen
    style.position = 'absolute';  // required to return coordinates properly
    style.visibility = 'hidden';  // not 'display: none' because we want rendering
  
    // transfer the element's properties to the div
    properties.forEach(function (prop) {
      style[prop] = self.computed[prop];
    });
  
    style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
  
    this.divText = document.createTextNode('');
    this.div.appendChild(this.divText);
    this.span = document.createElement('span');
    this.spanText = document.createTextNode('');
    this.span.appendChild(this.spanText);
    this.div.appendChild(this.span);
  
    function resize() {
      style.width = self.computed.width;
    }
  
    window.addEventListener('resize', resize);
  }
  
  CaretCoordinates.prototype.get = function(positionLeft, positionRight) {
    // calculate left offset
    this.divText.nodeValue = this.element.value.substring(0, positionLeft);
  
    // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces
    if (this.element.nodeName === 'INPUT')
      this.divText.nodeValue = this.divText.nodeValue.replace(/\s/g, "\u00a0");
  
    this.spanText.nodeValue = this.element.value.substring(positionLeft) || '.';
  
    var left = this.span.offsetLeft + parseInt(this.computed['borderLeftWidth'], 10);
  
    // calculate right offset
    this.divText.nodeValue = this.element.value.substring(0, positionRight);
  
    if (this.element.nodeName === 'INPUT')
      this.divText.nodeValue = this.divText.nodeValue.replace(/\s/g, "\u00a0");
  
    this.spanText.nodeValue = this.element.value.substring(positionRight) || '.';
    var right = this.span.offsetLeft + parseInt(this.computed['borderLeftWidth'], 10);
  
    // special case where right position is not be calculated correctly (full line selected)
    if (right <= left) {
      right = this.div.offsetWidth + parseInt(this.computed['borderLeftWidth'], 10);
    }
  
    var coordinates = {
      top: this.span.offsetTop + parseInt(this.computed['borderTopWidth'], 10),
      left: left,
      right: right
    };
  
    return coordinates;
  };
  
  return CaretCoordinates;
})();

// Create the global function that matches the expected API
function getCaretCoordinates(element, position) {
  var caretCoords = new CaretCoordinates(element);
  var coords = caretCoords.get(position, position);
  
  return {
    left: coords.left,
    top: coords.top,
    height: parseInt(window.getComputedStyle(element).lineHeight) || 20
  };
}

// Make it available globally
window.getCaretCoordinates = getCaretCoordinates;
