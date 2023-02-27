const fs = require('fs');
const axios = require('axios');

const fetch = async  (filePath:string,url:string) => {
    const response = await axios.get(url, {responseType:"arraybuffer"})
    const binary = Buffer.from(response.data, 'binary');
    fs.writeFileSync(
        filePath,
        binary,
        'binary'
    );
};

export default fetch;
