// LOGGING
// https://stackoverflow.com/questions/8393636/node-log-in-a-file-instead-of-the-console

const fs = require("fs");
const util = require("util");

const DATA_DIR = process.env.DATA_DIR || "./data";
const LOGGING_DIR = `${DATA_DIR}/log`;

console.log = (d) => {
  var todayEPOCH = new Date()
    .toISOString()
    .replace(
      /^(?<year>\d+)-(?<month>\d+)-(?<day>\d+)T.*$/,
      "$<year>_$<month>_$<day>"
    );
  var log_file = fs.createWriteStream(`${LOGGING_DIR}/${todayEPOCH}.log`, {
    flags: "a",
  });
  var log_stdout = process.stdout;
  var logLine = util.format(d).replace(/\n+$/, ""); // https://stackoverflow.com/a/24874813
  log_file.write(new Date().toISOString() + ": " + logLine + "\n");
  log_stdout.write(logLine + "\n");
};

// Redirect errors to console.log
console.error = console.log;
