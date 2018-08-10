const LogLevels = {
  TRACE: 0,
  INFO: 1,
  DEBUG: 2,
  WARN: 3,
  ERROR: 4
};

// default to debug if not specified
const logLevelName = process.env.LOG_LEVEL || 'DEBUG';

function isEnabled(level) {
  return level >= LogLevels[logLevelName];
}

function appendError(params, err) {
  if (!err) {
    return params;
  }

  return Object.assign(params || {}, {
    errorName: err.name,
    errorMessage: err.message,
    stackTrace: err.stack
  });
}

function log(levelName, message, params) {
  if (!isEnabled(LogLevels[levelName])) {
    return;
  }

  let logMsg = Object.assign({}, params);
  logMsg.level = levelName;
  logMsg.message = message;

  console.log(JSON.stringify(logMsg));
}

const logger = {
  trace: (msg, params) => log('TRACE', msg, params),
  debug: (msg, params) => log('DEBUG', msg, params),
  info: (msg, params) => log('INFO', msg, params),
  warn: (msg, params, error) => log('WARN', msg, appendError(params, error)),
  error: (msg, params, error) => log('ERROR', msg, appendError(params, error))
};

export default logger;
