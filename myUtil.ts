const fs = require('fs');
type saveAsJson = (data: object, filemane: string) => void;
export const saveAsJson: saveAsJson = (data: object, filename: string) => {
    fs.writeFileSync(
        `./JSON/${filename}.json`,
        JSON.stringify(data, null, 4),
        'utf8'
    );
};
