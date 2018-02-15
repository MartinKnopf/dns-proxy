'use strict';

let dns = require('native-dns');
let server = dns.createServer();
let async = require('async');

server.on('listening', () => console.log('server listening on', server.address()));
server.on('close', () => console.log('server closed', server.address()));
server.on('error', (err, buff, req, res) => console.error(err.stack));
server.on('socketError', (err, socket) => console.error(err));

let entries = [
  {
    domain: "^mpw.de*",
    records: [
      { type: "A", address: "192.168.211.126", ttl: 1800 }
    ]
  }
];

let authority = { address: '8.8.8.8', port: 53, type: 'udp' };

function proxy(question, response, cb) {
  console.log('proxying', question.name);

  var request = dns.Request({
    question: question, // forwarding the question
    server: authority,  // this is the DNS server we are asking
    timeout: 1000
  });

  // when we get answers, append them to the response
  request.on('message', (err, msg) => {
    msg.answer.forEach(a => response.answer.push(a));
  });

  request.on('end', cb);
  request.send();
}

function handleRequest(request, response) {
  console.log('request from', request.address.address, 'for', request.question[0].name);

  let f = [];

  request.question.forEach(question => {
    if (question.name === 'mpw.de') {
    console.log('hier');
      entries[0].records.forEach(record => {
        record.name = question.name;
        record.ttl = record.ttl || 1800;
        response.answer.push(dns[record.type](record));
      });
    } else {
      f.push(cb => proxy(question, response, cb));
    }
  });

  async.parallel(f, function() { response.send(); });
}

server.on('request', handleRequest);

server.serve(53);