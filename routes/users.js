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
    , NaverStrategy = require('passport-naver').Strategy
    , KakaoStrategy = require('passport-kakao').Strategy
    , FacebookStrategy = require('passport-facebook').Strategy
    , GoogleStrategy = require('passport-google-oauth20').Strategy;
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

// 사용자 회원가입(이메일가입)
router.post('/signup', function (req, res, next) {
    try {
        console.log('api/signup!!');
        console.log(req.body.name);
        console.log(req.body.id);
        console.log(req.body.pw);

        var name = req.body.name;
        var id = req.body.id;
        var pw = req.body.pw;

        mssql.connect(config, function (err) {

            console.log('Connect');
            var request = new mssql.Request();

            var checkId = "SELECT * FROM tALU WHERE ALU_id = '" + id + "'";
            var insertData = "INSERT INTO tALU VALUES ('" + id + "', '" + pw + "', '" + name + "', 'email');";

            request.query(checkId, function (err, result) {

                if (result.rowsAffected[0] == 0) {

                    // 중복 없음 -> 회원가입 가능
                    request.query(insertData, function (err, result) {

                        res.json({ data: 'OK' });

                    })
                } else {
                    // 중복 있음 -> 회원가입 불가능
                    res.json({ data: 'NO' });
                }
            })
        });
    }
    catch (err) {
        console.log(err);
    }
});

