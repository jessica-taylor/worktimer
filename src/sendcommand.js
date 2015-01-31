
var open = require('amqplib').connect('amqp://localhost');

var queueName = 'worktimer';
var msg = process.argv[2];
console.log('msg', msg);

function publisher(conn) {
  conn.createChannel(on_open);
  function on_open(err, ch) {
    if (err != null) bail(err);
    ch.assertQueue(queueName);
    ch.sendToQueue(queueName, new Buffer(msg));
    conn.close();
  }
}

require('amqplib/callback_api').connect('amqp://localhost', function(err, conn) {
  if (err) console.error(err)
  publisher(conn);
});
