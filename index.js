#!/usr/bin/env node

/*jshint node:true */
'use strict';

var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var server = http.createServer();

/*
HTTP responses can include a media type indicating what sort of stuff
the server's sending back. This looks at a filename's extension and
attempts to determine the media type.
*/
function determineMediaType(filename) {
  var extension = path.extname(filename).replace('.', '', 1);
  var knownTypes = {
    txt: "text/plain",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    js: "text/javascript",
    css: "text/css"
  };

  return knownTypes[extension];
}

/*
Given a filename, serve it from the public/ folder. Attempt to infer its media-
type based on its extension. Sends headers and body and calls end, so don't do
anything with the response before or after sending it to this function.
*/
function serveFile(filename, response) {
  var headers = {};
  var mediaType = determineMediaType(filename);
  if (mediaType !== undefined) {
    headers['Content-Type'] = mediaType;
  }
  response.writeHead(200, headers);

  // Here we read the file contents and send them to the response.
  var readStream = fs.createReadStream(__dirname + '/public/' + filename);
  readStream.on('data', function(data) {
    response.write(data);
  });
  readStream.on('end', function() {
    response.end();
  });
}

server.on('request', function(request, response) {
  var pathname = url.parse(request.url).pathname;
  if (pathname === '/') {
    serveFile('index.html', response);
  } else {
    // fs.exists takes a filename and calls a callback with a boolean
    // indicating whether that file exists.
    fs.exists(__dirname + '/public/' + pathname, function(exists) {
      if (exists) {
        serveFile(pathname, response);
      } else {
        // that file didn't exist, so send back a 404 Not Found
        var body = '404 NOT FOUND';
        response.writeHead(404, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
        });
        response.write(body);
        response.end();
      }
    });
  }
});

console.log("Now listening on port 9001");
server.listen(9001);
