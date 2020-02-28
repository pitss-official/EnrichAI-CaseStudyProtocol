# Enrich AI: Protocol Simulator
###### By Pawan Kumar
***
Installation Guide:
* You should have node js and npm installed
* run command  __npm install__ which will install all the dependencies required for this package
* after installing all the dependencies, open two terminal/command prompt window
* make sure that you are in the same directory as the project
* run __npm run server__ for running the server lister which will act like a station who will recieve all requests from 
all the devices and will respond to them as well as store the results.
* run multiple instances of __npm run client__. All the instances will act like a individual device and will connect 
with the server as per protocol documentation

#### Currently client and server both features:
*** 
 * __error detection__
 
 * __frame analysis__
 
 * __login packet decoding__
 
 * __identifying devices with the socket id they are using to connect with the server and mapping the data sent by them__
 
 * __heartbeat packet detection and response__
 
 * __GPS Packet decoding and storing the results__
 
 #### Results
 ***
 The server will store last result of gps data in __lastGPSData.json__ file and other past results in __results.json__ file.
 The results.json is not a proper json file however we can do better by using database management systems.
 The reason is because as the file grows the JSON.parse function becomes slow at reading file and chances of write errors 
 are high which will throw unwanted error and exceptions in JSON.parse function. However if we will use database management 
 system like mongo db, it will be a peice of cake to store a object inside a document in mongodb or we can update the existing 
 data for that device using socket id.
 ##### JSON Interpretation
 ***
       {
           "date":"27/1/20",
           "time":"13:54:20",
           "satelliteQuantity":9,
           "latitude":24.3111693333333334,
           "longitude":11.440924611111111,
           "speed":0,
           "statusRealTimeOrDifferential":"GPS real-time",
           "statusPositionedOrPositioning":"GPS has been positioned",
           "course":"110°EN",
           "MCC":460,
           "MNC":0,
           "LAC":10365,
           "cellID":8049,
           "ACC":"low",
           "dataUploadMode":"Upload by time interval",
           "GPSRealTimeReUpload":"Re-Upload",
           "mileage":0,
           "deviceID":"0351608080779288"
       }
  
#### Client or Terminal Details
For now the device(terminal)'s hardware details like IMEI, GPS Data and other associated data is hardcoded into client.js, we can replace it with source or sensor data in actual device
***
#### Caution
***
Do not delete the results.json file. It is used for storing the results. Rather clear the file contents for fresh results.
