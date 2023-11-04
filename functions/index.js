const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { setGlobalOptions } = require("firebase-functions/v2");

const { google } = require("googleapis");
const sheets = google.sheets("v4");

const cors = require("cors")({ origin: true });

setGlobalOptions({ maxInstances: 10 });

const inputSpreadsheetId = "12tJswNTkkCPGtFsG7yx5--Q3SCQrZ530_6xN7Ze2uyE";
const outputSpreadsheetId = "1ARB4tFYmGC_Wa_kd1VEAIwPrhdwvwcZcpAqDd1Zo0IU";

exports.sheetsBridge = onRequest(async (req, res) => {
	cors(req, res, async () => {
		switch (req.body.data?.action) {
			case "visit": {
				await handleVisit(res);
			}
			case "choose": {
				const { pairIdx, colorIdx } = req.body.data;
				await handleChoose(+pairIdx, +colorIdx, res);
			}
			default: {
				res.status(400).send("Invalid input");
			}
		}
	})
});

async function handleVisit(res) {
	const auth = await google.auth.getClient();
	const inputTable = await readInputTable(auth);

	// selecting a row with the least "selected" value
	let targetRow = null
	let targetRowIdx = null
	for (let i = 1; i < inputTable.length; i++) {
		const row = inputTable[i];
		if (!targetRow || +row[1] < +targetRow[1]) {
			targetRowIdx = i - 1;
			targetRow = row;
		}
	}

	// incrementing "appeared" value
	setColumn(`C${targetRowIdx + 2}`, +targetRow[2] + 1,
		inputSpreadsheetId, auth);

	// sending colors to the client
	res.status(200).json({
		data: {
			pairIdx: targetRowIdx,
			colors: [
				targetRow[3],
				targetRow[4]
			],
		}
	});
}

async function handleChoose(pairIdx, colorIdx, res) {
	const auth = await google.auth.getClient();
	const inputTable = await readInputTable(auth);
	const outputTable = await readOutputTable(auth);

	const targetRow = inputTable[pairIdx + 1];
	if (![0, 1].includes(colorIdx))
		res.status(400).send("Invalid choice index");
	const chosenColor = targetRow[3 + colorIdx];

	// incrementing "selected" value
	setColumn(`B${pairIdx + 2}`, +targetRow[1] + 1,
		inputSpreadsheetId, auth);

	// finding the color row in the output table
	let colorChosenCount = 0;
	let outputRowIdx = null;
	for (let i = 1; i < outputTable.length; i++) {
		const row = outputTable[i];

		if (row[0] == chosenColor) {
			colorChosenCount = +row[1];
			outputRowIdx = i - 1;
			break;
		}
	}

	// updating output table
	if (outputRowIdx === null) outputRowIdx = outputTable.length - 1;
	insertTable(
		`A${outputRowIdx + 2}`,
		[[chosenColor, colorChosenCount + 1]],
		outputSpreadsheetId,
		auth
	);

	res.status(200).json({
		data: {
			ok: true
		}
	});
}

async function readInputTable(auth) {
	const response = await sheets.spreadsheets.values.get({
		auth,
		spreadsheetId: inputSpreadsheetId,
		range: "A1:E",
	});

	return response.data.values;
}

async function readOutputTable(auth) {
	const response = await sheets.spreadsheets.values.get({
		auth,
		spreadsheetId: outputSpreadsheetId,
		range: "A1:B",
	});

	return response.data.values;
}

function setColumn(colAddr, value, spreadsheetId, auth) {
	insertTable(colAddr, [[value]], spreadsheetId, auth)
}

function insertTable(addr, subtable, spreadsheetId, auth) {
	sheets.spreadsheets.values.update({
		auth,
		spreadsheetId,
		range: addr,
		valueInputOption: 'RAW',
		resource: { values: subtable },
	});
}