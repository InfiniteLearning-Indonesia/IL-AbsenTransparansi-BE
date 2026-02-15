const base = require('../config/airtable');

const fetchTableData = (tableName) => {
    return new Promise((resolve, reject) => {
        const records = [];

        // Using select().eachPage() for pagination
        base(tableName).select({
            // view: "Grid view" // Removed to avoid error if view doesn't exist
        }).eachPage(function page(pageRecords, fetchNextPage) {
            records.push(...pageRecords);
            fetchNextPage();
        }, function done(err) {
            if (err) {
                return reject(err);
            }
            resolve(records);
        });
    });
};

module.exports = {
    fetchTableData
};
