'use strict';

let dns = require('native-dns');
let server = dns.createServer();
let async = require('async');

let conf = require('./dns-conf.json');
let entries = conf.entries;
let fallbackDNS = conf.fallbackDNS;

server.on('listening', () => console.log('server listening on', server.address()));
server.on('close', () => console.log('server closed', server.address()));
server.on('error', (err, buff, req, res) => console.error(err.stack));
server.on('socketError', (err, socket) => console.error(err));

function proxyToFallbackDNS(question, response, cb) {
  console.log('proxying', question.name);

  var request = dns.Request({
    question: question,
    server: fallbackDNS,
    timeout: 1000
  });

  request.on('message', (err, msg) => {
    msg.answer.forEach(a => {
      response.answer.push(a);
      console.log('answering from fallback:', a);
    });
  });

  request.on('end', cb);
  request.send();
}

function handleRequest(request, response) {
  console.log('request from', request.address.address, 'for', request.question[0].name);

  let f = [];

  request.question.forEach(question => {
    let done = false;

    for(let i = 0; i < entries.size && !done; i++) {
      if(question.name.match(entries[i].domain)) {
        entries[i].records.forEach(record => {
          record.name = question.name;
          record.ttl = record.ttl || 1800;
          response.answer.push(dns[record.type](record));

          console.log('answering from entries:', record.address);

          done = true;
        });
      }
    }

    if(!done) f.push(cb => proxyToFallbackDNS(question, response, cb));
  });

  async.parallel(f, () => response.send());
}

server.on('request', handleRequest);

server.serve(53, conf.serverAddress);
