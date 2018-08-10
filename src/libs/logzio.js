import Promise from 'bluebird';
import net from 'net';

export const processAll = async log => {
  const { logGroup, logStream, logEvents } = log;

  await new Promise((resolve, reject) => {
    const socket = net.connect(
      process.env.LOG_STASH_PORT,
      process.env.LOG_STASH_HOST,
      () => {
        socket.setEncoding('utf8');

        logEvents.forEach(logEvent => {
          try {
            let log = JSON.parse(logEvent.message);
            log.logStream = logStream;
            log.logGroup = logGroup;
            log.type = 'cloudwatch';
            log.token = process.env.LOG_ACCOUNT_TOKEN;

            socket.write(JSON.stringify(log) + '\n');
          } catch (err) {
            console.error(err.message);
          }
        });

        socket.end();
        resolve();
      }
    );
  });
};
