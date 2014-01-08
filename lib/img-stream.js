/**
 * Create a writable stream that can be used with `pipe()`, and buffer
 * the contents of an img file at a given URL. When the image is finished
 * buffering, create an Image object, and obtain the width and height.
 *
 * If the buffer cannot be loaded into an Image, an error will be sent in
 * the callback, otherwise a size object will be sent:
 * ({ width: w, height: h }).
 */

var concat = require( 'concat-stream' );

var createSizeStream = function( callback ) {
  var Image = require( 'canvas' ).Image;

  return concat( function( err, data ) {
    if ( err ) {
      callback( err );
      return;
    }

    var img = new Image();
    img.onload = function() {
      callback( null, {
        width: img.width,
        height: img.height
      });
    };
    img.onerror = function() {
      callback( 'Error rendering img' );
    };
    img.src = data;
  });
};

var canvasUnavailable = function( callback ) {
  return concat( function( err, data ) {
    if ( err ) {
      callback( err );
      return;
    }

    callback(new Error( 'canvas module has not been installed' ));
  });
};

try {
  require( 'canvas' );
  module.exports.createSizeStream = createSizeStream;
} catch(ex) {
  module.exports.createSizeStream = canvasUnavailable;
}
