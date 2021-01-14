var express = require('express');
var router = express.Router();

/* 추가한 부분 */
var app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy
    , NaverStrategy = require('passport-naver').Strategy;
/* 여기까지 */

const mssql = require('mssql');
const multer = require('multer');
const path = require('path');
/* GET home page. */

const nodemailer = require("nodemailer");

const fs = require('fs');
const emlformat = require('eml-format');


const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// var DomParser = require('dom-parser');


const config = {
    // "user"      : "sa",
    // "password"  : "qw12qw12)",
    // "server"    : "192.168.0.122",
    // "port"      : 1433,
    // "database"  : "aTEST",
    // "timezone"  : 'utc',
    // "options"   : {
    //     "encrypt" : false
    // }
    //"user": "test",
    "user": "sa",
    "password": "qw12qw12",
    //"server": "192.168.137.1",
    "server": "192.168.0.134",
    // "server": "192.168.35.115",
    //"server"    : "192.168.0.135",
    "port": 1433,
    "database": "aTEST",
    // "timezone"  : 'utc',
    "options": {
        encrypt: false, // Use this if you're on Windows Azure 
        enableArithAbort: true
    }
}

var secret_key = 'yuriminfosysqw12qw12';   // JWT 시크릿키

/* configuration */
app.use(cors());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));
router.use(cookieParser());
/* router.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 31536000000 // 1년
    }

})); */
/* passport와 flash는 반드시 session 다음에 */
router.use(passport.initialize());
//router.use(passport.session());
//router.use(flash());

/* 세션 대신 JWT 사용 
// 로그인이 성공하면 serializerUser로 user정보를 세션에 저장
passport.serializeUser(function (user, done) {
    console.log("serializeUser ", user)
    done(null, user.id);   
});

// Node.js의 모든 페이지에 접근할때, 로그인이 되어있을 경우
// deserializeUser로 session에 저장된 값을 이용 
passport.deserializeUser(function (id, done) {
    console.log("deserializeUser id ", id)
    var userinfo;
    try {
        mssql.connect(config, function (err) {

            console.log('Connect');
            var request = new mssql.Request();

            var queryString = "SELECT * FROM tALU WHERE id = '" + id + "'";

            request.query(queryString, function (err, result) {
                if (err) console.log(err);

                console.log("deserializeUser mssql result : ", result);
                var json = JSON.stringify(result.recordset[0]);
                userinfo = JSON.parse(json);
                done(null, userinfo);
            })
        });
    }
    catch (err) {
        console.log(err);
    }
});*/

// passport - username & password
passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw'
},
    function (username, password, done) {
        console.log('passport!!');
        try {
            mssql.connect(config, function (err) {

                console.log('Connect');
                var request = new mssql.Request();

                var queryString = "SELECT * FROM tALU WHERE id = '" + username + "' AND pw = '" + password + "'";

                request.query(queryString, function (err, result) {
                    if (err) console.log(err);

                    // 입력받은 ID와 비밀번호에 일치하는 회원정보가 없는 경우   
                    if (result.rowsAffected[0] === 0) {
                        console.log("로그인 실패! 결과 없음");
                        return done(null, false, { message: 'Incorrect' });
                    } else {
                        console.log("로그인 성공! 결과 있음");
                        var json = JSON.stringify(result.recordset[0]);
                        var userinfo = JSON.parse(json);
                        return done(null, userinfo);  // result값으로 받아진 회원정보를 return해줌
                    }
                })
            });
        }
        catch (err) {
            console.log(err);
        }
    }
));

// passport - naver
passport.use(new NaverStrategy({
    clientID: 'jKCn5fyjj_lrGShea38E',
    clientSecret: 'gc3RUBRg5R',
    callbackURL: 'http://192.168.0.134:8087/users/naverlogin/callback'
},
    function (accessToken, refreshToken, profile, done) {
        console.log('passport-naver!!');
        console.log('accessToken : ' + accessToken);
        console.log('refreshToken : ' + refreshToken);
        console.log(profile);

        var user = { 
            name: profile.displayName, 
            email: profile.emails[0].value, 
            username: profile.displayName, 
            provider: profile.provider, 
            naver: profile._json 
        }; 
        
        console.log("user="); 
        console.log(user); 
        
        return done(null, user);
    }
));

