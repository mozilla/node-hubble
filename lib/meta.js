/**
 * Take an HTML string and parse out Open Graph and Twitter Card
 * social metadata, as well as any Dublin Core (both dc and dcterms).
 * See http://ogp.me/, https://dev.twitter.com/docs/cards, and
 * http://dublincore.org/documents/2008/01/14/dcmi-terms/
 *
 * Given the following HTML:
 *
 * <html>
 *   <head>
 *     <meta property="og:title" content="This is a title">
 *     <meta name="og:url" content="http://foo.com">
 *     <meta name="twitter:title" content="This is also a title">
 *   </head>
 * </html>
 *
 * The following would be returned from parse:
 *
 * {
 *   "href": "http://example.com/some-url.html",
 *   "contentType": "text/html",
 *   "og": {
 *     "og:title": "This is a title",
 *     "og:url": "http://foo.com"
 *   },
 *   "twitter": {
 *     "twitter:title": "This is also a title"
 *   }
 * }
 *
 * If no social graph data is found, we look for standard metadata
 * and return that (e.g., title, description).
 */

var cheerio = require( 'cheerio' ),
    twitterRegex = /^twitter\:/,
    ogRegex = /^og\:/,
    dcRegex = /^dc\./,
    dctermsRegex = /^dcterms\./;

exports.parse = function( html ) {
  var doc = cheerio.load( html ),
      meta = doc( 'meta' ),
      result = {},
      unprocessed = [],
      // Buckets for each namespaced type of meta data we look for
      og = {},
      twitter = {},
      dc = {},
      dcterms = {};

  // Try grabbing social graph data first
  Object.keys( meta ).forEach( function( i ) {
    var elem = meta[ i ],
        attribs = elem.attribs || {},
        // HTML5 spec says to use `name`, OG and others say `property`.
        name = (attribs.name || attribs.property || '').toLowerCase(),
        // In the wild you'll find name/content, property/content, name/value, ...
        content = attribs.content || attribs.value || '';

    if ( ogRegex.test( name ) ) {
      og[ name ] = content;
    } else if ( twitterRegex.test( name ) ) {
      twitter[ name ] = content;
    } else if ( dcRegex.test( name ) ) {
      dc[ name ] = content;
    } else if ( dctermsRegex.test( name ) ) {
      dcterms[ name ] = content;
    } else {
      // Remember the ones we didn't use in case we don't get
      // any social graph data and want to look at it later
      unprocessed.push({
        name: name,
        content: content
      });
    }
  });

  // Attach any populated namespace buckets
  if ( Object.keys( og ).length ) {
    result.og = og;
  }
  if ( Object.keys( twitter ).length ) {
    result.twitter = twitter;
  }
  if ( Object.keys( dc ).length ) {
    result.dc = dc;
  }
  if ( Object.keys( dcterms ).length ) {
    result.dcterms = dcterms;
  }

  // If we didn't find any social graph data, look for more
  // standard metadata.
  if ( !Object.keys( result ).length ) {
    unprocessed.forEach( function( m ) {
      var name = m.name,
          content = m.content;

      switch( name ) {
        case 'description':
          result.description = content;
          break;
        case 'author':
        case 'creator':
          result.author = content;
          break;
      }
    });
  }

  // Add the document title.
  var title = doc( 'title' ).text();
  if ( title ) {
    result.title = title;
  }

  return result;
};
