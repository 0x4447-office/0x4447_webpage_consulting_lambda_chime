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

        //
        //  1.  Escape the content of the request.
        //
        let body = JSON.parse(event.body);

        //
        //	2. This container holds all the data to be passed around the chain.
        //
        let container = {
            req: {
                start_time: body.payload.event.start_time,
                end_time: body.payload.event.end_time,
                first_name: body.payload.invitee.first_name,
                name: body.payload.invitee.name,
                email: body.payload.invitee.email
            },
            templates: templates,
            message: null,
            //
            //	The default response for API Gateway.
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
//  Based on the received information we build out the iCal file to be
//  attached in the email.
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
            name: "0x4447",
            timezone: 'Europe/Berlin'
        });

        //
        //	2.	Set some basic info about the file.
        //
        cal.prodId({
            company: '0x4447',
            product: 'Meeting',
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
            description: description
        });

        //
        //	6.	Add all the atendees of the meeting.
        //
        event.createAttendee({ email: 'meet@chime.aws', name: 'Chime' });
        event.createAttendee({ email: 'pin+0000001@chime.aws', name: 'PIN' });

        //
        //  7. Add details about the invitee.
        //
        event.createAttendee({
            email: container.req.email,
            name: container.req.name
        });

        //
        //	8.	Set when the callendar app should notificy about the event.
        //
        event.createAlarm({
            type: 'audio',
            trigger: 300 * 6, // 30min before event
        });

        //
        //	9.	Convert the file in to a Base64 so we can attach it to the
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
//  Compose the email message with the iCal attachemtn.
//
function write_message(container)
{
    return new Promise(function(resolve, reject) {

        console.info("write_message");

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
                    content: container.ics,
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

//
//  Once the email message is ready we save it in to S3 so it can be picked up
//  by another lambda and be sent.
//
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
