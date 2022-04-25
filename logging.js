// LOGGING
// https://stackoverflow.com/questions/8393636/node-log-in-a-file-instead-of-the-console

const fs = require("fs");

var todayEPOCH = new Date()
  .toISOString()
  .replace(
    /^(?<year>\d+)-(?<month>\d+)-(?<day>\d+)T.*$/,
    "$<year>_$<month>_$<day>"
  );
var util = require("util");
var log_file = fs.createWriteStream(`log/${todayEPOCH}.log`, { flags: "a" });
var log_stdout = process.stdout;

console.log = (d) => {
  log_file.write(new Date().toISOString() + ": " + util.format(d) + "\n");
  log_stdout.write(util.format(d) + "\n");
};

// Redirect errors to console.log
console.error = console.log;
