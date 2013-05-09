/**
 * Create a writable stream that can be used with `pipe()`, and buffer
 * the contents of an img file at a given URL. When the image is finished
 * buffering, create an Image object, and obtain the width and height.
 *
 * If the buffer cannot be loaded into an Image, an error will be sent in
 * the callback, otherwise a size object will be sent:
 * ({ width: w, height: h }).
 */
var concat = require( 'concat-stream' ),
    Image = require( 'canvas' ).Image;

exports.createSizeStream = function( callback ) {
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
