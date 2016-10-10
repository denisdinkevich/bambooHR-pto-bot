'use strict';
const request = require('request-promise-native')
const Botkit = require('botkit')
const parseXml = require('xml2js').parseString
const moment = require('moment')
require('moment-range')
const find = require('lodash.find')
const controller = Botkit.slackbot({})

const bot = controller.spawn({
    incoming_webhook: {
        url: process.env.SLACK_WEBHOOK
    }
})

function whosOut() {
const date = new Date()
    console.log('Whos out running\nCurrent time is: '+ date.getHours() + ':' + date.getMinutes())

    const options = {
        url: 'https://' + process.env.BAMBOOHR_TOKEN + ':x@api.bamboohr.com/api/gateway.php/' + process.env.BAMBOOHR_SUBDOMAIN + '/v1/time_off/whos_out/?start=2016-09-1&end=2016-12-31'
    }

    request(options).then(function(xml) {
        parseXml(xml, function(err, result) {
	console.log('=============RESULT\n',result)
            const requestResult = []
            const holiResult = []
                //Setting week start to Monday
            const weekStart = moment().startOf('isoweek')
                //Setting week end to Friday
            const weekEnd = moment().endOf('isoweek').subtract('2', 'days')
            const thisWeekRange = moment.range(weekStart, weekEnd)
            const nextWeekRange = moment.range(weekStart.add('1', 'weeks'), weekEnd.add('1', 'weeks'))
            for (let i = 0; i < result.calendar.item.length; i += 1) {
                console.log('LOOPING', result.calendar.item);
                const index = result.calendar.item[i]
                const startDate = moment(index.start[0])
                const endDate = moment(index.end[0])
                const entryRange = moment.range(startDate, endDate)

                if (index.$.type === 'holiday') {
                  // console.log('Found a holiday, somewhere, at index:', index);

                    const holidayObj = {
                        name: index.holiday[0]._,
                        days: []
                    }

                    const holiRangeArray = moment.range(startDate, endDate).toArray('days')

                    if (entryRange.overlaps(thisWeekRange)) {
                      // console.log('Holiday overlaps with week!');

                        for (var k = 0; k < holiRangeArray.length; k += 1) {
                            holidayObj.days.push(holiRangeArray[k].format('MM/DD'))
                        }
                        holiResult.push(holidayObj)
                        continue
                    }
                } else {
                  // console.log('This index is not a holiday. Index:', index);

                    const resObj = {
                        name: index.employee[0]._,
                        days: []
                    }

                    if (entryRange.overlaps(thisWeekRange)) {
                      // console.log('This non-holiday entry overlaps with this week!');

                        const daysOffArrayThisWeek = thisWeekRange.intersect(entryRange).toArray('days')
                        for (let j = 0; j < daysOffArrayThisWeek.length; j += 1) {

                            resObj.days.push(daysOffArrayThisWeek[j].format('dddd'))
                        }
                    if (entryRange.overlaps(nextWeekRange)) {
                      // console.log('This non-holiday entry overlaps with next week!');

                        const daysOffArrayNextWeek = nextWeekRange.intersect(entryRange).toArray('days')
                        for (let j = 0; j < daysOffArrayNextWeek.length; j += 1) {

                            resObj.days.push(daysOffArrayNextWeek[j].format('dddd'))
                        }

                        const found = find(requestResult, {
                                'name': resObj.name
                            })
                            //if user found, add days to their object
                        if (found) {
                            found.days = found.days.concat(resObj.days)
                        }
                        //If user not found, push new user object into array
                        else {
                            requestResult.push(resObj)
                        }
                    }
                }
            } // end for loop
            // console.log('requestResult.length ===', requestResult.length);
            // console.log('holiResult.length ===', holiResult.length);
            if (requestResult.length > 0 && holiResult.length > 0) {
              // console.log('Requests and holdays!');
                bot.sendWebhook({
                    text: 'Week of ' + weekStart.format('MM/DD') + '-' + weekEnd.format('MM/DD') + '\n' + 'Scheduled to be out:\n' + formatArrayToString(requestResult) + '\n' + '🎉Company Holidays this week🎉:\n' + formatArrayToString(holiResult),
                    channel: process.env.SLACK_CHANNEL,
                    username: 'Who\'s Out?',
                    icon_emoji: ':date:'
                }, function(err) {
                    if (err) {
                        console.log(err)
                    } else console.log('message sent!');
                });
            } else if (requestResult.length > 0 && holiResult.length < 1) {
              // console.log('Requests and no holdays!');

                bot.sendWebhook({
                    text: 'Week of ' + weekStart.format('MM/DD') + '-' + weekEnd.format('MM/DD') + '\n' + 'Scheduled to be out:\n' + formatArrayToString(requestResult),
                    channel: process.env.SLACK_CHANNEL,
                    username: 'Who\'s Out?',
                    icon_emoji: ':date:'
                }, function(err) {
                    if (err) {
                        console.log(err)
                    } else console.log('message sent!');
                })
            } else if (requestResult.length < 1 && holiResult.length > 0) {
              // console.log('No requests and some holdays!');

                bot.sendWebhook({
                        text: 'Week of ' + weekStart.format('MM/DD') + '-' + weekEnd.format('MM/DD') + '\n' + 'Nobody scheduled to be out this week!\n' + '🎉 Company Holidays this week 🎉' + formatArrayToString(holiResult),
                        channel: process.env.SLACK_CHANNEL,
                        username: 'Who\'s Out?',
                        icon_emoji: ':date:'
                    }, function(err) {
                        if (err) {
                            console.log(err)
                        } else console.log('message sent!');
                    }

                )
            } else if (requestResult.length < 1 && holiResult.length < 1) {
              // console.log('No requests and no holdays!');

                bot.sendWebhook({
                        text: 'Week of ' + weekStart.format('MM/DD') + '-' + weekEnd.format('MM/DD') + '\n' + 'Nobody scheduled to be out this week!',
                        channel: process.env.SLACK_CHANNEL,
                        username: 'Who\'s Out?',
                        icon_emoji: ':date:'
                    }, function(err) {
                        if (err) {
                            console.log(err)
                        } else console.log('message sent!');
                    }

                )
            }

        })
    })
}


function formatArrayToString(array) {
    if (array.length < 1) {
        console.log('formatArray needs an array with a length greater than 0!')
        return
    }
    let resultArr = []
    for (let i = 0; i < array.length; i += 1) {
        let newArr = []
        newArr.push('>' + '*' + array[i].name + '*')
        newArr.push('_' + array[i].days.join(', ') + '_')
        newArr = newArr.join(': ')
        resultArr.push(newArr)
    }
    return resultArr.join('\n')
}

module.exports = whosOut
