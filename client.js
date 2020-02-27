//connect to the server address and port
const host = '127.0.0.1', port = 9889
//sleep function for delaying the execution
var sleep = require('system-sleep');
//crc library
var crc16 = require('node-crc-itu');
let net = require('net');
//fix the device kind and time zones
//imei is of 15 length so it should add a padded 0
const IMEI = '0351608080779288', deviceKind = '2203', timeZone = '3201'
//some variable for keeping track of execution of the program and socket connection for client
let timeOutCount = -1, client = new net.Socket(), lastPacket = 1;
//some utility variables for taking care of order of execution of program
let connected=false,response=false,responseRequired=true
//printing to simulate GPRS Connection
console.log('Connected to GPRS')
//lets make a dummy error handling listner so that the program may not crash abruptly on errors
client.on('error', err => client.destroy())
//assume the serial of the device
let serial=['04','AA'],repeater
//start the connection with the server
const init=()=>{
    client.connect(port, host, function () {
        console.log('Connected to Adapter/Server/Platform');
        connected=true
    });

}
//event listener for handling data entered into the socket
client.on('data', data=> {
    console.log('Received: ' + data);
    parser(data.toString())
});
//on closing the connection retry until a count then reboot if still fails
client.on('close',  ()=> {
    // console.log('Connection closed');
    nextFunctionFail()
    setTimeout(nextFunctionFail, 5000);
});
//parser function for packet
const parser = packet => {
    response=true
    //check if the packet received have a ending flag if not then return INVALID PACKET ERROR
    if (packet.indexOf('0D 0A') == -1){
        console.log('End Mismatch. Packet Discarded')
        // nextFunctionFail()
    }
    //Remove the spaces at the beginning and ending of the packet
    packet = packet.trim();
    //split the packet frames
    packet = packet.split(' ')
    //checking if the packet has starting frames
    if ((packet[0] == '78' && packet[1] == '78') || (packet[0] == '79' && packet[0] == '79'))
        //if starting frames and ending frames are present process the packet
        processPacket(packet);
    else {
        console.log('start mismatch. Packet Discarded')
        // nextFunctionFail()
    }
}
//process the packet
const processPacket = (frame) => {
    //remove the packet ending flag values
    frame=frame.slice(0,frame.length-2)
    //extract the blocks inside the packet
    let packetLength = frame[2],
        protocolNumber = frame[3],
        information = frame.slice(4, frame.length - 4),
        informationSerial = [frame[frame.length - 4], frame[frame.length - 3]],
        errorCheck = [frame[frame.length - 2], frame[frame.length - 1]]
    information
    //discard the packet if crc does not match with error bits
    if (paddZerosHexString(crc16('' + packetLength + protocolNumber + information.join('') + informationSerial.join('')).toUpperCase(),4) != errorCheck.join('')) {
        console.log('Packet Discarded')
        // return nextFunctionFail()
    }
    //process the packet according to the packet type
    switch (protocolNumber) {
        case '01':
            //login packet
            let terminalID=information.slice(0,8),
                terminalIdentificationCode=information.slice(8,10),
                timeZone=information.slice(10,12)
            // console.log(protocolNumber,information,informationSerial,errorCheck)
            nextFunctionSuccess()
            // sendResponse(client,protocolNumber,informationSerial);
            break
        case '23':
            //heartbeat packet
            let terminalInformationContent=information[0],
                voltageLevel=information.slice(1,3),
                gsmSignalStength=information[3],
                languageStatus=information.slice(4,6)
            // console.log(protocolNumber,information,informationSerial,errorCheck)
            nextFunctionSuccess()
            // sendResponse(client,protocolNumber,informationSerial)
            break
    }
}
//gps packet sender
const GPSPacket = previousSerial => {
    responseRequired=false
    lastPacket = 3;
    let dt=new Date(),satellite='03'
    let information=[
        numberToTwoDigitHex(dt.getFullYear()%100),
        numberToTwoDigitHex(dt.getMonth()),
        numberToTwoDigitHex(dt.getDate()),
        numberToTwoDigitHex(dt.getHours()),
        numberToTwoDigitHex(dt.getMinutes()),
        numberToTwoDigitHex(dt.getSeconds()),
        satellite
    ].concat([
        //let latitude be 45.48739349347
        //multiply it by 18000000 and convert to hex
        //result will look like
        //do similar for longitude
        'C9','02', '7A', 'C8',
        '18','0C', '46', '58',
        //assuming speed 3 and other data as per protocol example
        numberToTwoDigitHex(3),
        '15', '4C', '00', '01', 'CC', '00', '28', '7D', '00' ,'1F',
        '71', '00',
        '00','01'

    ])
    sendResponse('22',serial,information)
}
//heartbeat packet sending function
const heartBeatPacket = previousSerial => {
    responseRequired=true
    lastPacket = 2;
    if(parseInt(Number('0x' + serial[0] + serial[1]), 10)>220)serial=['00','01']
    let currVolatge=4.16,
        terminalInfo='11111111',
        signalStrength=4,
        extendedBit=['01','02']
    let information = [paddZerosHexString(parseInt(terminalInfo,2).toString(16),2)].concat(['01','9F']).concat([numberToTwoDigitHex(signalStrength)]).concat(extendedBit)
    sendResponse('23',serial,information)
}
//login packet sending function
const loginPacket = () => {
    responseRequired=true
    lastPacket = 1
    let information = IMEI.split(/(?=(?:..)*$)/).concat(deviceKind.split(/(?=(?:..)*$)/)).concat(timeZone.split(/(?=(?:..)*$)/))
    sendResponse('01', serial, information)
}
//response sender fucnction
const sendResponse = (protocolNumber, previousInformationSerial, information = []) => {
    response=false
    let length = 5 + information.length,
        //increment serial number
        informationSerial = previousInformationSerial
    //calculate crc values
    let crc = paddZerosHexString(crc16('' + numberToTwoDigitHex(length) + protocolNumber + information.join('') + informationSerial.join('')).toString().toUpperCase(),4)
    // console.log('' + numberToTwoDigitHex(length) + protocolNumber + information.join('') + informationSerial.join(''))
    client.write(`78 78 ${numberToTwoDigitHex(length)} ${protocolNumber} ${information.join(' ')} ${informationSerial.join(' ')} ${crc.split(/(?=(?:..)*$)/).join(' ')} 0D 0A`)
    console.log(`Sent: 78 78 ${numberToTwoDigitHex(length)} ${protocolNumber} ${information.join(' ')} ${informationSerial.join(' ')} ${crc.split(/(?=(?:..)*$)/).join(' ')} 0D 0A`)
}
//utility function for padding zeros in a string
const paddZerosHexString = (string, count) => {
    while (string.length != count)
        string = '0' + string
    return string.toUpperCase()
}
//utility function for converting a number into hexadecimal of length 2
const numberToTwoDigitHex = number => {
    number = number.toString(16)
    if (number.length == 1)
        return '0' + number.toUpperCase()
    else return number.toUpperCase()
}
//next function to call if last function processing and response was successful
function nextFunctionSuccess() {
    //if the serial packet becomes large, initiate with starting number 1 again
    serial=parseInt(Number('0x' + serial[0] + serial[1]), 10) + 2
    if(serial>200)serial=1
    serial=paddZerosHexString(serial.toString(16).toUpperCase(), 4).split(/(?=(?:..)*$)/)
    setTimeout(()=>{
    if (lastPacket == 1) {
        heartBeatPacket();
    }
    if (lastPacket == 2) {
        GPSPacket();
    }
    if (lastPacket == 3) {
        heartBeatPacket();
    }},500);
}
//next function to call if last function processing and response was failed
function nextFunctionFail() {
    setTimeout(()=>{
    if (lastPacket == 1) {
        loginPacket();
    }
    if (lastPacket == 2) {
        heartBeatPacket();
    }
    if (lastPacket == 3) {
        GPSPacket();}
    },500);
}
//main loop of the program
while (1){
    // console.log(timeOutCount)
    if(!connected)init()
    timeOutCount==-1?loginPacket():''

    if(timeOutCount==2){
        console.log('Rebooting Device : Max timeout reached')
        timeOutCount=0
        connected=false
        response=false
        responseRequired=true
        lastPacket=1
        init()
    }
    else {
        if(responseRequired&response==false){
            timeOutCount++
            nextFunctionFail()
        }else if(responseRequired==true&&response==true)
            nextFunctionSuccess()
    }
    sleep(5000)
}