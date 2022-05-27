const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const REPORTS_DIR = `${DATA_DIR}/reports`;

process.on("message", async (message) => {
  if (message == "START") {
    process.send(`(!) Starting report processing...`);
    await processEverything();
    process.send("(✔) Report processing complete.");
    process.exit();
  }
});

const processEverything = async () => {
  const crashReportDirs = fs
    .readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter((crashReportDir) => crashReportDir.isDirectory())
    .map((crashReportDir) => crashReportDir.name);

  if (!crashReportDirs.length) process.send(`(!) Nothing left to process.`);

  const mongo = require("./mongodb");

  const getPDB = async (crashGUID) => {
    const PDBEntry = await mongo.db
      .collection("PDBCollection")
      .findOne({ GUID: crashGUID });
    retObj = {};
    if (PDBEntry) {
      retObj["url"] = `uploadsPDB/${PDBEntry.PDBZip}`;
      retObj["description"] = `QA Build [${PDBEntry.username}]`;
      retObj["source"] = `${PDBEntry.PDBZip}`;
      return retObj;
    } else {
      retObj["url"] = `\\\\192.168.1.8\\Symbols\\SAF-TAC\\`;
      retObj["description"] = `SimCT Symbol Server`;
      retObj["source"] = `\\\\192.168.1.8\\Symbols\\SAF-TAC\\`;
      return retObj;
    }
  };

  var simpleCrashDB = [];

  for (const crashReportDir of crashReportDirs) {
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
      crashPDB: await getPDB(context.RuntimeProperties.CrashGUID._text),
    };
    simpleCrashDB.push(crashMetadata);
  }

  if (simpleCrashDB.length) {
    await mongo.db.collection("CrashCollection").deleteMany({}); // This is very bad: You should ideally insert new ones without overwriting entire collection all the time.
    await mongo.db.collection("CrashCollection").insertMany(simpleCrashDB);
  }
};
