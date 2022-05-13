const fs = require("fs");

const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";
const UPLOAD_PDB_DIR = process.env.UPLOAD_PDB_DIR || "./uploadsPDB";
const DATABASE_DIR = process.env.DATABASE_DIR || "./db";

console.log(`(!) Starting report processing [NEW THREAD]...`);

const crashReportDirs = fs
  .readdirSync(REPORTS_DIR, { withFileTypes: true })
  .filter((crashReportDir) => crashReportDir.isDirectory())
  .map((crashReportDir) => crashReportDir.name);

if (!crashReportDirs.length) console.log(`(!) Nothing left to process.`);

// Read QA PDB
var simplePDBDB = {};
// Check if PDBDB exists first
if (fs.existsSync(`${DATABASE_DIR}/simplePDBDB.txt`)) {
  const PDBList = fs.readFileSync(`${DATABASE_DIR}/simplePDBDB.txt`, "utf-8");
  PDBList.split(/\r?\n/).forEach((line) => {
    if (line) {
      tokens = line.split(",");
      simplePDBDB[tokens[0]] = {};
      simplePDBDB[tokens[0]]["PDBZip"] = tokens[1];
      simplePDBDB[tokens[0]]["username"] = tokens[2];
    }
  });
}

const getPDB = (crashGUID, crcVersion) => {
  retObj = {};
  if (simplePDBDB[crashGUID]) {
    retObj["url"] = `uploadsPDB/${simplePDBDB[crashGUID].PDBZip}`;
    retObj["description"] = `QA Build [${simplePDBDB[crashGUID].username}]`;
    retObj["source"] = `${simplePDBDB[crashGUID].PDBZip}`;
    return retObj;
  } else {
    retObj["url"] = `\\\\192.168.1.8\\Symbols\\SAF-TAC\\`;
    retObj["description"] = `SimCT Symbol Server`;
    retObj["source"] = `\\\\192.168.1.8\\Symbols\\SAF-TAC\\`;
    return retObj;
  }
};

var simpleCrashDB = [];

crashReportDirs.forEach((crashReportDir) => {
  // Store necessary information in database.
  // Crash date, Crash ID, Crash version, UE Version, Crash ZIP file name
  const contextXML = fs.readFileSync(
    `${REPORTS_DIR}/${crashReportDir}/CrashContext.runtime-xml`
  );
  const convert = require("xml-js");
  const contextJSON = convert.xml2json(contextXML, { compact: true });
  const context = JSON.parse(contextJSON).FGenericCrashContext;
  const crashMetadata = {
    crashGUID: context.RuntimeProperties.CrashGUID._text,
    crcVersion: context.RuntimeProperties.CrashReportClientVersion._text,
    buildConfig: context.RuntimeProperties.BuildConfiguration._text,
    engineVersion: context.RuntimeProperties.EngineVersion._text,
    crashType: context.RuntimeProperties.CrashType._text,
    errorMsg: context.RuntimeProperties.ErrorMessage._text,
    callStack: context.RuntimeProperties.CallStack._text,
    crashReportDir: `${crashReportDir}`,
    crashPDB: getPDB(
      context.RuntimeProperties.CrashGUID._text,
      context.RuntimeProperties.CrashReportClientVersion._text
    ),
  };
  simpleCrashDB.push(crashMetadata);
});
// console.log(simpleCrashDB);
// https://stackoverflow.com/a/56904201
fs.writeFileSync(
  `${DATABASE_DIR}/simpleCrashDB.json`,
  JSON.stringify(simpleCrashDB, null, "\t")
);

console.log("(✔) Report processing complete.");
