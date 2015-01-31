var child_process = require('child_process');
var util = require('util');
var assert = require('assert');
var fs = require('fs');

var logFile = "/home/jessicat/Documents/worklog.jsonl";
var stateFile = "/tmp/work-timer-state.txt";
var commandFile = "/tmp/work-timer-commands";

child_process.exec('rm ' + commandFile, function(err) {
  if (err) console.error(err);
  child_process.exec('mkfifo ' + commandFile, function(err) {
    if (err) console.error(err);
    main();
  });
});

function currentTime() {
  return new Date().getTime() / 1000;
}

function Timer(type, duration) {
  this.type = type;
  this.duration = duration;
  this.timeLeft = duration;
  this.segmentLog = [];
}

Timer.prototype.isDone = function() {
  return this.timeLeft <= 0;
};

Timer.prototype.moveForward = function(time) {
  this.timeLeft -= time;
  if (this.timeLeft < 0) this.timeLeft = 0;
};

Timer.prototype.logSegment = function(log) {
  this.segmentLog.push(log);
};

Timer.prototype.startSegment = function() {
  return new Segment(this, currentTime());
};

function Segment(timer, startTime) {
  this.timer = timer;
  this.startTime = startTime;
}

Segment.prototype.timeRunning = function() {
  return currentTime() - this.startTime;
};

Segment.prototype.timeLeft = function() {
  return Math.max(0, this.timer.timeLeft - this.timeRunning());
};

Segment.prototype.isDone = function() {
  return this.timeLeft() == 0;
};

Segment.prototype.finish = function() {
  var elapsed = Math.min(currentTime() - this.startTime, this.timer.timeLeft);
  this.timer.moveForward(elapsed);
  this.timer.logSegment({startTime: this.startTime, elapsed: elapsed});
};

function workTimer() {
  return new Timer('work', 25*60);
  // return new Timer('work', 7);
}

function breakTimer() {
  return new Timer('break', 5*60);
  // return new Timer('break', 5);
}

var currentTimer = workTimer();
var currentSegment = null;

function startSegment() {
  currentSegment = currentTimer.startSegment();
}

function appendLogMessage(msg) {
  if (typeof msg != 'string') {
    assert(typeof msg == 'object');
    msg = JSON.stringify(msg);
  }
  fs.appendFile(logFile, msg + '\n', function(err) {
    if (err) console.error(err);
  });
}

function finishCurrentTimer() {
  if (currentTimer.segmentLog.length) {
    appendLogMessage({
      kind: 'timer',
      type: currentTimer.type,
      duration: currentTimer.duration,
      timeLeft: currentTimer.timeLeft,
      segments: currentTimer.segmentLog
    });
  }
  currentTimer = null;
}

function setTimerTo(timer) {
  if (currentSegment) finishCurrentSegment();
  finishCurrentTimer();
  currentTimer = timer;
  startSegment();
  playSound('checkout');
}

function finishCurrentSegment() {
  assert(currentSegment != null);
  currentSegment.finish();
  currentSegment = null;
}

function playSound(soundName) {
  child_process.exec('aplay sounds/' + soundName + '.wav', function(err) {
    if (err) console.error(err);
  });
}

function pause() {
  playSound('rblip2');
  finishCurrentSegment();
}

function unpause() {
  assert(currentSegment == null);
  playSound('rblip');
  startSegment();
}

function togglePause() {
  currentSegment ? pause() : unpause();
}

function formatTime(t) {
  t = t + 0.999;
  var secs = Math.floor(t % 60);
  return Math.floor(t / 60) + ':' + (secs < 10 ? '0' + secs : secs);
}

function update() {
  if (currentSegment != null && currentSegment.isDone()) {
    finishCurrentSegment();
    if (currentTimer.isDone()) {
      playSound(currentTimer.type == 'work' ? 'atone' : 'echime');
      var nextTimer = currentTimer.type == 'work' ? breakTimer() : workTimer();
      finishCurrentTimer();
      currentTimer = nextTimer;
      startSegment();
    }
  }
  var color = currentTimer.type == 'work' ?
    (currentSegment ? '00ffff' : '009999') :
    (currentSegment ? '00ff00' : '009900');
  var timeLeft = currentSegment ? currentSegment.timeLeft() : currentTimer.timeLeft;
  var stateMessage = '<fc=#'+color+'>'+formatTime(timeLeft)+'</fc>';
  fs.writeFile(stateFile, stateMessage, function(err) {
    if (err) console.error(err);
  });
}

setInterval(update, 200);

function readCommands() {
  fs.readFile(commandFile, 'utf8', function(err, command) {
    if (command) {
      command = command.trim();
      if (command == 'tpause') {
        togglePause();
      } else if (command == 'break') {
        setTimerTo(breakTimer());
      } else if (command == 'work') {
        setTimerTo(workTimer());
      } else {
        console.error('Unknown message: ' + command);
      }
    }
    readCommands();
  });
}

function main() {
  readCommands();
}
