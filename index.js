let AWS = require("aws-sdk");
let ical = require('ical-generator');
let mustache = require('mustache');

//
//	Bringing S3 to life.
//
let s3 = new AWS.S3({
	apiVersion: '2006-03-01'
});

//
//	Load all the email templates.
//
let templates = require('./assets/templates/index');

//
//	This lambda will create a Chime event, and send out the emails
//	with all the details.
//
exports.handler = (event) => {

	return new Promise(function(resolve, reject) {

        console.log(JSON.stringify(event, null, 4))

		//
		//	1. This container holds all the data to be passed around the chain.
		//
		let container = {
			req: {
                emails: [],
                agenda: "",
                first_name: "Bob",
                start_time: "2020-10-05T00:00:00Z",
                end_time: "2020-10-05T01:00:00Z"
            },
            templates: templates,
            message: null,
			//
			//	The default response for Lambda.
			//
			res: {
                statusCode: 200
            }
		}

		//
		//	->	Start the chain.
		//
		build_out_the_ical_file(container)
			.then(function(container) {

				return write_message(container);

			}).then(function(container) {

				return send_email(container);

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
function build_out_the_ical_file(container)
{
	return new Promise(function(resolve, reject) {

		console.info("build_out_the_ical_file");

		//
		//	1.	Initialize iCal
		//
		let cal = ical({
			domain: '0x4447.com',
			prodId: {
				company: '0x4447.com',
				product: 'meeting'
			},
			name: "0x4447",
			timezone: 'Europe/Berlin',

		});

		//
		//	2.	Set some basic info about the file.
		//
		cal.prodId({
			company: '0x4447',
			product: 'meeting',
			language: 'EN'
        });

        //
		//	3.	Create the description of the iCal file.
		//
		let description = container.templates.calendar.text;

		//
		//	4.	Set the bulk of the event with all the data.
		//
		let event = cal.createEvent({
			start: container.req.start_time,
			end: container.req.end_time,
			summary: container.req.first_name + " & David",
			description: description,
			organizer: 'David Gatti <david@0x4447.com>'
		});

		//
		//	6.	Add all the atendees of the meeting.
		//
		event.createAttendee({ email: 'meet@chime.aws', name: 'Chime' });
		event.createAttendee({ email: 'pin+3581170376@chime.aws', name: 'PIN' });

        // event.createAttendee({
		// 	email: container.user_details.email,
		// 	name: container.user_details.full_name,
		// 	rsvp: true
		// });

		//
		//	7.	Set when the callendar app should notificy about the event.
		//
		event.createAlarm({
			type: 'audio',
			trigger: 300 * 6, // 30min before event
		});

		//
		//	8.	Convert the file in to a Base64 so we can attach it to the
		//		email message payload.
		//
		container.ics = Buffer.from(cal.toString()).toString('base64');

		//
		//	->	Move to the next promise.
		//
		return resolve(container);


	});
}

//
//
//
function write_message(container)
{
	return new Promise(function(resolve, reject) {

		console.info("write_message");

        console.log(container.ics)

		//
		//	4.	Save it for the next promise.
		//
		container.message = {
			subject: container.templates.calendar.subject,
			body: "See atachement.",
			emails: {
				to: {
					name: "David Gatti",
					email: "david@0x4447.com"
				}
			},
			attachments: [
				{
					filename: 'event.ics',
					content: container.ics.toString('base64'),
					encoding: 'base64'
				}
			]
		}

		//
		//	->	Move to the next promise.
		//
		return resolve(container);

	});
}

function send_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("send_email");

		//
		//	1.	Prepare the query.
		//
		let params = {
			Bucket: '0x4447-web-us-east-1-smtp',
			Key: Date.now() + '.json',
			Body: JSON.stringify(container.message)
		};

		//
		//	-> Execute the query.
		//
		s3.putObject(params, function (error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				console.info(params);
				return reject(error);
			}

			//
			//	->	Move to the next promise.
			//
			return resolve(container);

		});

	});
}