// 사용자 회원가입
router.post('/signup', function (req, res, next) {
    try {
        console.log('api/signup!!');
        console.log(req.body.id);
        console.log(req.body.pw);

        var id = req.body.id;
        var pw = req.body.pw;

        mssql.connect(config, function (err) {

            console.log('Connect');
            var request = new mssql.Request();

            var checkId = "SELECT * FROM tALU WHERE id = '" + id + "'";
            var insertData = "INSERT INTO tALU VALUES ('" + id + "', '" + pw + "', 'email');";

            request.query(checkId, function (err, result) {

                if (result.rowsAffected[0] == 0) {

                    // 없는 아이디 -> 회원가입 가능
                    request.query(insertData, function (err, result) {

                        res.json({ data: 'OK' });

                    })
                } else {
                    // 아이디 존재 -> 회원가입 불가능
                    res.json({ data: 'NO' });
                }
            })
        });
    }
    catch (err) {
        console.log(err);
    }
});

// 이메일로그인
router.post('/emaillogin', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) {
            // 로그인실패
            return res.redirect('/login');
        }

        req.logIn(user, { session: false }, function (err) {

            if (err) {
                return next(err);
            } else {
                // 로그인성공
                console.log(req.user);

                // JWT 생성
                var token = jwt.sign({
                    // 내용
                    id: req.user.id,
                    pw: req.user.pw,
                    type: req.user.type
                },
                    // 시크릿키(인증키)
                    secret_key
                    , {
                        // 옵션
                        expiresIn: '365days'
                    });
                console.log("token : ", token);

                // JWT로 쿠키 생성
                res.cookie("user", token, {
                    maxAge: 31536000000 // 1년
                });
                return res.redirect('/welcome');
            }
        });
    })(req, res, next);
});

// 네이버로그인
router.get('/naverlogin', passport.authenticate('naver', {
    failureRedirect: '/login'
}));

router.get('/naverlogin/callback', function (req, res, next) {
    passport.authenticate('naver', function (err, user) {
        console.log('passport.authenticate(naver)실행');
        if (!user) {
            console.log('no user');
            return res.redirect('/login'); 
        }
        req.logIn(user, function (err) {
            console.log('naver/callback user : ', user);
            return res.redirect('/welcome');        
        });
    })(req, res);
});

// 로그아웃
router.post('/logout', function (req, res, next) {
    // 쿠키 삭제
    res.clearCookie('user');
    res.redirect('/login');
});

// JWT값 가져오기
router.get('/getJWT', function (req, res, next) {
    console.log(req.cookies.user);
    if (req.cookies.user == undefined) {
        // 쿠키에 user 없음
        res.json({ data: 'NO' });

    } else {
        // 쿠키에 user 있음
        var decoded = jwt.verify(req.cookies.user, secret_key);
        console.log(decoded);
        var logintype = decoded.type;

        if (logintype == 'email') {
            // 이메일 로그인인경우
            // id, pw 가져와서 db에 있는 사용자인지 확인
            var id = decoded.id;
            var pw = decoded.pw;

            try {
                mssql.connect(config, function (err) {

                    console.log('Connect');
                    var request = new mssql.Request();

                    var checkUser = "SELECT * FROM tALU WHERE id = '" + id + "' AND pw = '" + pw + "'";
                    request.query(checkUser, function (err, result) {

                        if (result.rowsAffected[0] == 0) {
                            // db에 없는 user -> 로그인 불가능
                            res.json({ data: 'INCORRECT' });

                        } else {
                            // user 존재 -> 로그인 가능
                            console.log('자동로그인!');
                            res.json({ data: 'OK' });
                        }
                    })
                });
            }
            catch (err) {
                console.log(err);
            }
        } else {
            // 다른 소셜 로그인 경우
        }
    }
});



/* GET users listing. */
router.get('/', function (req, res, next) {
    res.send('respond with a resource');
});

module.exports = router;