// passport - username & password
passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw'
},
    function (username, password, done) {
        console.log('passport-local!!');
        try {
            mssql.connect(config, function (err) {

                console.log('Connect');
                var request = new mssql.Request();

                var queryString = "SELECT * FROM tALU WHERE ALU_id = '" + username + "' AND ALU_pw = '" + password + "'";

                request.query(queryString, function (err, result) {
                    if (err) console.log(err);

                    // 입력받은 ID와 비밀번호에 일치하는 회원정보가 없는 경우   
                    if (result.rowsAffected[0] === 0) {
                        console.log("로그인 실패!");
                        return done(null, false);
                    } else {
                        console.log("로그인 성공!");
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
                    id: req.user.ALU_id,
                    pw: req.user.ALU_pw,
                    name: req.user.ALU_name,
                    type: req.user.ALU_type
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

// passport - naver
passport.use(new NaverStrategy({
    clientID: 'jKCn5fyjj_lrGShea38E',
    clientSecret: 'gc3RUBRg5R',
    callbackURL: 'http://192.168.0.134:8087/users/naverlogin/callback'
},
    function (accessToken, refreshToken, profile, done) {
        try {
            console.log('passport-naver!!');

            var user = { 
                provider: profile.provider, 
                id: profile.id, 
                name: profile.displayName, 
                email: profile.emails[0].value, 
                profile_image: profile._json.profile_image,
                age: profile._json.age,
                birthday: profile._json.birthday
            }; 
    
            mssql.connect(config, function (err) {
    
                console.log('Connect');
                var request = new mssql.Request();
    
                var checkId = "SELECT * FROM tALU WHERE ALU_id = '" + user.id + "'";
                var insertData = "INSERT INTO tALU VALUES ('" + user.id + "', '', '" + user.name + "', '" + user.provider + "');";
    
                request.query(checkId, function (err, result) {
    
                    if (result.rowsAffected[0] == 0) {
    
                        // 사용자 데이터 없음 -> 회원가입 후 로그인
                        request.query(insertData, function (err, result) {
    
                            console.log('데이터 입력 후 네이버 로그인합니다.');
                            return done(null, user);
                        })
                    } else {
                        // 사용자 데이터 있음 -> 로그인
                        console.log('바로 네이버 로그인합니다.');
                        return done(null, user);
                    }
                })
            });
        }
        catch (err) {
            console.log(err);
        }
    }
));

// 네이버로그인
router.get('/naverlogin', passport.authenticate('naver', {
    failureRedirect: '/login'
}));

// 네이버로그인 콜백
router.get('/naverlogin/callback', function (req, res, next) {
    passport.authenticate('naver', function (err, user) {
        console.log('passport-naver callback!');

        if (!user) {

            console.log('no user');
            return res.redirect('/login'); 

        } else {

            req.logIn(user, function (err) {
                console.log('naver/callback user : ', user);
    
                // JWT 생성
                var token = jwt.sign({
                    // 내용
                    id: user.id,
                    pw: '',
                    name: user.name,
                    type: user.provider
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
            });
        }
    })(req, res);
});

// passport-kakao
passport.use(new KakaoStrategy({
    clientID: 'f4a7066d8d575a30efc4bedb0796989d',
    callbackURL: 'http://192.168.0.134:8087/users/kakaologin/callback',
},
    function (accessToken, refreshToken, profile, done) {
        try {
            console.log('passport-kakao!!');

            var user = {
                provider: profile.provider,
                id: profile.id,
                name: profile.username,
                profile_image: profile._json.kakao_account.profile.profile_image_url,
                email: profile._json.kakao_account.email,
                age: profile._json.kakao_account.age_range,
                birthday: profile._json.kakao_account.birthday,
                birthday_type: profile._json.kakao_account.birthday_type,
                gender: profile._json.kakao_account.gender
            };
    
            mssql.connect(config, function (err) {
    
                console.log('Connect');
                var request = new mssql.Request();
    
                var checkId = "SELECT * FROM tALU WHERE ALU_id = '" + user.id + "'";
                var insertData = "INSERT INTO tALU VALUES ('" + user.id + "', '', '" + user.name + "', '" + user.provider + "');";
    
                request.query(checkId, function (err, result) {
    
                    if (result.rowsAffected[0] == 0) {
    
                        // 사용자 데이터 없음 -> 회원가입 후 로그인
                        request.query(insertData, function (err, result) {
    
                            console.log('데이터 입력 후 카카오 로그인합니다.');
                            return done(null, user);
                        })
                    } else {
                        // 사용자 데이터 있음 -> 로그인
                        console.log('바로 카카오 로그인합니다.');
                        return done(null, user);
                    }
                })
            });
        }
        catch (err) {
            console.log(err);
        }
    }
));

// 카카오로그인
router.get('/kakaologin', passport.authenticate('kakao', {
    failureRedirect: '/login'
}));

// 카카오로그인 콜백
router.get('/kakaologin/callback', function (req, res, next) {
    passport.authenticate('kakao', function (err, user) {
        console.log('passport-kakao callback!');

        if (!user) {

            console.log('no user');
            return res.redirect('/login'); 

        } else {

            req.logIn(user, function (err) {
                console.log('kakao/callback user : ', user);
    
                // JWT 생성
                var token = jwt.sign({
                    // 내용
                    id: user.id,
                    pw: '',
                    name: user.name,
                    type: user.provider
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
            });
        }
    })(req, res);
});

// passport-facebook
passport.use(new FacebookStrategy({
    clientID: '872351713594449',
    clientSecret: '1d63016dd325a43ce7c9a81ab5d8c3a1',
    callbackURL: "https://192.168.0.134:443/users/facebooklogin/callback"
},
    function (accessToken, refreshToken, profile, done) {
        console.log('passport-facebook!!');
        console.log('accessToken : ' + accessToken);
        console.log('refreshToken : ' + refreshToken);
        console.log(profile);

        var user = {
            name: profile.username,
            username: profile.id,
            roles: ['authenticated'],
            provider: 'facebook',
            kakao: profile._json,
        };

        console.log("user=", user);
        return done(null, user);
    }
));

// 페이스북로그인
router.get('/facebooklogin', passport.authenticate('facebook', {
    scope: 'email',
    failureRedirect: '/login'
}));

// 페이스북로그인 콜백
router.get('/facebooklogin/callback', function (req, res, next) {
    passport.authenticate('facebook', function (err, user) {
        console.log('passport-facebook callback!');
        if (!user) {
            console.log('no user');
            return res.redirect('/login'); 
        } else {
            req.logIn(user, function (err) {
                console.log('facebook/callback user : ', user);
    
                /* // JWT 생성
                var token = jwt.sign({
                    // 내용
                    user
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
                }); */
    
                return res.redirect('/welcome');        
            });
        }
    })(req, res);
});

// passport-google
passport.use(new GoogleStrategy({
    clientID: '706426410759-v8mjqnsi67efdprf0qsg6pm78ckjt7ie.apps.googleusercontent.com',
    clientSecret: 'QxHrFf2R2sxV7JPP3hmEf0B_',
    callbackURL: "http://localhost:8087/users/googlelogin/callback"    
},
    function (accessToken, refreshToken, profile, done) {

        try {
            console.log('passport-google!!');

            var user = {
                provider: profile.provider,
                id: profile.id,
                name: profile.displayName,
                profile_image: profile.photos.value,
                locale: profile._json.locale
            };
    
            mssql.connect(config, function (err) {
    
                console.log('Connect');
                var request = new mssql.Request();
    
                var checkId = "SELECT * FROM tALU WHERE ALU_id = '" + user.id + "'";
                var insertData = "INSERT INTO tALU VALUES ('" + user.id + "', '', '" + user.name + "', '" + user.provider + "');";
    
                request.query(checkId, function (err, result) {
    
                    if (result.rowsAffected[0] == 0) {
    
                        // 사용자 데이터 없음 -> 회원가입 후 로그인
                        request.query(insertData, function (err, result) {
    
                            console.log('데이터 입력 후 구글 로그인합니다.');
                            return done(null, user);
                        })
                    } else {
                        // 사용자 데이터 있음 -> 로그인
                        console.log('바로 구글 로그인합니다.');
                        return done(null, user);
                    }
                })
            });
        }
        catch (err) {
            console.log(err);
        }
    }
));

// 구글로그인
router.get('/googlelogin', passport.authenticate('google', {
    scope: ['profile'],
    failureRedirect: '/login'
}));

// 구글로그인 콜백
router.get('/googlelogin/callback', function (req, res, next) {
    passport.authenticate('google', function (err, user) {
        console.log('passport-google callback!');
        if (!user) {
            console.log('no user');
            return res.redirect('/login'); 
        } else {
            req.logIn(user, function (err) {
                console.log('google/callback user : ', user);
    
                // JWT 생성
                var token = jwt.sign({
                    // 내용
                    id: user.id,
                    pw: '',
                    name: user.name,
                    type: user.provider
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
            });
        }
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
    console.log(req);
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

                    var checkUser = "SELECT * FROM tALU WHERE ALU_id = '" + id + "' AND ALU_pw = '" + pw + "'";
                    request.query(checkUser, function (err, result) {

                        if (result.rowsAffected[0] == 0) {
                            // db에 없는 user -> 로그인 불가능
                            res.json({ data: 'INCORRECT' });

                        } else {
                            // user 존재 -> 로그인 가능
                            console.log('user 쿠키 있음!');
                            res.json({ data: 'OK', name: decoded.name});
                        }
                    })
                });
            }
            catch (err) {
                console.log(err);
            }
        } else {
            // 네이버, 카카오, 구글 로그인인경우
            // id 가져와서 db에 있는 사용자인지 확인

            var id = decoded.id;
            var result = getJWTsocial(id);

            if (result == 'INCORRECT') {
                res.json({ data: 'INCORRECT' });
            } else {
                res.json({ data: 'OK', name: decoded.name });
            }

        }
    }
});



/* GET users listing. */
router.get('/', function (req, res, next) {
    res.send('respond with a resource');
});

module.exports = router;

// 소셜로그인 JWT 가져와서 USER 확인
function getJWTsocial(id) {
    console.log('getJWTsocial!!');

    try {
        mssql.connect(config, function (err) {

            console.log('Connect');
            var request = new mssql.Request();

            var checkUser = "SELECT * FROM tALU WHERE ALU_id = '" + id + "'";
            request.query(checkUser, function (err, result) {

                if (result.rowsAffected[0] == 0) {
                    // db에 없는 user -> 로그인 불가능
                    return 'INCORRECT';

                } else {
                    // user 존재 -> 로그인 가능
                    console.log('user 쿠키 있음!');
                    return 'OK';
                }
            })
        });
    }
    catch (err) {
        console.log(err);
    }
}