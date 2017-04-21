var Todo = require('./models/todo');
var express = require('express');
    var request = require('request');
    var cheerio = require('cheerio');
    var rp = require('request-promise');
    var q = require('bluebird');
    var jsonfile = require('jsonfile');
    var mongoose = require('mongoose');
    var _ = require('lodash');
// expose the routes to our app with module.exports
module.exports = function(app,db){
	// routes ======================================================================

    // api ---------------------------------------------------------------------
    // get all todos
    var TrainModel = require('./models/train')(db);
    var StationModel = require('./models/station')(db);
   // var TrainInfoModel = require('./models/traininfo')(db);

    function createCallbackFn(processor, instance, finalList){
        var Instance = instance;
        var processor = processor;
        var finalList = finalList;
        return function($){
            var tmpl= $('.results > tbody > tr');
            $('.results > tbody > tr').each(function(){
                var instanceArr = processor($(this),$);
                var objInstance = new Instance(instanceArr);
                finalList.push(objInstance);
            });
        }
    }

    var apiRoutes = express.Router();

     apiRoutes.get('/stations/setStationWeights',function(req,res){
     
      var startStnCode = req.query.start;
      var stationWeights=[];
      var trains = jsonfile.readFileSync('./resource/trainsInfo.json');
      var stations = jsonfile.readFileSync('./resource/stations.json');
      var fileName = "./resource/stationWeight.json";
     
        function setStationWeight(trains,StnCode){ 
             var trainsAtStn =[];
             _.forEach(trains,function(train){
                    for(var i=0;i<train.route.length;i++){
                        if(train.route[i].code == StnCode){                              
                            trainsAtStn.push(train.id); 
                            break;
                        }                        
                    }                    
             });
             var stationWeg = {
                 stationCode:StnCode,
                 stationWeight:trainsAtStn.length
             }
             stationWeights.push(stationWeg);
        }      
        _.forEach(stations,function(station){
              setStationWeight(trains,station.stationCode);
        });   
      
        jsonfile.writeFileSync(fileName,stationWeights);
        res.render('list',{
            tmpl: 'Total List : ' + stationWeights.length + '<br/>' + JSON.stringify(stationWeights)
        });

     });

    function getDirectTrains(trains,startStnCode,endStnCode,dateOfTravel){

        var directTrains =[];
            _.forEach(trains,function(train){
                var trainFound= false;
                var daysToAdd = 1;
                
                for(var i=0;i<train.route.length;i++){
                    if(train.route[i].code == startStnCode && !trainFound){    
                        daysToAdd = train.route[i].day;
                        trainFound=true;  
                    }
                    if(trainFound){
                        if(endStnCode == train.route[i].code){
                                _.forEach(train.days,function(day){
                                    var dayfound= false;
                                    if(day['day-code']==getDay(toDate(dateOfTravel,daysToAdd)) && !dayfound){
                                        if(day.runs =='Y'){
                                            dayfound = true;
                                            directTrains.push(train);
                                        };
                                    }
                                });
                        }
                    }
                }
            }); 
           // console.log(directTrains);
            return directTrains;    
    } 
        
    function toDate(dateStr,daysToAdd) {
        var parts = dateStr.split("-");
        return new Date(parts[2], parts[1] - 1, parts[0]-(daysToAdd-1));
    }
    
    function getDay(date){
        //console.log(date.getDay());
            var weekday = new Array(7);
            weekday[0] =  "SUN";
            weekday[1] = "MON";
            weekday[2] = "TUE";
            weekday[3] = "WED";
            weekday[4] = "THU";
            weekday[5] = "FRI";
            weekday[6] = "SAT";
            
            return weekday[date.getDay()];
    }

    function dateDiff(start, end, flag) {
        start = start.split(":");
        end = end.split(":");
        var startDate = new Date(0, 0, 0, start[0], start[1], 0);
        var endDate = new Date(0, 0, 0, end[0], end[1], 0);
        var diff = endDate.getTime() - startDate.getTime();
        var hours = Math.floor(diff / 1000 / 60 / 60);
        diff -= hours * 1000 * 60 * 60;
        var minutes = Math.floor(diff / 1000 / 60);
        if(flag){
            if (hours < 0)
            hours = hours + 24;
        }
        return ((hours > 0 && hours <= 9 )? "0" : "") + hours + ":" + ( (minutes>0 && minutes <= 9) ? "0" : "") + minutes;
    }
    
    function getTrainsAndJunctionsBtwStations(startStnCode,endStnCode,dateOfTravel,stations,trains){
          
            var directTrains=[];
            var stationCode =[];
            var staionsInfo=[];
            var connectingStations=[];
            var directTrainNumbers=[];

               directTrains = getDirectTrains(trains,startStnCode,endStnCode,dateOfTravel);
               _.forEach(directTrains,function(train){
                    var flag1=false;
                    var flag2=false;
                   for(var i=0;i<train.route.length;i++){
                       if(train.route[i].code == startStnCode && !flag1){
                           flag1=true;                        
                       }
                       if(flag1){
                                if(_.indexOf(stationCode,train.route[i].code)==-1){   
                                    if(endStnCode == train.route[i].code){
                                        flag2=true;
                                    }
                                     if(!flag2){                    
                                        stationCode.push(train.route[i].code);
                                        staionsInfo.push({code:train.route[i].code,name:train.route[i].fullname});
                                     }                                    
                                }                          
                       }                           
                   }                  
               });  

               _.forEach(staionsInfo,function(station){
                  if(_.endsWith(station.name,'JN')||_.endsWith(station.name,'JN.')){
                      connectingStations.push({code:station.code,name:station.name});
                  }
                  else{
                     var obj = _.filter(stations, {'stationCode': station.code});
                     if(typeof(obj[0]) != "undefined"){
                        if(obj[0].stationWeight>100){
                        connectingStations.push({code:station.code,name:station.name});
                        }
                     }
                  }
               }); 

                _.forEach(directTrains,function(train){
                    directTrainNumbers.push(train.id);
                });

               return { 
                        directTrains:directTrains,
                        connectingStations:_.slice(connectingStations,1,connectingStations.length),
                        directTrainNumbers:directTrainNumbers
                      }
    }

    function getConnetedTrains(startStnCode,endStnCode,dateOfTravel,stations,trains){
                var connectedTrains =[];
                var connectingStations =[];
                var directTrainNumbers=[];
                var directTrains=[];

                var response = getTrainsAndJunctionsBtwStations(startStnCode,endStnCode,dateOfTravel,stations,trains);
                connectingStations = response.connectingStations;
                directTrainNumbers = response.directTrainNumbers;
                directTrains = response.directTrains;
                _.forEach(connectingStations,function(station){
                    var trainsFromSrcToIntermediateTemp =[];
                  
                        trainsFromSrcToIntermediateTemp = getDirectTrains(trains,startStnCode,station.code,dateOfTravel).filter(function(o) { 
                            return  directTrainNumbers.indexOf(o.id) === -1;
                        });
                        
                        _.forEach(trainsFromSrcToIntermediateTemp,function(train){

                            var trainsFromIntermediateToEndtemp=[];
                            var findTriainOfNextday=false;
                            var secArivalToIntermediateStn = train.route.filter(function(r){
                                return r.code == station.code;
                            })[0].scharr;

                            var dayofArival = train.route.filter(function(r){
                                return r.code == station.code;
                            })[0].day;

                            if(parseInt(secArivalToIntermediateStn.split(":")[0])>=23){
                                findTriainOfNextday = true; 
                            }
                             
                            var date = "";
                            date = dateOfTravel;
                            if(dayofArival > 1){
                                var parts = date.split("-");
                                parts[0]=parseInt(parts[0])+parseInt(dayofArival-1);
                                date = parts[0]+"-"+parts[1]+"-"+parts[2];
                               // console.log();
                            }else if(dayofArival == 1 && findTriainOfNextday){
                               var parts = date.split("-");
                                parts[0]=parseInt(parts[0])+1;
                                date = parts[0]+"-"+parts[1]+"-"+parts[2]; 
                              
                            }

                            trainsFromIntermediateToEndtemp = getDirectTrains(trains,station.code,endStnCode,date).filter(function(o) { 
                                return  directTrainNumbers.indexOf(o.id) === -1;
                            });


                            var trainsFromIntermediateToEnd =[];

                            _.forEach(trainsFromIntermediateToEndtemp,function(trn){

                                var schDepatureFromIntermediateStation = trn.route.filter(function(r){
                                     return r.code == station.code;
                                })[0].schdep;

                                var waitingTime =  dateDiff(secArivalToIntermediateStn, schDepatureFromIntermediateStation,findTriainOfNextday);                                                          
                              //  console.log(train.id+"--"+ trn.id +"--"+trn.name+"---"+secArivalToIntermediateStn +"---"+ schDepatureFromIntermediateStation+"---"+waitingTime);
                                var hrs = parseInt(waitingTime .split(":")[0]);
                                var mins = parseInt(waitingTime .split(":")[1]);
                                var time = (hrs*60)+mins;


                                trainsFromIntermediateToEnd.push({
                                    train:trn,
                                    schDepatureFromIntermediateStation:schDepatureFromIntermediateStation,
                                    waitingTime:waitingTime,
                                    watingMins:time
                                });

                            });
                            
                             var trainsFromIntToEnd = [];
                              trainsFromIntToEnd = trainsFromIntermediateToEnd.filter(function(trn){   
                                  return trn.watingMins > 30 && trn.watingMins <300;
                              });

                             if(trainsFromIntToEnd.length>0){ 
                                var firstLeg = {startStn:startStnCode,
                                    endStn:station.code,
                                    dateOfArivalToIntermediateStn:date,
                                    secArivalToIntermediateStn:secArivalToIntermediateStn,
                                    train:train
                                    };

                                var secondLeg = {
                                    startStn:station.code,
                                    endStn:endStnCode,
                                    dateOfDepatureFromIntermediateStn:date, 
                                    trains:trainsFromIntToEnd
                                    };
                                    connectedTrains.push({
                                        sourceStn:startStnCode,
                                        endStn:endStnCode,
                                        firstleg:firstLeg,
                                        secondleg:secondLeg
                                    });
                             }
                        });
                    });
        return {directTrains:directTrains,connectedTrains:connectedTrains};
    }
                 
    apiRoutes.get('/find-route/getTrains',function(req,res){
        var startStnCode = req.query.start;
        var endStnCode = req.query.end;
        var dateOfTravel = req.query.date; 
        var trains = jsonfile.readFileSync('./resource/trainsInfo.json');
        var stations = jsonfile.readFileSync('./resource/stationWeight.json');
        var response = getConnetedTrains(startStnCode,endStnCode,dateOfTravel,stations,trains);
        res.json({directTrains:response.directTrains,connectedTrains:response.connectedTrains});
    });

     apiRoutes.get('/find-route/getDirectTrains',function(req,res){
        var startStnCode = req.query.start;
        var endStnCode = req.query.end;
        var dateOfTravel = req.query.date; 
        var trains = jsonfile.readFileSync('./resource/trainsInfo.json');
        res.json({directTrains: getDirectTrains(trains,startStnCode,endStnCode,dateOfTravel)});
     });

     apiRoutes.get('/find-route/getDirectTrainsAndJunctionsBetweenStations',function(req,res){

        var startStnCode = req.query.start;
        var endStnCode = req.query.end;
        var dateOfTravel = req.query.date; 
        var trains = jsonfile.readFileSync('./resource/trainsInfo.json');
        var stations = jsonfile.readFileSync('./resource/stationWeight.json');
        
             
       
         var response  = getTrainsAndJunctionsBtwStations(startStnCode,endStnCode,dateOfTravel,stations,trains);
            console.log('all promises done'); 
             
             res.json({directTrains:response.directTrains,
                 connectingStations: response.connectingStations,
                 directTrainNumbers:response.directTrainNumbers
            });
     });

     apiRoutes.get('/trains/gettraininfo',function(req,res){
          var fileName = './resource/trainsInfo_5000_5565.json'
         var trainInfoList=[];
          var trainFileName = './resource/trainsData.json';
          var trains = jsonfile.readFileSync(trainFileName);
           
           function TrainInfo(info){
                this.id = info.train.number;
                this.days = info.train.days;
                this.classes = info.train.classes;
                this.name = info.train.name;
                this.route = info.route;
                this.starts = _.find(info.route,function(d){
                    return  d.no == 1;
                });
                this.ends = _.find(info.route,function(d){
                    return d.schdep =="Destination";
                });
             }  

              function getOptions(url){
                console.log('making call with url -> '+url);
                    return {
                            uri: url,
                            json:true
                    };
                 }
               function buildPromises(trains){
                   
                    var promises= [];
                        for(var i=5000;i<5565;i++){
                                var urlPattern = 'http://api.railwayapi.com/route/train/'+trains[i].number+'/apikey/xn81k7tb/';
                                var promise = rp(getOptions(urlPattern));
                                promise.then(function(res){
                                    trainInfoList.push(new TrainInfo(res));
                                }).catch(function (err) {
                                   console.log("Train Number Error : "+trains[i.number]);
                                }); 
                                promises.push(promise);                               
                            } 
                       
                    return promises;
                }
        
        var promises = buildPromises(trains);
        q.all(promises).then(function(results){
            console.log('all promises done');
            
            jsonfile.writeFileSync(fileName,trainInfoList);
            res.render('list',{
                tmpl: 'Total List : ' + trainInfoList.length + '<br/>' + JSON.stringify(trainInfoList)
            });
        }); 
     });

     apiRoutes.get('/trains/gettrains',function(req,res){

           var fileName = './resource/trainsData.json';
           var trainList = [];
           

           function getOptions(url){
            console.log('making call with url -> '+url);
                return {
                        uri: url,
                        json:true
                };
            }
               function buildPromises(){
                   
                    var promises= [];
                    for(var i=1;i<10;i++){
                        var urlPattern = 'http://api.railwayapi.com/suggest_train/trains/'+i+'/apikey/xn81k7tb/';
                        var promise = rp(getOptions(urlPattern));
                        promise.then(function(res){
                           _.forEach(res.trains,function(train){
                                trainList.push(train);
                           });
                        });
                        promises.push(promise);
                    }
                    return promises;
             }

        var promises = buildPromises();
        q.all(promises).then(function(results){
            console.log('all promises done');
            
            jsonfile.writeFileSync(fileName,trainList);
            res.render('list',{
                tmpl: 'Total List : ' + trainList.length + '<br/>' + JSON.stringify(trainList)
            });
        });
     });
  
    apiRoutes.get('/trains/populate',function(req,res){
        var pages = 5;
        var fileName = './resource/trains.json'
        var trainList = [];

        function Train(data){
            this.id = data[0];
            this.name = data[1];
            this.startStnCode = data[2];
            this.starts = data[3];
            this.endStnCode = data[4];
            this.ends = data[5];                       
        }

        function getOptions(url){
            console.log('making call with url -> '+url);
            return {
                uri: url,
                transform: function (body) {
                    return cheerio.load(body);
                }
            };
        }

        function trainProcessor($tr,$){
            console.log($tr.html());
            var trainInfoArr = [];
            $tr.find('td').each(function(){
                var href = $(this).find('a').attr('href');
                if(href && href.indexOf('stations') !== -1){
                    trainInfoArr.push(href.split('/')[3]);
                }
                trainInfoArr.push($(this).text());
            });
            return trainInfoArr;
        }

        function buildPromises(pages){
            var urlPattern = 'https://www.cleartrip.com/trains/list?page=';
            var promises= [];
            var callbackFn = createCallbackFn(trainProcessor, Train, trainList);
            for(var i=1;i<=pages;i++){
                var promise = rp(getOptions(urlPattern+i));
                promise.then(callbackFn);
                promises.push(promise);
            }
            return promises;
        }

        var promises = buildPromises(pages);
        q.all(promises).then(function(results){
            console.log('all promises done');
            /*trainList.forEach(function(eachTrain){
                console.log('creating train db');
                var trainInstance = new TrainModel({
                    id           : eachTrain.id,
                    name         : eachTrain.name,
                    startStnCode : eachTrain.startStnCode,
                    starts       : eachTrain.starts,
                    endStnCode   : eachTrain.endStnCode,
                    ends         : eachTrain.ends
                });
                trainInstance.save(function(err){
                    if(err) res.send(err);
                });
            });*/
            jsonfile.writeFileSync(fileName,trainList);
            res.render('list',{
                tmpl: 'Total List : ' + trainList.length + '<br/>' + JSON.stringify(trainList)
            });
        });
        
    });

    apiRoutes.get('/stations/populate',function(req,res){
        var pages = 5;
        var fileName = './resource/stations.json';
        var stationList = [];

        function Station(data){
            this.stationCode = data[0];
            this.stationName = data[1];
        }

        function getOptions(url){
            console.log('making call with url -> '+url);
            return {
                uri: url,
                transform: function (body) {
                    return cheerio.load(body);
                }
            };
        }

        function stationProcessor($tr,$){
            console.log($tr.html());
            var stationInfoArr = [];
            $tr.find('td').each(function(){
                stationInfoArr.push($(this).text());
            });
            return stationInfoArr;
        }

        function buildPromises(pages){
            var urlPattern = 'https://www.cleartrip.com/trains/stations/list?page=';
            var promises= [];
            var callbackFn = createCallbackFn(stationProcessor, Station, stationList);
            for(var i=1;i<=pages;i++){
                var promise = rp(getOptions(urlPattern+i));
                promise.then(callbackFn);
                promises.push(promise);
            }
            return promises;
        }

        var promises = buildPromises(pages);
        q.all(promises).then(function(results){
            console.log('all promises done');
            /*trainList.forEach(function(eachTrain){
                console.log('creating train db');
                var trainInstance = new TrainModel({
                    id           : eachTrain.id,
                    name         : eachTrain.name,
                    startStnCode : eachTrain.startStnCode,
                    starts       : eachTrain.starts,
                    endStnCode   : eachTrain.endStnCode,
                    ends         : eachTrain.ends
                });
                trainInstance.save(function(err){
                    if(err) res.send(err);
                });
            });*/
            jsonfile.writeFileSync(fileName,stationList);
            res.render('list',{
                tmpl: 'Total List : ' + stationList.length + '<br/>' + JSON.stringify(stationList)
            });
        });
        
    });

    apiRoutes.get('/commit',function(req,res){
        var promises= [];
        promises.push(db.collection('trains').drop());
        promises.push(db.collection('stations').drop());
        q.all(promises).then(function(){
            var commitPromises = [];
            var trainFileName = './resource/trains.json';
           
            var stationFileName = './resource/stations.json';
            var trains = jsonfile.readFileSync(trainFileName);
            var stations = jsonfile.readFileSync(stationFileName);

           var trains_0_1500 = jsonfile.readFileSync('./resource/trainsInfo_0_1500.json');
           var trains_1500_3000 = jsonfile.readFileSync('./resource/trainsInfo_1500_3000.json');
           var trains_3000_4000 = jsonfile.readFileSync('./resource/trainsInfo_3000_4000.json');
           var trains_4000_5000 = jsonfile.readFileSync('./resource/trainsInfo_4000_5000.json');
           var trains_5000_5565 = jsonfile.readFileSync('./resource/trainsInfo_5000_5565.json');
          // var array1=[];
            var array1 = Array.prototype.concat(trains_0_1500, trains_1500_3000, trains_3000_4000,trains_4000_5000,trains_5000_5565);

           jsonfile.writeFileSync("./resource/trainsInfo.json",array1);

           console.log("creating models in db");

            //db.dropCollection('trains');
            commitPromises.push(TrainModel.create(trains));
            commitPromises.push(StationModel.create(stations));
            //commitPromises.push(TrainInfoModel.create(array1));
            q.all(commitPromises).then(function(){
                res.json('done'); 
            });
        });


        /*if(db.collections['trains'].drop){
            console.log('Dropping trains');
            db.collections['trains'].drop();
        }
        if(db.collections['stations']){
            console.log('Dropping stations');
            db.collections['stations'].drop();
        }
        */
    });

    apiRoutes.get('/find-route',function(req,res){
        var queryPromises = [];
        queryPromises.push(TrainModel.find({startStnCode: req.query.start}));
        queryPromises.push(TrainModel.find({endStnCode: req.query.end}));
        queryPromises.push(TrainModel.find({startStnCode: req.query.start, endStnCode: req.query.end}));
        q.all(queryPromises).then(function(resolves){
            //var flatArray = _.flattenDeep(resolves);
            //var commonStation = _.intersectionBy(flatArray,'')
            //res.json(flatArray);
            var respData = {};
            var Route = function(a,b){
                this.firstLeg = a || null;
                this.finalLeg = b || null;
            };
            var finalObj = {};
            var indirectBuild = [];
            var startToIntermediate = _.intersectionWith(resolves[0],resolves[1],function(a,b){
                if(a.endStnCode === b.startStnCode){
                    if(!finalObj[a.endStnCode]){
                        finalObj[a.endStnCode] = {intStation: a.endStnCode, firstLeg: [], finalLeg:[]};
                    }
                    finalObj[a.endStnCode].firstLeg.push(a);
                    return true;
                }else{
                    return false;
                }
            });



            var intermediateToEnd = _.intersectionWith(resolves[1], startToIntermediate,function(a,b){
                if(b.endStnCode === a.startStnCode){
                    finalObj[a.startStnCode].finalLeg.push(a);
                    return true;
                }else{
                    return false;
                }
            });

            for(prop in finalObj){
                indirectBuild.push(finalObj[prop]);
            }

            respData = {
                direct: resolves[2],
                indirect: indirectBuild
            }

            /*[

                "mys" : {
                    firstLeg: [],
                    finalLeg: []
                }

            ]*/
            
            res.json(respData);
        });
        
        
    });

    app.use('/api',apiRoutes);

    app.get('*',function(req,res){
    	res.sendfile('./public/index.html');
    });
};
