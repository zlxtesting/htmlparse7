'use strict';

const fs = require('fs');
const format = require('human-format');
const promisifyEvent = require('promisify-event');
const memwatch = require('memwatch-next');
const SAXParser = require('../../lib').SAXParser;

function parse() {
    const data = fs.readFileSync('test/data/huge-page/huge-page.html');
    let parsedDataSize = 0;
    const stream = new SAXParser();

    for (let i = 0; i < 400; i++) {
        parsedDataSize += data.length;
        stream.write(data);
    }

    stream.end();

    return promisifyEvent(stream, 'finish').then(() => {
        return parsedDataSize;
    });
}

function getDuration(startDate, endDate) {
    const scale = new format.Scale({
        seconds: 1,
        minutes: 60,
        hours: 3600
    });

    return format((endDate - startDate) / 1000, { scale: scale });
}

function printResults(parsedDataSize, startDate, endDate, heapDiff, maxMemUsage) {
    console.log('Input data size:', format(parsedDataSize, { unit: 'B' }));
    console.log('Duration: ', getDuration(startDate, endDate));
    console.log('Memory before: ', heapDiff.before.size);
    console.log('Memory after: ', heapDiff.after.size);
    console.log('Memory max: ', format(maxMemUsage, { unit: 'B' }));
}

(function() {
    let parsedDataSize = 0;
    let maxMemUsage = 0;
    let startDate = null;
    let endDate = null;
    const heapDiffMeasurement = new memwatch.HeapDiff();
    let heapDiff = null;

    memwatch.on('stats', stats => {
        maxMemUsage = Math.max(maxMemUsage, stats['current_base']);
    });

    startDate = new Date();

    const parserPromise = parse().then(dataSize => {
        parsedDataSize = dataSize;
        endDate = new Date();
        heapDiff = heapDiffMeasurement.end();
    });

    Promise.all([
        parserPromise,
        promisifyEvent(memwatch, 'stats') // NOTE: we need at least one `stats` result
    ]).then(() => {
        return printResults(parsedDataSize, startDate, endDate, heapDiff, maxMemUsage);
    });
})();
