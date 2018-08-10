import Promise from 'bluebird';
import net from 'net';
import logger from '../libs/log';

export const processAll = async log => {
  const { logGroup, logStream, logEvents } = log;

  await new Promise((resolve, reject) => {
    const socket = net.connect(
      process.env.DATA_DOG_PORT,
      process.env.DATA_DOG_HOST,
      () => {
        logger.trace('connection success');
        socket.setEncoding('utf8');

        logEvents.forEach(logEvent => {
          try {
            let log = JSON.parse(logEvent.message);
            log.logStream = logStream;
            log.logGroup = logGroup;
            log.type = 'cloudwatch';
            const logData = `${process.env.DATA_DOG_API_KEY} ${JSON.stringify(
              log
            )}\n`;
            socket.write(logData);
          } catch (err) {
            logger.error(err.message, null, err);
          }
        });

        socket.end();
        resolve();
      }
    );
  });
};
