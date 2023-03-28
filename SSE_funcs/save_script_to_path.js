const 	enigma 		= require('enigma');
const 	schema 		= require('enigma/schemas/12.20.0.json');

const 	q 			= require('qlik-sse');					// Внешний модуль (требует отдельной установки) для поддержки SSE на основе node.js
const 	fs 			= require("fs");						// Стандартный модуль для операций с файловой системой.
const 	WebSocket 	= require('ws');
const 	ini 		= require("ini");						// Внешний модуль (требует отдельной установки) для получения параметров приложения из ini файла.

const 	config 												= ini.parse(fs.readFileSync("./njs_qcb_qlik_sse_master.ini", "utf-8"));		// Считываем содержимое ini файла.	

const 	qs_api_qrs_request_option_cert_path 				= config.qs_api_qrs_request_option_cert_path;
const 	qs_api_wss_request_url								= config.qs_api_wss_request_url;

const 	qs_api_qrs_request_option_UserDirectory				= config.qs_api_qrs_request_option_UserDirectory;
const 	qs_api_qrs_request_option_UserId					= config.qs_api_qrs_request_option_UserId;

try {
	var certificates = {
		cert:	fs.readFileSync(qs_api_qrs_request_option_cert_path + 'client.pem'),
		key: 	fs.readFileSync(qs_api_qrs_request_option_cert_path + 'client_key.pem'),
		root:	fs.readFileSync(qs_api_qrs_request_option_cert_path + 'root.pem')
	};
}
catch (error) {
	console.log(error);
}

const functionConfig = {
    name: 'save_script_to_path',
    functionType: q.sse.FunctionType.SCALAR,
    returnType: q.sse.DataType.STRING,
    params: [
      {
        name: 'app_id',
        dataType: q.sse.DataType.STRING,
      },
	  {
		name: 'path_to_save',
		dataType: 	q.sse.DataType.STRING,
	  }
    ],
  }

async function sv_scr_to_pth (app_id, path_to_app) {
	return await new Promise(function (resolve, reject) {
		try {
			
			if (!app_id || !path_to_app) { resolve("No input data"); }
			const session = enigma.create({
				schema,
				url: qs_api_wss_request_url,
				createSocket: url => new WebSocket(qs_api_wss_request_url + app_id, {
								ca: 	certificates.root,
								cert: 	certificates.cert,
								key: 	certificates.key,
								headers: {
									'X-Qlik-User': 	'UserDirectory= ' + qs_api_qrs_request_option_UserDirectory + '; ' + 'UserId= ' + qs_api_qrs_request_option_UserId,
								}
							})	
			});

			(async () => {
				try {
					
					const global = await session.open(); 
					
					const doc = await global.openDoc(app_id);
					//console.log('APP_ID ======== ', doc.id);

					const getscript = await doc.getScript({});
					//console.log('getScript ======== ', JSON.stringify(getscript));
					
					const applayouts = await doc.getAppLayout({});
					//console.log('APP_NAME ======== ', applayouts.qTitle);

					//SAVE TO FILE.TXT
					fs.writeFile(path_to_app + applayouts.qTitle + '.txt', getscript, function(err){
						if(err) {
							session.close();
							throw err;
							}						
					});
					
					/*
					var data = fs.readFileSync(path_to_app + applayouts.qTitle + '.txt', "utf8");
					console.log(data);  // выводим считанные данные
					//const setscript = 
					await doc.setScript({
						"qScript": data + '//data2'//getscript
						});
						//console.log('setscript ======== ', setscript);
					*/
					
					await session.close();
					resolve('The script from "' + applayouts.qTitle + '.qvf" has been successfully saved to the "' + path_to_app + applayouts.qTitle + '.txt"');
				} catch (err) {
					await session.close();
					resolve('err_res ' + String(err));
				}
			})();

		}
		catch (error) {
			console.log(error);
			resolve(error.stack);
		} 
});	
} 

const functionDefinition = async function save_script_to_path(request) {
    request.on('data', async (bundle) => {
      try {
        const 	rows 		= [];
		var 	response;
		var 	str_01, 
				str_02,
				str_11,
				str_12;
		var 	rows_0		= [], 
				rows_1		= [];
		var 	app_id,
				path_to_save;

		bundle.rows.forEach((row) => {				
			str_01 = row.duals[0].strData;
			str_02 = str_01 + '';		  
			rows_0.push(str_02);				
			
			str_11 = row.duals[1].strData;
			str_12 = str_11 + '';		  
			rows_1.push(str_12);
		});

		app_id = rows_0.join('');
		path_to_save = rows_1.join('');
		
		response = await sv_scr_to_pth(app_id, path_to_save);
		rows.push({
			duals: [{ strData: response}]
		});			
		
        request.write({
          rows
        });
		request.end();
      }
      catch (error) {
        console.log(error);
      }      
    });
  }

module.exports = {
  functionDefinition,
  functionConfig
};

//==============================================================================================================================

