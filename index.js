const puppeteer = require('puppeteer');
const readline = require('readline');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const { email, password } = require('./env.js');
let productURL;

const askQuestion = (query) => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise(resolve => {
		rl.question(query, ans => {
			rl.close();
			resolve(ans);
		});
	});
}

const correctTime = (t) => {
	console.log(`time: ${t}`);
	if (!isNaN(parseInt(t)) && parseInt(t) >= 0) return `/${t}`;
	else return '';
}

const onlyNumber = (t) => {
	return (t === '') ? 0 : t.replace('/', '');
}

const getPrice = async (page) => {
	let price;
	try {
		price =	await page.$eval("#price_inside_buybox",
			(el) => el.innerHTML
		);

		return price;
	} catch (e) {
		console.log('Sorry there was an error with the product, you can choose another or exit');

		const answer = await askQuestion('If you don\'t want to track another product, write exit: ');

		if (answer.match('exit')) process.exit(1);

		productURL = answer;
		await page.goto(answer);
		price = await page.$eval("#price_inside_buybox",
			(el) => el.innerHTML
		);

		return price;
	}
}

/*
https://www.amazon.com/-/es/computadora-electr%C3%B3nicos-ergon%C3%B3mica-reposapi%C3%A9s-reposacabezas/dp/B08HN1NPGZ/ref=sr_1_13?dchild=1&keywords=gaming%2Bchairs&pd_rd_r=40692d6e-2e32-4f7e-b35f-0b26729f163b&pd_rd_w=enaqu&pd_rd_wg=9M6e8&pf_rd_p=0876ea35-294d-4c10-b82b-ef77adfac50a&pf_rd_r=ZJR68RPXE9QFNBSVE829&qid=1623765797&sr=8-13&th=1
https://www.amazon.com/Sony-Noise-Cancelling-Headphones-WH1000XM3/dp/B07G4MNFS1/
*/
(async () => {
	const bw = await puppeteer.launch({
		headless: true,
		devtools: false,
		defaultViewport: null,
	});
	const az = await bw.newPage();

	productURL = await askQuestion('URL product: ');
	await az.goto(productURL);

	let period;

	console.log("\nDefault is 1 min");
	do {
		console.log("Refreshing time ->");
		console.log('\t- s (seconds)\n\t- m (minutes)\n\t- h (hours)\n\t- d (days)\n\t- mo (months)\n\t- def (default)\n');

		period = await askQuestion('Period time: ');
	} while (period !== 's' && period !== 'm' && period !== 'h' && period !== 'd' && period !== 'mo' && period !== 'def');

	let time = correctTime(await askQuestion('period to refresh: '));

	let timeRefresh = '* * * * *';
	if (period === 's') timeRefresh = `*${time} * * * * *`;
	else if (period === 'm') timeRefresh = `*${time} * * * *`;
	else if (period === 'h') timeRefresh = `* *${time} * * *`;
	else if (period === 'd') timeRefresh = `* * *${time} * *`;
	else if (period === 'mo') timeRefresh = `* * * *${time} *`;

	let price = await getPrice(az);

	console.log(`Price now (${new Date()})\n\t`, price.replace("&nbsp;", " ").replace("\n", ""));

	console.log(cron.validate(timeRefresh));
	console.log(timeRefresh);

	// to display 0 instead of nothing
	time = onlyNumber(time);

	const wantedPrice = await askQuestion('At what price do you want to be notificated? ')

	let transporter = nodemailer.createTransport({
		service: "outlook",
		auth: {
			user: email,
			pass: password,
		},
	});

	cron.schedule(timeRefresh, async () => { 
		// await az.reload();
		await az.goto(productURL);

		price = await getPrice(az);
		price = price.replace("&nbsp;", " ").replace("\n", "");
		let date = new Date();

		console.log(`Price after ${time}${period}\n(${date})\n\t`, price);

		if (Number(wantedPrice) >= Number(price.replace(/[^0-9.-]+/g, ""))) {
			let textToSend = 'Price dropped to ' + price;
			let htmlText = `<p>Price dropped to ${price} (${date})</p><a href=\"${productURL}\">Link</a>`;

	    let info = await transporter.sendMail({
	      from: `"Price Tracker" <${email}>`,
	      to: email,
	      subject: 'Price dropped to ' + price,
	      text: textToSend,
	      html: htmlText
	    });

			console.log("Message sent: %s", info.messageId);
		}
	});
})();
