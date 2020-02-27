const RESPONSE=require('./Responses')
const fs=require('fs')
var crc16=require('node-crc-itu');
const net = require('net');
console.log("Server Started")

//conSeen for storing the socket instances for further communication with proper client
var conSeen = Object.create(null);

var socketNum = 0;
//creating a listener instance for socket connections
let server = net.createServer(socket=> {
    socketNum++;
    socket.nickname = "Con" + socketNum;
    var clientName = socket.nickname;
    conSeen[clientName] = socket;
    socket.on('close', function() {
        delete conSeen[clientName];
    });
    //whenever some device sends the data, connect to the same instance using the conSeen[obj]
    socket.on('data', function(inputSeen) {
        var clientName = socket.nickname;
        //convert the data from byte object to string
        var input = inputSeen.toString('utf8');
        //print the data on the console with device name
        console.log("Saw : " + input + " from " + clientName + "\r\n");
        //send the data for further processing
        parser(input,conSeen[clientName])
    });
    //listen for any error occur inbetween so that the program may not crash abruptly
    socket.on('error',err => {console.log(err)})
});
//start the listening task
server.listen(9889, '127.0.0.1');

const parser=(str,socket)=>{
    //check if the packet received have a ending flag if not then return INVALID PACKET ERROR
    if(str.indexOf('0D 0A')==-1)
        return RESPONSE.INVALID_PACKET
    //if packet seems to have a ending flag then split the packet into sub packets by ending flags
    //this will help parsing string with multiple packets
    let packets=str.split('0D 0A')
    packets.forEach(packet=>{
        //Remove the spaces at the beginning and ending of the packet
        packet=packet.trim();
        //split the packet frames
        packet=packet.split(' ')
        //checking if the packet has starting frames
        if((packet[0]=='78'&&packet[1]=='78')||(packet[0]=='79'&&packet[0]=='79'))
            //if starting frames and ending frames are present process the packet
            processPacket(packet,socket);
        else return RESPONSE.INVALID_PACKET
    })
}
const processPacket=(frame,client)=>{
    //break the packet into individual blocks that will help in easy programming
    //all the break information was taken from the documentation
    let packetLength=frame[2],
        protocolNumber=frame[3],
        information=frame.slice(4,frame.length-4),
        informationSerial=[frame[frame.length-4],frame[frame.length-3]],
        errorCheck=[frame[frame.length-2],frame[frame.length-1]]
    information
    //calculate and match the crc value for the packet
    //discard the packet if crc does not match with error bits
    // console.log(crc16('110103516080807792882203320104AA'))
    if(paddZerosHexString(crc16(''+packetLength+protocolNumber+information.join('')+informationSerial.join('')).toUpperCase(),4)!=errorCheck.join('')) {
        console.log('Packet Discarded')
        //if the packet is damaged, discard it
        //RESPONSE.INVALID_PACKET means a null, its just for better readability of the code
        return RESPONSE.INVALID_PACKET;
    }
    //process the packet according to packet type
    switch (protocolNumber) {
        case '01':
            //login packet
            //futher split the information block into its respective components
            let terminalID=information.slice(0,8),
                terminalIdentificationCode=information.slice(8,10),
                timeZone=information.slice(10,12)
            //assign the imei of the terminal to the socket instance so that the device can be recognized using this
            client.uid=terminalID.join('')
            // console.log(protocolNumber,information,informationSerial,errorCheck)
            //compute and send the response
            sendResponse(client,protocolNumber,informationSerial);
            break
        case '23':
            //heartbeat packet
            //splitting further blocks of information block
            let terminalInformationContent=information[0],
                voltageLevel=information.slice(1,3),
                gsmSignalStength=information[3],
                languageStatus=information.slice(4,6)
            // console.log(protocolNumber,information,informationSerial,errorCheck)
            //compute and send the response of heartbeat packet
            sendResponse(client,protocolNumber,informationSerial)
            break
        case '22':
            //gps packet
            //prepare sub blocks of GPS Packet for further processing
            let datetime=information.slice(0,6),
                satalliteCount=information[6],
                lattitude=information.slice(7,11),
                longitude=information.slice(11,15),
                speed=information[15],
                courseStatus=information.slice(16,18),
                MCC=information.slice(18,20),
                MNC=information[20],
                LAC=information.slice(21,23),
                cellID=information.slice(23,26),
                ACC=information[26],
                dataUploadMode=information[27],
                GPSRealTime=information[28],
                mileage=information.slice(29,33)
            // console.log(datetime,
            //     satalliteCount ,
            //     lattitude ,
            //     longitude ,
            //     speed ,
            //     courseStatus ,
            //     MCC ,
            //     MNC ,
            //     LAC ,
            //     cellID ,
            //     ACC ,
            //     dataUploadMode ,
            //     GPSRealTime ,
            //     mileage)
            //assign high level meaning of the raw data to course and status values
            courseStatus=inferenceCourseStatus(courseStatus)
            //create a json object having the processed data
            let dataToSave={
                // dd/mm/yy formatted
                date:hexToInt(datetime[2])+'/'+hexToInt(datetime[1])+'/'+hexToInt(datetime[0]),
                //hh:mm:ss
                time:hexToInt(datetime[3])+':'+hexToInt(datetime[4])+':'+hexToInt(datetime[5]),
                satelliteQuantity:hexToInt(satalliteCount[1]),
                //DOCUMENTED 1800000 BUT IT SHOULD DIVIDE BY 18000000 ? NEED CLEARITY
                latitude:hexToInt(lattitude.join(''))/18000000,
                longitude:hexToInt(longitude.join(''))/18000000,
                speed:hexToInt(speed),
                statusRealTimeOrDifferential:courseStatus[0],
                statusPositionedOrPositioning:courseStatus[1],
                course:courseStatus[2]+'°'+courseStatus[3]+courseStatus[4],
                //course and status to be done
                MCC:hexToInt(MCC.join('')),
                MNC:hexToInt(MNC),
                LAC:hexToInt(LAC.join('')),
                cellID:hexToInt(cellID.join('')),
                ACC:ACC=='00'?'low':'high',
                dataUploadMode:inferenceDataUploadMode(dataUploadMode),
                GPSRealTimeReUpload:GPSRealTime=='00'?'Real time upload':'Re-Upload',
                mileage:hexToInt(mileage.join('')/100),
            }
            //open files and write the data
            fs.readFile('results.json',  (err, data) =>{
                dataToSave.deviceID=client.uid
                let json
                if(data.length<5)json=JSON.stringify(dataToSave)
                else {
                    json=data.toString()+','+JSON.stringify(dataToSave)
                }
                fs.writeFile("results.json", json,"utf8",res=>{})
            })
            fs.writeFile('lastGPSData.json',JSON.stringify(dataToSave),"utf8",res=>{});
            break
    }
}
//general purpose function for sending responses
const sendResponse=(client,protocolNumber,previousInformationSerial,information=[])=>{
    //compute the length block using fixed block size and information block size
    let length=5+information.length,
        //increment serial number
        informationSerial=parseInt(Number('0x'+previousInformationSerial[0]+previousInformationSerial[1]),10)+1
    //convert serial into hexadecimal string
    informationSerial=paddZerosHexString(informationSerial.toString(16).toUpperCase(),4)
    //calculate crc values
    let crc=paddZerosHexString(crc16(''+numberToTwoDigitHex(length)+protocolNumber+informationSerial).toString().toUpperCase(),4)
    //send the data on the socket connection of that device
    client.write(
        `78 78 ${numberToTwoDigitHex(length)} ${protocolNumber} ${informationSerial[0]}${informationSerial[1]} ${informationSerial[2]}${informationSerial[3]} ${crc[0]}${crc[1]} ${crc[2]}${crc[3]} 0D 0A`
    );
}
//utility function to make a number hexadecimal with fixed length
const numberToTwoDigitHex=number=>{
    number=number.toString(16)
    if(number.length==1)
        return '0'+number
    else return number
}
//utility function for adding leading zeros in a string upto a certain limit
const paddZerosHexString=(string,count)=>{
    while (string.length!=count)
    string='0'+string
    return string
}
//hex to int converter utility function
const hexToInt=hexdigit=>parseInt(Number('0x'+hexdigit),10)
//high level values of data upload mode values of the GPS packet
const inferenceDataUploadMode= hexnumber=>{
    switch (hexnumber) {
        case '00': return 'Upload by time interval'
        case '01': return 'Upload by distance interval'
        case '02': return 'Inflection point upload'
        case '03': return 'ACC status upload'
        case '04': return 'Re-upload the last GPS point when back to static.'
        case '05': return 'Upload the last effective point when network recovers.'
        case '06': return 'Update ephemeris and upload GPS data compulsorily'
        case '07': return 'Upload location when side key triggered'
        case '08': return 'Upload location after power on'
        case '09': return 'Unused'
        case '0A': return 'Upload the last longitude and latitude when device is static time updated'
        case '0D': return 'Upload the last longitude and latitude when device is static'
        case '0E': return 'Gpsdup upload (Upload regularly in a static state.)'
    }
}
//high level values of course and status values of GPS packet
const inferenceCourseStatus=courseStatus=>{
    let data=paddZerosHexString(Number('0x'+courseStatus[0]).toString(2),8).toString().concat(paddZerosHexString(Number('0x'+courseStatus[1]).toString(2),8).toString())
    let course=parseInt(data.slice(6,16),2),
        status0=data[2]==0?'GPS real-time':'differential positioning',
        status1=data[3]==1?', GPS has been positioned':' GPS is positioning',
        direction0=data[4]==0?'E':'W',
        direction1=data[5]==1?'N':'S'
    return [status0,status1,course,direction0,direction1]
}