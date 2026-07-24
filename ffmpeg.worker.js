var VERSION = "0.12.1";
var DEFAULT_CORE_URL = `https://unpkg.com/@ffmpeg/core@${VERSION}/dist/umd/ffmpeg-core.js`;

var MessageType;
(function (m) {
  m.LOAD = "LOAD";
  m.EXEC = "EXEC";
  m.WRITE_FILE = "WRITE_FILE";
  m.READ_FILE = "READ_FILE";
  m.DELETE_FILE = "DELETE_FILE";
  m.RENAME = "RENAME";
  m.CREATE_DIR = "CREATE_DIR";
  m.LIST_DIR = "LIST_DIR";
  m.DELETE_DIR = "DELETE_DIR";
  m.ERROR = "ERROR";
  m.DOWNLOAD = "DOWNLOAD";
  m.PROGRESS = "PROGRESS";
  m.LOG = "LOG";
})(MessageType || (MessageType = {}));

var UnknownMessageError = new Error("unknown message type");
var NotLoadedError = new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
var TerminatedError = new Error("called FFmpeg.terminate()");
var ImportError = new Error("failed to import ffmpeg-core.js");

var coreInstance = null;

var loadCore = async function ({ coreURL = DEFAULT_CORE_URL, wasmURL, workerURL } = {}) {
  var initial = !coreInstance;
  var coreScript = coreURL;
  var wasm = wasmURL || coreURL.replace(/.js$/g, ".wasm");
  var worker = workerURL || coreURL.replace(/.js$/g, ".worker.js");

  try {
    importScripts(coreScript);
  } catch (e) {
    var mod = await import(coreScript);
    if (!mod.default) throw ImportError;
    self.createFFmpegCore = mod.default;
  }

  coreInstance = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreScript}#${btoa(JSON.stringify({ wasmURL: wasm, workerURL: worker }))}`
  });

  coreInstance.setLogger(n => self.postMessage({ type: MessageType.LOG, data: n }));
  coreInstance.setProgress(n => self.postMessage({ type: MessageType.PROGRESS, data: n }));

  return coreInstance;
};

function exec({ args, timeout = -1 }) {
  coreInstance.setTimeout(timeout);
  coreInstance.exec(...args);
  var ret = coreInstance.ret;
  coreInstance.reset();
  return ret;
}

function writeFile({ path, data }) {
  coreInstance.FS.writeFile(path, data);
  return true;
}

function readFile({ path, encoding }) {
  return coreInstance.FS.readFile(path, { encoding });
}

function deleteFile({ path }) {
  coreInstance.FS.unlink(path);
  return true;
}

function rename({ oldPath, newPath }) {
  coreInstance.FS.rename(oldPath, newPath);
  return true;
}

function createDir({ path }) {
  coreInstance.FS.mkdir(path);
  return true;
}

function listDir({ path }) {
  var entries = coreInstance.FS.readdir(path);
  var result = [];
  for (var name of entries) {
    var stat = coreInstance.FS.stat(`${path}/${name}`);
    var isDir = coreInstance.FS.isDir(stat.mode);
    result.push({ name: name, isDir: isDir });
  }
  return result;
}

function deleteDir({ path }) {
  coreInstance.FS.rmdir(path);
  return true;
}

self.onmessage = async function ({ data: { id, type, data } }) {
  var transfer = [];
  var result;
  try {
    if (type !== MessageType.LOAD && !coreInstance) throw NotLoadedError;
    switch (type) {
      case MessageType.LOAD:
        result = await loadCore(data);
        break;
      case MessageType.EXEC:
        result = exec(data);
        break;
      case MessageType.WRITE_FILE:
        result = writeFile(data);
        break;
      case MessageType.READ_FILE:
        result = readFile(data);
        break;
      case MessageType.DELETE_FILE:
        result = deleteFile(data);
        break;
      case MessageType.RENAME:
        result = rename(data);
        break;
      case MessageType.CREATE_DIR:
        result = createDir(data);
        break;
      case MessageType.LIST_DIR:
        result = listDir(data);
        break;
      case MessageType.DELETE_DIR:
        result = deleteDir(data);
        break;
      default:
        throw UnknownMessageError;
    }
  } catch (err) {
    self.postMessage({ id: id, type: MessageType.ERROR, data: err.toString() });
    return;
  }

  if (result instanceof Uint8Array) transfer.push(result.buffer);
  self.postMessage({ id: id, type: type, data: result }, transfer);
};
