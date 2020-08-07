let AWS = require("aws-sdk");
let { v4: uuidv4 } = require('uuid');

//
//	Initialize Amazon Chime.
//
let chime = new AWS.Chime({
	apiVersion: '2018-05-01',
	region: process.env.AWS_REGION || 'us-east-1'
});

//
//	This lambda will create a Chime event, and send out the emails
//	with all the details.
//
exports.handler = (event) => {

	return new Promise(function(resolve, reject) {

		//
		//	1. This container holds all the data to be passed around the chain.
		//
		let container = {
			req: {},
			//
			//	The default response for Lambda.
			//
			res: {
                message: "OK"
            }
		}

		//
		//	->	Start the chain.
		//
		create_a_meeting(container)
			.then(function(container) {

				return step_two(container);

			}).then(function(container) {

				//
				//  ->  Send back the good news.
				//
				return resolve(container.res);

			}).catch(function(error) {

				//
				//	->	Stop and surface the error.
				//
				return reject(error);

			});
	});
};

//	 _____    _____     ____    __  __   _____    _____   ______    _____
//	|  __ \  |  __ \   / __ \  |  \/  | |_   _|  / ____| |  ____|  / ____|
//	| |__) | | |__) | | |  | | | \  / |   | |   | (___   | |__    | (___
//	|  ___/  |  _  /  | |  | | | |\/| |   | |    \___ \  |  __|    \___ \
//	| |      | | \ \  | |__| | | |  | |  _| |_   ____) | | |____   ____) |
//	|_|      |_|  \_\  \____/  |_|  |_| |_____| |_____/  |______| |_____/
//

//
//
//
function create_a_meeting(container)
{
	return new Promise(function(resolve, reject) {

        console.info("create_a_meeting");

		//
		//	1.	Prepare the query.
		//
		let params = {
			ClientRequestToken: uuidv4()
		};

		//
		//	-->	Execute the query.
		//
		chime.createMeeting(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			}

			console.log(JOSN.stringify(data, null, 4))

			//
			//	--> move to the next step.
			//
			return resolve(error);

		});

	});
}

//
//
//
function write_message(container)
{
	return new Promise(function(resolve, reject) {

		console.info("write_message");
		
		//
		//	1.	Convert the S3 payload in to a string and jsut use it as it is
		//		since we don't need anything fancy for ourselfs.
		//
		let user_details = JSON.stringify(container.user_details, null, 4);
		
		//
		//	2.	Prepare the data to be replaced.
		//
		let data = {
			user_details: user_details
		}

		//
		//	3.	Render the message.
		//
		let message = mustache.render(container.templates.organizer.text, data);

		//
		//	4.	Save it for the next promise.
		//
		container.message.organizer = {
			subject: container.templates.organizer.subject,
			body: message,
			emails: {
				to: {
					name: "David To",
					email: "null+to@0x4447.email"
				},
				cc: {
					name: "David CC",
					email: "null+cc@0x4447.email"
				}
			}
		}

		//
		//	->	Move to the next promise.
		//
		return resolve(container);
		
	});
}