import fetch from "./fetch";

const url = 'https://cdn.discordapp.com/attachments/1032042326782124072/1055161621716140073/feneara_shiko_caption.JPG';

const fileName = url.split('/').pop();
const filePath = `./${fileName}`;

fetch(filePath, url);
