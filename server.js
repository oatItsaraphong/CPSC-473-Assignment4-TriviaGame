/* jshint browser: true, jquery: true, camelcase: true, indent: 2, undef: true, quotmark: single, maxlen: 80, trailing: true, curly: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, nonew: true, unused: true, strict: true */

//include requirement
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var redis = require('redis');


//connect to mongo database
mongoose.connect('mongodb://localhost/TriviaGame');
mongoose.set('debug', true);

//redis connection
client = redis.createClient();
client.on('connect', function() {
    'use strict';
    console.log('connected');
});

//init object
var questionSchema = new mongoose.Schema({
  questionString: String,
  answerString: String,
  answerID: Number
});


var QuestionDb = mongoose.model('questionCollection', questionSchema);

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use('/', express.static('public'));
console.log('!---- Trivia Game server side, listening at port 3000 ----!');

//----Function Code------------------------------------------

//set defautl and create redis
var setDefaultScore = function() {
  'use strict';
	client.set('ScoreRight','0', function(err, replyR) {
		if (err) {
			console.log(err);
		} else {
			console.log('Key ' + replyR + ' added');
		}
	});
	client.set('ScoreWrong','0', function(err, replyW) {
		if (err) {
			console.log(err);
		} else {
			console.log('Key ' + replyW + ' added');
		}
	});
};

//return score from redis
app.get('/score', function(req,res){
  'use strict';
  console.log('score');

  client.mget('ScoreRight','ScoreWrong',function(err, replyRight){
      console.log('All Score: ' + replyRight[1]);

        res.json({'right': replyRight[0], 'wrong' : replyRight[1]});
    });
});

//get the answer from user and compare it then return t/f
app.post('/answer', function(req,res){
  'use strict';
  console.log('answering');
  var answerIn = req.body.answer;
  var idIn = req.body.answerId;

  QuestionDb.find({answerID:idIn},{answerID:1, answerString: 1}).exec(
    function(err, dataIn){

      //compare two sting return 0 if exactly the same
      var result = dataIn[0].answerString.localeCompare(answerIn);
      console.log('compare: ' + result);
      if(result === 0){
        //update score
        client.incr('ScoreRight',function(err, replay){
          if(err){
            console.log('Error update Score');
          }
          else{
            console.log('New Rigth Score: ' + replay);
          }
        });
        //return
        res.json({'correct': true});
      }//end if
      else {
        //update score
        client.incr('ScoreWrong',function(err, replay){
          if(err){
            console.log('Error update Score');
          }
          else{
            console.log('New Wrong Score: ' + replay);
          }
        });
        //return
        res.json({'correct': false});
      }//end else
    });//end exec
});// end of answer

//return one question at random to the user
app.get('/question', function(req, res){
  'use strict';
  console.log('Retrive Question');

  //initialize score one load
  client.get('ScoreRight',function(err, reply){
    if(reply=== null){
      setDefaultScore();
      console.log('up: ' + reply);
    }
  });

  //RNG
  var test;
  QuestionDb.find({},{answerID:1}).exec(
    function(err, dataCount){
    test = Math.floor(Math.random() * ((dataCount.length+1) - 1) + 1);

    //retrive question
    QuestionDb.find({answerID:test}).exec(
                    function(err, dataIn){

        if(dataIn.length === 0)
        {
          console.log('No Question');
          //return 0 if their is no data in DB
          res.json({'question': 'No Question in DB', 'answerId':0});
        }
        else {

          res.json({'question': dataIn[0].questionString,
            'answerId':dataIn[0].answerID});
        }
      });//end retrive question

  });//end RNG
});

//Adding new question
app.post('/question', function(req, res){
  'use strict';
  console.log('Add Question Function');

  var questionIn = req.body.question;
  var answerIn = req.body.answer;
  var result = 1;

  //Retrive that data with the highest answerID : to assign the unqiue one
  //  to the new question
  QuestionDb.find({answerID:{$exists:true}},
                  {answerID:1}).sort({answerID:-1}).limit(1).exec(
    function(err, dataIn){

      //check for empty database
      if(dataIn.length !== 0){
        console.log('Number of Question in DB and ID: ' + dataIn[0].answerID);
        result = dataIn[0].answerID + 1;
      }
      else{
        result = 1;
      }

      //initialize the dataset
      var q1 = new QuestionDb({questionString: questionIn,
                      answerString: answerIn,
                      answerID: result});
      //save dataset
      q1.save(function(err, result){
        if(err){
          console.log('Error Save to DB');
          res.json('Error Saving to DB');
        }
        else{
          console.log('Question Added');
          res.json('Question Added');
        }
      });//save function
    });//end DB find exec
});//end /quesiton post

app.listen(3000);
