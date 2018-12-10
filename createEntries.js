const c2j = require('csvtojson');
const fs = require('fs');

//----- Settings -----
const sex = 'boy'; // 'boy' or 'girl'
const dataType = 'wtageinf';
const outputStartDay = 0;
const outputEndDay = 500;
const targetPercentile = 'P50'; //['P3', 'P5', 'P10', 'P25', 'P50', 'P75', 'P90', 'P95', 'P97']
const variancePercent = 5;
const entryReliability = 80;
const dataSource = `./sources/${dataType}-${sex}.csv`;


function createEntry(day, initalValue, modifier) {
    const randomAdjustment = ((Math.random() * modifier) - (modifier / 2)) / 100
    const finalValue = initalValue + (initalValue * randomAdjustment)
    return {
        daysOld: day,
        baseValue: initalValue,
        value: finalValue
    }
}

function getJsonData(dataSource) {
    return new Promise((resolve, reject) => {
        c2j()
        .fromFile(dataSource)
        .then((jsonData) => {
            resolve(jsonData.map((row) => {
                return createEntry(row['Agemos'] * 30, Number(row[targetPercentile]), variancePercent);
            }));
        })
    })

}

function interpolateData(baseData) {
    const dataToReturn = [];
    const finalDay = baseData[baseData.length - 1].daysOld;
    const variancePercentModified = variancePercent / 4;
    for (i = 0; i < baseData.length; i++) {
        dataToReturn.push(baseData[i]);
        const startDay = baseData[i].daysOld;
        if (startDay === finalDay) {
            break;
        }
        const dayRange = baseData[i + 1].daysOld - startDay;
        let day = 1
        while (day < dayRange) {
            if (Math.random() <= entryReliability / 100){
                dataToReturn.push(
                    createEntry(startDay + day, baseData[i].value + ((baseData[i + 1].value - baseData[i].value) * (day / dayRange)), variancePercentModified)
                );                
            }
            day++
        }
    }
    return dataToReturn.filter((entry) => {
        return entry.daysOld >= outputStartDay && entry.daysOld <= outputEndDay;
    });
}

function convertKgToGrams(entry) {
    return {
        ...entry,
        baseValue: Math.round(entry.baseValue * 1000),
        value: Math.round(entry.value * 1000)
    }
}

function getDates(data) {
    const currentDaysOld = data[data.length - 1].daysOld;
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - currentDaysOld);

    return data.map((entry) => {
        const entryDate = new Date(startDate.getTime());
        entryDate.setDate(entryDate.getDate() + entry.daysOld);
        return { ...entry, date: entryDate.toISOString() }
    })
}

(async () => {
    const baseData = await getJsonData(dataSource);
    const dailyData = interpolateData(baseData);
    const convertedData = dailyData.map((entry) => {
        return convertKgToGrams(entry);
    })
    const dataWithDates = getDates(convertedData);
    await fs.writeFile(`./output/entries-${targetPercentile}-${outputStartDay}-${outputEndDay}.json`, JSON.stringify(dataWithDates), 'utf8', () => {
        console.log('File Saved');
    });
})();
