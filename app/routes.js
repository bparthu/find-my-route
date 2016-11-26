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
            //db.dropCollection('trains');
            commitPromises.push(TrainModel.create(trains));
            commitPromises.push(StationModel.create(stations));
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