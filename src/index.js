'use strict';

let watchUrl = require('webpage-watch');
let cheerio = require('cheerio');
let _ = require('underscore');
let nodemailer = require('nodemailer');
let config = require('./config.json')


const CHAR_ID=config.CHAR_ID;
const COOKIES=config.COOKIES;
const API_ENDPOINT=CHAR_ID.map(charId => 'https://www.novaragnarok.com/?module=character&action=view&id='+charId+'&preferred_server=NovaRO');


const HEADERS = COOKIES.map(cookie => { 
	return {
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Encoding': 'gzip, deflate, sdch, br',
		'Accept-Language': 'en-IN,en-GB;q=0.8,en-US;q=0.6,en;q=0.4',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Cookie': cookie,
		'Host': 'www.novaragnarok.com',
		'Pragma': 'no-cache',
		'Referer': 'https://www.novaragnarok.com/?module=account&action=view',
		'Upgrade-Insecure-Requests': '1',
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
	};
});

let requestOpts = API_ENDPOINT.map((endPoint, index) => {
	return {
		url: endPoint,
		headers: HEADERS[index],
		gzip: true
	}
});

function extractInfo(htmlBody) {
	if(!htmlBody) {
		return undefined;
	}
	let regexSearch = htmlBody.match(/<th>Zeny<\/th>[^]*?<td colspan="2">(.*?)<\/td>/m);
	
	var $ = cheerio.load(htmlBody);
	let items=[];
	$('.normalslotted').parent('tr').each((index, value) => {
		let item={};
		item.itemName=$(value).children("td:nth-last-child(3)").text().replace(/\s+/g," ");
		item.itemQty=parseInt($(value).children("td:nth-last-child(2)").text().replace(/\s+/g," "));
		
		let inserted = _.findWhere(items, {itemName: item.itemName});
		if(!inserted) {
			items.push(item);
		}
		else {
			inserted.itemQty+=item.itemQty;
		}
		
	});

    if(!regexSearch || !regexSearch[1]) {
    	return undefined;
    }
 
    let newZeny = parseInt((regexSearch[1]||"").replace(/,/g,""));
    let vendorName = htmlBody.match(/<h3>Character Information for (.*?)<\/h3>/)[1];
    if(isNaN(newZeny)) {
    	return undefined;
    }
    else {
    	return {zeny: newZeny, items: items, vendorName: vendorName};
    }
}

function intimate(oldItems, newItems) {
	let message="";
	let subject=`Nova RO - Item Sold by ${newItems.vendorName}!!!`;
	if(oldItems === undefined) {
		message = `Stared Monitoring! Current Zeny ${newItems.zeny.toLocaleString()}!`;	
		subject=`Nova RO - Started Monitoring Vendor - ${newItems.vendorName}!!!`;
	}
	else if(newItems === undefined) {
		message = `Oops we got response as undefined. Something is wrong. Better have a look!`;
	}
	else {
		message = `Items Sold!!! Zeny Changed from ${oldItems.zeny.toLocaleString()} to ${newItems.zeny.toLocaleString()}. Gained ${(newItems.zeny-oldItems.zeny).toLocaleString()} Zeny!`;
		

		
		oldItems.items.forEach((oldItem) => {
			let newItem = _.findWhere(newItems.items, {itemName: oldItem.itemName});
			if(!newItem) {
				message += `\nSold ${oldItem.itemName} : ${oldItem.itemQty} ea`;
			}
			else if (newItem.itemQty != oldItem.itemQty) {
				message += `\nSold ${oldItem.itemName} : ${oldItem.itemQty - newItem.itemQty} ea`;
			}
		});
		

	}


	var from = config.GMAIL_USERNAME;
	var to = config.GMAIL_SENDTO;

	var smtpTransport = nodemailer.createTransport({
		service: "Gmail",
		auth: {
			user: config.GMAIL_USERNAME,
			pass: config.PASSWORD
		}
	});

	var mailOptions = {
		from: from,
		to: to, 
		subject: subject,
		text: message
	}
	

	smtpTransport.sendMail(mailOptions, function(error, response){
		
		console.log(message+"\n Notified via Email\n");
	});
}

const WATCH_FREQUENCY = 60000;

requestOpts.forEach(request => {
	watchUrl({requestOpts: request, frequency: WATCH_FREQUENCY, extractInfo: extractInfo, callback: intimate});
});
