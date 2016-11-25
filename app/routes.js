var Todo = require('./models/todo');
var express = require('express');
    var request = require('request');
    var cheerio = require('cheerio');
    var rp = require('request-promise');
    var q = require('bluebird');
    var TrainModel = require('./models/train');
// expose the routes to our app with module.exports
module.exports = function(app){
	// routes ======================================================================

    // api ---------------------------------------------------------------------
    // get all todos

    function Train(data){
        this.id = data[0];
        this.name = data[1];
        this.startStnCode = data[2];
        this.starts = data[3];
        this.endStnCode = data[4];
        this.ends = data[5];
    }

    var trainList = [];

    var apiRoutes = express.Router();
    apiRoutes.get('/trains/populate',function(req,res){
        var pages = 1;
        url = 'https://www.cleartrip.com/trains/list?page=1';

        function getOptions(url){
            console.log('making call with url -> '+url);
            return {
                uri: url,
                transform: function (body) {
                    return cheerio.load(body);
                }
            };
        }

        function callbackFn($){
            var tmpl= $('.results > tbody > tr');
            $('.results > tbody > tr').each(function(){
                var trainInfoArr = [];
                $(this).find('td').each(function(){
                    var href = $(this).find('a').attr('href');
                    if(href && href.indexOf('stations') !== -1){
                        trainInfoArr.push(href.split('/')[3]);
                    }
                    trainInfoArr.push($(this).text());
                });
                var train = new Train(trainInfoArr);
                trainList.push(train);
            });

            /*res.render('list',{
                tmpl: JSON.stringify(trainList)
            });*/
        }

        function buildPromises(pages){
            var urlPattern = 'https://www.cleartrip.com/trains/list?page=';
            var promises= [];
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
            trainList.forEach(function(eachTrain){
                TrainModel.create({
                    id           : eachTrain.id,
                    name         : eachTrain.name,
                    startStnCode : eachTrain.startStnCode,
                    starts       : eachTrain.starts,
                    endStnCode   : eachTrain.endStnCode,
                    ends         : eachTrain.ends
                },function(err){
                    if(err){
                        res.send(err);
                    }
                });
            });
            res.render('list',{
                tmpl: 'Total List : ' + trainList.length + '<br/>' + JSON.stringify(trainList)
            });
        });

        /*var options = getOptions(url); 
        var promise = rp(options);
        promises.push(promise);
        promise.then(function ($) {
            var tmpl= $('.results > tbody > tr');
            $('.results > tbody > tr').each(function(){
                var trainInfoArr = [];
                $(this).find('td').each(function(){
                    trainInfoArr.push($(this).text());
                });
                var train = new Train(trainInfoArr);
                trainList.push(train);
            });

            res.render('list',{
                tmpl: JSON.stringify(trainList)
            });
        })
        .catch(function (err) {
            res.send(err);
        });*/

        
    });

    app.use('/api',apiRoutes);

    app.get('*',function(req,res){
    	res.sendfile('./public/index.html');
    });
};